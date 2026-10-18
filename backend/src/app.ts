import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { Database } from "bun:sqlite";
import { authPlugin } from "./api/auth";
import { createAccountsApi } from "./api/accounts";
import { createLogsApi } from "./api/logs";

export function createApp(db: Database) {
  const corsOriginEnv = process.env.CORS_ORIGIN;
  let corsOrigin: any = true;
  if (corsOriginEnv && corsOriginEnv !== "*") {
    corsOrigin = corsOriginEnv.includes(",")
      ? corsOriginEnv.split(",").map((s) => s.trim())
      : corsOriginEnv.trim();
  }

  return new Elysia()
    .use(
      cors({
        origin: corsOrigin, // Reflect incoming origin by default or restrict to configured domains
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
      })
    )
    .onError(({ code, error, set }) => {
      console.error(`[OpenMi Error] code=${code}:`, error);

      if (code === "VALIDATION") {
        set.status = 400;
        return {
          error: "Validation failed",
          details: error.message,
        };
      }

      if (code === "NOT_FOUND") {
        set.status = 404;
        return { error: "Route not found" };
      }

      // Check for auth errors
      if (error.message?.includes("token") || error.message?.includes("authentication")) {
        set.status = 401;
        return { error: error.message };
      }

      set.status = 500;
      return {
        error: "Internal server error",
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
      };
    })
    .get("/api/health", () => ({ status: "ok", timestamp: Date.now() }))
    .use(authPlugin)
    .use(createAccountsApi(db))
    .use(createLogsApi(db));
}
