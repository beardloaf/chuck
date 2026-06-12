import { format } from "date-fns";

/**
 * Format a story date's month/year by its **UTC** calendar fields.
 *
 * `storyDate` encodes a month, stored at the start of that month in UTC
 * (e.g. "2003-06-01" → 2003-06-01T00:00:00Z). Plain `format()` reads local
 * time, so in a timezone behind UTC that midnight rolls back to the previous
 * day → the label drifts a month earlier ("Jun" shown as "May"). Reading the
 * UTC fields makes the label identical on the server (UTC) and any client
 * timezone, and correct for already-stored posts.
 */
export function formatStoryMonth(
  value: number | Date,
  fmt: string = "MMM yyyy",
): string {
  const d = value instanceof Date ? value : new Date(value);
  return format(new Date(d.getUTCFullYear(), d.getUTCMonth(), 1), fmt);
}
