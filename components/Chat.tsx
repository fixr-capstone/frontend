"use client";

import { useEffect, useRef, useState } from "react";
import { chat, type ChatMessage } from "@/lib/api";
import { Markdown } from "@/lib/markdown";
import { SEVERITY_COLOR, type Finding, type Severity } from "@/lib/findings";

const STARTERS = {
  all: ["Which of these should I fix first?", "Explain these like I'm not a developer", "Which ones could be false alarms?"],
  one: ["Explain this like I'm not a developer", "Is this actually dangerous in my code?", "Walk me through applying the fix"],
};
const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

function CopyReply({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`msg__copy ${copied ? "is-done" : ""}`}
      onClick={() => {
        navigator.clipboard?.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? "Copied" : "Copy answer"}
    </button>
  );
}

export default function Chat({
  open,
  onClose,
  findings,
  focus,
}: {
  open: boolean;
  onClose: () => void;
  findings: Finding[];
  focus: Finding | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const real = findings.filter((f) => !f.style);
  const counts = SEVERITIES.map((s) => [s, real.filter((f) => f.severity === s).length] as const).filter(([, n]) => n);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open, focus]);
  useEffect(() => {
    const log = logRef.current;
    if (log && stick.current) log.scrollTo({ top: log.scrollHeight });
  }, [messages, error]);
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.documentElement.style.overflow = ""; };
  }, [open, onClose]);
  useEffect(() => () => abort.current?.abort(), []);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const history: ChatMessage[] = [...messages, { role: "user", content: question }];
    stick.current = true;
    setMessages([...history, { role: "assistant", content: "" }]);
    setDraft("");
    setError("");
    setBusy(true);
    abort.current = new AbortController();
    try {
      await chat(history, findings, focus?.id ?? null, (chunk) =>
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: m[m.length - 1].content + chunk }]),
        abort.current.signal,
      );
      setMessages((m) => (m[m.length - 1].content ? m : m.slice(0, -1)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMessages((m) => m.slice(0, -2));
      setDraft(question);
    }
    setBusy(false);
  };

  const reset = () => { abort.current?.abort(); setMessages([]); setError(""); inputRef.current?.focus(); };

  return (
    <>
      <div className={`chat-scrim ${open ? "is-open" : ""}`} onClick={onClose} aria-hidden="true" />
      <aside className={`chat ${open ? "is-open" : ""}`} role="dialog" aria-label="Ask Fixr" inert={!open}>
        <header className="chat__head">
          <div className="chat__brand">
            <span className="chat__title">Ask Fixr</span>
            <span className="chat__status">Answers from this scan</span>
          </div>
          <div className="chat__tools">
            {messages.length > 0 && <button type="button" className="chat__new" onClick={reset} disabled={busy}>New chat</button>}
            <button type="button" className="chat__close" onClick={onClose} aria-label="Close chat" />
          </div>
        </header>

        <div className="chat__context" style={focus ? { ["--c" as string]: SEVERITY_COLOR[focus.severity] } : undefined}>
          {focus ? (
            <>
              <span className="chat__sev">{focus.severity}</span>
              <span className="chat__ctitle">{focus.title}</span>
              <span className="chat__loc">{focus.file}{focus.line ? `:${focus.line}` : ""}</span>
            </>
          ) : (
            <>
              <span className="chat__ctitle">{real.length === 1 ? "The 1 finding" : `All ${real.length} findings`}</span>
              <span className="chat__counts">
                {counts.map(([s, n]) => <span key={s} style={{ color: SEVERITY_COLOR[s] }}>{n} {s}</span>)}
              </span>
            </>
          )}
        </div>

        <div
          className="chat__log"
          ref={logRef}
          aria-live="polite"
          onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }}
        >
          {messages.length === 0 && (
            <div className="chat__empty">
              <p>Ask anything about {focus ? "this finding" : "these results"}. Plain questions are welcome; no security background needed.</p>
              <div className="chat__starters">
                {STARTERS[focus ? "one" : "all"].map((s, i) => (
                  <button key={s} type="button" style={{ ["--i" as string]: i }} onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => {
            const live = busy && i === messages.length - 1;
            return m.role === "user" ? (
              <div key={i} className="msg msg--user">{m.content}</div>
            ) : (
              <article key={i} className={`msg msg--assistant ${live ? "is-live" : ""}`}>
                <span className="msg__who">Fixr</span>
                {m.content ? <Markdown text={m.content} /> : <span className="msg__thinking">Reading the findings</span>}
                {live && m.content && <span className="msg__caret" aria-hidden="true" />}
                {!live && m.content && <CopyReply text={m.content} />}
              </article>
            );
          })}
          {error && <p className="chat__error">{error}</p>}
        </div>

        <form className="chat__form" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
          <div className="chat__field">
            <textarea
              ref={inputRef}
              value={draft}
              rows={1}
              placeholder={focus ? "Ask about this finding" : "Ask about a finding or a fix"}
              aria-label="Your question"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(draft); } }}
            />
            {busy ? (
              <button type="button" className="chat__send is-stop" onClick={() => abort.current?.abort()} aria-label="Stop answering" />
            ) : (
              <button type="submit" className="chat__send" disabled={!draft.trim()} aria-label="Send" />
            )}
          </div>
          <span className="chat__hint">Enter to send, Shift + Enter for a new line</span>
        </form>
      </aside>
    </>
  );
}
