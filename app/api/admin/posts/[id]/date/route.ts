import { z } from "zod";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { isAuthed } from "@/lib/admin";

export const runtime = "nodejs";

const Body = z.object({
  // "YYYY-MM-DD" (stored as the first of that month) or null to clear.
  storyDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthed())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const storyDate = parsed.storyDate ? new Date(parsed.storyDate) : null;
  if (storyDate && Number.isNaN(storyDate.getTime())) {
    return Response.json({ error: "Bad date" }, { status: 400 });
  }

  const result = await db
    .update(schema.posts)
    .set({ storyDate })
    .where(eq(schema.posts.id, id))
    .returning({ id: schema.posts.id })
    .all();

  if (result.length === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ id, storyDate: parsed.storyDate });
}
