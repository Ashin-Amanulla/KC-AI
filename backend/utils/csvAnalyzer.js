import fs from 'fs';
import crypto from 'crypto';
import csv from 'csv-parser';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { config } from '../config/index.js';
import { CsvAnalysisCache } from '../modules/csv-analysis/csvAnalysisCache.model.js';
import { CsvAnalysisReport } from '../modules/csv-analysis/csvAnalysisReport.model.js';
import { CsvAnalysisJob } from '../modules/csv-analysis/csvAnalysisJob.model.js';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PROMPT_VERSION = 'v1';
const BATCH_SIZE = 10;

/**
 * Normalize row for hashing: sort keys, exclude internal _id
 */
function normalizeRowForHash(row) {
  const { _id, ...rest } = row;
  const keys = Object.keys(rest).sort();
  const obj = {};
  keys.forEach((k) => {
    const v = rest[k];
    obj[k] = v === undefined || v === null ? '' : String(v).trim();
  });
  return obj;
}

/**
 * Compute SHA-256 hash of normalized row content for cache key
 */
function computeRowHash(row) {
  const normalized = normalizeRowForHash(row);
  const str = JSON.stringify(normalized);
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Strip empty/null/undefined fields from row to reduce token usage
 */
function trimRowForInput(row) {
  const { _id, ...rest } = row;
  const trimmed = {};
  Object.keys(rest).forEach((k) => {
    const v = rest[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      trimmed[k] = rest[k];
    }
  });
  return { id: _id, ...trimmed };
}

const SYSTEM_PROMPT =
  'You are a specialized data analysis assistant. Output strict JSON.';

const USER_PROMPT_TEMPLATE = (batchData) => `
You are an assistant responsible for analyzing post-shift care reports written by staff.
Your task is to read structured shift data along with free-text shift notes and produce a clear, factual exception analysis.

Input:
You will receive a JSON list of shifts. Each shift contains relevant fields like Date, Client, Staff, Scheduled/Actual times, and Notes.

For EACH shift, perform the following verification and extraction:

1. **Shift Summary**: Produce a concise, professional 2–3 line summary of what occurred during the shift. Use only information explicitly present. Do not infer or assume.

2. **Exception Detection**:
   - **Early Leave**: Check if Actual End Time is earlier than Scheduled End Time. Extract the reason exactly as written in the notes, if mentioned.
   - **Overtime**: Check if Actual End Time is later than Scheduled End Time. Capture duration if possible.
   - **Staff Change**: Any indication of staff replacement, handover, or client-requested change. Capture the stated reason, if available.

3. **Night Stay / Sleepover Detection**:
   - Detect if this is a night shift, sleepover, or overnight shift.
   - Look for patterns like: "10pm-6am", "sleepover", "overnight", "night shift", "10:00 pm - 06:00 am", "22:00-06:00".
   - Set "occurred": true if night stay pattern is detected, false otherwise.
   - Extract shift duration if mentioned.

4. **Special Requests Detection**:
   - Identify any special requests from clients, families, or care plans.
   - Look for: dietary preferences, activity requests, family requests, appointment scheduling, shopping requests, preferences.
   - Extract the exact text of the request.
   - Set "occurred": true if any special request is mentioned, false otherwise.

5. **Incident Detection**:
   - Identify incidents reported in the notes (Category field may say "Incident").
   - Categorize severity: "low" (minor issues), "medium" (requires attention), "high" (serious concerns, injuries, medical emergencies).
   - Extract incident description exactly as written.
   - Set "occurred": true if incident is present, false otherwise.

6. **Behaviour Alerts**:
   - Detect behavioural concerns: aggression, self-harm, restraints used, challenging behaviour, heightened behaviour.
   - Look for keywords: "aggressive", "self-harm", "restraint", "RP", "behaviour", "incident", "challenging", "heightened".
   - Extract the exact description of the behaviour.
   - Set "occurred": true if behaviour alert is present, false otherwise.

7. **Medication Concerns**:
   - Detect medication-related issues: refused medication, missed doses, medication reactions, administration errors.
   - Look for: "refused", "missed", "not administered", "medication", "reaction", "error".
   - Extract the exact description of the concern.
   - Set "occurred": true if medication concern is present, false otherwise.

8. **Expense Extraction**:
   - Extract Expense type (e.g., taxi, meal, parking, shopping, groceries), Amount, Currency (assume AUD if not stated).
   - Indicate if the note implies a reimbursement claim.
   - Only include expenses explicitly mentioned.

9. **Reimbursement Claims**:
   - Flag reimbursement if the notes include terms such as: "reimburse", "claim", "refund", "to be paid back".
   - Do not assume reimbursement unless clearly stated.

10. **Reason Capture**:
   - For every exception, capture the exact wording of the reason from the shift notes. Do not paraphrase reasons.
   - If no reason is mentioned, return null.

11. **Lazy Note**:
   - Flag if the staff member hasn't put effort into note making (e.g. extremely short, generic, or empty).

Input JSON:
${JSON.stringify(batchData)}

Output Rules:
- Be factual and conservative.
- Never guess intent.
- Never invent values.
- Prefer false negatives over false positives.
- Accuracy is more important than completeness.

Output Requirements:
Return a JSON Object where keys are the shift IDs (from input 'id' field) and values adhere to this schema:
{
  "staff_name": "string",
  "shift_summary": "string",
  "exceptions": {
    "early_leave": { "occurred": boolean, "reason": "string (exact text) or null", "duration": "string or null" },
    "overtime": { "occurred": boolean, "duration": "string or null" },
    "staff_change": { "occurred": boolean, "reason": "string or null" },
    "night_stay": { "occurred": boolean, "duration": "string or null" },
    "special_request": { "occurred": boolean, "description": "string or null" },
    "incident": { "occurred": boolean, "severity": "low|medium|high|null", "description": "string or null" },
    "behaviour_alert": { "occurred": boolean, "description": "string or null" },
    "medication_concern": { "occurred": boolean, "description": "string or null" }
  },
  "expenses": [
    { "type": "string", "amount": number, "currency": "string", "is_reimbursement": boolean }
  ],
  "reimbursement_claim_explicit": boolean,
  "lazy_note": boolean
}
IMPORTANT: Return STRICT JSON only.
`;

/**
 * Analyze CSV file with row-level caching. Options: { userId, fileName } for report audit.
 */
export const analyzeCsv = async (filePath, options = {}) => {
  return new Promise((resolve, reject) => {
    const rows = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        data._id = Math.random().toString(36).substr(2, 9);
        rows.push(data);
      })
      .on('error', (err) => reject(err))
      .on('end', async () => {
        try {
          console.log(
            `Parsed ${rows.length} rows from ${filePath}. Checking cache...`
          );

          const modelVersion = config.openai?.model || 'gpt-4o';

          for (let i = 0; i < rows.length; i++) {
            rows[i]._rowHash = computeRowHash(rows[i]);
          }

          const hashes = rows.map((r) => r._rowHash);
          const cacheEntries = await CsvAnalysisCache.find({
            rowHash: { $in: hashes },
            promptVersion: PROMPT_VERSION,
            modelVersion,
          })
            .lean()
            .exec();

          const cacheByHash = new Map(
            cacheEntries.map((e) => [e.rowHash, e.analysisResult])
          );

          const cachedRows = [];
          const uncachedRows = [];
          rows.forEach((row) => {
            const cached = cacheByHash.get(row._rowHash);
            if (cached) {
              cachedRows.push({ row, analysis_result: cached });
            } else {
              uncachedRows.push(row);
            }
          });

          console.log(
            `Cache: ${cachedRows.length} hits, ${uncachedRows.length} to analyze via OpenAI`
          );

          const results = [...cachedRows];
          const newCacheEntries = [];

          for (let i = 0; i < uncachedRows.length; i += BATCH_SIZE) {
            const batch = uncachedRows.slice(i, i + BATCH_SIZE);
            console.log(
              `Processing batch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(uncachedRows.length / BATCH_SIZE)}...`
            );

            const batchData = batch.map((r) => trimRowForInput(r));
            const prompt = USER_PROMPT_TEMPLATE(batchData);

            try {
              const completion = await openai.chat.completions.create({
                messages: [
                  { role: 'system', content: SYSTEM_PROMPT },
                  { role: 'user', content: prompt },
                ],
                model: modelVersion,
                response_format: { type: 'json_object' },
              });

              let analysisMap = {};
              try {
                analysisMap = JSON.parse(
                  completion.choices[0].message.content
                );
              } catch (parseError) {
                console.error(
                  'Failed to parse OpenAI response:',
                  completion.choices[0].message.content
                );
                throw parseError;
              }

              batch.forEach((row) => {
                const analysis = analysisMap[row._id];
                const analysisResult = analysis || {
                  error: 'Analysis missing for this row',
                };
                results.push({ row, analysis_result: analysisResult });

                if (analysis && !analysis.error) {
                  newCacheEntries.push({
                    rowHash: row._rowHash,
                    analysisResult,
                    modelVersion,
                    promptVersion: PROMPT_VERSION,
                  });
                }
              });
            } catch (error) {
              console.error(
                `Error processing batch starting at index ${i}:`,
                error
              );
              batch.forEach((row) => {
                results.push({
                  row,
                  analysis_result: { error: 'Batch processing failed' },
                });
              });
            }
          }

          if (newCacheEntries.length > 0) {
            await CsvAnalysisCache.insertMany(newCacheEntries);
            console.log(`Cached ${newCacheEntries.length} new row analyses`);
          }

          const orderedResults = rows.map((row) => {
            const found = results.find((r) => r.row._id === row._id);
            return {
              ...row,
              analysis_result: found ? found.analysis_result : { error: 'Missing' },
            };
          });

          if (options.userId !== undefined || options.fileName) {
            await CsvAnalysisReport.create({
              uploadedBy: options.userId || null,
              fileName: options.fileName || null,
              totalRows: rows.length,
              cachedRows: cachedRows.length,
              freshRows: uncachedRows.length,
              tokensUsed: null,
              results: orderedResults,
            });
          }

          const output = orderedResults.map((item) => {
            const { _rowHash, ...rest } = item;
            return rest;
          });
          resolve(output);
        } catch (error) {
          reject(error);
        }
      });
  });
};

