"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EXAMPLES, SEVERITY_COLOR, getResults, type ExampleKey, type Finding, type Severity } from "@/lib/findings";
import { highlight, highlightLine } from "@/lib/highlight";
import SignalField from "@/components/SignalField";
import Pipeline from "@/components/Pipeline";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
/** Same order as the real pipeline. */
const STATUS_LINES = [
  "Running Bandit, pip-audit, deptry and flake8",
  "Filtering likely false alarms",
  "Ranking by severity and confidence",
  "Explaining the top findings",
];
const SCAN_MS = 3600;

type Phase = "idle" | "loading" | "results" | "error" | "custom";

export default function Fixr({ forceError = false }: { forceError?: boolean }) {
  const [example, setExample] = useState<ExampleKey | null>(null);
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [statusIdx, setStatusIdx] = useState(0);
  const [filter, setFilter] = useState<Severity | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [emptyWarn, setEmptyWarn] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [results, setResults] = useState<{ raw: number; findings: Finding[] }>({ raw: 0, findings: [] });
  const [heroFindings, setHeroFindings] = useState<Finding[]>([]);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    getResults("messy").then((r) => setHeroFindings(r.findings));
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 88, behavior: reduce ? "auto" : "smooth" });
  }, []);

  /** Results only exist for the untouched sample files; anything else is the user's own code. */
  const isSample = example !== null && code === EXAMPLES[example].code;

  const loadExample = (key: ExampleKey) => {
    clearTimers();
    setExample(key);
    setCode(EXAMPLES[key].code);
    setPhase("idle");
    setFilter(null);
    setOpen({});
    setEmptyWarn(false);
  };

  const scan = () => {
    if (!code.trim()) { setEmptyWarn(true); return; }
    clearTimers();
    setEmptyWarn(false);
    setFilter(null);
    setOpen({});

    if (!isSample) {
      setPhase("custom");
      timers.current.push(setTimeout(() => scrollTo("results"), 60));
      return;
    }

    setPhase("loading");
    setStatusIdx(0);
    const step = SCAN_MS / STATUS_LINES.length;
    for (let i = 1; i < STATUS_LINES.length; i++) {
      timers.current.push(setTimeout(() => setStatusIdx(i), step * i));
    }
    timers.current.push(setTimeout(async () => {
      if (forceError) { setPhase("error"); return; }
      setResults(await getResults(example));
      setPhase("results");
      timers.current.push(setTimeout(() => scrollTo("results"), 80));
    }, SCAN_MS));
  };

  const reset = () => {
    clearTimers();
    setExample(null);
    setCode("");
    setPhase("idle");
    setFilter(null);
    setOpen({});
    setEmptyWarn(false);
    setResults({ raw: 0, findings: [] });
    scrollTo("scanner");
    taRef.current?.focus({ preventScroll: true });
  };

  const openFinding = (id: string) => {
    setFilter(null);
    setOpen((o) => ({ ...o, [id]: true }));
    timers.current.push(setTimeout(() => scrollTo(`finding-${id}`), 60));
  };

  const pickFromHero = () => {
    loadExample("messy");
    timers.current.push(setTimeout(() => scrollTo("scanner"), 30));
  };

  const copy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(id);
    timers.current.push(setTimeout(() => setCopied((c) => (c === id ? null : c)), 1400));
  };

  const loading = phase === "loading";
  const findings = phase === "results" ? results.findings : [];
  const visible = findings.filter((f) => !filter || f.severity === filter);
  const counts = SEVERITIES.map((s) => ({ severity: s, n: findings.filter((f) => f.severity === s).length }));
  const total = findings.length || 1;
  const lines = code.split("\n");

  /**
   * `flagged`: which finding tints each source line (highest severity wins on overlap).
   * `starts`: the finding that begins on a line, so every finding gets a clickable gutter
   * marker even when its first line sits inside another finding's span.
   */
  const { flagged, starts } = useMemo(() => {
    const flagged = new Map<number, Finding>();
    const starts = new Map<number, Finding>();
    for (const f of findings) {
      if (!starts.has(f.line)) starts.set(f.line, f);
      const span = f.snippet.split("\n").length;
      for (let n = f.line; n < f.line + span; n++) if (!flagged.has(n)) flagged.set(n, f);
    }
    return { flagged, starts };
  }, [findings]);

  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    if (preRef.current) { preRef.current.scrollTop = scrollTop; preRef.current.scrollLeft = scrollLeft; }
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop;
  };

  return (
    <>
      <header className="header">
        <div className="wrap header__inner">
          <span className="wordmark">FIXR</span>
          <nav className="header__nav">
            <a href="#how" onClick={(e) => { e.preventDefault(); scrollTo("how"); }}>How it works</a>
            <a className="btn btn--sm" href="#scanner" onClick={(e) => { e.preventDefault(); scrollTo("scanner"); }}>Try the scanner</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="wrap hero">
          <div className="hero__copy">
            <h1 className="hero__title">
              <span className="hero__raw">41 warnings.</span>
              <span className="hero__real">6 worth fixing.</span>
            </h1>
            <p className="hero__sub">
              Fixr runs four Python scanners over AI-written code, filters out their false alarms, and explains what is left.
            </p>
            <div className="hero__ctas">
              <a className="btn btn--primary" href="#scanner" onClick={(e) => { e.preventDefault(); scrollTo("scanner"); }}>Try the scanner</a>
              <a className="btn btn--ghost" href="#how" onClick={(e) => { e.preventDefault(); scrollTo("how"); }}>How it works</a>
            </div>
          </div>

          <SignalField findings={heroFindings} onPick={pickFromHero} />
        </section>

        <Pipeline />

        <section className="wrap scanner" id="scanner">
          <h2 className="h2">Try it on a sample</h2>
          <p className="scanner__note">
            These three files have prepared results. Scanning your own code needs the Fixr backend, which this page is not connected to yet.
          </p>

          <div className="tabs" role="group" aria-label="Sample files">
            {(Object.keys(EXAMPLES) as ExampleKey[]).map((k) => (
              <button key={k} className="tab" aria-pressed={example === k} onClick={() => loadExample(k)}>
                {EXAMPLES[k].label}
              </button>
            ))}
          </div>

          <div className={`editor ${loading ? "is-scanning" : ""}`}>
            <div className="editor__bar">
              <span>{example && isSample ? `${example === "minor" ? "profile" : "app"}.py` : "untitled.py"}</span>
              <span>{lines.length} {lines.length === 1 ? "line" : "lines"}</span>
            </div>

            <div className="editor__body">
              <div className="gutter" ref={gutterRef} aria-hidden={findings.length === 0}>
                {lines.map((_, i) => {
                  const f = flagged.get(i + 1);
                  const start = starts.get(i + 1);
                  return start ? (
                    <button
                      key={i}
                      className="gutter__n is-flag"
                      style={{ ["--c" as string]: SEVERITY_COLOR[start.severity] }}
                      onClick={() => openFinding(start.id)}
                      aria-label={`Line ${i + 1}: ${start.title}`}
                    >
                      {i + 1}
                    </button>
                  ) : (
                    <span key={i} className={`gutter__n ${f ? "is-span" : ""}`} style={f ? { ["--c" as string]: SEVERITY_COLOR[f.severity] } : undefined}>
                      {i + 1}
                    </span>
                  );
                })}
              </div>

              <div className="editor__pane">
                <pre className="code" ref={preRef} aria-hidden="true">
                  <div className="code__inner">
                    {lines.map((line, i) => {
                      const f = flagged.get(i + 1);
                      const parts = highlightLine(line);
                      return (
                        <div
                          key={i}
                          className={`code__line ${f ? "is-flag" : ""}`}
                          style={f ? { ["--c" as string]: SEVERITY_COLOR[f.severity] } : undefined}
                        >
                          {parts.length ? parts : "​"}
                        </div>
                      );
                    })}
                  </div>
                </pre>
                <textarea
                  ref={taRef}
                  className="editor__input"
                  value={code}
                  spellCheck={false}
                  placeholder="Pick a sample above, or paste Python here"
                  aria-label="Code to scan"
                  onChange={(e) => { setCode(e.target.value); setEmptyWarn(false); setPhase("idle"); }}
                  onScroll={syncScroll}
                />
                {loading && <span className="beam" aria-hidden="true" />}
              </div>
            </div>
          </div>

          <div className="actions">
            <button className="btn btn--primary" disabled={!code.trim() || loading} onClick={scan}>
              {loading ? "Scanning" : "Scan for vulnerabilities"}
            </button>
            {(phase === "results" || phase === "error" || phase === "custom") && (
              <button className="btn btn--ghost" onClick={reset}>Start over</button>
            )}
            {emptyWarn && <span className="warn">Pick a sample or paste some code first.</span>}
          </div>

          {loading && (
            <ol className="statuses" aria-live="polite">
              {STATUS_LINES.map((line, i) => (
                <li key={line} className={`status ${i < statusIdx ? "is-done" : i === statusIdx ? "is-active" : ""}`}>
                  <span className="status__mark" aria-hidden="true">{i < statusIdx ? "✓" : i === statusIdx ? "▌" : ""}</span>
                  {line}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="wrap results" id="results">
          {phase === "error" && (
            <div className="panel panel--error">
              <div>
                <div className="panel__big">Scan failed</div>
                <p>The scanner did not return a result. Run it again.</p>
              </div>
              <button className="btn btn--ghost" onClick={scan}>Scan again</button>
            </div>
          )}

          {phase === "custom" && (
            <div className="panel panel--note">
              <div>
                <div className="panel__big">Samples only, for now</div>
                <p>This page has prepared results for the three sample files. To scan your own code, run it against the Fixr backend.</p>
              </div>
              <button className="btn btn--primary" onClick={() => loadExample("messy")}>Load the messy sample</button>
            </div>
          )}

          {phase === "results" && findings.length === 0 && (
            <div className="panel panel--clean">
              <div className="panel__big">Nothing to fix</div>
              <p>No scanner warning in this file survived filtering.</p>
            </div>
          )}

          {phase === "results" && findings.length > 0 && (
            <>
              <div className="summary">
                <div className="summary__nums">
                  <span className="summary__raw">{results.raw}</span>
                  <span className="summary__arrow" aria-hidden="true">&rarr;</span>
                  <span className="summary__real">{findings.length}</span>
                </div>
                <p className="summary__text">
                  {results.raw} raw warnings, {results.raw - findings.length} dropped as likely noise.{" "}
                  <strong>{findings.length} worth your time.</strong>
                </p>
              </div>

              <div className="bar-split" aria-label="Findings by severity">
                {counts.filter((c) => c.n > 0).map((c) => (
                  <button
                    key={c.severity}
                    title={`${c.n} ${c.severity}`}
                    aria-label={`Show only ${c.severity}`}
                    className={filter && filter !== c.severity ? "is-dim" : ""}
                    style={{ flex: c.n / total, background: SEVERITY_COLOR[c.severity] }}
                    onClick={() => setFilter((cur) => (cur === c.severity ? null : c.severity))}
                  />
                ))}
              </div>

              <div className="chips">
                {counts.map((c) => (
                  <button
                    key={c.severity}
                    className={`chip ${filter === c.severity ? "is-on" : ""}`}
                    disabled={c.n === 0}
                    aria-pressed={filter === c.severity}
                    style={{ ["--c" as string]: SEVERITY_COLOR[c.severity] }}
                    onClick={() => setFilter((cur) => (cur === c.severity ? null : c.severity))}
                  >
                    <b>{c.n}</b> {c.severity}
                  </button>
                ))}
                {filter && <button className="chips__clear" onClick={() => setFilter(null)}>Show all</button>}
              </div>

              <ul className="findings">
                {visible.map((f, i) => (
                  <li
                    key={f.id}
                    id={`finding-${f.id}`}
                    className={`finding ${open[f.id] ? "is-open" : ""}`}
                    style={{ ["--c" as string]: SEVERITY_COLOR[f.severity], ["--i" as string]: i }}
                  >
                    <button
                      className="finding__head"
                      onClick={() => setOpen((o) => ({ ...o, [f.id]: !o[f.id] }))}
                      aria-expanded={!!open[f.id]}
                    >
                      <span className="finding__sev">{f.severity}</span>
                      <span className="finding__main">
                        <span className="finding__title">{f.title}</span>
                        <span className="finding__loc">{f.file}, line {f.line}</span>
                      </span>
                      <span className="finding__toggle" aria-hidden="true" />
                    </button>

                    {open[f.id] && (
                      <div className="finding__body">
                        <p>{f.description}</p>
                        <div className="snips">
                          <div className="snip snip--bad">
                            <div className="snip__head">
                              <span>Vulnerable</span>
                              <button className="copy" onClick={() => copy(f.id + "s", f.snippet)}>
                                {copied === f.id + "s" ? "Copied" : "Copy"}
                              </button>
                            </div>
                            <pre>{highlight(f.snippet)}</pre>
                          </div>
                          <div className="snip snip--fix">
                            <div className="snip__head">
                              <span>Suggested fix</span>
                              <button className="copy" onClick={() => copy(f.id + "f", f.suggestedFix)}>
                                {copied === f.id + "f" ? "Copied" : "Copy"}
                              </button>
                            </div>
                            <pre>{highlight(f.suggestedFix)}</pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </main>

      <footer className="footer">
        <div className="wrap footer__inner">
          <span className="wordmark wordmark--sm">FIXR</span>
          <span>Security triage for AI-written Python. Results on this page are sample data.</span>
        </div>
      </footer>
    </>
  );
}
