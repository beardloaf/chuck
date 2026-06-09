import { db, schema } from "@/lib/db";
import { desc, eq, inArray } from "drizzle-orm";
import { isAuthed } from "@/lib/admin";
import { AdminLogin } from "./AdminLogin";
import { AdminQueue, type AdminPost } from "./AdminQueue";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin · Mikula",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  if (!(await isAuthed())) {
    return (
      <div className="w-full max-w-md mx-auto px-6 py-16">
        <h1 className="headline-lg mb-6">Admin</h1>
        <AdminLogin />
      </div>
    );
  }

  const sp = await searchParams;
  const filter = (sp.filter || "pending") as "pending" | "approved" | "rejected";

  const rows = await db
    .select()
    .from(schema.posts)
    .where(eq(schema.posts.status, filter))
    .orderBy(desc(schema.posts.createdAt))
    .all();

  const ids = rows.map((p) => p.id);
  const media =
    ids.length === 0
      ? []
      : await db
          .select()
          .from(schema.mediaItems)
          .where(inArray(schema.mediaItems.postId, ids))
          .all();
  const byPost = new Map<string, typeof media>();
  for (const m of media) {
    const list = byPost.get(m.postId) ?? [];
    list.push(m);
    byPost.set(m.postId, list);
  }
  for (const list of byPost.values()) list.sort((a, b) => a.position - b.position);

  const counts = await countByStatus();

  const items: AdminPost[] = rows.map((p) => ({
    id: p.id,
    author: p.author,
    body: p.body,
    status: p.status,
    createdAt: p.createdAt.getTime(),
    media: (byPost.get(p.id) ?? []).map((m) => ({
      id: m.id,
      type: m.type as "audio" | "image" | "video",
      url: m.url,
      mime: m.mime,
      durationMs: m.durationMs,
      width: m.width,
      height: m.height,
      peaks: m.waveformPeaks ?? null,
    })),
  }));

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-10">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="headline-lg">Admin</h1>
          <p className="text-sm text-ink-3 mt-1">
            Approve or reject submitted stories.
          </p>
        </div>
        <FilterTabs current={filter} counts={counts} />
      </header>

      <AdminQueue items={items} filter={filter} />
    </div>
  );
}

async function countByStatus() {
  const all = await db.select().from(schema.posts).all();
  const counts = { pending: 0, approved: 0, rejected: 0 };
  for (const p of all) counts[p.status as keyof typeof counts]++;
  return counts;
}

function FilterTabs({
  current,
  counts,
}: {
  current: string;
  counts: { pending: number; approved: number; rejected: number };
}) {
  const tabs: Array<{ key: keyof typeof counts; label: string }> = [
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
  ];
  return (
    <div className="flex gap-1.5">
      {tabs.map((t) => (
        <a
          key={t.key}
          href={`/admin?filter=${t.key}`}
          className={`toggle ${current === t.key ? "" : ""}`}
          data-on={current === t.key ? "true" : "false"}
        >
          <span>{t.label}</span>
          <span className="text-ink-3 text-[0.7rem] font-normal">{counts[t.key]}</span>
        </a>
      ))}
    </div>
  );
}
