import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

/**
 * Process-wide singleton DB handle. better-sqlite3 is synchronous and
 * inexpensive to open, but we don't want to re-open it on every import in
 * dev mode (where modules can be evaluated repeatedly).
 */
declare global {
  // eslint-disable-next-line no-var
  var __mikulaDb: ReturnType<typeof createDb> | undefined;
}

function createDb() {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const sqlite = new Database(path.join(dataDir, "mikula.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export const db = globalThis.__mikulaDb ?? createDb();
if (process.env.NODE_ENV !== "production") {
  globalThis.__mikulaDb = db;
}

export { schema };
