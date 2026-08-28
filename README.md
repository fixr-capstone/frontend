# Fixr

Security analysis for AI-generated code. Single page, no routing, no auth. All scan
results are mocked in `lib/findings.ts`.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Swapping in a real backend

`getResults(example)` in `lib/findings.ts` is the only place findings come from.
Replace its body with a `fetch` and keep the `Finding` shape:

```ts
type Finding = {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  file: string;
  line: number;
  snippet: string;
  suggestedFix: string;
};
```

`components/Fixr.tsx` already awaits it, so nothing else has to change.

## Files

- `app/layout.tsx` — fonts (Big Shoulders Display / Space Grotesk / JetBrains Mono) + metadata
- `app/globals.css` — the whole design system: color tokens, type scale, every class
- `components/Fixr.tsx` — the page: hero noise field, how-it-works, scanner, results
- `lib/highlight.tsx` — small Python tokenizer used by the textarea overlay and both code blocks
- `lib/findings.ts` — mock data + example source files
