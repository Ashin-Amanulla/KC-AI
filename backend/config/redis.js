import Redis from 'ioredis';
import { config } from './index.js';

let redis = null;

export const getRedisConnection = () => {
  if (!redis) {
    redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        if (times > 10) {
          console.error('Redis: Max retries reached');
          return null;
        }
        return Math.min(times * 200, 3000);
      },
    });
    redis.on('error', (err) => console.error('Redis connection error:', err));
    redis.on('connect', () => console.log('Redis connected'));
  }
  return redis;
};

export const closeRedis = async () => {
  if (redis) {
    await redis.quit();
    redis = null;
  }
};
