import type { Metadata } from "next";
import Scanner from "@/components/Scanner";

export const metadata: Metadata = { title: "Scan" };

export default function ScanPage() {
  return <Scanner />;
}
