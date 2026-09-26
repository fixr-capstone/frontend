import type { Metadata } from "next";
import { Big_Shoulders, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Google merged "Big Shoulders Display" into this variable family. Its optical-size
// axis selects the display cut automatically at large sizes (font-optical-sizing: auto).
const display = Big_Shoulders({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-display",
  // Next has no fallback metrics for this family yet; name the fallback explicitly instead.
  adjustFontFallback: false,
  fallback: ["Arial Narrow", "sans-serif"],
});
const sans = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Fixr: security triage for AI-written Python",
  description: "Fixr runs four Python scanners, filters out their false alarms, and explains the findings worth fixing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
