# Removing the celebration-of-life ticket

The gathering was **15 Sep 2026, 12–3pm PT**. Once it's over the pinned ticket
cell in the feed is dead weight, and a scheduled job opens a PR to delete it.

A date check in `lib/event.ts` already hides it from visitors after the cutoff,
so by the time this runs nothing is user-visible. **There is no urgency** —
correctness matters far more than speed.

## Rules

- Open a **pull request against `main`**. Do not push to `main`, do not merge.
  This is a live memorial site.
- Do **not** touch the intro photo panel — `app/feed/IntroPhotos.tsx`,
  `lib/intro-photos.ts`, `public/intro/`, `scripts/build-intro-photos.mjs`,
  the `intro:photos` npm script, and every `.intro-*` CSS rule all stay.
  They're a separate feature that outlives the event.

## Delete

- `app/feed/EventTile.tsx`
- `lib/event.ts`
- `public/mikula-ink.png` — the ticket's wordmark plate. Grep first; if
  anything else references it, keep it.

## Edit

- `app/feed/Feed.tsx` — drop the `EventTile` import, the `showCelebration`
  prop (from both the props type and the signature), and the line rendering
  `<EventTile show={...} />`. It sits just above the `{!READ_ONLY && (` block,
  in the fixed bottom layer — not in the grid.
- `app/page.tsx` — drop the `isCelebrationOver` import and the
  `showCelebration={...}` prop passed to `<Feed>`.
- `app/globals.css` — delete the section under the banner comment
  `Celebration-of-life hard ticket` (selectors `.event-dock`, `.event-ticket`
  and everything prefixed `.et-`), and
  the separate block guarded by `@supports not (container-type: inline-size)`,
  which exists only as a fallback for that ticket.
- `app/layout.tsx` — remove the `Archivo_Narrow` import, its config object and
  its variable from the `<html>` className. Grep for `--font-condensed` first;
  it should have no remaining users once the ticket is gone.

## Before opening the PR

- `npx tsc --noEmit` and `npx eslint app lib` must be clean. Pre-existing
  errors in `app/ThemeToggle.tsx` and `app/share/Composer.tsx` are not yours.
- `npm run build` must succeed.
- Grep for `event-dock`, `event-ticket`, `et-`, `EventTile`, `CELEBRATION`,
  `isCelebrationOver`, `dock-w` and `font-condensed` to confirm nothing dangles.
- The floating add button (`.fab-zone`, `.fab`) is NOT part of this — the ticket
  shares its bottom band but the button predates it and stays.

## Known non-issue

**Vercel preview deployments always fail on this repo** and always have — the
Turso env vars are scoped to Production only, and `lib/db/index.ts` throws on
Vercel without `TURSO_DATABASE_URL` by design. A red preview check is expected
and is not a reason to hold the PR. Production deploys are unaffected.
