import { createClient } from 'redis';

let redis: ReturnType<typeof createClient> | null = null;

export function getRedisClient() {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      console.warn('REDIS_URL not configured, caching disabled');
      return null;
    }

    redis = createClient({
      url: redisUrl,
    });

    redis.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redis.on('connect', () => {
      console.log('Redis Client Connected');
    });
  }

  return redis;
}

export async function ensureRedisConnected() {
  const client = getRedisClient();
  if (!client) return null;

  if (!client.isOpen) {
    await client.connect();
  }
  return client;
}

// Cache utilities with fallback to memory cache
const memoryCache = new Map<string, { data: any; expires: number }>();

export async function getCached(key: string): Promise<any | null> {
  try {
    const client = await ensureRedisConnected();
    if (client) {
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    }
  } catch (error) {
    console.warn('Redis get failed, falling back to memory cache:', error);
  }

  // Fallback to memory cache
  const cached = memoryCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  if (cached) {
    memoryCache.delete(key);
  }
  return null;
}

export async function setCached(key: string, data: any, ttlSeconds = 300): Promise<void> {
  try {
    const client = await ensureRedisConnected();
    if (client) {
      await client.setEx(key, ttlSeconds, JSON.stringify(data));
      return;
    }
  } catch (error) {
    console.warn('Redis set failed, falling back to memory cache:', error);
  }

  // Fallback to memory cache
  memoryCache.set(key, {
    data,
    expires: Date.now() + ttlSeconds * 1000,
  });
}

export async function deleteCached(key: string): Promise<void> {
  try {
    const client = await ensureRedisConnected();
    if (client) {
      await client.del(key);
    }
  } catch (error) {
    console.warn('Redis delete failed:', error);
  }

  // Also clear from memory cache
  memoryCache.delete(key);
}