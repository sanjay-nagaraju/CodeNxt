import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { runs: true, symbols: true },
      },
    },
  });

  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, path: projectPath, defaultBranch } = body;

  if (!name || !projectPath) {
    return NextResponse.json(
      { error: "name and path are required" },
      { status: 400 }
    );
  }

  // Upsert — if project path already exists, return existing
  const project = await prisma.project.upsert({
    where: { path: projectPath },
    update: { name, defaultBranch: defaultBranch || "main" },
    create: { name, path: projectPath, defaultBranch: defaultBranch || "main" },
  });

  return NextResponse.json(project, { status: 201 });
}
