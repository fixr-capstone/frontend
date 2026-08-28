"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EXAMPLES, SEVERITY_COLOR, getResults, type ExampleKey, type Finding, type Severity } from "@/lib/findings";
import { highlight } from "@/lib/highlight";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
const STATUS_LINES = [
  "Running Semgrep, Bandit, pip-audit, Gitleaks...",
  "Reasoning about findings...",
  "Filtering false positives...",
];
/** Which of the 41 hero marks are the real findings, and at what severity. */
const REAL_MARKS: Record<number, Severity> = { 3: "critical", 8: "critical", 13: "critical", 21: "high", 29: "high", 36: "medium" };

const SCAN_MS = 3600;

type Phase = "idle" | "loading" | "results" | "error";

export default function Fixr({ forceError = false }: { forceError?: boolean }) {
  const [settled, setSettled] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [example, setExample] = useState<ExampleKey | null>(null);
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [statusIdx, setStatusIdx] = useState(0);
  const [filter, setFilter] = useState<Severity | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [emptyWarn, setEmptyWarn] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [results, setResults] = useState<{ raw: number; findings: Finding[] }>({ raw: 0, findings: [] });

  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isReduced) { setReduced(true); setSettled(true); return; }
    const t = setTimeout(() => setSettled(true), 2400);
    return () => clearTimeout(t);
  }, []);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 84, behavior: reduced ? "auto" : "smooth" });
  }, [reduced]);

  const loadExample = (key: ExampleKey) => {
    setExample(key);
    setCode(EXAMPLES[key].code);
    setPhase("idle");
    setFilter(null);
    setOpen({});
    setEmptyWarn(false);
  };

  const scan = () => {
    if (!code.trim()) { setEmptyWarn(true); return; }
    setPhase("loading");
    setStatusIdx(0);
    setEmptyWarn(false);
    setFilter(null);
    setOpen({});

    const tick = setInterval(() => setStatusIdx((i) => Math.min(STATUS_LINES.length - 1, i + 1)), SCAN_MS / 3);
    const done = setTimeout(async () => {
      clearInterval(tick);
      if (forceError) { setPhase("error"); return; }
      setResults(await getResults(example));
      setPhase("results");
      setTimeout(() => scrollTo("results"), 60);
    }, SCAN_MS);

    return () => { clearInterval(tick); clearTimeout(done); };
  };

  const reset = () => {
    setExample(null);
    setCode("");
    setPhase("idle");
    setFilter(null);
    setOpen({});
    setEmptyWarn(false);
    setResults({ raw: 0, findings: [] });
    taRef.current?.focus();
    scrollTo("scanner");
  };

  const copy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1400);
  };

  const loading = phase === "loading";
  const findings = phase === "results" ? results.findings : [];
  const visible = findings.filter((f) => !filter || f.severity === filter);
  const counts = SEVERITIES.map((s) => ({ severity: s, n: findings.filter((f) => f.severity === s).length }));
  const total = findings.length || 1;

  return (
    <>
      <div className="marquee" aria-hidden="true">
        <div className="marquee__track">
          {[0, 1].map((i) => (
            <span key={i}>
              41 raw findings&nbsp; &bull; &nbsp;6 real issues&nbsp; &bull; &nbsp;security for vibe-coded apps&nbsp; &bull; &nbsp;
              41 raw findings&nbsp; &bull; &nbsp;6 real issues&nbsp; &bull; &nbsp;security for vibe-coded apps&nbsp; &bull; &nbsp;
            </span>
          ))}
        </div>
      </div>

      <header className="header">
        <div className="wrap header__inner">
          <span className="wordmark">FIXR</span>
          <span className="header__rule" />
          <span className="eyebrow">v0.4 &middot; mocked</span>
          <a className="btn-ghost-sm" href="#scanner" onClick={(e) => { e.preventDefault(); scrollTo("scanner"); }}>Scanner</a>
        </div>
      </header>

      {/* hero */}
      <section className="wrap hero">
        <div>
          <div className="hero__counts">
            <div>
              <div className="eyebrow">Raw findings</div>
              <div className={`bignum bignum--raw ${settled ? "is-settled" : ""}`}>41</div>
            </div>
            <div className="hero__arrow">&rarr;</div>
            <div>
              <div className="eyebrow" style={{ color: "var(--mint)" }}>Actually real</div>
              <div className={`bignum bignum--real ${settled ? "is-settled" : ""}`}>6</div>
            </div>
          </div>
          <p className="hero__line">Every scan starts noisy. This is what&rsquo;s actually real.</p>
          <button className="btn btn--primary" style={{ marginTop: 28 }} onClick={() => scrollTo("scanner")}>
            Scan your code
          </button>
        </div>

        <div>
          <div className="field__head eyebrow">
            <span>Noise field</span>
            <span>{settled ? "6 real / 35 noise" : "unsorted"}</span>
          </div>
          <div className={`field ${settled ? "is-settled" : ""}`} aria-hidden="true">
            {Array.from({ length: 41 }, (_, i) => {
              const sev = REAL_MARKS[i];
              const style: React.CSSProperties = settled
                ? sev
                  ? { height: sev === "critical" ? 68 : 46, background: SEVERITY_COLOR[sev] }
                  : { height: 4, opacity: 0.55 }
                : { height: 14 + ((i * 37) % 5) * 7, background: sev ? "#4A4657" : "#35323F", animationDelay: `${(i % 9) * 90}ms` };
              return <span key={i} className={`mark ${settled ? "" : "mark--noise"}`} style={style} />;
            })}
          </div>
          <div className="legend">
            {SEVERITIES.map((s) => (
              <span key={s}><i style={{ background: SEVERITY_COLOR[s] }} />{s}</span>
            ))}
            <span><i style={{ background: "#35323F", height: 3 }} />noise</span>
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className="invert">
        <div className="wrap">
          <div className="eyebrow" style={{ marginBottom: 28 }}>How it works</div>
          <div className="steps">
            {[
              ["01", "Scan", "Semgrep, Bandit, pip-audit, and Gitleaks run against your code."],
              ["02", "Reason", "An LLM reads each finding in the actual context of your code and explains what's really happening."],
              ["03", "Rank", "A trained classifier filters out the noise, so only what matters rises to the top."],
            ].map(([num, title, body]) => (
              <div className="step" key={num}>
                <div className="step__num">{num}</div>
                <div className="step__title">{title}</div>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* scanner */}
      <section className="wrap" id="scanner" style={{ paddingTop: 64 }}>
        <div className="section-head">
          <h2>Paste the code</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(Object.keys(EXAMPLES) as ExampleKey[]).map((k) => (
              <button key={k} className="tab" aria-pressed={example === k} onClick={() => loadExample(k)}>
                {EXAMPLES[k].label}
              </button>
            ))}
          </div>
        </div>

        <div className="editor">
          <div className="editor__pane">
            <pre className="code" ref={preRef} aria-hidden="true">{highlight(code)}</pre>
            <textarea
              ref={taRef}
              className="editor__input"
              value={code}
              spellCheck={false}
              placeholder="def get_user(user_id): ..."
              aria-label="Code to scan"
              onChange={(e) => { setCode(e.target.value); setEmptyWarn(false); setPhase("idle"); }}
              onScroll={(e) => {
                if (!preRef.current) return;
                preRef.current.scrollTop = e.currentTarget.scrollTop;
                preRef.current.scrollLeft = e.currentTarget.scrollLeft;
              }}
            />
            {loading && <span className="beam" />}
          </div>

          <div className="map">
            <div className="map__label">Map</div>
            {findings.length === 0 ? (
              <div className="map__empty">no<br />findings<br />yet</div>
            ) : (
              findings.map((f) => (
                <button
                  key={f.id}
                  className="tick"
                  style={{ borderLeft: `3px solid ${SEVERITY_COLOR[f.severity]}` }}
                  onClick={() => { setFilter(null); setOpen((o) => ({ ...o, [f.id]: true })); scrollTo("results"); }}
                >
                  {f.line}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="actions">
          <button className="btn btn--primary" disabled={!code.trim() || loading} onClick={scan}>
            {loading ? "Scanning" : "Scan for vulnerabilities"}
          </button>
          {(phase === "results" || phase === "error") && (
            <button className="btn btn--outline" onClick={reset}>Scan another</button>
          )}
          {emptyWarn && <span className="warn">Paste some code or try an example first</span>}
        </div>

        {loading && (
          <div className="statuses">
            {STATUS_LINES.map((line, i) => (
              <div key={line} className={`status ${i < statusIdx ? "is-done" : i === statusIdx ? "is-active" : ""}`}>
                <span className="status__mark">{i < statusIdx ? "\u2713" : i === statusIdx ? "\u258C" : "\u00B7"}</span>
                {line}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* results */}
      <section className="wrap results" id="results">
        {phase === "error" && (
          <div className="panel-error">
            <div>
              <div className="panel-error__big">Scan failed</div>
              <p style={{ margin: "10px 0 0", fontSize: 18 }}>Something went wrong running the scan, try again.</p>
            </div>
            <button className="btn btn--outline" onClick={scan}>Retry</button>
          </div>
        )}

        {phase === "results" && findings.length === 0 && (
          <div className="panel-clean">
            <div className="panel-clean__big">Clean</div>
            <p style={{ margin: "18px 0 0", fontSize: 20 }}>No issues found. This one&rsquo;s clean.</p>
          </div>
        )}

        {phase === "results" && findings.length > 0 && (
          <>
            <div className="summary">
              <span className="summary__raw">{results.raw}</span>
              <span className="summary__label">raw</span>
              <span className="summary__arrow">&rarr;</span>
              <span className="summary__real">{findings.length}</span>
              <span className="summary__label summary__label--real">real issues</span>
            </div>

            <div className="bar">
              {counts.filter((c) => c.n > 0).map((c) => (
                <button
                  key={c.severity}
                  title={`${c.n} ${c.severity}`}
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
                  style={{ color: c.n ? SEVERITY_COLOR[c.severity] : undefined, borderColor: filter === c.severity ? SEVERITY_COLOR[c.severity] : undefined }}
                  onClick={() => setFilter((cur) => (cur === c.severity ? null : c.severity))}
                >
                  <b>{c.n}</b> {c.severity}
                </button>
              ))}
              {filter && <span className="chips__hint">filtered &mdash; click again to clear</span>}
            </div>

            <div className="index">
              {visible.map((f, i) => (
                <div key={f.id} className={`row ${open[f.id] ? "is-open" : ""}`}>
                  <button className="row__button" onClick={() => setOpen((o) => ({ ...o, [f.id]: !o[f.id] }))} aria-expanded={!!open[f.id]}>
                    <span className="row__num" style={open[f.id] ? { color: SEVERITY_COLOR[f.severity] } : undefined}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="row__badge" style={{ background: SEVERITY_COLOR[f.severity], color: f.severity === "low" ? "var(--text)" : "var(--base)" }}>
                      {f.severity}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span className="row__title">{f.title}</span>
                      <span className="row__loc">{f.file} : line {f.line}</span>
                    </span>
                    <span className="row__plus">+</span>
                  </button>

                  {open[f.id] && (
                    <div className="row__body">
                      <p>{f.description}</p>
                      <div className="snips">
                        <div className="snip">
                          <div className="snip__head">
                            <span className="snip__label">Vulnerable</span>
                            <button className="copy" onClick={() => copy(f.id + "s", f.snippet)}>
                              {copied === f.id + "s" ? "Copied" : "Copy"}
                            </button>
                          </div>
                          <pre>{highlight(f.snippet)}</pre>
                        </div>
                        <div className="snip snip--fix">
                          <div className="snip__head">
                            <span className="snip__label">Suggested fix</span>
                            <button className="copy" onClick={() => copy(f.id + "f", f.suggestedFix)}>
                              {copied === f.id + "f" ? "Copied" : "Copy"}
                            </button>
                          </div>
                          <pre>{highlight(f.suggestedFix)}</pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <footer className="footer">
        <div className="wrap footer__inner">
          <span>Fixr</span>
          <span>Everything on this page is mocked</span>
        </div>
      </footer>
    </>
  );
}
