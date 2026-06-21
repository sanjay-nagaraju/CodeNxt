import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import Redis from "ioredis";
import { CHANNELS } from "@/lib/redis";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: runId } = await params;

  // Verify run exists
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) {
    return new Response("Run not found", { status: 404 });
  }

  // Create SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Create a dedicated subscriber connection
      const subscriber = new Redis(
        process.env.REDIS_URL || "redis://localhost:6379"
      );

      const channel = CHANNELS.runEvents(runId);

      subscriber.subscribe(channel, (err) => {
        if (err) {
          console.error("Failed to subscribe:", err);
          controller.close();
          return;
        }
      });

      subscriber.on("message", (_ch: string, message: string) => {
        const data = `data: ${message}\n\n`;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          // Stream closed
          subscriber.unsubscribe(channel);
          subscriber.quit();
        }
      });

      // Send initial connection event
      const connectMsg = JSON.stringify({
        type: "connected",
        runId,
        status: run.status,
      });
      controller.enqueue(encoder.encode(`data: ${connectMsg}\n\n`));

      // Clean up on close
      _request.signal.addEventListener("abort", () => {
        subscriber.unsubscribe(channel);
        subscriber.quit();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
