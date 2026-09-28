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

## Deploy (Vercel)

Set `FIXR_API_URL` to the backend's public URL (for example `https://fixr-api.onrender.com`).
The build fails on Vercel without it. The backend must allow the Vercel domain in
`FIXR_CORS_ORIGINS`. A production build sends a Content-Security-Policy whose `connect-src`
is that URL.

## Files

- `app/layout.tsx`: fonts (Big Shoulders Display, Space Grotesk, JetBrains Mono) and metadata
- `app/globals.css`: the whole design system. One dark theme, one accent (mint), 2px corners
- `components/Fixr.tsx`: the page. Header, hero, scanner with a flagged-line gutter, results
- `components/Hero.tsx`: the hero. A scan line sweeps the messy sample's raw warnings, crossing out the headline as it goes; false alarms and style notes collapse and the findings worth fixing rise, numbered by priority
- `components/Logo.tsx`: code brackets around one mint bar (the line that matters) and the wordmark; `app/icon.svg` is the same mark as the favicon
- `app/error.tsx`: the error page for unexpected runtime errors
- `app/not-found.tsx`: the 404 page
- `components/Pipeline.tsx`: how it works. The section pins while you scroll and runs scan, filter, rank and explain over the real `app.py` scan, line by line
- `components/XRay.tsx`: results minimap. Each file drawn one bar per line, findings lit by severity and numbered by priority, linked to the list
- `components/Chat.tsx`: the Ask Fixr drawer
- `lib/highlight.tsx`: small Python tokenizer used by the editor and the code blocks
- `lib/findings.ts`: sample data and sample source files
- `lib/api.ts`: live scans. Zips pasted code, posts to the backend, maps its findings to the page's shape
- `lib/signal.ts`: the bar layout and counts used by the hero, derived from `lib/samples.json`
- `lib/samples.json`: real backend output for the three samples (after editing a sample, regenerate with `scripts/snapshot_samples.py`)

## Backend

The browser calls the backend directly at `FIXR_API_URL` (inlined at build time), which avoids
Vercel's proxy body-size and timeout limits; the backend allows the page's origin with CORS.
The live-scanner status polls `GET /api/v0/health` with a long timeout, because a sleeping
Render instance takes up to a minute to wake. `lib/api.ts` adapts the scan response: pasted code is sent as a one-file ZIP, `unknown` severity shows as
`low`, the fix code block is pulled out of `metadata.explanation`, and the raw count
(which the backend does not return) is left out of the summary.

## Fix prompt

After a scan, "Download fix prompt" saves `fixr-fix-prompt.md` (`lib/fixPrompt.ts`): the
findings in priority order, each with the flagged code, what is wrong and the suggested fix,
plus working rules for the AI tool (one fix at a time, no unrelated changes, plain-language
summaries, rotate leaked secrets). It is built in the browser and needs no backend.

## Chat

The "Ask Fixr" drawer (`components/Chat.tsx`) talks to this endpoint on the backend. Without it the drawer shows "Chat is not switched on yet".

`POST /api/v0/chat`, JSON body:

```json
{
  "messages": [{ "role": "user", "content": "Is this actually dangerous?" }],
  "findings": [{ "id": "api1", "rule": "B608", "severity": "high", "title": "...", "file": "app.py",
                 "line": 15, "snippet": "...", "description": "...", "suggestedFix": "...", "style": false }],
  "focus_id": "api1"
}
```

- Stateless: `messages` is the whole conversation so far, ending with the new question.
- `focus_id` is the finding the user asked about, or `null` for the whole scan.
- Reply: the answer as a `text/plain` stream (chunked). Send `Cache-Control: no-cache, no-transform`,
  otherwise a compressing proxy buffers the response and the reply arrives in one piece.
- A 429 means the rate limit was hit. A 404 or 405 shows the "not switched on" message; any other error status shows it to the user.

## Motion

Every animation uses `transform` or `opacity` and switches off under
`prefers-reduced-motion`.
