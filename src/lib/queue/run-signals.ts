import IORedis from "ioredis";

export type RunSignal = "pause" | "cancel" | "resume";

let signalRedis: IORedis | null = null;

function getSignalRedis(): IORedis {
  if (!signalRedis) {
    signalRedis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return signalRedis;
}

function signalKey(runId: string): string {
  return `run:${runId}:signal`;
}

export async function setRunSignal(runId: string, signal: RunSignal): Promise<void> {
  const redis = getSignalRedis();
  await redis.set(signalKey(runId), signal, "EX", 3600); // 1 hour TTL
}

export async function getRunSignal(runId: string): Promise<RunSignal | null> {
  const redis = getSignalRedis();
  const val = await redis.get(signalKey(runId));
  return val as RunSignal | null;
}

export async function clearRunSignal(runId: string): Promise<void> {
  const redis = getSignalRedis();
  await redis.del(signalKey(runId));
}
