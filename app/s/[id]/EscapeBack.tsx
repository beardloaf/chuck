"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Pressing Escape on a story page returns to the feed. */
export function EscapeBack() {
  const router = useRouter();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") router.push("/");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return null;
}
