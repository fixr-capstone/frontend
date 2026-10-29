import Link from "next/link";
import samples from "@/lib/samples.json";
import Hero from "@/components/Hero";
import HomeReview from "@/components/HomeReview";

const { raw, dropped, findings } = samples.messy;
const real = findings.filter((f) => f.category !== "style").length;
const explained = findings.filter((f) => "explanation" in f.metadata).length;

const STEPS: [string, string, string][] = [
  ["Scan", `${raw} warnings`, "Bandit, pip-audit, deptry and flake8 read every file. Between them they flag anything that might be a problem: most of it is noise."],
  ["Filter", `${dropped.length} dropped`, "A classifier trained on labelled benchmark results drops the confident false alarms. Anything high-severity it doubts stays, marked as a likely false alarm."],
  ["Rank", `${real} ranked`, "What's left is ordered by severity times the chance it's real, so the first finding is the one to fix first. Style notes step aside."],
  ["Explain", `${explained} explained`, "An LLM reads the code around the top findings and writes what's wrong in plain words, with an example change."],
];

export default function Home() {
  return (
    <>
      <Hero />

      <section className="wrap demo" aria-labelledby="demo-title">
        <div className="demo__intro">
          <p className="eyebrow">The review</p>
          <h2 className="h2" id="demo-title">It points. You fix.</h2>
          <p>
            Fixr doesn&apos;t hand you a rewritten repository you&apos;d have to trust blindly. It reads like a code review: the
            exact characters are marked, and the note under the line says what to change and how to check it.
          </p>
          <ul className="demo__points">
            <li><b>The exact text.</b> Not just the line: the string, call or argument that needs to change.</li>
            <li><b>What to change, and how to check.</b> One instruction per finding, written for the rule, plus the AI&apos;s example change.</li>
            <li><b>A brief for your AI tool.</b> Copy a prompt for one finding, or download one for the whole scan.</li>
          </ul>
        </div>
        <div className="demo__review">
          <HomeReview />
        </div>
      </section>

      <section className="wrap steps-home" aria-labelledby="steps-title">
        <div className="steps-home__head">
          <p className="eyebrow">How it works</p>
          <h2 className="h2" id="steps-title">Four scanners in, one ranked list out.</h2>
          <Link className="linkish" href="/how">The full pipeline and the model behind the filter</Link>
        </div>
        <ol className="steps-home__list">
          {STEPS.map(([verb, count, body], i) => (
            <li key={verb}>
              <span className="steps-home__n">{String(i + 1).padStart(2, "0")}</span>
              <h3>{verb} <span>{count}</span></h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap closer" aria-labelledby="closer-title">
        <h2 className="h2" id="closer-title">Point it at a repository.</h2>
        <form className="repo repo--wide" action="/scan" method="get">
          <input className="repo__input" type="text" name="repo" inputMode="url" spellCheck={false} autoComplete="off" placeholder="github.com/owner/repo" aria-label="Public GitHub repository link" required />
          <button className="btn btn--primary" type="submit">Open in the scanner</button>
        </form>
        <p className="closer__alt">Or <Link className="linkish" href="/scan">paste code or upload a .zip</Link>.</p>
      </section>
    </>
  );
}
