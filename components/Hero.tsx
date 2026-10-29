import Link from "next/link";
import samples from "@/lib/samples.json";
import { EXAMPLES, SEVERITY_COLOR } from "@/lib/findings";
import { toFinding, type ApiFinding } from "@/lib/api";
import { highlightLine } from "@/lib/highlight";
import { hintFor, markSpan } from "@/lib/hints";

/**
 * The hero is the product's argument in one picture: the scanners' raw output, which nobody reads, and one
 * Fixr review note on the exact line. Both are built from the real scan of the messy sample.
 */
const { raw, dropped } = samples.messy;
const kept = (samples.messy.findings as unknown as ApiFinding[]).map(toFinding);
const real = kept.filter((f) => !f.style);
const code = EXAMPLES.messy.code.split("\n");

type Row = { line: number; rule: string; text: string; kind: "real" | "note" | "drop"; rank?: number; color?: string };
const rows: Row[] = [
  ...kept.map((f): Row => f.style
    ? { line: f.line, rule: f.rule ?? "", text: f.title, kind: "note" }
    : { line: f.line, rule: f.rule ?? "", text: f.title, kind: "real", rank: real.indexOf(f) + 1, color: SEVERITY_COLOR[f.severity] }),
  ...dropped.map((d): Row => ({ line: d.line ?? 0, rule: d.rule_id, text: "XML parsed with xml.etree", kind: "drop" })),
].sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));

// the note shows the SQL injection: the clearest case of "this exact text, changed this way"
const shown = real.find((f) => f.rule === "B608") ?? real[0];
const shownLine = code[shown.line - 1] ?? "";
const span = markSpan(shownLine, shown);
const hint = hintFor(shown);
const indent = shownLine.length - shownLine.trimStart().length;

export default function Hero() {
  return (
    <section className="wrap hero">
      <div className="hero__copy">
        <p className="eyebrow">Security triage for AI-written Python</p>
        <h1 className="hero__title">
          <span className="hero__raw"><s>{raw} warnings.</s></span>
          <span className="hero__real">{real.length} worth fixing.</span>
        </h1>
        <p className="hero__sub">
          Fixr runs four scanners over your code, drops their false alarms, and marks the exact text to change on the
          exact line. It doesn&apos;t rewrite your project. It tells you, or the AI tool you build with, what to fix.
        </p>
        <div className="hero__ctas">
          <Link className="btn btn--primary" href="/scan">Scan your code</Link>
          <Link className="btn btn--ghost" href="/scan?sample=messy">Try the messy sample</Link>
        </div>
        <Link className="hero__cli" href="/cli">
          <code><i>$</i> fixr scan .</code>
          <span>or run it on your own machine</span>
        </Link>
      </div>

      <figure className="artifact" aria-label="Raw scanner output for app.py, and one Fixr review note">
        <div className="artifact__log">
          <p className="artifact__bar">
            <span>app.py · four scanners, raw</span>
            <span>{raw} raw warnings</span>
          </p>
          <ol>
            {rows.map((r, i) => (
              <li key={i} className={`log log--${r.kind}`} style={r.color ? { ["--c" as string]: r.color } : undefined}>
                <span className="log__loc">app.py:{r.line}</span>
                <span className="log__rule">{r.rule}</span>
                <span className="log__text">{r.text}</span>
                <span className="log__tag">{r.kind === "real" ? String(r.rank).padStart(2, "0") : r.kind === "drop" ? "false alarm" : "style"}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="artifact__note" style={{ ["--c" as string]: SEVERITY_COLOR[shown.severity] }}>
          <p className="artifact__where">
            <span>app.py</span><b>line {shown.line}</b><span>{shown.rule}</span>
            <span className="artifact__sev">{shown.severity}</span>
          </p>
          <pre className="artifact__code">
            <span className="artifact__n">{shown.line}</span>
            {highlightLine(shownLine.slice(indent, span ? span[0] : undefined))}
            {span && <mark className="cr__mark">{highlightLine(shownLine.slice(span[0], span[1]))}</mark>}
            {span && highlightLine(shownLine.slice(span[1]))}
          </pre>
          <p className="artifact__title">{shown.title}</p>
          <dl className="note__steps">
            <div><dt>Change</dt><dd>{hint?.change}</dd></div>
            {hint?.check && <div><dt>Check</dt><dd>{hint.check}</dd></div>}
          </dl>
        </div>
        <figcaption className="artifact__cap">
          The messy sample&apos;s real scan: {raw} warnings in, {dropped.length} false alarms dropped, {kept.length - real.length} style notes set aside, {real.length} ranked.
        </figcaption>
      </figure>
    </section>
  );
}
