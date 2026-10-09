# Fixr

Security triage for AI-written Python. Single page, no routing, no auth.

A capstone project by Parth, Sparsh, Anushka and Shrey.

The three sample files have prepared results in `lib/samples.json`: a snapshot of what the real backend returns for them, including the LLM explanations. Anything else (edited
samples, pasted code, an uploaded `.zip`, a public GitHub link) is scanned live by the Fixr backend.
For a GitHub link the backend downloads the repository itself (`POST /api/v0/repositories/github`).

Live: https://frontend-rho-two-59.vercel.app (frontend, Vercel) and https://fixr-api-q4k7.onrender.com (backend, Render).

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. For live scans, run the backend (`rest_backend`) on port 8000,
or point the page elsewhere with `FIXR_API_URL=http://host:port npm run dev`.

## Deploy

The frontend is on Vercel and the backend on Render. Deploy the backend first: each side needs
the other's URL.

**Backend (Render).** The backend repo has a `render.yaml` Blueprint: New → Blueprint →
`fixr-capstone/backend`, branch `main`. It asks for three secrets:

| Variable | Value |
|---|---|
| `GROQ_API_KEY` | Groq key for the explanations and chat |
| `GITHUB_TOKEN` | Fine-grained token, read-only Contents on `static-analysis-bundle`, `ML-filtering-` and `RAG-implementation` (they are private git dependencies) |
| `FIXR_CORS_ORIGINS` | The Vercel URL, comma-separated if more than one, e.g. `https://frontend-rho-two-59.vercel.app,http://localhost:3000` |

Check it at `<render url>/api/v0/health`, which returns `{"status":"ok"}`. Limits can be tuned
with `FIXR_MAX_UPLOAD_MB`, `FIXR_SCANS_PER_MINUTE`, `FIXR_CHATS_PER_MINUTE` and
`FIXR_SCAN_CONCURRENCY`.

**Frontend (Vercel).** Import `fixr-capstone/frontend` (Next.js preset, default settings) and set
`FIXR_API_URL` to the Render URL, with no trailing slash. The build fails on Vercel without it,
rather than shipping a page that points at localhost. It is inlined at build time, so after
changing it, redeploy. A production build sends a Content-Security-Policy whose `connect-src` is
that URL. Vercel's free plan cannot import a private repo from an organisation, which is why this
repo is public; it holds no secrets.

## Server status

Render's free tier sleeps after 15 idle minutes and takes 30 to 60 seconds to wake, so a cold
start has to read as "starting", not "broken" (`components/ServerStatus.tsx`):

- A pill in the sticky header shows the state from anywhere on the page: "Connecting", then
  "Waking server · 23s" in amber with a bar that fills over about a minute, then "Server live".
  Clicking it jumps to the scanner. On phones it shrinks to the dot and the counter.
- Above the scanner, a banner explains the wait in plain words while it lasts, and says the
  samples work right away.
- The page polls `GET /api/v0/health` for up to three minutes before showing "offline", so a
  slow wake turns into "live" by itself.

Before a demo, open the site a minute early so the server is already awake.

## Files

- `app/layout.tsx`: fonts (Big Shoulders Display, Space Grotesk, JetBrains Mono) and metadata
- `app/globals.css`: the whole design system. One dark theme, one accent (mint), 2px corners
- `components/Fixr.tsx`: the page. Header, hero, scanner with a flagged-line gutter, results
- `components/Hero.tsx`: the hero. A scan line sweeps the messy sample's raw warnings, crossing out the headline as it goes; false alarms and style notes collapse and the findings worth fixing rise, numbered by priority
- `components/Logo.tsx`: code brackets around one mint bar (the line that matters) and the wordmark; `app/icon.svg` is the same mark as the favicon
- `components/ServerStatus.tsx`: the header status pill and the waking banner
- `components/CliPanel.tsx`: "Fixr on your computer", opened from `›_ CLI` in the header or the `$ fixr scan .` line under the hero buttons. A step-by-step guide for people who have never used a terminal: it picks Windows, macOS or Linux for you, says how to open a terminal, gives each command with a Copy button (a step ticks itself off when its command is copied), scans by dragging the project folder into the terminal, and has a short troubleshooting list and a preview of the report. A website cannot start a program on someone's computer, so the guide is the bridge. The CLI itself lives in [fixr-capstone/cli](https://github.com/fixr-capstone/cli) (private)
- `app/error.tsx`: the error page for unexpected runtime errors
- `app/not-found.tsx`: the 404 page
- `components/Pipeline.tsx`: how it works. The section pins while you scroll and runs scan, filter, rank and explain over the real `app.py` scan, line by line
- `components/ZipView.tsx`: an uploaded project's Python files, read from the archive in the browser. A read head steps down them while scanning; each then shows its finding count
- `components/FindingList.tsx`: the results list and its toolbar, plus the file explorer that replaces the x-ray when a scan covers more than 6 files (see Results)
- `components/XRay.tsx`: results minimap for scans of up to 6 files. Each file drawn one bar per line, findings lit by severity and numbered by priority, linked to the list
- `components/Chat.tsx`: the Ask Fixr drawer
- `lib/highlight.tsx`: small Python tokenizer used by the editor and the code blocks
- `lib/findings.ts`: sample data and sample source files
- `lib/api.ts`: live scans and chat. Zips pasted code, posts to the backend, maps its findings to the page's shape
- `lib/report.ts`: the security grade, the one-line verdict under it, and the printable report behind "Report (PDF)". Each kind of issue costs points by severity, repeats add little, likely false alarms and style notes do not count
- `lib/fixPrompt.ts`: the downloadable fix prompt; `node lib/fixPrompt.check.mts` checks it
- `lib/signal.ts`: the bar layout and counts used by the hero, derived from `lib/samples.json`
- `lib/samples.json`: real backend output for the three samples (after editing a sample, or after a scanner change, regenerate with `scripts/snapshot_samples.py`)

