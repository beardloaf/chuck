import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  COOKIE_MAX_AGE_DAYS,
  adminToken,
  tokensMatch,
} from "@/lib/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const expected = adminToken();
  if (!expected) {
    return Response.json(
      { error: "Admin not configured (set ADMIN_TOKEN)" },
      { status: 503 },
    );
  }

  let token = "";
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const data = (await req.json()) as { token?: string };
      token = data.token ?? "";
    } else {
      const fd = await req.formData();
      token = String(fd.get("token") ?? "");
    }
  } catch {
    /* fall through */
  }

  if (!tokensMatch(token, expected)) {
    return Response.json({ error: "Wrong token" }, { status: 401 });
  }

  const jar = await cookies();
  jar.set(ADMIN_COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * COOKIE_MAX_AGE_DAYS,
  });
  return Response.json({ ok: true });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  return Response.json({ ok: true });
}
