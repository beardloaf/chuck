"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/home", label: "Home" },
  { href: "/party", label: "Party" },
  { href: "/", label: "Memories" },
  { href: "/about", label: "About" },
];

/**
 * Site top nav. On the feed it gets an `onAdd` to open the composer sheet;
 * elsewhere the Add button links back to the feed.
 */
export function SiteNav({ onAdd }: { onAdd?: () => void }) {
  const pathname = usePathname();

  return (
    <header className="topbar">
      <Link href="/" className="topbar-brand">
        Mikula
      </Link>
      <nav className="topbar-nav">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="topbar-link"
            data-active={pathname === item.href ? "" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="topbar-actions">
        <ThemeToggle />
        {onAdd ? (
          <button type="button" className="add-btn" onClick={onAdd}>
            <PlusIcon />
            Add a memory
          </button>
        ) : (
          <Link href="/" className="add-btn">
            <PlusIcon />
            Add a memory
          </Link>
        )}
      </div>
    </header>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
