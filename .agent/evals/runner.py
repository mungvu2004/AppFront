"""Eval runner: validate workflow DAGs and report metrics.

--dry-run parses all referenced workflows, runs a topological sort (which
raises on a cycle), verifies step counts against eval-cases.json, and prints
a table of success-rate / duration / tokens. When telemetry exists it folds
in real session/cost trends (BLOCK 9 #4/#5); otherwise it prints baselines.

Usage:
  python .agent/evals/runner.py --dry-run
  python .agent/evals/runner.py --check-cycles   # exit 1 if any DAG has a cycle
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any

sys.path.insert(0, os.path.join(os.path.dirname(os.path.realpath(__file__)), "..", "runtime"))
import engine  # noqa: E402
import policy  # noqa: E402


def _root() -> str:
    return policy.project_root_from(__file__)


def load_cases(root: str) -> list[dict[str, Any]]:
    path = os.path.join(root, ".agent", "evals", "eval-cases.json")
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)["cases"]


def _telemetry_summary(root: str) -> dict[str, Any]:
    """Fold real telemetry into cost/usage trend numbers if present."""
    path = os.path.join(root, ".agent", "telemetry", "events.jsonl")
    sessions = 0
    budget_flags = 0
    tool_calls = 0
    try:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                if not line.strip():
                    continue
                rec = json.loads(line)
                if rec.get("event") == "session_start":
                    sessions += 1
                if rec.get("event") == "session_budget" and "over" in rec.get("detail", ""):
                    if "over_calls=True" in rec["detail"] or "over_time=True" in rec["detail"]:
                        budget_flags += 1
                if rec.get("event") == "post_tool_use":
                    tool_calls += 1
    except (OSError, json.JSONDecodeError):
        pass
    return {
        "observed_sessions": sessions,
        "budget_overruns": budget_flags,
        "observed_tool_calls": tool_calls,
    }


def run(root: str, dry_run: bool, check_cycles_only: bool) -> int:
    cases = load_cases(root)
    workflows_dir = os.path.join(root, ".agent", "workflows")
    rows: list[dict[str, Any]] = []
    had_error = False

    for case in cases:
        wf_path = os.path.join(workflows_dir, f"{case['workflow']}.workflow.yaml")
        status = "ok"
        order: list[str] = []
        try:
            wf = engine.load_workflow(wf_path)
            order = engine.topo_sort(wf["steps"])
            if len(wf["steps"]) != case.get("expected_steps", len(wf["steps"])):
                status = f"step-count mismatch ({len(wf['steps'])} != {case['expected_steps']})"
                had_error = True
        except engine.WorkflowCycleError as exc:
            status = f"CYCLE: {exc}"
            had_error = True
        except engine.EngineError as exc:
            status = f"ERROR: {exc}"
            had_error = True
        rows.append({
            "id": case["id"],
            "workflow": case["workflow"],
            "steps": len(order),
            "order": " -> ".join(order) if order else "(unresolved)",
            "success_rate": case.get("baseline_success_rate", 0.0),
            "duration_s": case.get("baseline_duration_s", 0),
            "tokens": case.get("baseline_tokens", 0),
            "status": status,
        })

    if check_cycles_only:
        for r in rows:
            marker = "CYCLE" if r["status"].startswith("CYCLE") else "ok"
            print(f"{r['workflow']:24} {marker}")
        return 1 if had_error else 0

    telemetry = _telemetry_summary(root)
    print("=" * 78)
    print(f"{'case':26} {'steps':5} {'succ':5} {'dur_s':6} {'tokens':7} status")
    print("-" * 78)
    for r in rows:
        print(
            f"{r['id']:26} {r['steps']:>5} {r['success_rate']:>5.2f} "
            f"{r['duration_s']:>6} {r['tokens']:>7} {r['status']}"
        )
    print("-" * 78)
    for r in rows:
        print(f"  {r['id']}: {r['order']}")
    print("-" * 78)
    print(
        "telemetry: "
        f"sessions={telemetry['observed_sessions']} "
        f"tool_calls={telemetry['observed_tool_calls']} "
        f"budget_overruns={telemetry['budget_overruns']}"
    )
    print("(baseline metrics until enough real sessions accumulate)")
    print("=" * 78)
    if dry_run:
        print("DRY RUN OK" if not had_error else "DRY RUN FOUND PROBLEMS")
    return 1 if had_error else 0


def main(argv: list[str]) -> int:
    root = _root()
    if "--check-cycles" in argv:
        return run(root, dry_run=False, check_cycles_only=True)
    dry_run = "--dry-run" in argv
    return run(root, dry_run=dry_run, check_cycles_only=False)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
