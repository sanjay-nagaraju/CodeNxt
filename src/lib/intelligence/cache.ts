import { redis } from "@/lib/redis";
import type { RepoMap } from "@/lib/agents/state";

const CACHE_TTL = 3600; // 1 hour

function repoMapKey(projectId: string): string {
  return `cache:repoMap:${projectId}`;
}

function symbolsKey(projectId: string): string {
  return `cache:symbols:${projectId}`;
}

export async function getCachedRepoMap(projectId: string): Promise<RepoMap | null> {
  const cached = await redis.get(repoMapKey(projectId));
  return cached ? JSON.parse(cached) : null;
}

export async function setCachedRepoMap(projectId: string, repoMap: RepoMap): Promise<void> {
  await redis.setex(repoMapKey(projectId), CACHE_TTL, JSON.stringify(repoMap));
}

export async function invalidateProjectCache(projectId: string): Promise<void> {
  await redis.del(repoMapKey(projectId));
  await redis.del(symbolsKey(projectId));
}
