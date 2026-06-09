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

## Full dynamic app (Vercel)

The adapters are **already wired up**: the app uses Turso (libSQL) for the
database and Vercel Blob for uploads whenever the relevant env vars are present,
and falls back to the on-disk SQLite + `public/uploads/` when they're not (so
local dev and the Pages build are unchanged). Vercel's filesystem is read-only
and ephemeral, which is why these hosted services are required there.

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
2. **Create the schema** in Turso:
   ```bash
   TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… npm run db:push
   ```
3. **Load the existing memories** from the local DB into Turso:
   ```bash
   TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… node scripts/migrate-to-turso.mjs
   ```
   (The existing media files are served from `public/uploads/`, which ships with
   the deployment. New uploads go to Vercel Blob.)

### Deploy

1. Import the GitHub repo into Vercel (or run `npx vercel`). Vercel auto-detects
   Next.js — no `vercel.json` needed.
2. Add a **Blob store** to the project (Storage tab) — this sets
   `BLOB_READ_WRITE_TOKEN` automatically.
3. Add the project **Environment Variables**: `TURSO_DATABASE_URL`,
   `TURSO_AUTH_TOKEN`, `ADMIN_TOKEN` (Blob token is added in step 2).
4. Deploy. The feed, story pages, uploads (`/api/posts`), and admin moderation
   all run server-side against Turso + Blob.

> The GitHub Pages export above is independent — it still builds from the local
> `data/mikula.db` and ignores the Turso/Blob env, so you can keep both if you
> want.

## Logo

To swap the CSS-rendered wordmark for the chrome PNG, drop the image at
`public/logo.png`. The `<Logo>` component (`app/Logo.tsx`) detects it at
render time and switches automatically.
