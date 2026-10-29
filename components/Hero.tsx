"use client";

import { Fragment, useEffect, useState } from "react";
import { EXAMPLES, SEVERITY_COLOR, type Finding } from "@/lib/findings";
import { highlightLine } from "@/lib/highlight";
import { REAL_AT, TOTAL } from "@/lib/signal";

/**
 * The messy sample's real code, scanned and then folded like an editor folds code: a scan line lights each
 * line worth fixing, and everything else folds away until only those lines are left.
 */
const SCAN_MS = 1800;
const LINES = EXAMPLES.messy.code.replace(/\n$/, "").split("\n");

type Phase = "idle" | "scanning" | "folded";

export default function Hero({
  findings,
  onPick,
  onNav,
  onCli,
}: {
  findings: Finding[];
  onPick: (finding: Finding) => void;
  onNav: (id: string) => void;
  onCli: () => void;
}) {
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [active, setActive] = useState<Finding | null>(null);

  useEffect(() => {
    setPhase("idle");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setPhase("folded"); return; }
    const scan = setTimeout(() => setPhase("scanning"), 700);
    const fold = setTimeout(() => setPhase("folded"), 700 + SCAN_MS + 350);
    return () => { clearTimeout(scan); clearTimeout(fold); };
  }, [run]);

  // which source line each finding sits on, with its priority
  const byLine = new Map(findings.map((f, i) => [f.line, { f, rank: i + 1 }] as const));
  // the file as runs: a flagged line, or a stretch of lines that fold away together
  const runs: ({ kind: "hit"; n: number } | { kind: "fold"; from: number; to: number })[] = [];
  LINES.forEach((_, i) => {
    const n = i + 1;
    const last = runs[runs.length - 1];
    if (byLine.has(n)) runs.push({ kind: "hit", n });
    else if (last?.kind === "fold") last.to = n;
    else runs.push({ kind: "fold", from: n, to: n });
  });

  const sweeping = phase !== "idle";
  const done = phase === "folded";
  const line = (n: number, hit?: { f: Finding; rank: number }) => (
    <span
      className="fold__row"
      style={{ ["--d" as string]: `${((n - 1) / LINES.length) * SCAN_MS}ms`, ...(hit ? { ["--c" as string]: SEVERITY_COLOR[hit.f.severity] } : {}) }}
    >
      <span className="fold__n">{n}</span>
      <code className="fold__code">{hit && done ? highlightLine(LINES[n - 1]) : LINES[n - 1] || " "}</code>
      {hit && <span className="fold__rank">{String(hit.rank).padStart(2, "0")}</span>}
    </span>
  );

  return (
    <section className={`wrap hero ${sweeping ? "is-sweeping" : ""} ${done ? "is-done" : ""}`} style={{ ["--sweep" as string]: `${SCAN_MS}ms` }}>
      <div className="hero__copy">
        <h1 className="hero__title">
          <span className="hero__raw"><span className="hero__strike">{TOTAL} warnings.</span></span>
          <span className="hero__real">{REAL_AT.length} worth fixing.</span>
        </h1>
        <p className="hero__sub">
          Fixr runs four Python scanners over AI-written code, filters out their false alarms, and explains what is left.
        </p>
        <div className="hero__ctas">
          <a className="btn btn--primary" href="#scanner" onClick={(e) => { e.preventDefault(); onNav("scanner"); }}>Scan your code</a>
          <a className="btn btn--ghost" href="#how" onClick={(e) => { e.preventDefault(); onNav("how"); }}>How it works</a>
        </div>
        {/* the CLI, offered the way you would use it: as a command */}
        <button type="button" className="hero__cli" onClick={onCli} aria-haspopup="dialog">
          <code><i>$</i> fixr scan .<b aria-hidden="true" /></code>
          <span>or run it on your own machine</span>
        </button>
      </div>

      <div className={`signal fold fold--${phase}`} onMouseLeave={() => setActive(null)}>
        <p className="fold__file" aria-hidden="true">
          <span>app.py</span>
          <span className="fold__count"><b>{done ? REAL_AT.length : LINES.length}</b> {done ? "lines worth fixing" : "lines"}</span>
        </p>
        <div className="fold__frame">
        <span className="fold__beam" aria-hidden="true" />
        <ol className="fold__list" aria-label={`app.py: ${LINES.length} lines, ${findings.length} worth fixing`}>
          {runs.map((r) => {
            if (r.kind === "fold") {
              const count = r.to - r.from + 1;
              return (
                <li key={`f${r.from}`} className="fold__run" aria-hidden="true">
                  <div className="fold__body">
                    {Array.from({ length: count }, (_, k) => <Fragment key={k}>{line(r.from + k)}</Fragment>)}
                  </div>
                  <span className="fold__gap">{count} {count === 1 ? "line" : "lines"}</span>
                </li>
              );
            }
            const hit = byLine.get(r.n)!;
            return (
              <li key={`h${r.n}`} className="fold__hit">
                <button
                  type="button"
                  disabled={!done}
                  aria-label={`${hit.f.severity}: ${hit.f.title}, line ${hit.f.line}`}
                  onMouseEnter={() => setActive(hit.f)}
                  onFocus={() => setActive(hit.f)}
                  onBlur={() => setActive(null)}
                  onClick={() => onPick(hit.f)}
                >
                  {line(r.n, hit)}
                </button>
              </li>
            );
          })}
        </ol>
        </div>

        <div className="signal__readout" aria-live="polite">
          {active ? (
            <>
              <span className="readout__sev" style={{ color: SEVERITY_COLOR[active.severity] }}>{active.severity}</span>
              <span className="readout__title">{active.title}</span>
            </>
          ) : (
            <span className="readout__muted">{done ? "Click a line to open it in the scanner" : "Scanning app.py"}</span>
          )}
          <button type="button" className="signal__replay" onClick={() => setRun((r) => r + 1)} disabled={!done}>Replay</button>
        </div>
      </div>
    </section>
  );
}
