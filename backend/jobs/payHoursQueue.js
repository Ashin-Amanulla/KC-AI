import { Queue } from 'bullmq';
import { getRedisConnection } from '../config/redis.js';

const PAY_HOURS_QUEUE_NAME = 'pay-hours';

let queue = null;

export const getPayHoursQueue = () => {
  if (!queue) {
    const connection = getRedisConnection();
    queue = new Queue(PAY_HOURS_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: { count: 50 },
      },
    });
  }
  return queue;
};

export const addPayHoursJob = async (jobData) => {
  const q = getPayHoursQueue();
  const job = await q.add('compute', jobData, {
    jobId: jobData.jobId,
  });
  return job;
};
