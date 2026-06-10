"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Site top bar — just the centered brand. The brand shows the chrome wordmark
 * at /logo.png once it loads, otherwise the "Charles Mikula" text (probing
 * avoids ever flashing a broken image when the file isn't present). The theme
 * toggle is hidden for now (dark-only); nav/add-button are omitted.
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
    </header>
  );
}
