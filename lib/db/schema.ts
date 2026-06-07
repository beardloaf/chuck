import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
} from "drizzle-orm/sqlite-core";
import { randomUUID } from "node:crypto";

/**
 * Stories shared by visitors. Author/title/body are all optional.
 * A "post" is anything with at least one of those fields or at least one
 * attached media item (enforced at the API layer, not in SQL).
 */
export const POST_STATUSES = ["pending", "approved", "rejected"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const posts = sqliteTable(
  "posts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    author: text("author").notNull().default("Anonymous"),
    /** Optional one-line headline. Shown on tiles and as the story heading. */
    title: text("title"),
    body: text("body"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    /**
     * When the *story* happened (set by the user during composition, only
     * required when there's media attached). Nullable for text-only posts;
     * the feed sort can coalesce to createdAt.
     */
    storyDate: integer("story_date", { mode: "timestamp_ms" }),
    /**
     * Moderation status. New posts land as "pending" and only become public
     * once an admin approves them.
     */
    status: text("status", { enum: POST_STATUSES })
      .notNull()
      .default("pending"),
    statusAt: integer("status_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("posts_created_at_idx").on(t.createdAt),
    index("posts_status_idx").on(t.status),
  ],
);

/**
 * Media attached to a post. Ordered by `position`. URL is relative to the
 * site origin (e.g. /uploads/abc.webm).
 */
export const mediaItems = sqliteTable(
  "media_items",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["audio", "image", "video"] }).notNull(),
    url: text("url").notNull(),
    mime: text("mime").notNull(),
    durationMs: integer("duration_ms"),
    width: integer("width"),
    height: integer("height"),
    // Stored as JSON-encoded array of small ints (0–255) for the static waveform preview.
    waveformPeaks: text("waveform_peaks", { mode: "json" }).$type<number[] | null>(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("media_items_post_id_idx").on(t.postId)],
);

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type MediaItem = typeof mediaItems.$inferSelect;
export type NewMediaItem = typeof mediaItems.$inferInsert;
