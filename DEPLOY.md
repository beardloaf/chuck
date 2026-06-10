# Deploying Mikula

Local dev uses **SQLite on disk** (`data/mikula.db`) and **local file storage**
(`public/uploads/`). That works for one machine, but won't survive a serverless
deploy, so production runs on hosted services instead.

The site is deployed to **Vercel** using **Turso** (libSQL) for the database and
**Vercel Blob** for uploads.

> **The live data lives in Turso, not in this repo.** `data/mikula.db` is a local
> dev file and is **git-ignored** (see `.gitignore`) — it is never committed, so a
> `git push` only deploys code and can't overwrite the live approved / pending /
> rejected state. There is intentionally **no** seed or migrate-on-deploy step
> that touches Turso. Moderate posts in the live admin UI; the database persists
> across deploys on its own.

## Vercel + Turso + Blob

The adapters are **already wired up**: the app uses Turso (libSQL) for the
database and Vercel Blob for uploads whenever the relevant env vars are present,
and falls back to the on-disk SQLite + `public/uploads/` when they're not (so
local dev is unchanged). Vercel's filesystem is read-only and ephemeral, which
is why these hosted services are required there.

Env vars (see `.env.example`):

| Var | Where to get it |
| --- | --- |
| `TURSO_DATABASE_URL` | `turso db show --url <name>` |
| `TURSO_AUTH_TOKEN` | `turso db tokens create <name>` |
| `BLOB_READ_WRITE_TOKEN` | added automatically when you attach a Blob store to the Vercel project |
| `ADMIN_TOKEN` | your moderation password (any long random string) |

### One-time setup

1. **Create the database.** Install the [Turso CLI](https://docs.turso.tech),
   then:
   ```bash
   turso db create chuck
   turso db show --url chuck          # → TURSO_DATABASE_URL
   turso db tokens create chuck       # → TURSO_AUTH_TOKEN
   ```
2. **Create the schema** in Turso (safe to re-run — it only adds missing
   tables/columns, it does not clear data):
   ```bash
   TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… npm run db:push
   ```

### Deploy

1. Import the GitHub repo into Vercel (or run `npx vercel`). Vercel auto-detects
   Next.js — no `vercel.json` needed.
2. Add a **Blob store** to the project (Storage tab) — this sets
   `BLOB_READ_WRITE_TOKEN` automatically.
3. Add the project **Environment Variables**: `TURSO_DATABASE_URL`,
   `TURSO_AUTH_TOKEN`, `ADMIN_TOKEN` (Blob token is added in step 2).
4. Deploy. The feed, story pages, uploads (`/api/posts`), and admin moderation
   all run server-side against Turso + Blob. Every push to `main` redeploys the
   code only — the Turso data is untouched.

## Logo

To swap the rendered text wordmark for the chrome PNG, drop the image at
`public/logo.png`. Both the top-bar brand (`app/SiteNav.tsx`) and the `<Logo>`
component (`app/Logo.tsx`) detect it automatically and switch to the image — no
code change needed.
</content>
</invoke>
