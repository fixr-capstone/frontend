import React from "react";

const KEYWORDS =
  /^(import|from|def|return|try|except|pass|raise|if|elif|else|for|while|with|as|in|is|not|and|or|None|True|False|class|lambda|assert|del|global|yield|async|await)\b/;

const C = {
  comment: "#6E7488",
  string: "#F2C94C",
  keyword: "#5DF9C0",
  call: "#A9B8FF",
  number: "#FF9F45",
  ident: "#E2E8F2",
  punct: "#8F94A6",
};

/** Tiny Python tokenizer for one line. Good enough for snippets; swap for Shiki if you need real grammars. */
export function highlightLine(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let rest = line;
  let m: RegExpMatchArray | null;

  while (rest.length) {
    let color: string;
    let text: string;

    if ((m = rest.match(/^#.*/))) { color = C.comment; text = m[0]; }
    else if ((m = rest.match(/^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/))) { color = C.string; text = m[0]; }
    else if ((m = rest.match(KEYWORDS))) { color = C.keyword; text = m[0]; }
    else if ((m = rest.match(/^[A-Za-z_][A-Za-z0-9_]*(?=\()/))) { color = C.call; text = m[0]; }
    else if ((m = rest.match(/^[A-Z][A-Z0-9_]{2,}\b/))) { color = C.number; text = m[0]; }
    else if ((m = rest.match(/^\d+(?:\.\d+)?/))) { color = C.number; text = m[0]; }
    else if ((m = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/))) { color = C.ident; text = m[0]; }
    else if ((m = rest.match(/^\s+/))) { color = C.ident; text = m[0]; }
    else { color = C.punct; text = rest[0]; }

    parts.push(<span key={parts.length} style={{ color }}>{text}</span>);
    rest = rest.slice(text.length);
  }

  return parts;
}

/** Whole-snippet highlighting, one div per line. */
export function highlight(code: string): React.ReactNode[] {
  return (code ?? "").split("\n").map((line, i) => {
    const parts = highlightLine(line);
    return <div key={i} className="hl-line">{parts.length ? parts : "​"}</div>;
  });
}
