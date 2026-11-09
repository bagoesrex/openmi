import { Database } from "bun:sqlite";
import { schemaSql } from "./schema";

export function migrateSchema(db: Database): void {
  try {
    const columns = db.prepare("PRAGMA table_info(accounts)").all() as { name: string }[];
    const colNames = new Set(columns.map((c) => c.name));
    if (!colNames.has("timing_mode")) {
      db.exec("ALTER TABLE accounts ADD COLUMN timing_mode TEXT DEFAULT 'asia';");
    }
    if (!colNames.has("custom_timings")) {
      db.exec("ALTER TABLE accounts ADD COLUMN custom_timings TEXT;");
    }
  } catch {}
}

export function initDb(dbPath: string = "openmi.sqlite"): Database {
  const db = new Database(dbPath, { create: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(schemaSql);
  migrateSchema(db);
  return db;
}

export function closeDb(db: Database): void {
  db.close();
}
