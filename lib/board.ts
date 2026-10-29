import samples from "@/lib/samples.json";
import { EXAMPLES, type Finding, type Severity } from "@/lib/findings";
import { toFinding, type ApiFinding } from "@/lib/api";

/**
 * The messy sample's real scan, shaped for the hero receipt and the how-it-works board: every raw
 * warning as a tile, the ranked findings, the counts, and the top finding's explanation.
 */

// short names for the receipt and the tiles; anything else falls back to the scanner's title
const SHORT: Record<string, string> = {
  B105: "Hardcoded secret", B106: "Hardcoded secret", B107: "Hardcoded secret",
  B324: "MD5 password hash", B608: "SQL from strings", B113: "No request timeout",
  B311: "Weak random", B110: "Errors swallowed", B602: "shell=True", B201: "Flask debug on",
  B404: "subprocess import", B405: "XML import", B314: "XML parse", B506: "yaml.load", B307: "eval",
};
export const shortTitle = (f: Pick<Finding, "rule" | "title">) =>
  (f.rule && SHORT[f.rule]) || f.title.replace(/[.:].*$/, "").slice(0, 22);

export const SEV_SHORT: Record<Severity, string> = { critical: "CRIT", high: "HIGH", medium: "MED", low: "LOW" };

const api = samples.messy.findings as unknown as ApiFinding[];
const kept = api.map(toFinding);
export const real = kept.filter((f) => !f.style);
const style = kept.filter((f) => f.style);
const { raw, dropped } = samples.messy;

export const COUNTS = {
  raw,
  dropped: dropped.length,
  style: style.length,
  left: raw - dropped.length,
  real: real.length,
  explained: api.filter((f) => f.category !== "style" && f.metadata.explanation).length,
};

export type Tile =
  | { kind: "real"; rule: string; line: number; rank: number; finding: Finding }
  | { kind: "style"; rule: string; line: number; slot: number }
  | { kind: "alarm"; rule: string; line: number };

/** Every raw warning as a tile, in file order, with where it ends up. */
export const TILES: Tile[] = (() => {
  const tiles: Tile[] = [
    ...kept.map((f): Tile => (f.style
      ? { kind: "style", rule: f.rule ?? "", line: f.line, slot: 0 }
      : { kind: "real", rule: f.rule ?? "", line: f.line, rank: real.indexOf(f) + 1, finding: f })),
    ...dropped.map((d): Tile => ({ kind: "alarm", rule: d.rule_id, line: d.line ?? 0 })),
  ].sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
  let slot = 0;
  for (const t of tiles) if (t.kind === "style") t.slot = slot++;
  return tiles;
})();

/** The top finding, for the explanation card: one sentence, the flagged line, the first line of the fix. */
export const TOP = (() => {
  const f = real[0];
  const code = EXAMPLES.messy.code.split("\n");
  const fixLine = f.suggestedFix.split("\n").map((l) => l.trim()).find((l) => l && !/^(import|from|#)/.test(l)) ?? "";
  return {
    finding: f,
    lead: f.description.replace(/`/g, "").replace(/\s+/g, " ").split(/(?<=[.!?])\s/)[0],
    flagged: (code[f.line - 1] ?? f.snippet).trim(),
    fix: fixLine,
  };
})();
