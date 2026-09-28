"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EXAMPLES, SEVERITY_COLOR, getResults, type ExampleKey, type Finding, type Severity } from "@/lib/findings";
import { highlight, highlightLine } from "@/lib/highlight";
import Hero from "@/components/Hero";
import Chat from "@/components/Chat";
import Logo from "@/components/Logo";
import XRay from "@/components/XRay";
import { buildFixPrompt } from "@/lib/fixPrompt";
import { Markdown } from "@/lib/markdown";
import { MAX_UPLOAD_MB, SNIPPET_FILE, checkBackend, scanZip, zipOne } from "@/lib/api";
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

type Phase = "idle" | "loading" | "results" | "error";
type Source = "sample" | "code" | "zip";

/** Counts from `from` down to `to`: the filtering, replayed as a number. */
function CountDown({ from, to, className }: { from: number; to: number; className?: string }) {
  const [n, setN] = useState(from);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(to); return; }
    const start = performance.now();
    const ms = 1100;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from, to]);
  return <span className={className}>{n}</span>;
}

export default function Fixr({ forceError = false }: { forceError?: boolean }) {
  const [example, setExample] = useState<ExampleKey | null>(null);
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [statusIdx, setStatusIdx] = useState(0);
  const [filter, setFilter] = useState<Severity | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [warn, setWarn] = useState("");
  const [online, setOnline] = useState<boolean | null>(null);
  const [waking, setWaking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [results, setResults] = useState<{ raw: number | null; findings: Finding[] }>({ raw: 0, findings: [] });
  const [source, setSource] = useState<Source>("sample");
  const [error, setError] = useState("");
  const [scanId, setScanId] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatFocus, setChatFocus] = useState<Finding | null>(null);
  const [hot, setHot] = useState<string | null>(null);
  const [heroFindings, setHeroFindings] = useState<Finding[]>([]);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setWaking(true), 4000);
    checkBackend().then(setOnline).finally(() => clearTimeout(t));
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase !== "loading") return;
    const start = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    getResults("messy").then((r) => setHeroFindings(r.findings.filter((f) => !f.style)));
    return () => timers.current.forEach(clearTimeout);
  }, []);

  // Content only hides once JS opts in, so the page still reads without it.
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-reveal]");
    document.documentElement.classList.add("js-reveal");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }),
      { rootMargin: "0px 0px -12% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
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
    setWarn("");
  };

  const run = async (src: Source, request: () => Promise<{ raw: number | null; findings: Finding[] }>) => {
    clearTimers();
    setWarn("");
    setFilter(null);
    setOpen({});
    setSource(src);
    setPhase("loading");
    setStatusIdx(0);
    const step = SCAN_MS / STATUS_LINES.length;
    for (let i = 1; i < STATUS_LINES.length; i++) {
      timers.current.push(setTimeout(() => setStatusIdx(i), step * i));
    }
    try {
      if (forceError) throw new Error("The scanner did not return a result.");
      const [r] = await Promise.all([request(), new Promise((ok) => setTimeout(ok, SCAN_MS))]);
      setResults(r);
      setScanId((n) => n + 1);
      setChatOpen(false);
      setPhase("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
      checkBackend().then(setOnline);
    }
    clearTimers();
    timers.current.push(setTimeout(() => scrollTo("results"), 80));
  };

  const scan = () => {
    if (!code.trim()) { setWarn("Pick a sample or paste some code first."); return; }
    if (isSample) run("sample", () => getResults(example));
    else run("code", async () => ({ raw: null, findings: await scanZip(zipOne(SNIPPET_FILE, code)) }));
  };

  const scanUpload = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) { setWarn("Upload a .zip of your project."); return; }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) { setWarn(`That .zip is over ${MAX_UPLOAD_MB} MB. Leave out virtual environments and data files.`); return; }
    run("zip", async () => ({ raw: null, findings: await scanZip(file) }));
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file || phase === "loading") return;
    if (file.name.toLowerCase().endsWith(".py")) {
      setExample(null);
      setCode(await file.text());
      setPhase("idle");
      setWarn("");
    } else scanUpload(file);
  };

  const reset = () => {
    clearTimers();
    setExample(null);
    setCode("");
    setPhase("idle");
    setFilter(null);
    setOpen({});
    setWarn("");
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

  const openChat = (focus: Finding | null) => { setChatFocus(focus); setChatOpen(true); };
  const closeChat = useCallback(() => setChatOpen(false), []);

  const downloadPrompt = () => {
    const url = URL.createObjectURL(new Blob([buildFixPrompt(findings, notes)], { type: "text/markdown" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "fixr-fix-prompt.md" });
    a.click();
    URL.revokeObjectURL(url);
  };

  const loading = phase === "loading";
  const all = phase === "results" ? results.findings : [];
  const findings = all.filter((f) => !f.style);
  const notes = all.filter((f) => f.style);
  const visible = findings.filter((f) => !filter || f.severity === filter);
  const counts = SEVERITIES.map((s) => ({ severity: s, n: findings.filter((f) => f.severity === s).length }));
  const lines = code.split("\n");
  const editorFile = source === "zip" ? null : source === "code" ? SNIPPET_FILE : example === "minor" ? "profile.py" : example === "clean" ? "clean.py" : "app.py";
  const notesBlock = notes.length > 0 && (
    <details className="notes">
      <summary>{notes.length} style {notes.length === 1 ? "note" : "notes"} from flake8, not security issues</summary>
      <ul>
        {notes.map((n) => (
          <li key={n.id}><span>{n.file}:{n.line}</span>{n.description}</li>
        ))}
      </ul>
    </details>
  );

  // flagged: tint per line (first wins); starts: clickable gutter marker per finding.
  const { flagged, starts } = useMemo(() => {
    const flagged = new Map<number, Finding>();
    const starts = new Map<number, Finding>();
    for (const f of findings) {
      if (f.line < 1 || (source !== "sample" && (source === "zip" || f.file !== SNIPPET_FILE))) continue;
      if (!starts.has(f.line)) starts.set(f.line, f);
      const span = f.snippet.split("\n").length;
      for (let n = f.line; n < f.line + span; n++) if (!flagged.has(n)) flagged.set(n, f);
    }
    return { flagged, starts };
  }, [findings, source]);

  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    if (preRef.current) { preRef.current.scrollTop = scrollTop; preRef.current.scrollLeft = scrollLeft; }
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop;
  };

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="header">
        <div className="wrap header__inner">
          <a href="#" className="logo-link" aria-label="Fixr, back to top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Logo /></a>
          <nav className="header__nav">
            <a href="#how" onClick={(e) => { e.preventDefault(); scrollTo("how"); }}>How it works</a>
            <a className="btn btn--sm" href="#scanner" onClick={(e) => { e.preventDefault(); scrollTo("scanner"); }}>Try the scanner</a>
          </nav>
        </div>
      </header>

      <main id="main">
        <Hero findings={heroFindings} onPick={pickFromHero} onNav={scrollTo} />

        <Pipeline />

        <section className="wrap scanner" id="scanner">
          <h2 className="h2" data-reveal>Scan it</h2>
          <p className="scanner__note" data-reveal style={{ ["--d" as string]: "90ms" }}>
            The samples have prepared results. Edit one or paste your own Python and it goes to the Fixr backend, or drop in a whole project as a .zip.
          </p>
          <p className={`live live--${online === null ? "wait" : online ? "on" : "off"}`} data-reveal style={{ ["--d" as string]: "120ms" }}>
            {online === null ? (waking ? "Waking the live scanner, this can take a minute" : "Checking the live scanner") : online ? "Live scanner online" : "Live scanner offline. The samples still work."}
          </p>

          <div className="tabs" role="group" aria-label="Sample files" data-reveal style={{ ["--d" as string]: "160ms" }}>
            {(Object.keys(EXAMPLES) as ExampleKey[]).map((k) => (
              <button key={k} className="tab" aria-pressed={example === k} onClick={() => loadExample(k)}>
                {EXAMPLES[k].label}
              </button>
            ))}
          </div>

          <div
            data-reveal
            style={{ ["--d" as string]: "230ms" }}
            onDragOver={(e) => { e.preventDefault(); if (!loading) setDragging(true); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
            onDrop={onDrop}
          >
          <div className={`editor ${loading ? "is-scanning" : ""} ${dragging ? "is-drop" : ""}`}>
            {dragging && <div className="drop" aria-hidden="true"><b>Drop to scan</b><span>A .zip scans the project. A .py file opens here.</span></div>}
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
                      style={{ ["--c" as string]: SEVERITY_COLOR[start.severity], ["--ln" as string]: i }}
                      onClick={() => openFinding(start.id)}
                      aria-label={`Line ${i + 1}: ${start.title}`}
                    >
                      {i + 1}
                    </button>
                  ) : (
                    <span key={i} className={`gutter__n ${f ? "is-span" : ""}`} style={f ? { ["--c" as string]: SEVERITY_COLOR[f.severity], ["--ln" as string]: i } : undefined}>
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
                          style={f ? { ["--c" as string]: SEVERITY_COLOR[f.severity], ["--ln" as string]: i } : undefined}
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
                  onChange={(e) => { setCode(e.target.value); setWarn(""); setPhase("idle"); }}
                  onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); if (!loading) scan(); } }}
                  onScroll={syncScroll}
                />
                {loading && <span className="beam" aria-hidden="true" />}
              </div>
            </div>
          </div>
          </div>

          <div className="actions">
            <button className="btn btn--primary" disabled={!code.trim() || loading} onClick={scan}>
              {loading ? `Scanning ${elapsed}s` : "Scan for vulnerabilities"}
            </button>
            <label className={`btn btn--ghost upload ${loading ? "is-disabled" : ""}`}>
              Upload .zip
              <input type="file" accept=".zip,application/zip" hidden disabled={loading} onChange={(e) => { scanUpload(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {(phase === "results" || phase === "error") && (
              <button className="btn btn--ghost" onClick={reset}>Start over</button>
            )}
            {warn && <span className="warn" role="alert">{warn}</span>}
            <span className="kbd-hint"><kbd>Ctrl</kbd> <kbd>Enter</kbd> to scan</span>
          </div>
          <p className="privacy">
            Your code goes to the Fixr backend for the scan and is deleted when it finishes. The functions around the top
            findings are sent to an AI model (Groq) to write the explanations. Results are guidance, not a security audit.
          </p>

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
                <p>{error}</p>
              </div>
              {source !== "zip" && <button className="btn btn--ghost" onClick={scan}>Scan again</button>}
            </div>
          )}

          {phase === "results" && findings.length === 0 && (
            <div className="panel panel--clean">
              <div className="panel__big">Nothing to fix</div>
              <p>No scanner warning survived filtering.</p>
            </div>
          )}

          {phase === "results" && findings.length > 0 && (
            <>
              <div className="summary">
                <div className="summary__nums">
                  {results.raw !== null && (
                    <>
                      <span className="summary__raw">{results.raw}</span>
                      <span className="summary__arrow" aria-hidden="true">&rarr;</span>
                    </>
                  )}
                  <CountDown className="summary__real" from={results.raw ?? 0} to={findings.length} />
                </div>
                <p className="summary__text">
                  {results.raw !== null
                    ? `${results.raw} raw warnings: ${results.raw - all.length} dropped as ${results.raw - all.length === 1 ? "a likely false alarm" : "likely false alarms"}, ${notes.length} style notes set aside. `
                    : "Filtered and ranked by the Fixr backend. "}
                  <strong>{findings.length} worth your time.</strong>
                </p>
              </div>

              <div className="handoff">
                <p className="handoff__text">
                  <strong>Fix it with the AI tool you already use.</strong> The fix prompt tells ChatGPT, Claude, Cursor or Copilot what is wrong, what to fix first and how to change it safely.
                </p>
                <div className="handoff__actions">
                  <button className="btn btn--primary" onClick={downloadPrompt}>Download fix prompt</button>
                  <button className="btn btn--ghost" onClick={() => copy("prompt", buildFixPrompt(findings, notes))}>
                    {copied === "prompt" ? "Copied" : "Copy prompt"}
                  </button>
                  <button className="btn btn--ghost" onClick={() => openChat(null)}>Ask Fixr</button>
                </div>
              </div>

              <div className="triage">
                <aside className="triage__map">
                  <XRay findings={findings} notes={notes} code={source === "zip" ? null : code} codeFile={editorFile} hot={hot} onHot={setHot} onPick={openFinding} />
                </aside>
                <div className="triage__list">
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
                    className={`finding ${open[f.id] ? "is-open" : ""} ${hot === f.id ? "is-hot" : ""}`}
                    onMouseEnter={() => setHot(f.id)}
                    onMouseLeave={() => setHot(null)}
                    style={{ ["--c" as string]: SEVERITY_COLOR[f.severity], ["--i" as string]: i }}
                  >
                    <button
                      className="finding__head"
                      onClick={() => setOpen((o) => ({ ...o, [f.id]: !o[f.id] }))}
                      aria-expanded={!!open[f.id]}
                    >
                      <span className="finding__rank">{String(findings.indexOf(f) + 1).padStart(2, "0")}</span>
                      <span className="finding__sev">{f.severity}</span>
                      <span className="finding__main">
                        <span className="finding__title">{f.title}</span>
                        <span className="finding__loc">{f.file}, line {f.line}</span>
                      </span>
                      <span className="finding__toggle" aria-hidden="true" />
                    </button>

                    {open[f.id] && (
                      <div className="finding__body">
                        <Markdown className="finding__desc" text={f.description} />
                        {(f.snippet || f.suggestedFix) && <div className="snips">
                          {f.snippet && <div className="snip snip--bad">
                            <div className="snip__head">
                              <span>Flagged code</span>
                              <button className="copy" onClick={() => copy(f.id + "s", f.snippet)}>
                                {copied === f.id + "s" ? "Copied" : "Copy"}
                              </button>
                            </div>
                            <pre>{highlight(f.snippet)}</pre>
                          </div>}
                          {f.suggestedFix && <div className="snip snip--fix">
                            <div className="snip__head">
                              <span>Suggested fix</span>
                              <button className="copy" onClick={() => copy(f.id + "f", f.suggestedFix)}>
                                {copied === f.id + "f" ? "Copied" : "Copy"}
                              </button>
                            </div>
                            <pre>{highlight(f.suggestedFix)}</pre>
                          </div>}
                        </div>}
                        <button className="ask" onClick={() => openChat(f)}>Ask about this finding</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {notesBlock}
                </div>
              </div>
            </>
          )}

          {phase === "results" && findings.length === 0 && notesBlock}
        </section>
      </main>

      {phase === "results" && all.length > 0 && (
        <Chat key={scanId} open={chatOpen} onClose={closeChat} findings={all} focus={chatFocus} />
      )}

      <footer className="footer">
        <div className="wrap footer__inner">
          <div className="footer__brand">
            <Logo small />
            <p>Security triage for AI-written Python. Four scanners, one classifier, and plain-language fixes.</p>
          </div>
          <nav className="footer__col" aria-label="Page">
            <span>On this page</span>
            <a href="#how" onClick={(e) => { e.preventDefault(); scrollTo("how"); }}>How it works</a>
            <a href="#scanner" onClick={(e) => { e.preventDefault(); scrollTo("scanner"); }}>Scanner</a>
            <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Back to top</a>
          </nav>
          <div className="footer__col">
            <span>Under the hood</span>
            <p>Bandit, pip-audit, deptry, flake8</p>
            <p>XGBoost false-alarm filter</p>
            <p>Explanations by an LLM on Groq</p>
          </div>
        </div>
        <div className="wrap footer__base">
          <span>Fixr, a capstone project by Parth, Sparsh and Shrey</span>
          <span>Sample results are prepared. Your own code is scanned live.</span>
        </div>
      </footer>
    </>
  );
}
