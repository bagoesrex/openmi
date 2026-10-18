import { Database } from "bun:sqlite";
import { schemaSql } from "./schema";

export function initDb(dbPath: string = "openmi.sqlite"): Database {
  const db = new Database(dbPath, { create: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(schemaSql);
  return db;
}

export function closeDb(db: Database): void {
  db.close();
}
