import type { Config } from "drizzle-kit";

// Local: the on-disk SQLite file. Production: a hosted Turso database (set
// TURSO_DATABASE_URL + TURSO_AUTH_TOKEN in the environment before `db:push`).
const tursoUrl = process.env.TURSO_DATABASE_URL;

export default (
  tursoUrl
    ? {
        schema: "./lib/db/schema.ts",
        out: "./lib/db/migrations",
        dialect: "turso",
        dbCredentials: { url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN },
      }
    : {
        schema: "./lib/db/schema.ts",
        out: "./lib/db/migrations",
        dialect: "sqlite",
        dbCredentials: { url: "file:./data/mikula.db" },
      }
) satisfies Config;
