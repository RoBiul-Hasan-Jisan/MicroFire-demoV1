"""One command: rebuild the table, retrain, re-plan the next tests, and write a changelog entry.

    python3 pipelines/retrain.py            # after adding cited rows to data/curated/extra_runs.csv
    python3 pipelines/retrain.py --dry-run  # show the entry without writing anything

The entry in docs/MODEL_CHANGELOG.md records: which cited rows were added or removed, how every
score moved, what the nested (honest) score is now, and how the recommended next tests changed.
Nothing is hidden when a score gets worse.
"""
import csv
import datetime
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PIPE = ROOT / "pipelines"
REPORT = ROOT / "data" / "processed" / "model_report.json"
TABLE = ROOT / "data" / "processed" / "model_table.csv"
NEXT = ROOT / "data" / "processed" / "next_experiments.json"
LOG = ROOT / "docs" / "MODEL_CHANGELOG.md"
HEAD = "# Model changelog\n\nEvery retrain appends an entry. Written by `pipelines/retrain.py`; do not edit by hand.\n"
KEYS = ("baseline_series_prior", "logistic_oxygen_only", "logistic_oxygen_flow_direction_SHIPPED", "nested_selection_honest")


def read_json(p):
    return json.loads(p.read_text()) if p.exists() else None


def usable_ids():
    if not TABLE.exists():
        return {}
    with open(TABLE) as f:
        return {r["id"]: r for r in csv.DictReader(f) if r["usable_label"] == "1"}


def batch_key(n):
    return [(s["gravity"], s["o2"], s["forced"], s["direction"]) for s in n["headline"]["batch"]] if n else []


def entry(before, after, ids_before, ids_after, nb, na, today):
    lines = [f"\n## {today}\n"]
    added, removed = sorted(set(ids_after) - set(ids_before)), sorted(set(ids_before) - set(ids_after))
    if not before:
        lines.append(f"- First recorded training: {after['n_rows']} labelled rows ({after['n_sustained']} sustained, {after['n_not_sustained']} not) in {after['n_series']} series.")
    else:
        lines.append(f"- Labelled rows: {before['n_rows']} -> {after['n_rows']} (sustained {before['n_sustained']} -> {after['n_sustained']}).")
    for rid in added:
        r = ids_after[rid]
        lines.append(f"  - added `{rid}`: {r['material']}, {r['o2_pct']} % O2, {r['flow_cm_s']} cm/s, {r['outcome_group']}; {r['notes'].replace('added:', 'source: ')}".rstrip("; "))
    for rid in removed:
        lines.append(f"  - no longer usable: `{rid}`")
    lines.append("- Cross-validated scores (leave-one-series-out); lower Brier and log-loss are better:")
    lines.append("")
    lines.append("| model | accuracy | balanced acc. | Brier | log-loss |")
    lines.append("|---|---|---|---|---|")
    for k in KEYS:
        a = after["models"].get(k)
        b = (before or {}).get("models", {}).get(k)
        if not a:
            continue
        cell = lambda f: f"{a[f]}" if not b else f"{b[f]} -> {a[f]}"
        lines.append(f"| {k} | {cell('accuracy')} | {cell('balanced_accuracy')} | {cell('brier')} | {cell('log_loss')} |")
    nested, base = after["models"].get("nested_selection_honest"), after["models"]["baseline_series_prior"]
    if nested:
        verdict = "better than" if nested["brier"] < base["brier"] else "NOT better than"
        lines.append(f"\n- Honest check: the nested score is {verdict} the no-skill baseline on Brier ({nested['brier']} vs {base['brier']}).")
    if before and after["models"].get("nested_selection_honest") and before["models"].get("nested_selection_honest"):
        d = after["models"]["nested_selection_honest"]["brier"] - before["models"]["nested_selection_honest"]["brier"]
        lines.append(f"- Nested Brier changed by {d:+.3f} ({'worse' if d > 0.002 else 'better' if d < -0.002 else 'within noise'}).")
    kb, ka = batch_key(nb), batch_key(na)
    if ka:
        lines.append("- Recommended next tests (value of information)" + (":" if not kb else (" unchanged:" if kb == ka else " changed:")))
        for i, s in enumerate(na["headline"]["batch"], 1):
            lines.append(f"  {i}. {s['gravity']}, {s['o2']} % O2, {s['forced']} cm/s forced flow, {s['direction']}")
    return "\n".join(lines) + "\n"


def main():
    dry = "--dry-run" in sys.argv
    before, nb, ids_before = read_json(REPORT), read_json(NEXT), usable_ids()
    for script in ("build_model_table.py", "train_models.py", "pressure_check.py", "loc_curve.py", "next_experiments.py", "sensitivity.py", "visibility_measured.py"):
        subprocess.run([sys.executable, str(PIPE / script)], check=True, stdout=subprocess.DEVNULL)
    after, na, ids_after = read_json(REPORT), read_json(NEXT), usable_ids()
    text = entry(before, after, ids_before, ids_after, nb, na, datetime.date.today().isoformat())
    print(text)
    if dry:
        return
    LOG.parent.mkdir(exist_ok=True)
    if not LOG.exists():
        LOG.write_text(HEAD)
    LOG.write_text(LOG.read_text() + text)
    web = ROOT / "apps" / "web" / "data" / "model_changelog.md"
    web.write_text(LOG.read_text())
    print(f"appended to {LOG.relative_to(ROOT)} and {web.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
