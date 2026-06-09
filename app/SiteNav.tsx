"use client";

import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Site top bar — brand wordmark + theme toggle. (Main nav and the header
 * "add a memory" button are intentionally omitted for now.)
 */
export function SiteNav() {
  return (
    <header className="topbar">
      <Link href="/" className="topbar-brand">
        Charles Mikula
      </Link>
      <div className="topbar-actions">
        <ThemeToggle />
      </div>
    </header>
  );
}
