/**
 * Build-time site configuration shared by server and client components.
 *
 * These are driven by env vars that are only set for the static GitHub Pages
 * build (see scripts/build-static.mjs). For the normal dev/server build they
 * are unset, so the full dynamic app (uploads, admin, request-time data) is
 * unchanged.
 */

/** Path prefix when hosted under a sub-path, e.g. "/chuck" on GitHub Pages. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** When true, hide write affordances (the site is a published, read-only view). */
export const READ_ONLY = process.env.NEXT_PUBLIC_READ_ONLY === "1";

/**
 * Prefix a site-absolute asset URL (e.g. "/uploads/x.jpg") with the basePath.
 * `next/link` and the router add the basePath automatically, but raw <img>,
 * <video> and <audio> `src` values do not, so we apply it here at the data
 * layer. Leaves external (http) and already-relative URLs untouched.
 */
export function asset(url: string): string {
  if (!url || !url.startsWith("/")) return url;
  return `${BASE_PATH}${url}`;
}
