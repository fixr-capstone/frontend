import samples from "@/lib/samples.json";
import type { Severity } from "@/lib/findings";

export type Kind = "drop" | "note" | "real";

const { raw, dropped, findings } = samples.messy;
const real = findings.filter((f) => f.category !== "style");
const bars = [
  ...dropped.map((f) => ({ ...f, kind: "drop" as Kind })),
  ...findings.map((f) => ({ rule_id: f.rule_id, line: f.line, kind: (f.category === "style" ? "note" : "real") as Kind })),
].sort((a, b) => (a.line ?? 0) - (b.line ?? 0));

/** The messy sample's real scan, one bar per raw warning in line order. */
export const TOTAL = bars.length;
/** Bar position of each worth-fixing finding, in rank order. */
export const REAL_AT = real.map((f) => bars.findIndex((b) => b.kind === "real" && b.rule_id === f.rule_id && b.line === f.line));
const EXPLAINED = real.map((f) => "explanation" in f.metadata);
export const COUNTS = {
  raw,
  dropped: dropped.length,
  kept: findings.length,
  real: real.length,
  notes: findings.length - real.length,
  explained: EXPLAINED.filter(Boolean).length,
};

export const REST: Record<Severity, number> = { critical: 1, high: 0.72, medium: 0.5, low: 0.34 };

/** Deterministic, so the server render and the first client render agree. */
export const noiseHeight = (i: number) => 0.2 + (((i * 37) % 11) / 11) * 0.45;
