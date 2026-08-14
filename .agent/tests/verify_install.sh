#!/usr/bin/env bash
# Post-clone install verifier (BLOCK 9 #1). A teammate who clones the repo has
# NO active hooks until they accept the workspace-trust dialog, and layer-1/2
# artifacts must be deployed. This prints RED/GREEN per protection layer so
# nobody assumes a guardrail that is not actually live.
# Run FIRST after cloning:  bash .agent/tests/verify_install.sh
set -euo pipefail
IFS=$'\n\t'

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PY="python"
command -v python >/dev/null 2>&1 || PY="python3"
cd "$ROOT"

green() { printf 'GREEN  %s\n' "$1"; }
red()   { printf 'RED    %s\n' "$1"; RED_COUNT=$((RED_COUNT+1)); }
RED_COUNT=0

echo "== Prerequisites =="
command -v "$PY" >/dev/null 2>&1 && green "python present" || red "python missing"
"$PY" -c 'import yaml' 2>/dev/null && green "PyYAML present" || red "PyYAML missing (pip install pyyaml)"
command -v git >/dev/null 2>&1 && green "git present" || red "git missing"
command -v docker >/dev/null 2>&1 && green "docker present" || echo "INFO   docker absent (sandbox layer unavailable)"

echo ""
echo "== Layer 1: permissions.deny in LIVE .claude/settings.json =="
if [ -f .claude/settings.json ]; then
  if "$PY" - <<'PYEOF'
import json, sys
live = json.load(open(".claude/settings.json", encoding="utf-8"))
deny = "\n".join(live.get("permissions", {}).get("deny", []))
need = ["rm -rf /", "git push --force", "Read(.env", "Edit(.claude/settings.json)"]
sys.exit(0 if all(n in deny for n in need) else 1)
PYEOF
  then green "layer-1 deny rules present in live settings.json"
  else red "live settings.json is missing deny families — apply .agent/deploy/settings.json"
  fi
else
  red ".claude/settings.json absent"
fi

echo ""
echo "== Layer 1: hooks wired in LIVE settings.json (vs canonical deploy) =="
"$PY" - <<'PYEOF' && green "all lifecycle hooks wired live" || echo "INFO   live settings.json not yet at Phase-2 wiring — apply .agent/deploy/settings.json"
import json, sys
try:
    live = json.load(open(".claude/settings.json", encoding="utf-8")).get("hooks", {})
except Exception:
    sys.exit(1)
need = {"PreToolUse", "SessionStart", "PostToolUse", "PostToolUseFailure",
        "SessionEnd", "ConfigChange"}
sys.exit(0 if need <= set(live) else 1)
PYEOF

echo ""
echo "== Hook executability (would they even start?) =="
for h in pre_tool_use session_start post_tool_use post_tool_use_failure session_end config_change; do
  f=".agent/hooks/$h.py"
  if [ -f "$f" ] && printf '{}' | "$PY" "$f" >/dev/null 2>&1; then
    green "hook $h.py starts (not exit 127)"
  elif [ -f "$f" ]; then
    # a guardrail hook fails-closed (exit 2) on empty input; that is healthy
    code=0; printf '{}' | "$PY" "$f" >/dev/null 2>&1 || code=$?
    if [ "$code" -eq 2 ] || [ "$code" -eq 0 ]; then green "hook $h.py starts (exit $code)"
    else red "hook $h.py abnormal exit $code"; fi
  else
    red "hook $h.py missing"
  fi
done

echo ""
echo "== Layer 2: git hooks installed =="
hp="$(git config --get core.hooksPath || true)"
if [ "$hp" = ".githooks" ] && [ -x .githooks/pre-commit ]; then
  green "core.hooksPath=.githooks and pre-commit executable"
else
  echo "INFO   git hooks not installed. To enable layer-2:"
  echo "         cp .agent/deploy/githooks/* .githooks/ && chmod +x .githooks/*"
  echo "         git config core.hooksPath .githooks"
fi

echo ""
echo "== Smoke suite (drives hooks directly; independent of trust dialog) =="
for t in smoke_guardrail smoke_lifecycle smoke_agents smoke_mcp smoke_workflows smoke_policy; do
  if bash ".agent/tests/$t.sh" >/dev/null 2>&1; then green "$t GREEN"
  else red "$t RED (run: bash .agent/tests/$t.sh)"; fi
done

echo ""
echo "=================================================="
if [ "$RED_COUNT" -gt 0 ]; then
  echo "INSTALL VERIFY: $RED_COUNT RED item(s) — harness NOT fully active"
  echo "IMPORTANT: after applying settings, you must accept the workspace-trust"
  echo "dialog in a fresh (non -p) session or the Claude Code hooks will NOT fire."
  exit 1
fi
echo "INSTALL VERIFY: all layers GREEN"
