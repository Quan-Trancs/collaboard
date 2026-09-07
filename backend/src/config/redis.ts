import Redis from 'ioredis';

let redis: Redis | null = null;

export const getRedis = (): Redis => {
  if (!redis) {
    throw new Error('Redis is not connected');
  }
  return redis;
};

export const connectRedis = async (): Promise<Redis> => {
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  const client = new Redis(url, {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
  });

  try {
    await client.connect();
    await client.ping();
    redis = client;
    console.log('Redis connected');
    return client;
  } catch (error) {
    const err = error as Error;
    console.error('Redis connection failed:', err.message);
    process.exit(1);
  }
};

export const isRedisReady = (): boolean => redis?.status === 'ready';

export const createRedisClient = (): Redis => {
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  return new Redis(url, { maxRetriesPerRequest: 2 });
};