## Backend

The browser calls the backend directly at `FIXR_API_URL`, which avoids Vercel's proxy body-size
and timeout limits; the backend allows the page's origin with CORS. `lib/api.ts` adapts the scan
response: `unknown` severity shows as `low`, the fix code block is pulled out of
`metadata.explanation`, and the raw count (which the backend does not return) is left out of the
summary.

Render sits behind Cloudflare, whose firewall blocks request bodies that look like SQL injection
or similar, and Fixr's own findings quote exactly that. So nothing goes out as plain text: pasted
code is sent as a deflated one-file ZIP, and the chat body is gzipped (`Content-Encoding: gzip`),
which the backend inflates.

## Fix prompt

After a scan, "Download fix prompt" saves `fixr-fix-prompt.md` (`lib/fixPrompt.ts`), a brief for
the AI tool that wrote the code. It is built in the browser and needs no backend, and it stays
short on big projects (a 454-finding scan gives about 12 KB):

- **Fix these:** the top 25 findings in priority order that are medium or above, or that Fixr
  explained, each with the flagged code, what is wrong and the suggested fix.
- **Lower-priority issues:** the rest, grouped by rule, with the names involved, a dozen
  locations and a note when they are in test files. Names that are the project's own folders
  are marked as not missing packages.
- **Likely false alarms:** findings whose explanation says they are harmless, one line each,
  with no suggested fix and an instruction to leave them alone.
- **Style clean-up:** a count per linter rule and advice to run a formatter instead of editing
  by hand.

Plus working rules for the AI tool: one fix at a time, no unrelated changes, plain-language
summaries, rotate leaked secrets.

## Chat

The "Ask Fixr" drawer (`components/Chat.tsx`) talks to this endpoint on the backend. Without it the drawer shows "Chat is not switched on yet".

`POST /api/v0/chat`, JSON body, gzipped:

```json
{
  "messages": [{ "role": "user", "content": "Is this actually dangerous?" }],
  "findings": [{ "id": "api1", "rule": "B608", "severity": "high", "title": "...", "file": "app.py",
                 "line": 15, "snippet": "...", "description": "...", "suggestedFix": "...", "style": false }],
  "focus_id": "api1"
}
```

- Stateless: `messages` is the whole conversation so far, ending with the new question.
- `findings` is the focused finding plus the top 40 others, clipped to the backend's field limits.
  The backend takes at most 300 and writes each one into the model's prompt.
- `focus_id` is the finding the user asked about, or `null` for the whole scan.
- Reply: the answer as a `text/plain` stream (chunked). Send `Cache-Control: no-cache, no-transform`,
  otherwise a compressing proxy buffers the response and the reply arrives in one piece.
- A 429 means the rate limit was hit. A 404 or 405 shows the "not switched on" message; any other error status shows it to the user.

## Results

Built so a big project (hundreds of findings across dozens of files) stays a short page
(`components/FindingList.tsx`):

- **Toolbar.** A prompt-style search (`> filter by file, rule or text`; press `/` anywhere to jump
  to it), the severity chips, and a switch between By issue, By file and By priority. On wide
  screens it stays under the header. A chosen file shows as a removable chip
  (`in client/operations/file_operations.py ×`); focus rings appear for keyboard use only.
- **Grouping.** Scans of more than 25 findings group by issue, so 50 copies of one warning are one
  row ("B105 · 50 places in 50 files") with its places inside, 20 at a time. The priority view
  renders 40 rows at a time. When every group would hold one finding (one file in scope), the list
  is shown flat.
- **Explorer.** Scans of more than 6 files get an editor-style explorer in the left column instead
  of a minimap per file. The folder every file shares (a zip's `<repo>-main/`) is shown once as the
  project name; files sit under their folders with totals; each file has a signal bar as long as
  its share of the worst file and coloured by its severity mix. Clicking a file scopes the list and
  dims the rest. The column scrolls on its own, so it stays in view. On phones the explorer hides
  and a compact file picker takes its place in the toolbar.
- **Paths** drop the shared root and wrap after a `/`, not mid-name.
- Picking a finding from the x-ray, the editor gutter or the hero clears the filters, opens its
  group, pages to it and scrolls it clear of the toolbar.

## Motion and performance

Every animation uses `transform` or `opacity`, so it runs on the compositor and never re-lays out
or repaints the page, and it switches off under `prefers-reduced-motion`. The moving parts:

- **Hero:** a faint grid fades in, a mint scan line passes down every few seconds, and the signal
  sweep crosses out the headline.
- **Buttons:** a light sweep across primary buttons on hover; a press-down on click.
- **Grouping switch:** the highlight slides between By issue, By file and By priority.
- **Results:** changing grouping, severity or file morphs between views (View Transitions; browsers
  without it, or a transition that cannot start, get the instant update). Rows rise in, capped to
  the first few.
- **Copy buttons** pop when they copy; **CLI guide steps** send out a ring when they tick off.
- **Scroll-driven, no JavaScript:** the reading-progress bar under the header and the back-to-top
  button that fades in further down both use CSS scroll timelines.

Long result lists stay smooth: hover links a row to its X-ray bar by toggling a class instead of
re-rendering, entrance staggers are capped to the first rows, and off-screen rows skip layout
(`content-visibility`). The header uses a near-opaque background instead of a backdrop blur,
which would repaint on every scroll frame.
