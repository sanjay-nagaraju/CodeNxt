import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { createWorkflowGraph } from "./lib/workflow/graph";
import { emitEvent } from "./lib/workflow/event-emitter";
import type { TaskJobData } from "./lib/queue/task-queue";

// ─── Direct imports for worker (can't use path aliases in standalone) ──

const prisma = new PrismaClient();

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

async function processTask(job: Job<TaskJobData>): Promise<void> {
  const { runId, projectId, projectPath, task } = job.data;

  console.log(`[Worker] Processing task: "${task}" (run: ${runId})`);

  try {
    // Update run status
    await prisma.run.update({
      where: { id: runId },
      data: { status: "PENDING", startedAt: new Date() },
    });

    // Create and run the workflow
    const workflow = createWorkflowGraph();

    await workflow.invoke({
      task,
      projectId,
      projectPath,
      runId,
      branchName: "",
      maxRetries: 3,
    });

    console.log(`[Worker] Task completed: "${task}" (run: ${runId})`);
  } catch (error: unknown) {
    const err = error as { message?: string; name?: string };
    
    if (err.name === "CancelledError") {
      console.log(`[Worker] Task cancelled: (run: ${runId})`);
      return;
    }

    console.error(`[Worker] Task failed: ${err.message}`);

    try {
      await emitEvent({
        runId,
        agent: "System",
        message: `Workflow crashed: ${err.message || "Unknown error"}`,
        level: "ERROR",
      });
    } catch (e) {
      console.error("[Worker] Failed to emit error event:", e);
    }

    await prisma.run.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        error: err.message || "Unknown error",
        completedAt: new Date(),
      },
    });
  }
}

// ─── Start Worker ──────────────────────────────────────────────────

const worker = new Worker<TaskJobData>("codenxt-tasks", processTask, {
  connection: connection as any,
  concurrency: 1, // Process one task at a time
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
});

worker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`[Worker] Job ${job?.id} failed:`, error.message);
});

worker.on("ready", () => {
  console.log("[Worker] Ready and waiting for tasks...");
});

console.log("[Worker] CodeNXT worker starting...");

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[Worker] Shutting down...");
  await worker.close();
  await prisma.$disconnect();
  await connection.quit();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[Worker] Shutting down...");
  await worker.close();
  await prisma.$disconnect();
  await connection.quit();
  process.exit(0);
});
