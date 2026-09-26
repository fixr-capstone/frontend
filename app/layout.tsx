import type { Metadata } from "next";
import { Big_Shoulders_Display, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Big_Shoulders_Display({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-display" });
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
