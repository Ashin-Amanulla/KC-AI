import { getRedisConnection } from '../config/redis.js';

const CACHE_PREFIX = 'app:';
const CACHE_LOG = process.env.CACHE_LOG === 'true';

function logCache(event, key) {
  if (CACHE_LOG) {
    console.log(`[cache] ${event} ${key}`);
  }
}

export async function getOrSet(key, ttlSeconds, fn) {
  const fullKey = CACHE_PREFIX + key;

  try {
    const redis = getRedisConnection();
    const cached = await redis.get(fullKey);
    if (cached !== null) {
      logCache('HIT', key);
      return JSON.parse(cached);
    }
    logCache('MISS', key);
  } catch (err) {
    console.error('Cache get error:', err.message);
  }

  const value = await fn();

  try {
    const redis = getRedisConnection();
    await redis.set(fullKey, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    console.error('Cache set error:', err.message);
  }

  return value;
}

export async function invalidate(keyOrPrefix) {
  try {
    const redis = getRedisConnection();

    if (!keyOrPrefix.includes('*')) {
      await redis.del(CACHE_PREFIX + keyOrPrefix);
      return;
    }

    const pattern = CACHE_PREFIX + keyOrPrefix;
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err) {
    console.error('Cache invalidate error:', err.message);
  }
}
