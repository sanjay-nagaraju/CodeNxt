import IORedis from "ioredis";

let connection: IORedis | null = null;

export function getQueueConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return connection;
}
