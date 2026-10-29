# Fixr

Security triage for AI-written Python. Four pages, no auth.

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

## Pages

| Route | What it is |
|---|---|
| `/` | The pitch: a hero showing the scanners' raw output against one Fixr review note, a live review of the messy sample, the four steps, and a GitHub link box |
| `/scan` | The scanner: paste code (or pick a sample), upload a `.zip`, or point at a public GitHub repository; then the results |
| `/how` | The pipeline run over the messy sample as you scroll, and the model card: what the filter does, its numbers and its limits |
| `/cli` | The guide to running Fixr from a terminal, for people who have never used one |

`/scan?sample=messy` runs a sample on arrival; `/scan?repo=<link>` fills in a repository (the home page's link box uses it).

## Files

- `app/layout.tsx`: fonts (Anybody, Schibsted Grotesk, IBM Plex Mono, self-hosted), metadata, and the header and footer every page shares
- `app/page.tsx`, `app/scan/page.tsx`, `app/how/page.tsx`, `app/cli/page.tsx`: the four pages
- `app/globals.css`: the whole design system. One dark theme, one accent (mint), 2px corners
- `components/SiteHeader.tsx`, `components/SiteFooter.tsx`: navigation, with the current page marked
- `components/Hero.tsx`: the home hero, built from the messy sample's real scan: the raw scanner output (style notes faded, false alarms struck through, the 7 findings numbered) with one review note laid over it
- `components/Scanner.tsx`: the `/scan` page. Source tabs (code, `.zip`, GitHub), the scan, the verdict bar, and the code review or list
- `components/CodeReview.tsx`: the results as a code review (see Review)
- `components/HomeReview.tsx`: the same review over the messy sample, live on the home page
- `components/Logo.tsx`: the wordmark, drawn as outlines. Its F is built from code lines: the stem is the editor's gutter, the arms are lines, and the mint arm is the finding worth fixing. `app/icon.svg` (favicon) and `app/apple-icon.png` use the small-size cut of the same F. Masters, exports and usage guide: `../fixr-logo-kit/`
- `components/ServerStatus.tsx`: one site-wide poll of the backend (in the root layout, so opening any page starts waking a sleeping server), the header status pill and the waking banner
- `components/CliGuide.tsx`: the CLI guide. It picks Windows, macOS or Linux for you, gives each command with a Copy button (a step ticks itself off when its command is copied), and has a troubleshooting list and a preview of the report. The CLI itself lives in [fixr-capstone/cli](https://github.com/fixr-capstone/cli) (private)
- `components/Pipeline.tsx`: how it works. The section pins while you scroll and runs scan, filter, rank and explain over the real `app.py` scan, line by line
- `components/ZipView.tsx`: an uploaded project's Python files, read from the archive in the browser (or the repository's, for a GitHub scan). A read head steps down them while scanning; each then shows its finding count
- `components/FindingList.tsx`: the list view and its toolbar, plus the file explorer for scans of more than 6 files
- `components/Chat.tsx`: the Ask Fixr drawer
- `app/error.tsx`, `app/not-found.tsx`: the error and 404 pages
- `lib/hints.ts`: per-rule review hints: which characters to mark, what to change, how to check it. `node lib/hints.check.mts` checks the marking
- `lib/highlight.tsx`: small Python tokenizer used by the editor and the code blocks
- `lib/findings.ts`: sample data and sample source files
- `lib/api.ts`: live scans and chat. Zips pasted code, posts to the backend, maps its findings and returned sources to the page's shape
- `lib/report.ts`: the security grade, the one-line verdict, and the printable report behind "Report (PDF)". Each kind of issue costs points by severity, repeats add little, likely false alarms and style notes do not count
- `lib/fixPrompt.ts`: the downloadable fix prompt, and the one-finding prompt in each review note; `node lib/fixPrompt.check.mts` checks it
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

## Review

The middle ground between a list of warnings and a rewritten repository: Fixr shows where and what,
and the fix stays with the user or their AI tool (`components/CodeReview.tsx`, `lib/hints.ts`).

- **The file, not a snippet.** Each scan returns the text of the files with findings (the backend
  caps it at 256 KB a file, 3 MB in all). Short files show whole; longer ones show each flagged
  line with three lines before and two after, the gaps folded behind "Show 42 more lines".
- **The exact characters.** On each flagged line the text to change is underlined: the secret's
  value, the SQL string being concatenated, `hashlib.md5`, `requests.get(`, `shell=True`. The
  pattern comes from the rule; without one, from the column the scanner reported.
- **A note under the line**, as in a code review: what's wrong in one sentence, then **Change**
  (one instruction written for that rule) and **Check** (how to tell it's fixed). The LLM's longer
  explanation and its example change, shown as a diff against the flagged line, sit behind two
  disclosures.
- **Actions per finding:** copy `file:line`, copy a prompt for just this issue, ask Fixr, mark it
  handled. Handled findings fade, and the verdict bar counts them ("3 of 7 handled").
- **Not tied to a line:** dependency advisories get the same notes in a section of their own.
- Several files get a file list on the left, each with the findings still open.

The list view (`components/FindingList.tsx`) is still there for big scans:

- **Toolbar.** A prompt-style search (`> filter by file, rule or text`; press `/` anywhere to jump
  to it), the severity chips, and a switch between By issue, By file and By priority.
- **Grouping.** Scans of more than 25 findings group by issue, so 50 copies of one warning are one
  row ("B105 · 50 places in 50 files") with its places inside, 20 at a time.
- **Explorer.** Scans of more than 6 files get an editor-style explorer: files under their folders,
  each with a bar as long as its share of the worst file. Clicking a file scopes the list.

## Motion and performance

Motion is kept to what explains something, uses only `transform` or `opacity` (so it runs on the
compositor and never re-lays out the page), and switches off under `prefers-reduced-motion`:

- **Logo:** the F's stem grows and its code lines draw in on load; on hover the finding line
  stretches and blinks like a cursor.
- **Scanning:** a read head steps down the editor or the project's file list, and the pipeline
  steps tick off.
- **How it works:** the pinned pipeline section advances stage by stage as you scroll.
- **Small feedback:** buttons press down, copy buttons pop, review notes open with a short rise,
  the grouping switch slides, CLI steps send out a ring when they tick off.
- **Scroll-driven, no JavaScript:** the reading-progress line under the header.

The hero is deliberately still: it makes its point with the real scan, not with an animation.
Long result lists stay smooth: entrance staggers are capped to the first rows, and off-screen rows
skip layout (`content-visibility`). The header uses a near-opaque background instead of a backdrop
blur, which would repaint on every scroll frame.
