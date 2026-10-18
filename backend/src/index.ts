import { initDb } from "./db/client";
import { createApp } from "./app";
import { startScheduler } from "./services/scheduler";

const dbPath = process.env.DB_PATH || "openmi.sqlite";
const port = parseInt(process.env.PORT || "3001", 10);

console.log(`[OpenMi] Initializing database at ${dbPath}...`);
const db = initDb(dbPath);

console.log(`[OpenMi] Starting background scheduler...`);
const scheduler = startScheduler(db);

const app = createApp(db);

app.listen(port, () => {
  console.log(`🚀 OpenMi Backend running at http://localhost:${port}`);
  console.log(`🔒 Master authentication enabled via MASTER_PASSWORD in .env`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[OpenMi] Shutting down gracefully...");
  scheduler.stop();
  db.close();
  process.exit(0);
});
