import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setRunSignal, clearRunSignal, type RunSignal } from "@/lib/queue/run-signals";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { action } = body as { action: RunSignal };

  if (!["pause", "resume", "cancel"].includes(action)) {
    return NextResponse.json(
      { error: "Invalid action. Must be pause, resume, or cancel." },
      { status: 400 }
    );
  }

  // Verify run exists and is active
  const run = await prisma.run.findUnique({ where: { id } });
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const terminalStatuses = ["COMPLETED", "FAILED", "CANCELLED"];
  if (terminalStatuses.includes(run.status)) {
    return NextResponse.json(
      { error: `Cannot ${action} a ${run.status.toLowerCase()} run` },
      { status: 400 }
    );
  }

  if (action === "pause") {
    await setRunSignal(id, "pause");
    await prisma.run.update({ where: { id }, data: { status: "PAUSED" } });
    return NextResponse.json({ status: "pause_requested" });
  }

  if (action === "resume") {
    await setRunSignal(id, "resume");
    await prisma.run.update({
      where: { id },
      data: { status: "PENDING" }, // Will be updated to the correct status by the node
    });
    return NextResponse.json({ status: "resume_requested" });
  }

  if (action === "cancel") {
    await setRunSignal(id, "cancel");
    await prisma.run.update({ where: { id }, data: { status: "CANCELLED" } });
    return NextResponse.json({ status: "cancel_requested" });
  }

  return NextResponse.json({ status: "ok" });
}
