import type { Metadata } from "next";
import Link from "next/link";
import Pipeline from "@/components/Pipeline";

export const metadata: Metadata = { title: "How it works" };

const NUMBERS: [string, string][] = [
  ["66 / 66", "real vulnerabilities kept on the held-out split"],
  ["30 / 30", "hidden findings that really were false alarms"],
  ["44%", "of false alarms removed before you read anything"],
];

export default function HowPage() {
  return (
    <>
      <section className="wrap page-head">
        <p className="eyebrow">How it works</p>
        <h1 className="page-title">From noise to the line that matters.</h1>
        <p className="page-lede">
          The real pipeline, run over the messy sample as you scroll: the four scanners, the false-alarm filter, the ranking and the
          explanations. Every number on this page comes from that scan or from the evaluation below.
        </p>
      </section>

      <Pipeline />

      <section className="wrap model" aria-labelledby="model-title">
        <div className="model__head">
          <p className="eyebrow">The filter</p>
          <h2 className="h2" id="model-title">A classifier that would rather show you too much.</h2>
          <p>
            Only Bandit findings are classified: pip-audit matches a known advisory and deptry and flake8 check fixed rules, so
            there&apos;s nothing for a model to judge. An XGBoost model estimates the chance each Bandit finding is real, from
            four features: severity, confidence, the rule, and whether the flagged line builds a string from a variable.
          </p>
        </div>
        <dl className="model__numbers">
          {NUMBERS.map(([n, label]) => <div key={label}><dt>{n}</dt><dd>{label}</dd></div>)}
        </dl>
        <div className="model__cols">
          <div>
            <h3>Trained on labelled decoys</h3>
            <p>
              The OWASP Benchmark for Python plants real vulnerabilities next to safe look-alikes, which is what a false-alarm
              classifier needs. Bandit fires on 533 of its 1,230 cases: 262 real, 271 false.
            </p>
          </div>
          <div>
            <h3>A labelling bug, found and fixed</h3>
            <p>
              Bandit and the benchmark number some weaknesses differently (weak hashing is CWE-327 to one, CWE-328 to the other),
              so an exact match had labelled 128 real findings as false. The model learned to hide MD5 password hashing. Mapping
              the two numberings fixed it; the honest accuracy fell from an inflated 95% to 83%, and the filter now hides nothing real.
            </p>
          </div>
          <div>
            <h3>Errs on the side of showing</h3>
            <p>
              For <code>exec</code>, <code>eval</code> and XML parsing, real and decoy code look the same to the features, so the
              model can only say about 0.3. The cut-off is 0.1, and high-severity findings are never hidden: if the model doubts
              one, it stays, marked as a likely false alarm. A hidden bug costs more than an extra minute of reading.
            </p>
          </div>
          <div>
            <h3>Where it stops</h3>
            <p>
              The benchmark is synthetic, and the split is by finding rather than by project, so these numbers are optimistic.
              Python only. The next step is a labelled set from real AI-built repositories.
            </p>
          </div>
        </div>
        <p className="model__cta"><Link className="btn btn--primary" href="/scan?sample=messy">See it on the messy sample</Link></p>
      </section>
    </>
  );
}
