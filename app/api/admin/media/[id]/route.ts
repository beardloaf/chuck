import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { isAuthed } from "@/lib/admin";

export const runtime = "nodejs";

const BLOB_HOST = /^https:\/\/[a-z0-9.-]+\.blob\.vercel-storage\.com\//i;

/** Admin: remove a single media item from a post. Deletes the underlying Blob
 *  to save storage; committed /uploads files are left in place (served from git). */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthed())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const [m] = await db
    .select()
    .from(schema.mediaItems)
    .where(eq(schema.mediaItems.id, id))
    .limit(1)
    .all();
  if (!m) return Response.json({ error: "Not found" }, { status: 404 });

  if (BLOB_HOST.test(m.url)) {
    try {
      const { del } = await import("@vercel/blob");
      await del(m.url);
    } catch {
      /* best-effort blob cleanup */
    }
  }

  await db.delete(schema.mediaItems).where(eq(schema.mediaItems.id, id));
  return Response.json({ ok: true });
}
