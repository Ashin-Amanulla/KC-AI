import { Worker } from 'bullmq';
import { getRedisConnection } from '../config/redis.js';
import { analyzeWithProgress } from '../utils/csvAnalyzer.js';

const CSV_ANALYSIS_QUEUE_NAME = 'csv-analysis';

let worker = null;

export const startCsvAnalysisWorker = () => {
  if (worker) return worker;

  const connection = getRedisConnection();
  worker = new Worker(
    CSV_ANALYSIS_QUEUE_NAME,
    async (job) => {
      const { filePath, jobId, userId, fileName } = job.data;
      if (!filePath || !jobId) {
        throw new Error('Missing filePath or jobId in job data');
      }
      await analyzeWithProgress(filePath, jobId, {
        userId,
        fileName,
      });
    },
    {
      connection,
      concurrency: 1,
    }
  );

  worker.on('completed', (job) => {
    console.log(`CSV analysis job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`CSV analysis job ${job?.id} failed:`, err.message);
  });

  console.log('CSV analysis worker started');
  return worker;
};

export const stopCsvAnalysisWorker = async () => {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('CSV analysis worker stopped');
  }
};
