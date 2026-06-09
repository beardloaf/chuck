#!/usr/bin/env node
// One-time data load: copy the local SQLite content (data/mikula.db) into a
// hosted Turso database, so the Vercel deployment has the existing memories.
//
// Prereqs:
//   1. Create a Turso DB and get its URL + auth token.
//   2. Create the schema there:  TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run db:push
//   3. Load the data (this script):
//        TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/migrate-to-turso.mjs
//
// Re-runnable: rows are upserted by primary key (INSERT OR REPLACE).

import Database from "better-sqlite3";
import { createClient } from "@libsql/client";
import path from "node:path";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN first.");
  process.exit(1);
}

const local = new Database(path.join(process.cwd(), "data", "mikula.db"), {
  readonly: true,
});
const turso = createClient({ url, authToken });

const TABLES = {
  posts: ["id", "author", "title", "body", "created_at", "story_date", "status", "status_at"],
  media_items: ["id", "post_id", "type", "url", "mime", "duration_ms", "width", "height", "waveform_peaks", "position"],
};

for (const [table, cols] of Object.entries(TABLES)) {
  const rows = local.prepare(`SELECT ${cols.join(", ")} FROM ${table}`).all();
  if (rows.length === 0) {
    console.log(`${table}: nothing to copy`);
    continue;
  }
  const placeholders = cols.map(() => "?").join(", ");
  const sql = `INSERT OR REPLACE INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`;
  const stmts = rows.map((r) => ({ sql, args: cols.map((c) => r[c] ?? null) }));
  await turso.batch(stmts, "write");
  console.log(`${table}: copied ${rows.length} rows`);
}

local.close();
console.log("Done.");
