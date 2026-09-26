"use client";

import { useEffect, useState } from "react";
import { SEVERITY_COLOR, type Finding, type Severity } from "@/lib/findings";

const TOTAL = 41;
/** Where the six real findings of the messy sample sit among the 41 raw warnings. */
const REAL_AT = [3, 8, 13, 21, 29, 36];
const SWEEP_MS = 2400;
const REST: Record<Severity, number> = { critical: 1, high: 0.72, medium: 0.5, low: 0.34 };

/** Deterministic, so the server render and the first client render agree. */
const noiseHeight = (i: number) => 0.2 + (((i * 37) % 11) / 11) * 0.45;

export default function SignalField({
  findings,
  onPick,
}: {
  findings: Finding[];
  onPick: (finding: Finding) => void;
}) {
  const [run, setRun] = useState(0);
  const [sweeping, setSweeping] = useState(false);
  const [done, setDone] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    setSweeping(false);
    setDone(false);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSweeping(true);
      setDone(true);
      return;
    }
    const start = setTimeout(() => setSweeping(true), 650);
    const end = setTimeout(() => setDone(true), 650 + SWEEP_MS);
    return () => { clearTimeout(start); clearTimeout(end); };
  }, [run]);

  const kept = REAL_AT.map((at, n) => ({ at, finding: findings[n] })).filter((k) => k.finding);
  const byIndex = new Map(kept.map((k) => [k.at, k.finding]));
  const shown = active !== null ? byIndex.get(active) : undefined;

  return (
    <div className="signal">
      <div
        className={`signal__field ${sweeping ? "is-sweeping" : ""}`}
        style={{ ["--sweep" as string]: `${SWEEP_MS}ms` }}
        onMouseLeave={() => setActive(null)}
      >
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

      <div className="signal__readout" aria-live="polite">
        {shown ? (
          <>
            <span className="readout__sev" style={{ color: SEVERITY_COLOR[shown.severity] }}>{shown.severity}</span>
            <span className="readout__title">{shown.title}</span>
            <span className="readout__loc">{shown.file}:{shown.line}</span>
          </>
        ) : done ? (
          <>
            <span className="readout__muted">{TOTAL - kept.length} dropped as noise, {kept.length} kept.</span>
            <span className="readout__hint readout__hint--pointer">Hover a bar to read it, click to open it</span>
            <span className="readout__hint readout__hint--touch">Tap a bar to open it in the scanner</span>
          </>
        ) : (
          <span className="readout__muted">Reading {TOTAL} raw warnings</span>
        )}
      </div>

      <button type="button" className="signal__replay" onClick={() => setRun((r) => r + 1)} disabled={!done}>
        Replay
      </button>
    </div>
  );
}
