import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
  redisSub: Redis | undefined;
};

function createRedisClient(): Redis {
  const client = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 3) return null; // Stop retrying after 3 attempts
      return Math.min(times * 200, 2000);
    },
  });

  // Suppress unhandled error events during build
  client.on("error", () => {
    // Silently ignore connection errors (expected when Redis isn't running)
  });

  return client;
}

export function getRedis(): Redis {
  if (!globalForRedis.redis) {
    globalForRedis.redis = createRedisClient();
  }
  return globalForRedis.redis;
}

export function getRedisSub(): Redis {
  if (!globalForRedis.redisSub) {
    globalForRedis.redisSub = createRedisClient();
  }
  return globalForRedis.redisSub;
}

// Lazy proxies for backward compat
export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    const client = getRedis();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export const redisSub = new Proxy({} as Redis, {
  get(_target, prop) {
    const client = getRedisSub();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export const CHANNELS = {
  runEvents: (runId: string) => `run:${runId}:events`,
} as const;
