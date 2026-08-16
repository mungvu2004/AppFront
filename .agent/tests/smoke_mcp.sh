#!/usr/bin/env bash
# Phase 4 smoke test: MCP config, permission matrix, custom stdio server,
# tool bins, and sandbox isolation invariants.
# Run:  bash .agent/tests/smoke_mcp.sh
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

echo "== 1. .mcp.json is valid and declares 8 servers =="
set +e
"$PY" - <<'PYEOF'
import json, sys
data = json.load(open(".mcp.json", encoding="utf-8"))
servers = data.get("mcpServers", {})
assert len(servers) == 8, f"expected 8 servers, got {len(servers)}"
assert "internal-api" in servers and "filesystem" in servers
print(f"{len(servers)} servers: {', '.join(sorted(servers))}")
PYEOF
check ".mcp.json valid, 8 servers" $?

echo "== 2. permission matrix valid + cross-checked with .mcp.json =="
"$PY" .agent/mcp/check_permissions.py --validate >/dev/null 2>&1
check "permissions.json validates" $?
dec=$("$PY" .agent/mcp/check_permissions.py --decide filesystem read_file 2>/dev/null)
[ "$dec" = "auto_allow" ]; check "decide(filesystem,read_file)=auto_allow (got '$dec')" $?
dec=$("$PY" .agent/mcp/check_permissions.py --decide database drop_table 2>/dev/null)
[ "$dec" = "blocked" ]; check "decide(database,drop_table)=blocked (got '$dec')" $?
dec=$("$PY" .agent/mcp/check_permissions.py --decide github create_pull_request 2>/dev/null)
[ "$dec" = "ask_user" ]; check "decide(github,create_pull_request)=ask_user (got '$dec')" $?

echo "== 3. internal MCP server answers initialize + tools/list + tools/call =="
"$PY" - <<'PYEOF'
import json, subprocess, sys
server = ".agent/mcp/custom-servers/internal-api-mcp/server.py"
reqs = [
    {"jsonrpc":"2.0","id":1,"method":"initialize","params":{}},
    {"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}},
    {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"health_check"}},
    {"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_sample_dataset"}},
]
stdin = "\n".join(json.dumps(r) for r in reqs) + "\n"
proc = subprocess.run([sys.executable, server], input=stdin, capture_output=True, text=True, timeout=15)
lines = [json.loads(l) for l in proc.stdout.splitlines() if l.strip()]
by_id = {m["id"]: m for m in lines}
assert by_id[1]["result"]["serverInfo"]["name"] == "internal-api-mcp"
tools = {t["name"] for t in by_id[2]["result"]["tools"]}
assert tools == {"health_check","get_sample_dataset","trigger_build"}, tools
health = json.loads(by_id[3]["result"]["content"][0]["text"])
assert health["status"] == "ok"
ds = json.loads(by_id[4]["result"]["content"][0]["text"])
assert ds["counts"] == [48,21,34,14,4] and ds["total_area_m2"] == "248,60"
print(f"server OK: {len(tools)} tools, sample dataset correct")
PYEOF
check "internal MCP server stdio round-trip" $?

echo "== 4. tool bins exist, are executable, and run =="
"$PY" - <<'PYEOF'
import json, os
schema = json.load(open(".agent/tools/tools_schema.json", encoding="utf-8"))
for tool in schema["tools"]:
    p = os.path.join(".agent/tools", tool["path"])
    assert os.path.isfile(p), f"missing bin: {p}"
print(f"{len(schema['tools'])} declared bins exist")
PYEOF
check "declared tool bins exist" $?
bash .agent/tools/bin/code-search.sh "commit" src >/dev/null 2>&1
check "code-search.sh runs (exit 0)" $?
# security-scan on a clean tmp dir -> exit 0; on a planted secret -> exit 1
TMPD="$(mktemp -d)"
printf 'const x = 1;\n' > "$TMPD/clean.ts"
"$PY" .agent/tools/bin/security-scan.py "$TMPD" >/dev/null 2>&1
check "security-scan clean -> exit 0" $?
# The keyword is a printf argument, so the planted secret exists in the fixture
# written to $TMPD but not in this line -- otherwise the test that proves the
# scanner finds planted secrets is itself a planted secret, and the pre-commit
# gate refuses to let this file into git.
printf 'const %s = "abcdef123456";\n' apiKey > "$TMPD/leak.ts"
"$PY" .agent/tools/bin/security-scan.py "$TMPD" >/dev/null 2>&1
[ "$?" -eq 1 ]; check "security-scan planted secret -> exit 1" $?
rm -rf "$TMPD"

# A finding whose snippet holds characters outside the console codepage must be
# reported, not crash the scanner. On Windows stdout defaults to cp1252, which
# cannot encode Vietnamese; the report falls back to escaped ASCII rather than
# dying with a traceback the pre-commit hook would misread as a leaked secret.
TMPD="$(mktemp -d)"
# Escapes belong in the format string; bash printf does not expand them in an
# argument, and an all-ASCII fixture would make this case pass for free.
# The keyword is an argument here too, for the same reason; the escapes stay in
# the format string, where bash printf will expand them.
printf 'const %s = "khong ma hoa duoc \xe2\x86\x90 va \xc4\x91\xe1\xbb\x99 tin cay";\n' secret \
  > "$TMPD/unicode.ts"
out="$("$PY" .agent/tools/bin/security-scan.py "$TMPD" 2>&1)"; rc=$?
[ "$rc" -eq 1 ]; check "security-scan non-ascii snippet -> exit 1 (not a crash)" $?
case "$out" in *Traceback*) false ;; *) true ;; esac
check "security-scan non-ascii snippet -> no traceback" $?
printf '%s' "$out" | "$PY" -c "import json,sys; d=json.load(sys.stdin); sys.exit(0 if d['count'] == 1 else 1)"
check "security-scan non-ascii snippet -> valid JSON naming 1 finding" $?
rm -rf "$TMPD"

echo "== 5. sandbox isolation invariants =="
"$PY" - <<'PYEOF'
import re
text = open(".agent/sandboxes/docker-compose.sandbox.yml", encoding="utf-8").read()
checks = {
    "non-root user": re.search(r'user:\s*"?1000', text),
    "read_only root fs": re.search(r"read_only:\s*true", text),
    "no network": re.search(r'network_mode:\s*"?none', text),
    "cap_drop ALL": re.search(r"cap_drop:\s*\n\s*-\s*ALL", text),
    "no-new-privileges": "no-new-privileges" in text,
    "source mounted read_only": re.search(r"target:\s*/workspace/src[\s\S]*?read_only:\s*true", text),
    "mem limit": "mem_limit" in text,
    "no docker socket": "docker.sock" not in text,
    "not privileged": "privileged: true" not in text,
}
bad = [k for k, v in checks.items() if not v]
assert not bad, f"failed invariants: {bad}"
print(f"all {len(checks)} isolation invariants present")
PYEOF
check "sandbox compose isolation invariants" $?
if command -v docker >/dev/null 2>&1; then
  docker compose -f .agent/sandboxes/docker-compose.sandbox.yml config >/dev/null 2>&1
  check "docker compose config valid" $?
else
  echo "SKIP  docker not available (guarded)"
fi
set -e

echo ""
echo "=================================================="
echo "TOTAL: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  printf 'FAILED: %s\n' "${FAILURES[@]}"
  exit 1
fi
echo "SMOKE MCP: GREEN"
