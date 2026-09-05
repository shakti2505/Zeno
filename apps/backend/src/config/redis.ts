import Redis, { RedisOptions } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    // Exponential backoff with a cap of 3s for reconnection attempts
    const delay = Math.min(times * 200, 3000);
    return delay;
  },
};

export const redisConnection = new Redis(REDIS_URL, redisOptions);

redisConnection.on('connect', () => {
  console.log(`🔌 Connecting to Redis at ${REDIS_URL}...`);
});

redisConnection.on('ready', () => {
  console.log('⚡ Redis connection established and ready for BullMQ.');
});

redisConnection.on('error', (err: Error) => {
  console.error('❌ Redis Connection Error:', err.message);
});

export default redisConnection;
