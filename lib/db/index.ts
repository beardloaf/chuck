import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

/**
 * libSQL (SQLite-compatible) database handle.
 *
 * - Production (Vercel): a hosted Turso database, via TURSO_DATABASE_URL +
 *   TURSO_AUTH_TOKEN. Serverless filesystems are read-only/ephemeral, so the DB
 *   can't live on disk there.
 * - Local dev and the static export build: the on-disk SQLite file. Same SQLite
 *   schema either way, so nothing else in the app changes.
 *
 * Note: the libSQL driver is async — every query must be awaited.
 */
declare global {
  // eslint-disable-next-line no-var
  var __mikulaDb: ReturnType<typeof createDb> | undefined;
}

function createDb() {
  // On a serverless host (Vercel) the bundled SQLite file is read-only and
  // ephemeral. Falling back to it there would silently serve a STALE snapshot
  // (whatever was last committed) and lose every write — which looks exactly
  // like "the database got replaced with a previous version". Refuse to start
  // without Turso so a misconfigured deploy fails loudly instead.
  if (process.env.VERCEL && !process.env.TURSO_DATABASE_URL) {
    throw new Error(
      "TURSO_DATABASE_URL is required on Vercel. Refusing to fall back to the " +
        "bundled SQLite snapshot (it would serve stale data and drop writes).",
    );
  }

  const url = process.env.TURSO_DATABASE_URL ?? "file:./data/mikula.db";

  // Ensure the directory exists for the local file database.
  if (url.startsWith("file:")) {
    const dir = path.dirname(url.slice("file:".length));
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return drizzle(client, { schema });
}

export const db = globalThis.__mikulaDb ?? createDb();
if (process.env.NODE_ENV !== "production") {
  globalThis.__mikulaDb = db;
}

export { schema };
