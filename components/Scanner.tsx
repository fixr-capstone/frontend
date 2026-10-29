"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EXAMPLES, getResults, type ExampleKey, type Finding, type Sources } from "@/lib/findings";
import { highlightLine } from "@/lib/highlight";
import Chat from "@/components/Chat";
import CodeReview from "@/components/CodeReview";
import FindingList, { FileIndex } from "@/components/FindingList";
import ZipView from "@/components/ZipView";
import { WakeNote, useServer } from "@/components/ServerStatus";
import { buildFixPrompt } from "@/lib/fixPrompt";
import { buildReport, grade, verdict } from "@/lib/report";
import { MAX_UPLOAD_MB, SNIPPET_FILE, githubRepo, scanGithub, scanZip, zipOne, zipPyFiles } from "@/lib/api";

/** Same order as the real pipeline. */
const STATUS_LINES = [
  "Running Bandit, pip-audit, deptry and flake8",
  "Filtering likely false alarms",
  "Ranking by severity and confidence",
  "Explaining the top findings",
];
const SCAN_MS = 3600;
// A deliberately vulnerable public Flask app, for trying the GitHub scan
const DEMO_REPO = "https://github.com/we45/Vulnerable-Flask-App";
const SAMPLE_FILE: Record<ExampleKey, string> = { messy: "app.py", minor: "profile.py", clean: "clean.py" };

type Phase = "idle" | "loading" | "results" | "error";
type Tab = "code" | "zip" | "github";
type View = "review" | "list";
type Results = { raw: number | null; findings: Finding[]; sources: Sources };

const TABS: [Tab, string][] = [["code", "Code"], ["zip", "Project .zip"], ["github", "GitHub repo"]];

