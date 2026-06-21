import { prisma } from "@/lib/db";
import { redis, CHANNELS } from "@/lib/redis";

export interface AgentEvent {
  runId: string;
  agent: string;
  message: string;
  level?: "INFO" | "WARN" | "ERROR" | "DEBUG";
  metadata?: Record<string, unknown>;
}

export async function emitEvent(event: AgentEvent): Promise<void> {
  const { runId, agent, message, level = "INFO", metadata } = event;

  // Persist to database
  const dbEvent = await prisma.event.create({
    data: {
      runId,
      agent,
      message,
      level,
      metadata: metadata ? (metadata as any) : undefined,
    },
  });

  // Publish to Redis for real-time SSE
  const payload = JSON.stringify({
    id: dbEvent.id,
    runId,
    agent,
    message,
    level,
    metadata,
    createdAt: dbEvent.createdAt.toISOString(),
  });

  await redis.publish(CHANNELS.runEvents(runId), payload);
}

export async function emitAgentStart(runId: string, agent: string): Promise<void> {
  await emitEvent({
    runId,
    agent,
    message: `${agent} agent started`,
    level: "INFO",
    metadata: { phase: "start" },
  });
}

export async function emitAgentComplete(
  runId: string,
  agent: string,
  result?: Record<string, unknown>
): Promise<void> {
  await emitEvent({
    runId,
    agent,
    message: `${agent} agent completed`,
    level: "INFO",
    metadata: { phase: "complete", result },
  });
}

export async function emitAgentError(
  runId: string,
  agent: string,
  error: string
): Promise<void> {
  await emitEvent({
    runId,
    agent,
    message: `${agent} agent error: ${error}`,
    level: "ERROR",
    metadata: { phase: "error", error },
  });
}
