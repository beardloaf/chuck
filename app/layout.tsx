import type { Metadata } from "next";
import { Archivo_Narrow, Inter_Tight } from "next/font/google";
import "./globals.css";

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// Condensed grotesque, used only by the celebration ticket — the hard-ticket
// look depends on narrow caps, which Inter Tight can't supply.
const archivoNarrow = Archivo_Narrow({
  variable: "--font-condensed",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

// Canonical domain (the site also serves at chuckmikula.com).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://charlesmikula.com";
const OG_DESCRIPTION = "In memory of Charles “Chuck” Mikula.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Charles Mikula — In Memories",
    template: "Charles Mikula — %s",
  },
  description: OG_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Charles Mikula",
    title: "Charles Mikula — In Memories",
    description: OG_DESCRIPTION,
    url: "/",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "Charles “Chuck” Mikula",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Charles Mikula — In Memories",
    description: OG_DESCRIPTION,
    images: ["/og.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Dark theme only for now. The light theme + toggle are intentionally
  // disabled (CSS and ThemeToggle component kept so they can be brought back).
  return (
    <html lang="en" data-theme="dark" className={`${interTight.variable} ${archivoNarrow.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
