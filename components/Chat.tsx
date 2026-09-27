"use client";

import { useEffect, useRef, useState } from "react";
import { chat, type ChatMessage } from "@/lib/api";
import { highlight } from "@/lib/highlight";
import type { Finding } from "@/lib/findings";

const STARTERS = {
  all: ["Which of these should I fix first?", "Explain these like I'm not a developer", "Which ones could be false alarms?"],
  one: ["Explain this like I'm not a developer", "Is this actually dangerous in my code?", "Walk me through applying the fix"],
};

/** Plain text with fenced code blocks drawn as highlighted code; odd split parts are the code. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/```[\w-]*\n?/).map((part, i) =>
        i % 2 ? <pre key={i}>{highlight(part.trimEnd())}</pre> : part.trim() && <p key={i}>{part.trim()}</p>,
      )}
    </>
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

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open, focus]);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [messages, error]);
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

  return (
    <>
      <div className={`chat-scrim ${open ? "is-open" : ""}`} onClick={onClose} aria-hidden="true" />
      <aside className={`chat ${open ? "is-open" : ""}`} role="dialog" aria-label="Ask Fixr" inert={!open}>
        <header className="chat__head">
          <div>
            <span className="chat__title">Ask Fixr</span>
            <span className="chat__about">{focus ? `${focus.title} (line ${focus.line})` : `About all ${findings.filter((f) => !f.style).length} findings`}</span>
          </div>
          <button type="button" className="chat__close" onClick={onClose} aria-label="Close chat" />
        </header>

        <div className="chat__log" ref={logRef} aria-live="polite">
          {messages.length === 0 && (
            <div className="chat__empty">
              <p>Ask anything about these results. Answers are grounded in the scan and your code, and plain questions are welcome.</p>
              <div className="chat__starters">
                {STARTERS[focus ? "one" : "all"].map((s) => (
                  <button key={s} type="button" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`msg msg--${m.role}`}>
              {m.content ? <Rich text={m.content} /> : <span className="msg__typing" aria-label="Fixr is answering" />}
            </div>
          ))}
          {error && <p className="chat__error">{error}</p>}
        </div>

        <form className="chat__form" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
          <textarea
            ref={inputRef}
            value={draft}
            rows={2}
            placeholder="Ask about a finding or a fix"
            aria-label="Your question"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(draft); } }}
          />
          {busy
            ? <button type="button" className="btn btn--ghost" onClick={() => abort.current?.abort()}>Stop</button>
            : <button type="submit" className="btn btn--primary" disabled={!draft.trim()}>Send</button>}
        </form>
      </aside>
    </>
  );
}
