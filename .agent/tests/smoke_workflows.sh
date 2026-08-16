#!/usr/bin/env bash
# Phase 5 smoke test: workflow DAG parsing, topo order, cycle detection,
# and the eval runner --dry-run report.
# Run:  bash .agent/tests/smoke_workflows.sh
set -euo pipefail
IFS=$'\n\t'

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PY="python"
command -v python >/dev/null 2>&1 || PY="python3"
cd "$ROOT"

PASS=0
FAIL=0
FAILURES=()
check() {
  if [ "$2" -eq 0 ]; then PASS=$((PASS+1)); printf 'PASS  %s\n' "$1"
  else FAIL=$((FAIL+1)); FAILURES+=("$1"); printf 'FAIL  %s\n' "$1"; fi
}

echo "== 1. all 3 workflows parse and topo-sort =="
set +e
"$PY" - <<'PYEOF'
import os, sys
sys.path.insert(0, ".agent/runtime")
import engine
wdir = ".agent/workflows"
names = ["feature-development", "hotfix-patch", "database-migration"]
for n in names:
    wf = engine.load_workflow(os.path.join(wdir, f"{n}.workflow.yaml"))
    order = engine.topo_sort(wf["steps"])
    assert order[0] in {s["id"] for s in wf["steps"] if not s.get("depends_on")}
    assert order[-1] == "report", f"{n}: last step should be report, got {order[-1]}"
    assert len(order) == len(wf["steps"]), f"{n}: not all steps ordered"
print(f"{len(names)} workflows parsed, topo order valid, all end at 'report'")
PYEOF
check "3 workflows parse + topo-sort" $?

echo "== 2. cycle detection catches a deliberately cyclic DAG =="
"$PY" - <<'PYEOF'
import sys
sys.path.insert(0, ".agent/runtime")
import engine
cyclic = [
    {"id": "a", "depends_on": ["c"]},
    {"id": "b", "depends_on": ["a"]},
    {"id": "c", "depends_on": ["b"]},
]
try:
    engine.topo_sort(cyclic)
    print("FAILED: cycle not detected"); sys.exit(1)
except engine.WorkflowCycleError as exc:
    print(f"cycle correctly detected: {exc}")
PYEOF
check "cycle detected in cyclic DAG" $?

echo "== 3. unknown-dependency is rejected at load =="
"$PY" - <<'PYEOF'
import os, sys, tempfile
sys.path.insert(0, ".agent/runtime")
import engine
bad = """name: bad
version: 1
steps:
  - id: only
    depends_on: [ghost]
"""
fd, path = tempfile.mkstemp(suffix=".workflow.yaml")
os.write(fd, bad.encode()); os.close(fd)
try:
    engine.load_workflow(path)
    print("FAILED: unknown dep accepted"); sys.exit(1)
except engine.EngineError as exc:
    print(f"unknown dependency rejected: {exc}")
finally:
    os.remove(path)
PYEOF
check "unknown dependency rejected" $?

echo "== 4. eval runner --dry-run =="
"$PY" .agent/evals/runner.py --dry-run
check "runner --dry-run exit 0" $?
"$PY" .agent/evals/runner.py --check-cycles >/dev/null 2>&1
check "runner --check-cycles (real DAGs clean) exit 0" $?
set -e

echo ""
echo "=================================================="
echo "TOTAL: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  printf 'FAILED: %s\n' "${FAILURES[@]}"
  exit 1
fi
echo "SMOKE WORKFLOWS: GREEN"
