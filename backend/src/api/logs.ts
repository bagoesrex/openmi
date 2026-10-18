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
          .get("/api/logs/stream", ({ set }) => {
            set.headers["Content-Type"] = "text/event-stream";
            set.headers["Cache-Control"] = "no-cache";
            set.headers["Connection"] = "keep-alive";

            // Return a readable stream for Server-Sent Events
            return new ReadableStream({
              start(controller) {
                // Send initial keepalive
                controller.enqueue(new TextEncoder().encode(`: connected\n\n`));

                const unsubscribe = logBroadcaster.subscribe((log) => {
                  try {
                    const data = `data: ${JSON.stringify(log)}\n\n`;
                    controller.enqueue(new TextEncoder().encode(data));
                  } catch (err) {
                    unsubscribe();
                  }
                });

                // Periodic ping every 15s to keep connection alive
                const pingInterval = setInterval(() => {
                  try {
                    controller.enqueue(new TextEncoder().encode(`: ping\n\n`));
                  } catch {
                    clearInterval(pingInterval);
                    unsubscribe();
                  }
                }, 15000);
              },
            });
          })
    );
}
