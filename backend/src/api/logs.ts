import { Elysia } from "elysia";
import { Database } from "bun:sqlite";
import { createLogRepo } from "../db/repository";
import { authPlugin } from "./auth";
import { logBroadcaster } from "../services/broadcaster";

export function createLogsApi(db: Database) {
  const logRepo = createLogRepo(db);

  return new Elysia()
    .use(authPlugin)
    .guard(
      {
        beforeHandle: async ({ verifyAuth }) => {
          await verifyAuth();
        },
      },
      (app) =>
        app
          .get("/api/logs", ({ query }) => {
            const limit = query.limit ? parseInt(query.limit as string, 10) : 100;
            return logRepo.getRecent(limit);
          })
          .get("/api/logs/stream", () => {
            let unsubscribe: (() => void) | null = null;
            let pingInterval: any = null;

            // Return a readable stream for Server-Sent Events
            const stream = new ReadableStream({
              start(controller) {
                // Send initial keepalive
                controller.enqueue(new TextEncoder().encode(`: connected\n\n`));

                unsubscribe = logBroadcaster.subscribe((log) => {
                  try {
                    const data = `data: ${JSON.stringify(log)}\n\n`;
                    controller.enqueue(new TextEncoder().encode(data));
                  } catch {
                    if (unsubscribe) unsubscribe();
                  }
                });

                // Periodic ping every 15s to keep connection alive
                pingInterval = setInterval(() => {
                  try {
                    controller.enqueue(new TextEncoder().encode(`: ping\n\n`));
                  } catch {
                    clearInterval(pingInterval);
                    if (unsubscribe) unsubscribe();
                  }
                }, 15000);
              },
              cancel() {
                if (pingInterval) clearInterval(pingInterval);
                if (unsubscribe) unsubscribe();
              },
            });

            return new Response(stream, {
              headers: {
                "Content-Type": "text/event-stream; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
              },
            });
          })
    );
}
