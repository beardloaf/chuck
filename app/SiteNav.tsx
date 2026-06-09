"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Site top bar — brand + theme toggle. The brand shows the chrome wordmark at
 * /logo.png once it loads, otherwise the "Charles Mikula" text (probing avoids
 * ever flashing a broken image when the file isn't present). Main nav and the
 * header add-button are intentionally omitted.
 */
export function SiteNav() {
  const [logoOk, setLogoOk] = useState(false);

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => setLogoOk(true);
    img.src = "/logo.png";
  }, []);

  return (
    <header className="topbar">
      <Link href="/" className="topbar-brand" aria-label="Charles Mikula">
        {logoOk ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src="/logo.png" alt="Charles Mikula" className="topbar-logo" />
        ) : (
          "Charles Mikula"
        )}
      </Link>
      <div className="topbar-actions">
        <ThemeToggle />
      </div>
    </header>
  );
}
