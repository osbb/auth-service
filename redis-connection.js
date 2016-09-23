import redis from 'redis';

export function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  return Promise.resolve(redis.createClient(redisUrl));
}
