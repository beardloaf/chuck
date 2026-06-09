# Deploying Mikula

The local dev build uses **SQLite on disk** (`data/mikula.db`) and **local file
storage** (`public/uploads/`). That works for one machine, but won't survive a
serverless deploy.

There are two ways to ship it:

- **GitHub Pages (read-only viewer)** — publish a static snapshot of the
  approved memories. No server, free hosting. See below.
- **Full dynamic app** (uploads + admin work online) — swap the DB and storage
  adapters and deploy to a Node host. See "Full dynamic app" further down.

## GitHub Pages (read-only viewer)

The published site is a **static export** that anyone can browse, but it can't
accept new uploads or run the admin moderation UI — those need a server. You
keep adding and approving memories **locally**, then publish a fresh snapshot.

How it works:

- `npm run build:static` produces a static site in `./out` (`output: 'export'`).
  It prerenders the feed and one page per *approved* post, hides the
  add/composer UI, and excludes the server-only routes (`app/api`, `app/admin`).
- `npm run preview:static` serves `./out` locally the way Pages does
  (`http://localhost:4530/chuck/`) so you can check it before publishing.
- The DB (`data/mikula.db`) and `public/uploads/` are committed so CI can build.
- `.github/workflows/deploy-pages.yml` runs the build and deploys on every push
  to `main`. Live at `https://beardloaf.github.io/chuck/`.

To publish updates: add/approve memories locally → commit `data/mikula.db` and
any new files under `public/uploads/` → push to `main`.

> **Requirements / gotchas**
> - GitHub Pages from a **private** repo requires a paid plan (Pro/Team). On the
>   free plan, make the repo public or upgrade — otherwise the deploy won't run.
> - In the repo's **Settings → Pages**, set the source to **GitHub Actions**
>   (the workflow tries to enable this automatically on first run).
> - The base path is `/chuck` (the repo name). If you rename the repo or use a
>   custom domain served at the root, the workflow picks up the new base path
>   automatically from `actions/configure-pages`.

## Full dynamic app

To run the full app online (uploads + admin), swap two adapters.

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
