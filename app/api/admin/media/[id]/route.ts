import { z } from "zod";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { isAuthed } from "@/lib/admin";

export const runtime = "nodejs";

const BLOB_HOST = /^https:\/\/[a-z0-9.-]+\.blob\.vercel-storage\.com\//i;

const frac = z.number().min(0).max(1);
const Patch = z.object({
  /** The square region shown on the feed tile, or null to go back to centred. */
  crop: z
    .object({ x: frac, y: frac, w: frac.gt(0), h: frac.gt(0) })
    // Floating-point round-trips can push a full-width crop a hair past 1.
    .refine((c) => c.x + c.w <= 1.001 && c.y + c.h <= 1.001, {
      message: "Crop falls outside the image",
    })
    .nullable(),
});

/** Admin: set (or clear) the 1:1 crop an image uses on its feed tile. */
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

  const [m] = await db
    .select()
    .from(schema.mediaItems)
    .where(eq(schema.mediaItems.id, id))
    .limit(1)
    .all();
  if (!m) return Response.json({ error: "Not found" }, { status: 404 });
  if (m.type !== "image") {
    return Response.json({ error: "Only images can be cropped" }, { status: 400 });
  }

  await db
    .update(schema.mediaItems)
    .set({
      cropX: p.crop?.x ?? null,
      cropY: p.crop?.y ?? null,
      cropW: p.crop?.w ?? null,
      cropH: p.crop?.h ?? null,
    })
    .where(eq(schema.mediaItems.id, id));

  return Response.json({ ok: true });
}

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
