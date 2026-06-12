import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import "./globals.css";

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Charles Mikula — In Memories",
    template: "Charles Mikula — %s",
  },
  description: "In memory of Charles “Chuck” Mikula.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Dark theme only for now. The light theme + toggle are intentionally
  // disabled (CSS and ThemeToggle component kept so they can be brought back).
  return (
    <html lang="en" data-theme="dark" className={`${interTight.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
