import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scanRepository } from "@/lib/intelligence/scanner";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const repoMap = await scanRepository(id, project.path);
    const symbolCount = await prisma.symbol.count({ where: { projectId: id } });

    return NextResponse.json({
      success: true,
      repoMap,
      symbolCount,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      { error: `Scan failed: ${err.message}` },
      { status: 500 }
    );
  }
}
