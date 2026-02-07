
import fs from 'fs';
import csv from 'csv-parser';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const CSV_FILE_PATH = 'EventsDetail_Report_Export_1768249544.csv';
const OUTPUT_FILE_PATH = 'Shift_Report_Summary.md';

const results = [];

// Helper to sanitize text
const cleanText = (text) => text?.replace(/\n/g, ' ').trim() || '';

console.log(`Reading CSV file: ${CSV_FILE_PATH}...`);

fs.createReadStream(CSV_FILE_PATH)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
        console.log(`Parsed ${results.length} rows.`);

        // Group by Client
        const clients = {};
        results.forEach(row => {
            const clientName = row['Client'] || 'Unknown Client';
            if (!clients[clientName]) {
                clients[clientName] = [];
            }
            clients[clientName].push(row);
        });

        let fullReport = `# Shift Detail Report Summary\n\nGenerated on: ${new Date().toLocaleString()}\n\n`;

        for (const [clientName, rows] of Object.entries(clients)) {
            console.log(`Processing client: ${clientName} (${rows.length} entries)...`);

            // Prepare context for LLM
            const shiftData = rows.map(r => `
Date: ${r['Created at']}
Category: ${r['Category']}
Summary: ${r['Summary']}
Message: ${cleanText(r['Message'])}
--------------------------------------------------
`).join('\n');

            const prompt = `
You are an expert care coordinator assistant. Analyze the following shift notes for the client "${clientName}" and provide a structured summary.

**Specific Requirements:**
1.  **Shift Summary**: A concise overview of how the shifts went, noting general well-being and major activities.
2.  **Incidents & Reports**: Highlight any incidents, behavioral reports, or medical concerns (seizures, injuries, etc.).
3.  **Expenses**: Extract any mentions of expenses, money spent, or purchases (e.g., shopping, groceries, activities).
4.  **Staff & Handover**:
    *   Note staff changeover times if explicitly mentioned.
    *   Any specific handover issues or notes.
    *   **Early Leave / Reimbursement**: specifically look for reasons for early leave or reimbursement claims.
5.  **Exceptions**: Any irregular shift notes or variations from the norm.

**Input Data:**
${shiftData}

**Output Format:**
Return the response in Markdown format. Use bullet points. If a category has no information, state "None found".
`;

            try {
                const completion = await openai.chat.completions.create({
                    messages: [{ role: "system", content: "You are a helpful assistant analyzing shift reports." }, { role: "user", content: prompt }],
                    model: "gpt-4o",
                });

                const analysis = completion.choices[0].message.content;

                fullReport += `## Client: ${clientName}\n\n${analysis}\n\n---\n\n`;

            } catch (error) {
                console.error(`Error processing client ${clientName}:`, error);
                fullReport += `## Client: ${clientName}\n\n*Error processing data for this client.*\n\n---\n\n`;
            }
        }

        fs.writeFileSync(OUTPUT_FILE_PATH, fullReport);
        console.log(`Report generated successfully: ${OUTPUT_FILE_PATH}`);
    });
