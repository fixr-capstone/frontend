import { COUNTS, SEV_SHORT, TILES, TOP, shortTitle } from "@/lib/board";
import { SEVERITY_COLOR } from "@/lib/findings";

/**
 * How it works, as a sorting board: every raw warning in the messy sample is a tile. False alarms turn
 * over and drop out, style notes slide into a set-aside tray, the findings line up ranked, and the top
 * one opens its explanation. Pure CSS on a 16 s loop; reduced motion shows the sorted board.
 */
const TILE_W = 172;
const TILE_H = 48;
const COL = TILE_W + 12;
const ROW = TILE_H + 12;
const PAD = 16;

const STAGES: [string, string][] = [
  ["Scan", "Bandit, pip-audit, deptry and flake8 drop every warning on the board."],
  ["Filter", "XGBoost turns over confident false alarms. High severity gets a label, never a bin."],
  ["Rank", "Style notes go to the tray. The rest line up by severity times likelihood."],
  ["Explain", "A language model reads the code around the top tiles and says what to change."],
];
const COUNT_ROWS: [number, string][] = [
  [COUNTS.raw, "warnings"],
  [COUNTS.left, "left"],
  [COUNTS.real, "worth fixing"],
  [COUNTS.explained, "explained"],
];
const top = TOP.finding;
const loc = (line: number) => (line > 0 ? `:${line}` : "req");

export default function Pipeline() {
  return (
    <section className="wrap hv" id="how" aria-labelledby="hv-title">
      <div className="hv__head">
        <div className="hv__intro">
          <p className="hv__eyebrow">HOW IT WORKS · THE MESSY SAMPLE, SORTED</p>
          <h2 id="hv-title" className="hv__title">Nineteen tiles.<br /><span>Four moves.</span></h2>
        </div>
        <div className="hv__lede">
          <p>Every warning in <code>app.py</code> is a tile. Watch Fixr turn them over, set the noise aside, and put the rest in the order you should fix them.</p>
          <a href="#scanner">Skip to the scanner →</a>
        </div>
      </div>

      <div className="hv__body">
        <div className="hv__side">
          <div>
            <span className="hv__label">ON THE BOARD</span>
            <div className="hv__countwin" aria-live="polite">
              <div className="hv-count">
                {COUNT_ROWS.map(([n, label], i) => (
                  <div key={label} className={`hv__count hv__count--${i}`}><b>{n}</b><span>{label}</span></div>
                ))}
              </div>
            </div>
          </div>
          <ol className="hv__stages">
            <li aria-hidden="true" className="hv-rail" />
            {STAGES.map(([verb, body], i) => (
              <li key={verb} className="hv__stage">
                <span className={i === 3 ? "is-last" : undefined}><i>{String(i + 1).padStart(2, "0")}</i>  {verb}</span>
                <span>{body}</span>
              </li>
            ))}
          </ol>
          <p className="hv__proof">Held-out benchmark: <b>66/66</b> real vulnerabilities kept, <b>30/30</b> hidden findings were false alarms.</p>
        </div>

        <div className="hv__boardwrap">
          <div className="hv__boardbar"><span>app.py · 31 lines</span><span>tiles = scanner warnings</span></div>
          <figure
            className="hv__board"
            aria-label={`Sorting board: ${COUNTS.raw} warning tiles. ${COUNTS.dropped} false alarms flip and drop out, ${COUNTS.style} style notes slide into a set-aside tray, ${COUNTS.real} findings line up ranked 01 to ${String(COUNTS.real).padStart(2, "0")}, and an explanation opens for finding 01.`}
          >
            <div className="hv-sweep" aria-hidden="true" />
            <div className="hv-falbl hv__falbl">−{COUNTS.dropped} false alarms<br /><span>turned over, dropped</span></div>
            <div className="hv-tray hv__tray"><span>SET ASIDE · {COUNTS.style} STYLE NOTES</span></div>

            {TILES.map((t, i) => {
              const left = PAD + (i % 4) * COL;
              const top0 = PAD + Math.floor(i / 4) * ROW;
              const pos = { left, top: top0 };
              const delay = { animationDelay: `${i * 40}ms` };
              if (t.kind === "alarm") {
                return (
                  <div key={i} className="hv__cell" style={pos}>
                    <div className="hv-in" style={delay}>
                      <div className="hv-fa hv__flip">
                        <div className="hv-front hv__tile hv__tile--front"><span>{t.rule}</span><span className="hv__dim">{loc(t.line)}</span></div>
                        <div className="hv-back hv__tile hv__tile--alarm"><b>FALSE ALARM</b><span className="hv__dim">{t.rule}</span></div>
                      </div>
                    </div>
                  </div>
                );
              }
              if (t.kind === "style") {
                const move = { ["--dx" as string]: `${240 + t.slot * 46 - left}px`, ["--dy" as string]: `${468 - top0}px` };
                return (
                  <div key={i} className="hv__cell" style={pos}>
                    <div className="hv-in" style={delay}>
                      <div className="hv-st hv__tile hv__tile--style" style={move}><span>{t.rule}</span><span className="hv__dim">{loc(t.line)}</span><em>style</em></div>
                    </div>
                  </div>
                );
              }
              const move = { ["--dx" as string]: `${PAD - left}px`, ["--dy" as string]: `${PAD + (t.rank - 1) * ROW - top0}px` };
              const c = SEVERITY_COLOR[t.finding.severity];
              return (
                <div key={i} className="hv__cell" style={pos}>
                  <div className="hv-in" style={delay}>
                    <div className="hv-rl hv__tile hv__tile--real" style={move}>
                      <span>{t.rule}</span><span className="hv__dim">{loc(t.line)}</span>
                      <div className="hv-sev hv__sevface" style={{ borderColor: c }}>
                        <span className="hv__dim">{String(t.rank).padStart(2, "0")}</span>
                        <span className="hv__what">{shortTitle(t.finding)}</span>
                        <b style={{ color: c }}>{SEV_SHORT[t.finding.severity]}</b>
                      </div>
                      {t.rank <= COUNTS.explained && <span className="hv-ex hv__ex" aria-hidden="true" />}
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="hv-panel hv__panel">
              <div className="hv__panelhead">
                <b>01 · {SEV_SHORT[top.severity]}</b>
                <span>{top.file}:{top.line} · {top.rule}</span>
                <em>EXPLAINED</em>
              </div>
              <p className="hv__paneltitle">{top.title}</p>
              <p className="hv__panellead">{TOP.lead}</p>
              <div className="hv__panelcode">
                <div><span className="is-bad">FLAGGED</span><code className="is-bad">{TOP.flagged}</code></div>
                {TOP.fix && <div><span className="is-good">FIX LOOKS LIKE</span><code className="is-good">{TOP.fix}</code></div>}
              </div>
              <div className="hv__panelfoot">
                <span>02–{String(COUNTS.explained).padStart(2, "0")} explained the same way</span>
                <b>→ fix-prompt.md</b>
              </div>
            </div>
          </figure>
        </div>
      </div>

      <div className="hv__handoff">
        <div>
          <span className="hv__label">THEN · HAND IT OFF</span>
          <p>The sorted board becomes a fix prompt for the AI tool you already use. Fixr never edits your repo. You and your AI make the changes, one at a time.</p>
        </div>
        <div className="hv__handoffcta">
          <a className="btn btn--primary" href="#scanner">Sort my code</a>
        </div>
      </div>
    </section>
  );
}
