import Image from "next/image";
import fs from "node:fs";
import path from "node:path";

/**
 * Renders the Mikula wordmark. Uses /public/logo.png if you drop one in,
 * otherwise paints a modern text wordmark with a soft gradient accent.
 */
export function Logo({ width = 320 }: { width?: number }) {
  const logoPath = path.join(process.cwd(), "public", "logo.png");
  const hasImage = (() => {
    try {
      return fs.statSync(logoPath).isFile();
    } catch {
      return false;
    }
  })();

  if (hasImage) {
    return (
      <Image
        src="/logo.png"
        alt="Mikula"
        width={width}
        height={Math.round(width * 0.4)}
        priority
        className="select-none"
        style={{ width: `${width}px`, height: "auto" }}
      />
    );
  }

  return (
    <h1 className="text-display-xl select-none" aria-label="Mikula">
      <span className="ink-gradient">mikula</span>
      <span className="text-accent">.</span>
    </h1>
  );
}
