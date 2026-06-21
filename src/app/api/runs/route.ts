import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTaskQueue } from "@/lib/queue/task-queue";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  const where = projectId ? { projectId } : {};

  const runs = await prisma.run.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      project: { select: { name: true, path: true } },
      _count: { select: { events: true } },
    },
  });

  return NextResponse.json(runs);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { projectId, task } = body;

  if (!projectId || !task) {
    return NextResponse.json(
      { error: "projectId and task are required" },
      { status: 400 }
    );
  }

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    );
  }

  // Create run record
  const run = await prisma.run.create({
    data: {
      projectId,
      task,
      status: "PENDING",
    },
  });

  // Enqueue to BullMQ
  const queue = getTaskQueue();
  await queue.add("process-task", {
    runId: run.id,
    projectId,
    projectPath: project.path,
    task,
  });

  return NextResponse.json(run, { status: 201 });
}
