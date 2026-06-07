"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLogin() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Login failed");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-ink-2">
        Enter the admin token to manage the post queue.
      </p>
      <input
        type="password"
        className="input"
        placeholder="Admin token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        autoFocus
      />
      {error && (
        <p className="text-sm text-danger bg-[color:var(--danger-soft)] rounded-[var(--r-md)] px-4 py-3 border border-[color:rgba(239,68,68,0.3)]">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-xs text-ink-4">
        For local dev the default token is{" "}
        <code className="px-1.5 py-0.5 rounded bg-surface-2 text-ink-2">letmein</code>
        . Override with the <code className="px-1.5 py-0.5 rounded bg-surface-2 text-ink-2">ADMIN_TOKEN</code> env var.
      </p>
    </form>
  );
}
