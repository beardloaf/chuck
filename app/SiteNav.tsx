"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Band-style "Mikula" wordmarks in /public (all share a width; height varies). */
const LOGOS = [
  "/mikula-aerosmith.webp",
  "/mikula-blackmetal.webp",
  "/mikula-blacksabbath.webp",
  "/mikula-danzig.webp",
  "/mikula-def.webp",
  "/mikula-jerks.webp",
  "/mikula-judas.webp",
  "/mikula-led.webp",
  "/mikula-tallica1.webp",
  "/mikula-tallica2.webp",
];

/**
 * Site top bar — a centered "Mikula" wordmark chosen at random from /public on
 * each load. The pick happens client-side (after mount) so there's no SSR/
 * hydration mismatch; the "Charles Mikula" text stands in until it loads. All
 * logos share a width; taller ones simply make the header taller.
 */
export function SiteNav() {
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    const pick = LOGOS[Math.floor(Math.random() * LOGOS.length)];
    const img = new window.Image();
    img.onload = () => setLogo(pick);
    img.src = pick;
  }, []);

  return (
    <header className="topbar">
      <Link href="/" className="topbar-brand" aria-label="Charles Mikula">
        {logo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={logo} alt="Charles Mikula" className="topbar-logo" />
        ) : (
          "Charles Mikula"
        )}
      </Link>
    </header>
  );
}
