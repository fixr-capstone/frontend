# Fixr

Security triage for AI-written Python. Single page, no routing, no auth.

The three sample files have prepared results in `lib/samples.json`: a snapshot of what the real backend returns for them, including the LLM explanations. Anything else (edited
samples, pasted code, an uploaded `.zip`) is scanned live by the Fixr backend.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. For live scans, run the backend (`rest_backend`) on port 8000,
or point the page elsewhere with `FIXR_API_URL=http://host:port npm run dev`.

## Files

- `app/layout.tsx`: fonts (Big Shoulders Display, Space Grotesk, JetBrains Mono) and metadata
- `app/globals.css`: the whole design system. One dark theme, one accent (mint), 2px corners
- `components/Fixr.tsx`: the page. Header, hero, scanner with a flagged-line gutter, results
- `components/Hero.tsx`: the hero. A scan line sweeps the messy sample's raw warnings, crossing out the headline as it goes; false alarms and style notes collapse and the findings worth fixing rise, numbered by priority
- `components/Pipeline.tsx`: how it works, in the real pipeline order (scan, filter, rank, explain)
- `lib/highlight.tsx`: small Python tokenizer used by the editor and the code blocks
- `lib/findings.ts`: sample data and sample source files
- `lib/api.ts`: live scans. Zips pasted code, posts to the backend, maps its findings to the page's shape
- `lib/signal.ts`: the bar layout and counts shared by the hero and the pipeline funnel, derived from `lib/samples.json`
- `lib/samples.json`: real backend output for the three samples (after editing a sample, regenerate with `scripts/snapshot_samples.py`)

## Backend

`next.config.mjs` proxies `/api/v0/*` to the backend, so it needs no CORS. `lib/api.ts`
adapts the response: pasted code is sent as a one-file ZIP, `unknown` severity shows as
`low`, the fix code block is pulled out of `metadata.explanation`, and the raw count
(which the backend does not return) is left out of the summary.

## Motion

Every animation uses `transform` or `opacity` and switches off under
`prefers-reduced-motion`.