const SECONDS_PER_BATCH = 3;
const SECONDS_PER_CACHED_BATCH = 0.1;

/**
 * Quick stream to count rows in CSV for initial time estimate
 */
export const countCsvRows = (filePath) => {
  return new Promise((resolve, reject) => {
    let count = 0;
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', () => {
        count++;
      })
      .on('error', reject)
      .on('end', () => resolve(count));
  });
};

/**
 * Analyze CSV with progress updates for a job. Updates job document in MongoDB.
 */
export const analyzeWithProgress = async (filePath, jobId, options = {}) => {
  const job = await CsvAnalysisJob.findById(jobId);
  if (!job || job.status !== 'pending') {
    return;
  }

  await CsvAnalysisJob.findByIdAndUpdate(jobId, {
    status: 'processing',
    startedAt: new Date(),
  });

  return new Promise((resolve, reject) => {
    const rows = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        data._id = Math.random().toString(36).substr(2, 9);
        rows.push(data);
      })
      .on('error', (err) => reject(err))
      .on('end', async () => {
        const filePathForCleanup = filePath;
        try {
          const modelVersion = config.openai?.model || 'gpt-4o';

          for (let i = 0; i < rows.length; i++) {
            rows[i]._rowHash = computeRowHash(rows[i]);
          }

          const hashes = rows.map((r) => r._rowHash);
          const cacheEntries = await CsvAnalysisCache.find({
            rowHash: { $in: hashes },
            promptVersion: PROMPT_VERSION,
            modelVersion,
          })
            .lean()
            .exec();

          const cacheByHash = new Map(
            cacheEntries.map((e) => [e.rowHash, e.analysisResult])
          );

          const cachedRows = [];
          const uncachedRows = [];
          rows.forEach((row) => {
            const cached = cacheByHash.get(row._rowHash);
            if (cached) {
              cachedRows.push({ row, analysis_result: cached });
            } else {
              uncachedRows.push(row);
            }
          });

          const totalToProcess = rows.length;
          const uncachedCount = uncachedRows.length;
          const batchCount = Math.ceil(uncachedCount / BATCH_SIZE);

          const results = [...cachedRows];
          const newCacheEntries = [];
          const batchStartTime = Date.now();

          for (let i = 0; i < uncachedRows.length; i += BATCH_SIZE) {
            const batch = uncachedRows.slice(i, i + BATCH_SIZE);
            const batchIndex = Math.floor(i / BATCH_SIZE);

            const batchData = batch.map((r) => trimRowForInput(r));
            const prompt = USER_PROMPT_TEMPLATE(batchData);

            try {
              const completion = await openai.chat.completions.create({
                messages: [
                  { role: 'system', content: SYSTEM_PROMPT },
                  { role: 'user', content: prompt },
                ],
                model: modelVersion,
                response_format: { type: 'json_object' },
              });

              let analysisMap = {};
              try {
                analysisMap = JSON.parse(
                  completion.choices[0].message.content
                );
              } catch (parseError) {
                throw parseError;
              }

              batch.forEach((row) => {
                const analysis = analysisMap[row._id];
                const analysisResult = analysis || {
                  error: 'Analysis missing for this row',
                };
                results.push({ row, analysis_result: analysisResult });

                if (analysis && !analysis.error) {
                  newCacheEntries.push({
                    rowHash: row._rowHash,
                    analysisResult,
                    modelVersion,
                    promptVersion: PROMPT_VERSION,
                  });
                }
              });
            } catch (error) {
              console.error(`Error processing batch at index ${i}:`, error);
              batch.forEach((row) => {
                results.push({
                  row,
                  analysis_result: { error: 'Batch processing failed' },
                });
              });
            }

            const processedRows = results.length;
            const progress = Math.round((processedRows / totalToProcess) * 100);
            const batchesDone = batchIndex + 1;
            const elapsedMs = Date.now() - batchStartTime;
            const msPerBatch = elapsedMs / batchesDone;
            const remainingBatches = batchCount - batchesDone;
            const estimatedSecondsRemaining = Math.ceil(
              (remainingBatches * msPerBatch) / 1000
            );

            await CsvAnalysisJob.findByIdAndUpdate(jobId, {
              progress,
              processedRows,
              estimatedSeconds: Math.max(0, estimatedSecondsRemaining),
            });
          }

          if (newCacheEntries.length > 0) {
            await CsvAnalysisCache.insertMany(newCacheEntries);
          }

          const orderedResults = rows.map((row) => {
            const found = results.find((r) => r.row._id === row._id);
            return {
              ...row,
              analysis_result: found ? found.analysis_result : { error: 'Missing' },
            };
          });

          const output = orderedResults.map((item) => {
            const { _rowHash, ...rest } = item;
            return rest;
          });

          if (options.userId !== undefined || options.fileName) {
            await CsvAnalysisReport.create({
              uploadedBy: options.userId || null,
              fileName: options.fileName || null,
              totalRows: rows.length,
              cachedRows: cachedRows.length,
              freshRows: uncachedRows.length,
              tokensUsed: null,
              results: orderedResults,
            });
          }

          await CsvAnalysisJob.findByIdAndUpdate(jobId, {
            status: 'completed',
            progress: 100,
            processedRows: totalToProcess,
            estimatedSeconds: 0,
            results: output,
            completedAt: new Date(),
          });

          resolve(output);
        } catch (error) {
          await CsvAnalysisJob.findByIdAndUpdate(jobId, {
            status: 'failed',
            error: error.message,
            completedAt: new Date(),
          });
          reject(error);
        } finally {
          if (filePathForCleanup && fs.existsSync(filePathForCleanup)) {
            try {
              fs.unlinkSync(filePathForCleanup);
            } catch (deleteError) {
              console.error('Failed to delete uploaded file:', deleteError);
            }
          }
        }
      });
  });
};
