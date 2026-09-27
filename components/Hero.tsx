"use client";

import { useEffect, useState } from "react";
import { SEVERITY_COLOR, type Finding } from "@/lib/findings";
import { COUNTS, REAL_AT, REST, TOTAL, noiseHeight } from "@/lib/signal";

const SWEEP_MS = 2400;
const FACTS = [
  ["4", "scanners"],
  ["94.8%", "filter accuracy"],
  ["5", "findings explained"],
];

export default function Hero({
  findings,
  onPick,
  onNav,
}: {
  findings: Finding[];
  onPick: (finding: Finding) => void;
  onNav: (id: string) => void;
}) {
  const [run, setRun] = useState(0);
  const [scanned, setScanned] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    setScanned(0);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setScanned(TOTAL); return; }
    let raf = 0;
    let start = 0;
    const step = (now: number) => {
      start ||= now;
      const n = Math.min(TOTAL, Math.floor(((now - start) / SWEEP_MS) * TOTAL) + 1);
      setScanned(n);
      if (n < TOTAL) raf = requestAnimationFrame(step);
    };
    const delay = setTimeout(() => (raf = requestAnimationFrame(step)), 650);
    return () => { clearTimeout(delay); cancelAnimationFrame(raf); };
  }, [run]);

  const sweeping = scanned > 0;
  const done = scanned === TOTAL;
  const byIndex = new Map(REAL_AT.map((at, n) => [at, findings[n]] as const).filter(([, f]) => f));
  const kept = REAL_AT.filter((at) => at < scanned && byIndex.has(at)).length;
  const shown = active !== null ? byIndex.get(active) : undefined;

  return (
    <section className={`wrap hero ${sweeping ? "is-sweeping" : ""} ${done ? "is-done" : ""}`} style={{ ["--sweep" as string]: `${SWEEP_MS}ms`, ["--n" as string]: TOTAL }}>
      <div className="hero__copy">
        <h1 className="hero__title">
          <span className="hero__raw">{TOTAL} warnings.</span>
          <span className="hero__real">{REAL_AT.length} worth fixing.</span>
        </h1>
        <p className="hero__sub">
          Fixr runs four Python scanners over AI-written code, filters out their false alarms, and explains what is left.
        </p>
        <div className="hero__ctas">
          <a className="btn btn--primary" href="#scanner" onClick={(e) => { e.preventDefault(); onNav("scanner"); }}>Scan your code</a>
          <a className="btn btn--ghost" href="#how" onClick={(e) => { e.preventDefault(); onNav("how"); }}>How it works</a>
        </div>
        <dl className="hero__facts">
          {FACTS.map(([n, label]) => (
            <div key={label}><dt>{label}</dt><dd>{n}</dd></div>
          ))}
        </dl>
      </div>

      <div className="signal">
        <div className="signal__meta" aria-hidden="true">
          <span>app.py, raw scanner output</span>
          <span className="signal__tally"><b>{scanned - kept}</b> set aside <b className="signal__kept">{kept}</b> worth fixing</span>
        </div>

        <div className="signal__field" onMouseLeave={() => setActive(null)}>
          <span className="signal__line" aria-hidden="true" />
          {Array.from({ length: TOTAL }, (_, i) => {
            const finding = byIndex.get(i);
            const delay = `calc(var(--sweep) * ${i / TOTAL})`;
            if (!finding) {
              return (
                <span
                  key={i}
                  className="bar bar--noise"
                  aria-hidden="true"
                  style={{ ["--h" as string]: noiseHeight(i), transitionDelay: sweeping ? delay : "0s", animationDelay: `${(i % 7) * 110}ms` }}
                />
              );
            }
            return (
              <button
                key={i}
                type="button"
                className={`bar bar--real ${active === i ? "is-active" : ""}`}
                disabled={!done}
                aria-label={`${finding.severity}: ${finding.title}, ${finding.file} line ${finding.line}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onClick={() => onPick(finding)}
                style={{
                  ["--h" as string]: sweeping ? REST[finding.severity] : noiseHeight(i),
                  ["--c" as string]: SEVERITY_COLOR[finding.severity],
                  transitionDelay: sweeping ? delay : "0s",
                }}
              />
            );
          })}
        </div>

        <div className="signal__ranks" aria-hidden="true">
          {REAL_AT.map((at, n) => {
            const f = byIndex.get(at);
            return f && (
              <span key={at} style={{ gridColumn: at + 1, ["--c" as string]: SEVERITY_COLOR[f.severity], ["--n" as string]: n }}>
                {String(n + 1).padStart(2, "0")}
              </span>
            );
          })}
        </div>

        <div className="signal__readout" aria-live="polite">
          {shown ? (
            <>
              <span className="readout__sev" style={{ color: SEVERITY_COLOR[shown.severity] }}>{shown.severity}</span>
              <span className="readout__title">{shown.title}</span>
              <span className="readout__loc">line {shown.line}</span>
            </>
          ) : done ? (
            <>
              <span className="readout__muted">{COUNTS.dropped} dropped as {COUNTS.dropped === 1 ? "a false alarm" : "false alarms"}, {COUNTS.notes} style notes set aside. Numbered by priority.</span>
              <span className="readout__hint readout__hint--pointer">Hover a bar to read it, click to open it</span>
              <span className="readout__hint readout__hint--touch">Tap a bar to open it</span>
            </>
          ) : (
            <span className="readout__muted">Reading {TOTAL} raw warnings</span>
          )}
          <button type="button" className="signal__replay" onClick={() => setRun((r) => r + 1)} disabled={!done}>Replay</button>
        </div>
      </div>
    </section>
  );
}