export default function Scanner({ forceError = false }: { forceError?: boolean }) {
  const { online, recheck } = useServer();
  const [tab, setTab] = useState<Tab>("code");
  const [example, setExample] = useState<ExampleKey | null>(null);
  const [code, setCode] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [statusIdx, setStatusIdx] = useState(0);
  const [warn, setWarn] = useState("");
  const [error, setError] = useState("");
  const [zip, setZip] = useState<{ name: string; size: number | null; files: string[] } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [results, setResults] = useState<Results>({ raw: 0, findings: [], sources: {} });
  const [scanId, setScanId] = useState(0);
  const [view, setView] = useState<View>("review");
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  const [fileFilter, setFileFilter] = useState<string | null>(null);
  const [handled, setHandled] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatFocus, setChatFocus] = useState<Finding | null>(null);

  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    if (phase !== "loading") return;
    const start = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 84, behavior: reduce ? "auto" : "smooth" });
  };

  /** Results only exist for the untouched sample files; anything else is the user's own code. */
  const isSample = example !== null && code === EXAMPLES[example].code;

  const loadExample = (key: ExampleKey) => {
    clearTimers();
    setTab("code");
    setExample(key);
    setCode(EXAMPLES[key].code);
    setPhase("idle");
    setWarn("");
  };

  const run = async (request: () => Promise<Results>) => {
    clearTimers();
    setWarn("");
    setFileFilter(null);
    setHandled(new Set());
    setPhase("loading");
    setStatusIdx(0);
    const step = SCAN_MS / STATUS_LINES.length;
    for (let i = 1; i < STATUS_LINES.length; i++) timers.current.push(setTimeout(() => setStatusIdx(i), step * i));
    try {
      if (forceError) throw new Error("The scanner did not return a result.");
      const [r] = await Promise.all([request(), new Promise((ok) => setTimeout(ok, SCAN_MS))]);
      setResults(r);
      setScanId((n) => n + 1);
      setView(Object.keys(r.sources).length ? "review" : "list");
      setChatOpen(false);
      setPhase("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
      recheck();
    }
    clearTimers();
    timers.current.push(setTimeout(() => scrollTo("results"), 80));
  };

  const scanCode = (key = example, text = code) => {
    if (!text.trim()) { setWarn("Pick a sample or paste some code first."); return; }
    setZip(null);
    if (key !== null && text === EXAMPLES[key].code) {
      run(async () => ({ ...(await getResults(key)), sources: { [SAMPLE_FILE[key]]: text } }));
    } else {
      run(async () => ({ raw: null, ...(await scanZip(await zipOne(SNIPPET_FILE, text))) }));
    }
  };

  const scanUpload = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) { setWarn("Choose a .zip of your project."); return; }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) { setWarn(`That .zip is over ${MAX_UPLOAD_MB} MB. Leave out virtual environments and data files.`); return; }
    setTab("zip");
    setZip({ name: file.name, size: file.size, files: [] });
    zipPyFiles(file).then((files) => setZip({ name: file.name, size: file.size, files })).catch(() => {});
    run(async () => ({ raw: null, ...(await scanZip(file)) }));
  };

  const scanRepo = (url = repoUrl) => {
    const name = githubRepo(url);
    if (!name) { setWarn("Paste a GitHub repository link, like https://github.com/owner/repo"); return; }
    setZip({ name, size: null, files: [] });
    run(async () => {
      const { findings, files, sources } = await scanGithub(url);
      // GitHub wraps the archive in "<repo>-<commit sha>/"; the repo name already says it
      const unwrap = (path: string) => path.replace(/^[^/]+\//, "");
      setZip({ name, size: null, files: files.map(unwrap) });
      return {
        raw: null,
        findings: findings.map((f) => ({ ...f, file: unwrap(f.file) })),
        sources: Object.fromEntries(Object.entries(sources).map(([k, v]) => [unwrap(k), v])),
      };
    });
  };

  // links from the home page: /scan?sample=messy runs a sample, /scan?repo=<url> fills in a repository
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const sample = q.get("sample") as ExampleKey | null;
    const repo = q.get("repo");
    if (sample && sample in EXAMPLES) {
      loadExample(sample);
      scanCode(sample, EXAMPLES[sample].code);
    } else if (repo) {
      setTab("github");
      setRepoUrl(repo);
    }
    // runs once, on arrival
  }, []);

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file || phase === "loading") return;
    if (file.name.toLowerCase().endsWith(".py")) {
      setTab("code");
      setExample(null);
      setCode(await file.text());
      setPhase("idle");
      setWarn("");
    } else scanUpload(file);
  };

  const reset = () => {
    clearTimers();
    setPhase("idle");
    setWarn("");
    setZip(null);
    setResults({ raw: 0, findings: [], sources: {} });
    scrollTo("scan");
  };

  const copy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(id);
    timers.current.push(setTimeout(() => setCopied((c) => (c === id ? null : c)), 1400));
  };
  const openChat = (f: Finding | null) => { setChatFocus(f); setChatOpen(true); };
  const closeChat = useCallback(() => setChatOpen(false), []);
  const toggleHandled = useCallback((id: string) => setHandled((h) => {
    const next = new Set(h);
    if (!next.delete(id)) next.add(id);
    return next;
  }), []);

  const loading = phase === "loading";
  const all = phase === "results" ? results.findings : [];
  const findings = all.filter((f) => !f.style);
  const notes = all.filter((f) => f.style);
  const fileCount = new Set(findings.map((f) => f.file)).size;
  const g = grade(findings);
  const done = findings.filter((f) => handled.has(f.id)).length;
  const lines = code.split("\n");
  const project = zip?.name ?? (isSample && example ? SAMPLE_FILE[example] : "Pasted code");
  const first = g.real[0];

  const downloadPrompt = () => {
    const url = URL.createObjectURL(new Blob([buildFixPrompt(findings, notes)], { type: "text/markdown" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "fixr-fix-prompt.md" });
    a.click();
    URL.revokeObjectURL(url);
  };
  // a print-ready page; the browser's print dialog saves it as a PDF
  const downloadReport = () => {
    const w = window.open("", "_blank");
    if (!w) { setWarn("Allow pop-ups for this site to open the report."); return; }
    w.document.write(buildReport(findings, notes, project));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };
  const openFinding = (id: string) => { setView("review"); setFocus((f) => ({ id, n: (f?.n ?? 0) + 1 })); };

  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    if (preRef.current) { preRef.current.scrollTop = scrollTop; preRef.current.scrollLeft = scrollLeft; }
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop;
  };

  const showZip = zip !== null && phase !== "idle";

  return (
    <>
      <section className="wrap page-head" id="scan">
        <p className="eyebrow">Scan</p>
        <h1 className="page-title">Find the lines worth fixing.</h1>
        <p className="page-lede">
          Paste Python, upload a project or point at a public GitHub repository. Fixr marks each finding on its line and
          says what to change. It never edits your code: the fixes stay yours, or your AI tool&apos;s.
        </p>
        <WakeNote />
      </section>

      <section
        className={`wrap source ${dragging ? "is-drop" : ""}`}
        onDragOver={(e) => { e.preventDefault(); if (!loading) setDragging(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
        onDrop={onDrop}
      >
        <div className="source__tabs" role="tablist" aria-label="What to scan">
          {TABS.map(([t, label]) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} disabled={loading && tab !== t} onClick={() => { setTab(t); setWarn(""); }}>{label}</button>
          ))}
        </div>

        {tab === "code" && (
          <div className="source__panel" role="tabpanel">
            <div className="samples" role="group" aria-label="Sample files">
              <span>Try a sample</span>
              {(Object.keys(EXAMPLES) as ExampleKey[]).map((k) => (
                <button key={k} type="button" aria-pressed={example === k && isSample} onClick={() => loadExample(k)}>{EXAMPLES[k].label}</button>
              ))}
            </div>
            <div className={`editor ${loading ? "is-scanning" : ""}`}>
              <div className="editor__bar">
                <span>{isSample && example ? SAMPLE_FILE[example] : SNIPPET_FILE}</span>
                <span>{lines.length} {lines.length === 1 ? "line" : "lines"}</span>
              </div>
              <div className="editor__body">
                <div className="gutter" ref={gutterRef} aria-hidden="true">
                  {lines.map((_, i) => <span key={i} className="gutter__n">{i + 1}</span>)}
                </div>
                <div className="editor__pane">
                  <pre className="code" ref={preRef} aria-hidden="true">
                    <div className="code__inner">
                      {lines.map((line, i) => {
                        const parts = highlightLine(line);
                        return <div key={i} className="code__line">{parts.length ? parts : "​"}</div>;
                      })}
                    </div>
                  </pre>
                  <textarea
                    className="editor__input"
                    value={code}
                    spellCheck={false}
                    placeholder="Paste Python here, drop a .py file, or pick a sample above"
                    aria-label="Code to scan"
                    onChange={(e) => { setCode(e.target.value); setWarn(""); }}
                    onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); if (!loading) scanCode(); } }}
                    onScroll={syncScroll}
                  />
                  {loading && <span className="beam" aria-hidden="true" />}
                </div>
              </div>
            </div>
            <div className="actions">
              <button className="btn btn--primary" disabled={!code.trim() || loading} onClick={() => scanCode()}>
                {loading ? `Scanning ${elapsed}s` : "Scan this code"}
              </button>
              <span className="kbd-hint"><kbd>Ctrl</kbd> <kbd>Enter</kbd></span>
              {warn && <span className="warn" role="alert">{warn}</span>}
            </div>
          </div>
        )}

        {tab === "zip" && (
          <div className="source__panel" role="tabpanel">
            {showZip ? (
              <ZipView files={zip!.files} live={loading} findings={phase === "results" ? findings : null} />
            ) : (
              <label className={`dropzone ${loading ? "is-disabled" : ""}`}>
                <input type="file" accept=".zip,application/zip" hidden disabled={loading} onChange={(e) => { scanUpload(e.target.files?.[0]); e.target.value = ""; }} />
                <span className="dropzone__title">Drop a .zip of your project here</span>
                <span className="dropzone__note">Up to {MAX_UPLOAD_MB} MB. Leave out virtual environments and data files: only Python files and dependency lists are scanned.</span>
                <span className="btn btn--ghost">Choose a .zip</span>
              </label>
            )}
            {(warn || (showZip && loading)) && (
              <div className="actions">
                {loading && <span className="kbd-hint">Scanning {elapsed}s</span>}
                {warn && <span className="warn" role="alert">{warn}</span>}
              </div>
            )}
          </div>
        )}

        {tab === "github" && (
          <div className="source__panel" role="tabpanel">
            <form className="repo" onSubmit={(e) => { e.preventDefault(); if (!loading) scanRepo(); }}>
              <input
                className="repo__input"
                type="text"
                inputMode="url"
                spellCheck={false}
                autoComplete="off"
                value={repoUrl}
                onChange={(e) => { setRepoUrl(e.target.value); setWarn(""); }}
                placeholder="github.com/owner/repo"
                aria-label="Public GitHub repository link"
                disabled={loading}
              />
              <button className="btn btn--primary" type="submit" disabled={loading || !repoUrl.trim()}>
                {loading ? `Scanning ${elapsed}s` : "Scan repository"}
              </button>
            </form>
            <p className="try-repo">
              Public repositories only. No repo to hand? Try{" "}
              <button type="button" disabled={loading} onClick={() => { setRepoUrl(DEMO_REPO); scanRepo(DEMO_REPO); }}>
                we45/Vulnerable-Flask-App
              </button>
              , a Flask app built to be insecure.
            </p>
            {showZip && <ZipView files={zip!.files} pending="Downloading from GitHub" live={loading} findings={phase === "results" ? findings : null} />}
            {warn && <p className="warn" role="alert">{warn}</p>}
          </div>
        )}

        {dragging && <div className="drop" aria-hidden="true"><b>Drop to scan</b><span>A .zip scans the project. A .py file opens in the editor.</span></div>}

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
        <p className="privacy">
          Your code goes to the Fixr server for the scan and is deleted when it finishes. The functions around the top findings
          are sent to an AI model (Groq) to write the explanations.{online === false && " The live scanner is offline right now; the samples still work."}
        </p>
      </section>

      <section className="wrap results" id="results">
        {phase === "error" && (
          <div className="panel panel--error">
            <div>
              <p className="panel__big">Scan failed</p>
              <p>{error}</p>
            </div>
            <button className="btn btn--ghost" onClick={reset}>Try again</button>
          </div>
        )}

        {phase === "results" && findings.length === 0 && (
          <div className="panel panel--clean">
            <p className="panel__big">Nothing to fix</p>
            <p>No scanner warning survived filtering{notes.length ? `; ${notes.length} style ${notes.length === 1 ? "note" : "notes"} below` : ""}.</p>
          </div>
        )}

        {phase === "results" && findings.length > 0 && (
          <>
            <div className="verdict-bar">
              <div className={`grade grade--${g.letter}`} title="Each kind of issue costs points by severity; likely false alarms and style notes don't count.">
                <span className="grade__letter">{g.letter}</span>
                <span className="grade__label">Security grade<b>{g.score}/100</b></span>
              </div>
              <div className="verdict-bar__text">
                <p className="verdict-bar__count">
                  {results.raw !== null && <><s>{results.raw}</s> <span aria-hidden="true">→</span> </>}
                  <b>{findings.length}</b> worth fixing
                  {fileCount > 1 && <> across {fileCount} files</>}
                  {notes.length > 0 && <span className="verdict-bar__aside"> · {notes.length} style notes set aside</span>}
                </p>
                <p className="verdict-bar__line">
                  {verdict(g).replace(/ Fix first:.*$/, "")}
                  {first && <> <button type="button" className="linkish" onClick={() => openFinding(first.id)}>Start with {first.file}:{first.line}</button></>}
                </p>
                <div className="progress">
                  <span className="progress__track" aria-hidden="true"><i style={{ transform: `scaleX(${findings.length ? done / findings.length : 0})` }} /></span>
                  <span>{done} of {findings.length} handled</span>
                </div>
              </div>
              <div className="verdict-bar__actions">
                <button className="btn btn--primary" onClick={downloadPrompt}>Download fix prompt</button>
                <button className={`btn btn--ghost ${copied === "prompt" ? "is-copied" : ""}`} onClick={() => copy("prompt", buildFixPrompt(findings, notes))}>
                  {copied === "prompt" ? "Copied" : "Copy prompt"}
                </button>
                <button className="btn btn--ghost" onClick={downloadReport}>Report (PDF)</button>
                <button className="btn btn--ghost" onClick={() => openChat(null)}>Ask Fixr</button>
              </div>
            </div>

            <div className="view-switch">
              <div className="seg" role="tablist" aria-label="Results view" style={{ ["--n" as string]: 2, ["--i" as string]: view === "review" ? 0 : 1 }}>
                <button type="button" role="tab" aria-selected={view === "review"} aria-pressed={view === "review"} onClick={() => setView("review")}>Code review</button>
                <button type="button" role="tab" aria-selected={view === "list"} aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
              </div>
              <span>{view === "review" ? "Each finding on its line, with what to change." : "Every finding, grouped and filterable."}</span>
              <button className="btn btn--text" onClick={reset}>New scan</button>
            </div>

            {view === "review" ? (
              <CodeReview key={scanId} findings={findings} sources={results.sources} handled={handled} onHandled={toggleHandled} onAsk={openChat} focus={focus} />
            ) : (
              <div className={`triage ${fileCount > 6 ? "triage--index" : ""}`}>
                {fileCount > 6 && <aside className="triage__map"><FileIndex findings={findings} file={fileFilter} onFile={setFileFilter} /></aside>}
                <div className="triage__list">
                  <FindingList key={scanId} findings={findings} focus={null} file={fileFilter} onFile={setFileFilter} onHot={() => {}} onAsk={openChat} hasIndex={fileCount > 6} />
                </div>
              </div>
            )}
          </>
        )}

        {phase === "results" && notes.length > 0 && (
          <details className="notes">
            <summary>{notes.length} style {notes.length === 1 ? "note" : "notes"} from flake8, not security issues</summary>
            <ul>{notes.map((n) => <li key={n.id}><span>{n.file}:{n.line}</span>{n.description}</li>)}</ul>
          </details>
        )}
      </section>

      {phase === "results" && all.length > 0 && <Chat key={scanId} open={chatOpen} onClose={closeChat} findings={all} focus={chatFocus} />}
    </>
  );
}
