import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "mikula_admin";
export const COOKIE_MAX_AGE_DAYS = 30;

/** The configured admin token. Falls back to a dev default in non-prod. */
export function adminToken(): string {
  const fromEnv = process.env.ADMIN_TOKEN;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  if (process.env.NODE_ENV !== "production") return "letmein";
  return ""; // production with no token configured → no admin access
}

/** Constant-time string comparison. */
export function tokensMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Reads the admin cookie from the current request (App Router) and verifies it. */
export async function isAuthed(): Promise<boolean> {
  const expected = adminToken();
  if (!expected) return false;
  const jar = await cookies();
  const c = jar.get(ADMIN_COOKIE);
  if (!c) return false;
  return tokensMatch(c.value, expected);
}
