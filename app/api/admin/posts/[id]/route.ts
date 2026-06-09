import { z } from "zod";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { isAuthed } from "@/lib/admin";

export const runtime = "nodejs";

const Patch = z.object({
  author: z.string().max(80).optional(),
  title: z.string().max(200).nullable().optional(),
  body: z.string().max(20_000).nullable().optional(),
  // "YYYY-MM-DD" (stored as the first of that month) or null to clear.
  storyDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

/** Edit a post's name/title/body/story-date. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthed())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let p;
  try {
    p = Patch.parse(await req.json());
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const set: Partial<typeof schema.posts.$inferInsert> = {};
  if (p.author !== undefined) set.author = p.author.trim() || "Anonymous";
  if (p.title !== undefined) set.title = p.title?.trim() || null;
  if (p.body !== undefined) set.body = p.body?.trim() || null;
  if (p.storyDate !== undefined) {
    set.storyDate = p.storyDate ? new Date(p.storyDate) : null;
  }
  if (Object.keys(set).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const result = await db
    .update(schema.posts)
    .set(set)
    .where(eq(schema.posts.id, id))
    .returning({ id: schema.posts.id })
    .all();

  if (result.length === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}

/** Permanently delete a post and its media rows. */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthed())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  await db.delete(schema.mediaItems).where(eq(schema.mediaItems.postId, id));
  const result = await db
    .delete(schema.posts)
    .where(eq(schema.posts.id, id))
    .returning({ id: schema.posts.id })
    .all();

  if (result.length === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
