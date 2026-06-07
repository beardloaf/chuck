# Deploying Mikula

The local dev build uses **SQLite on disk** (`data/mikula.db`) and **local file
storage** (`public/uploads/`). That works for one machine, but won't survive a
serverless deploy. To ship this for real, swap two adapters.

## 1. Database → Neon Postgres (or Turso)

1. Create a free Neon project at https://neon.tech and copy the connection
   string. Set it in `.env`:
   ```
   DATABASE_URL=postgres://...
   ```
2. Install the Neon driver and switch dialect:
   ```bash
   npm install @neondatabase/serverless drizzle-orm
   npm uninstall better-sqlite3 @types/better-sqlite3
   ```
3. Replace `lib/db/index.ts` with a Neon client:
   ```ts
   import { neon } from "@neondatabase/serverless";
   import { drizzle } from "drizzle-orm/neon-http";
   import * as schema from "./schema";
   const sql = neon(process.env.DATABASE_URL!);
   export const db = drizzle(sql, { schema });
   export { schema };
   ```
4. Rewrite `lib/db/schema.ts` using `pgTable` (uuid pks, `timestamp` for
   `createdAt`, `jsonb` for `waveformPeaks`).
5. Update `drizzle.config.ts` to `dialect: "postgresql"` and run
   `npx drizzle-kit push`.

## 2. Storage → Vercel Blob

1. Create the Blob store from the Vercel dashboard and copy the token:
   ```
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
   ```
2. Install:
   ```bash
   npm install @vercel/blob
   ```
3. Replace `lib/storage.ts` so `saveUpload` calls `put(filename, file, { access: "public" })`
   from `@vercel/blob` and returns the resulting `url`. Mime/size validation
   stays put.

## 3. Deploy

```bash
vercel deploy
```

Set `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` in the Vercel project's
environment variables. That's it.

## Logo

To swap the CSS-rendered wordmark for the chrome PNG, drop the image at
`public/logo.png`. The `<Logo>` component (`app/Logo.tsx`) detects it at
render time and switches automatically.
