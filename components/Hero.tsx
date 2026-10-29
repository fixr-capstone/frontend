"use client";

import type { Finding } from "@/lib/findings";
import { COUNTS, SEV_SHORT, real, shortTitle } from "@/lib/board";
import { grade } from "@/lib/report";

/**
 * The hero: the question every vibe-coded app faces, and the answer printed as a triage receipt for the
 * messy sample's real scan: raw warnings in, false alarms and style notes out, the findings in order.
 */
const G = grade(real);
const STEPS = ["Collect", "Filter", "Rank", "Explain"];

export default function Hero({
  onPick,
  onNav,
  onCli,
}: {
  findings?: Finding[];
  onPick: (finding: Finding) => void;
  onNav: (id: string) => void;
  onCli: () => void;
}) {
  return (
    <section className="wrap hx">
      <div className="hx__copy">
        <p className="hx__eyebrow">FOR APPS BUILT WITH CHATGPT, CLAUDE, CURSOR, COPILOT</p>
        <h1 className="hx__title">It runs.<br /><span>Is it safe<br />to ship?</span></h1>
        <p className="hx__sub">
          Security scanners print pages of warnings. Fixr prints the few that matter, in order, with what each one means and
          what to tell your AI tool. It never changes your code.
        </p>
        <div className="hx__ctas">
          <a className="btn btn--primary" href="#scanner" onClick={(e) => { e.preventDefault(); onNav("scanner"); }}>Scan your code</a>
          <a className="btn btn--ghost" href="#how" onClick={(e) => { e.preventDefault(); onNav("how"); }}>How it works</a>
        </div>
        <ol className="hx__steps" aria-label="What Fixr does">
          {STEPS.map((s, i) => (
            <li key={s}><span>{String(i + 1).padStart(2, "0")}</span><b className={i === 3 ? "is-last" : undefined}>{s}</b></li>
          ))}
        </ol>
        <button type="button" className="hx__cli" onClick={onCli} aria-haspopup="dialog">
          <code>$ fixr scan .<i aria-hidden="true" /></code>
          or print one on your own machine
        </button>
      </div>

      <figure
        className="rc"
        aria-label={`A printed triage receipt for app.py: ${COUNTS.raw} raw warnings, ${COUNTS.dropped} false alarms dropped, ${COUNTS.style} style notes set aside, ${COUNTS.real} worth fixing, listed in order`}
      >
        <div className="rc__printer">
          <span>FIXR · TRIAGE</span>
          <i className="rc__led" aria-hidden="true" />
        </div>
        <div className="rc__slot" aria-hidden="true" />
        <div className="rc__window">
          <div className="rc__paper">
            <div className="rc__head">
              <b>FIXR</b>
              <span>app.py · 31 lines · 4 scanners</span>
            </div>
            <hr />
            <p className="rc__row"><span>RAW WARNINGS</span><span>{COUNTS.raw}</span></p>
            <p className="rc__row rc__row--dim"><span>FALSE ALARMS DROPPED</span><span>−{COUNTS.dropped}</span></p>
            <p className="rc__row rc__row--dim"><span>STYLE NOTES SET ASIDE</span><span>−{COUNTS.style}</span></p>
            <hr />
            <p className="rc__row rc__row--total rc__row--big"><span>WORTH FIXING</span><span>{COUNTS.real}</span></p>
            <hr />
            <ol className="rc__list">
              {real.map((f, i) => (
                <li key={f.id}>
                  <button type="button" onClick={() => onPick(f)} title={f.title}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <b className={`rc__sev rc__sev--${f.severity}`}>{SEV_SHORT[f.severity]}</b>
                    <span className="rc__what">{shortTitle(f)}</span>
                    <span className="rc__line">:{f.line}</span>
                  </button>
                </li>
              ))}
            </ol>
            <hr />
            <p className="rc__row rc__row--total"><span>GRADE</span><span>{G.letter} · {G.score}/100</span></p>
            <p className="rc__hand">Hand this to your AI tool:<br /><b>fix-prompt.md</b></p>
            <p className="rc__fine">Guidance, not a security audit.</p>
            <div className="rc__stamp" aria-hidden="true">START AT 01</div>
            <svg className="rc__tear" aria-hidden="true" viewBox="0 0 370 10" preserveAspectRatio="none">
              <path d="M0 10 L0 0 L10 10 L20 0 L30 10 L40 0 L50 10 L60 0 L70 10 L80 0 L90 10 L100 0 L110 10 L120 0 L130 10 L140 0 L150 10 L160 0 L170 10 L180 0 L190 10 L200 0 L210 10 L220 0 L230 10 L240 0 L250 10 L260 0 L270 10 L280 0 L290 10 L300 0 L310 10 L320 0 L330 10 L340 0 L350 10 L360 0 L370 10 Z" />
            </svg>
          </div>
        </div>
      </figure>
    </section>
  );
}
