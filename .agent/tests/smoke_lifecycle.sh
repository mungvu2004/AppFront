#!/usr/bin/env bash
# Phase 2 smoke test: state machine, lifecycle hooks, telemetry, concurrency.
# Run:  bash .agent/tests/smoke_lifecycle.sh
set -euo pipefail
IFS=$'\n\t'

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PY="python"
command -v python >/dev/null 2>&1 || PY="python3"

STATE="$ROOT/.agent/memory/state.json"
EVENTS="$ROOT/.agent/telemetry/events.jsonl"
PASS=0
FAIL=0
FAILURES=()

check() { # check <label> <exit_code_of_prev_cmd_via_$?>
  local label="$1" code="$2"
  if [ "$code" -eq 0 ]; then
    PASS=$((PASS + 1)); printf 'PASS  %s\n' "$label"
  else
    FAIL=$((FAIL + 1)); FAILURES+=("$label")
    printf 'FAIL  %s\n' "$label"
  fi
}

rm -f "$STATE" "$STATE.lock" "$EVENTS"

echo "== 1. simulated session via engine =="
set +e
"$PY" "$ROOT/.agent/runtime/engine.py" --simulate >/dev/null 2>&1
check "engine --simulate exits 0" $?
"$PY" "$ROOT/.agent/runtime/engine.py" --validate-state >/dev/null 2>&1
check "state.json valid against state.schema.json" $?
"$PY" - "$STATE" <<'PYEOF'
import json, sys
state = json.load(open(sys.argv[1], encoding="utf-8"))
assert state["status"] == "ended", state["status"]
assert state["tool_calls"] == 3, state["tool_calls"]
assert state["tool_failures"] == 1, state["tool_failures"]
assert state["retries"] == {"Bash": 1}, state["retries"]
assert state["end_reason"] == "simulate_complete"
print("counters correct")
PYEOF
check "simulate counters (3 calls, 1 failure, retries.Bash=1)" $?
set -e

echo "== 2. lifecycle hooks are FAIL-OPEN and update state =="
set +e
# fail-open probes FIRST (an empty session_start payload legitimately resets state)
printf '' | "$PY" "$ROOT/.agent/hooks/session_start.py" >/dev/null 2>&1
check "session_start empty stdin still exit 0 (fail-open)" $?
printf 'garbage' | "$PY" "$ROOT/.agent/hooks/post_tool_use.py" >/dev/null 2>&1
check "post_tool_use garbage stdin still exit 0 (fail-open)" $?
rm -f "$STATE" "$STATE.lock"
printf '%s' '{"session_id":"hooktest","source":"startup"}' \
  | "$PY" "$ROOT/.agent/hooks/session_start.py" >/dev/null 2>&1
check "session_start exit 0" $?
printf '%s' '{"tool_name":"Bash","tool_response":"ok"}' \
  | "$PY" "$ROOT/.agent/hooks/post_tool_use.py" >/dev/null 2>&1
check "post_tool_use exit 0" $?
printf '%s' '{"tool_name":"Bash","error":"boom"}' \
  | "$PY" "$ROOT/.agent/hooks/post_tool_use_failure.py" >/dev/null 2>&1
check "post_tool_use_failure exit 0 (1st)" $?
printf '%s' '{"tool_name":"Bash","error":"boom"}' \
  | "$PY" "$ROOT/.agent/hooks/post_tool_use_failure.py" >/dev/null 2>&1
check "post_tool_use_failure exit 0 (2nd)" $?
printf '%s' '{"reason":"clear"}' \
  | "$PY" "$ROOT/.agent/hooks/session_end.py" >/dev/null 2>&1
check "session_end exit 0" $?
"$PY" - "$STATE" <<'PYEOF'
import json, sys
state = json.load(open(sys.argv[1], encoding="utf-8"))
assert state["session_id"] == "hooktest"
assert state["status"] == "ended"
assert state["retries"].get("Bash") == 2, state["retries"]
assert state["tool_failures"] == 2
print("retry count incremented correctly")
PYEOF
check "retries.Bash == 2 after two failures" $?
set -e

echo "== 3. telemetry has a record for every event =="
set +e
"$PY" - "$EVENTS" <<'PYEOF'
import json, sys
events = [json.loads(l) for l in open(sys.argv[1], encoding="utf-8") if l.strip()]
names = {e["event"] for e in events}
needed = {"session_start", "post_tool_use", "post_tool_use_failure",
          "session_end", "session_budget"}
missing = needed - names
assert not missing, f"missing telemetry events: {missing}"
schema = json.load(open(".agent/schema/telemetry.schema.json", encoding="utf-8"))
sys.path.insert(0, ".agent/runtime")
import policy
for e in events:
    errs = policy._schema_errors(schema, e, "$")
    assert not errs, errs
print(f"{len(events)} records, all schema-valid, all event types present")
PYEOF
check "telemetry complete + schema-valid" $?
set -e

echo "== 4. two concurrent writers do not corrupt state =="
set +e
"$PY" - "$ROOT" <<'PYEOF'
import json, os, subprocess, sys
root = sys.argv[1]
worker = r"""
import sys, os
sys.path.insert(0, os.path.join(sys.argv[1], ".agent", "runtime"))
from state_store import StateStore
store = StateStore(os.path.join(sys.argv[1], ".agent", "memory", "concurrency_test.json"))
for _ in range(50):
    store.update(lambda s: {**s, "counter": int(s.get("counter", 0)) + 1})
"""
target = os.path.join(root, ".agent", "memory", "concurrency_test.json")
for suffix in ("", ".lock"):
    try:
        os.remove(target + suffix)
    except FileNotFoundError:
        pass
procs = [subprocess.Popen([sys.executable, "-c", worker, root]) for _ in range(2)]
codes = [p.wait() for p in procs]
assert codes == [0, 0], codes
data = json.load(open(target, encoding="utf-8"))
assert data["counter"] == 100, data["counter"]
print("2 processes x 50 increments -> counter=100, file intact")
PYEOF
check "concurrent updates: counter==100, JSON intact" $?
set -e

echo ""
echo "=================================================="
echo "TOTAL: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  printf 'FAILED: %s\n' "${FAILURES[@]}"
  exit 1
fi
echo "SMOKE LIFECYCLE: GREEN"
