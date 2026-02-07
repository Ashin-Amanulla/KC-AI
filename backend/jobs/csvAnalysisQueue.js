import { Queue } from 'bullmq';
import { getRedisConnection } from '../config/redis.js';

const CSV_ANALYSIS_QUEUE_NAME = 'csv-analysis';

let queue = null;

export const getCsvAnalysisQueue = () => {
  if (!queue) {
    const connection = getRedisConnection();
    queue = new Queue(CSV_ANALYSIS_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: { count: 100 },
      },
    });
  }
  return queue;
};

export const addCsvAnalysisJob = async (jobData) => {
  const q = getCsvAnalysisQueue();
  const job = await q.add('analyze', jobData, {
    jobId: jobData.jobId,
  });
  return job;
};
