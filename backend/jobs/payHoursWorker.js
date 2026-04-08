import { Worker } from 'bullmq';
import { getRedisConnection } from '../config/redis.js';
import { computeAllPayHours } from '../modules/pay-hours/services/payHoursOrchestrator.js';

const PAY_HOURS_QUEUE_NAME = 'pay-hours';

let worker = null;

export const startPayHoursWorker = () => {
  if (worker) return worker;

  const connection = getRedisConnection();
  worker = new Worker(
    PAY_HOURS_QUEUE_NAME,
    async (job) => {
      const { jobId } = job.data;
      if (!jobId) throw new Error('Missing jobId in job data');
      await computeAllPayHours(jobId);
    },
    {
      connection,
      concurrency: 1, // important: prevent concurrent full-replace races
    }
  );

  worker.on('completed', (job) => {
    console.log(`Pay hours job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Pay hours job ${job?.id} failed:`, err.message);
  });

  console.log('Pay hours worker started');
  return worker;
};

export const stopPayHoursWorker = async () => {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('Pay hours worker stopped');
  }
};
