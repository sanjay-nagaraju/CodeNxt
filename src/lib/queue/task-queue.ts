import { Queue } from "bullmq";
import { getQueueConnection } from "./connection";

export interface TaskJobData {
  runId: string;
  projectId: string;
  projectPath: string;
  task: string;
}

let taskQueue: Queue<TaskJobData> | null = null;

export function getTaskQueue(): Queue<TaskJobData> {
  if (!taskQueue) {
    taskQueue = new Queue<TaskJobData>("codenxt-tasks", {
      connection: getQueueConnection(),
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
        attempts: 1,
      },
    });
  }
  return taskQueue;
}
