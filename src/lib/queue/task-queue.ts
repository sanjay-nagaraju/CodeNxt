import { Queue } from "bullmq";
import { getQueueConnection } from "./connection";

export interface TaskJobData {
  runId: string;
  projectId: string;
  projectPath: string;
  task: string;
}

let taskQueue: any = null;

export function getTaskQueue(): any {
  if (!taskQueue) {
    taskQueue = new Queue("codenxt-tasks", {
      connection: getQueueConnection() as any,
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
        attempts: 1,
      },
    });
  }
  return taskQueue;
}
