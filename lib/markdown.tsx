"use client";

import { useState, type ReactNode } from "react";
import { highlight } from "@/lib/highlight";

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "label"; text: string }
  | { kind: "ol" | "ul"; items: string[] }
  | { kind: "code"; code: string };

/** Just enough Markdown for model answers: paragraphs, labels, lists, fenced code, `code` and **bold**. */
export function parse(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const last = blocks[blocks.length - 1];
    if (line.trimStart().startsWith("```")) {
      const code: string[] = [];
      while (++i < lines.length && !lines[i].trimStart().startsWith("```")) code.push(lines[i]);
      blocks.push({ kind: "code", code: code.join("\n") });
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.*)$/) ?? line.match(/^\*\*([^*]+)\*\*:?\s*$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    if (heading) blocks.push({ kind: "label", text: heading[1].replace(/:$/, "") });
    else if (ol || ul) {
      const kind = ol ? "ol" : "ul";
      const item = (ol ?? ul)![1];
      if (last?.kind === kind) last.items.push(item);
      else blocks.push({ kind, items: [item] });
    } else if (!line.trim()) {
      if (last?.kind === "p") blocks.push({ kind: "p", lines: [] });
    } else if (/^\s{2,}\S/.test(line) && (last?.kind === "ol" || last?.kind === "ul")) {
      last.items[last.items.length - 1] += " " + line.trim();
    } else if (last?.kind === "p") last.lines.push(line.trim());
    else blocks.push({ kind: "p", lines: [line.trim()] });
  }
  return blocks.filter((b) => b.kind !== "p" || b.lines.length);
}

function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("`") && part.endsWith("`") && part.length > 2 ? <code key={i}>{part.slice(1, -1)}</code>
      : part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part,
  );
}

export function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="md-code">
      <button
        type="button"
        className="md-code__copy"
        onClick={() => {
          navigator.clipboard?.writeText(code).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre>{highlight(code)}</pre>
    </div>
  );
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`md ${className ?? ""}`}>
      {parse(text).map((b, i) => {
        if (b.kind === "code") return <CodeBlock key={i} code={b.code} />;
        if (b.kind === "label") return <p key={i} className="md-label">{inline(b.text)}</p>;
        if (b.kind === "p") return <p key={i}>{b.lines.map((l, j) => <span key={j}>{j > 0 && " "}{inline(l)}</span>)}</p>;
        const List = b.kind;
        return <List key={i}>{b.items.map((item, j) => <li key={j}>{inline(item)}</li>)}</List>;
      })}
    </div>
  );
}
