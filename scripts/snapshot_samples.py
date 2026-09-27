"""Regenerates lib/samples.json from the real backend.

Run from the backend checkout, with GROQ_API_KEY set:
    uv run python <frontend>/scripts/snapshot_samples.py <frontend>
"""
import asyncio, json, re, sys, tempfile
from pathlib import Path

sys.path.insert(0, "rest_backend/src")
import rest_backend.main  # noqa: F401  sets the bundle config path
from rest_backend.patches import static_analyze
from ml_filtering.normalizer import normalize_directory
from ml_filtering.filtering import deduplicate
from ml_filtering.pipeline import run_pipeline, warm_up
from fixr_rag.context import attach_context
from fixr_rag.explain import explain_findings, select_for_explanation

FRONT = Path(sys.argv[1])
src = (FRONT / "lib/findings.ts").read_text(encoding="utf-8")
codes = dict(zip(["messy", "minor", "clean"], re.findall(r"code: `(.*?)`,", src, re.S)))
names = {"messy": "app.py", "minor": "profile.py", "clean": "clean.py"}

async def snap(key):
    with tempfile.TemporaryDirectory() as tmp:
        repo, out = Path(tmp) / "repository", Path(tmp) / "analysis"
        repo.mkdir()
        (repo / names[key]).write_text(codes[key], encoding="utf-8")
        await static_analyze(repo, out)
        raw = deduplicate(normalize_directory(out))
        ranked = run_pipeline(out)
        kept = {(f.rule_id, f.line) for f in ranked}
        dropped = [{"rule_id": f.rule_id, "line": f.line} for f in raw if (f.rule_id, f.line) not in kept]
        top = select_for_explanation(ranked)
        attach_context(top, repo)
        await explain_findings(top)
        for f in ranked:
            f.file_path = Path(f.file_path).name
            f.metadata.pop("source_context", None)
        return {"raw": len(raw), "dropped": dropped, "findings": [f.model_dump(mode="json") for f in ranked]}

async def main():
    warm_up()
    data = {k: await snap(k) for k in codes}
    (FRONT / "lib/samples.json").write_text(json.dumps(data, indent=1) + "\n", encoding="utf-8")
    for k, v in data.items():
        print(k, "raw", v["raw"], "dropped", v["dropped"], "kept", len(v["findings"]), [(f["rule_id"], f["severity"], f["line"], "explanation" in f["metadata"]) for f in v["findings"]])

asyncio.run(main())
