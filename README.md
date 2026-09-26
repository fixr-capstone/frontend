# Fixr

Security triage for AI-written Python. Single page, no routing, no auth.

**Results on this page are sample data.** Three sample files have prepared results in
`lib/findings.ts`. Pasting your own code shows a "samples only" notice instead of a fake
result, because nothing here is connected to the backend yet.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Files

- `app/layout.tsx`: fonts (Big Shoulders Display, Space Grotesk, JetBrains Mono) and metadata
- `app/globals.css`: the whole design system. One dark theme, one accent (mint), 2px corners
- `components/Fixr.tsx`: the page. Header, hero, scanner with a flagged-line gutter, results
- `components/SignalField.tsx`: the hero. 41 raw warnings, a scan line sweeps across, noise collapses and the 6 real findings rise. Hover or focus a bar to read it
- `components/Pipeline.tsx`: how it works, in the real pipeline order (scan, filter, rank, explain)
- `lib/highlight.tsx`: small Python tokenizer used by the editor and the code blocks
- `lib/findings.ts`: sample data and sample source files

## Connecting the real backend

`getResults(example)` in `lib/findings.ts` is the only place findings come from, but a
`fetch` alone is not enough. The backend (`POST /api/v0/repositories`) differs from this
page in several ways that need an adapter:

| This page expects | Backend returns |
|---|---|
| a pasted code string | a ZIP upload |
| `critical / high / medium / low` | `high / medium / low / unknown` |
| `title` and `description` | `message`, plus `metadata.explanation` on the top findings |
| a separate `suggestedFix` | the fix is inside the explanation text |
| `raw` (count before filtering) | not returned |
| `line` always a number | `null` for dependency findings |
| `id` | none |

The backend also has no CORS, so a browser on another port is blocked until it adds it.

## Motion

Every animation uses `transform` or `opacity` and switches off under
`prefers-reduced-motion`.
