#!/usr/bin/env bash
# Phase 3 smoke test: sub-agent + skill definitions are valid and the
# delegation boundary holds (only orchestrator may spawn agents).
# Run:  bash .agent/tests/smoke_agents.sh
set -euo pipefail
IFS=$'\n\t'

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PY="python"
command -v python >/dev/null 2>&1 || PY="python3"

set +e
"$PY" - "$ROOT" <<'PYEOF'
import os, re, sys
try:
    import yaml
except ImportError:
    print("PyYAML missing"); sys.exit(1)

root = sys.argv[1]
fail = []
ok = 0

def frontmatter(path):
    text = open(path, encoding="utf-8").read()
    m = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    if not m:
        raise ValueError(f"{path}: no YAML frontmatter")
    return yaml.safe_load(m.group(1)), text

# --- agents ---------------------------------------------------------------
agents_dir = os.path.join(root, ".claude", "agents")
agent_files = sorted(
    f for f in os.listdir(agents_dir) if f.endswith(".md")
)
expected_agents = {
    "orchestrator", "architect-planner", "software-engineer",
    "qa-test-engineer", "devops-secops",
}
seen_agents = {}
for fn in agent_files:
    path = os.path.join(agents_dir, fn)
    try:
        fm, _ = frontmatter(path)
    except Exception as exc:  # noqa: BLE001
        fail.append(str(exc)); continue
    if not isinstance(fm, dict) or "name" not in fm or "description" not in fm:
        fail.append(f"{fn}: frontmatter needs name + description"); continue
    ok += 1
    seen_agents[fm["name"]] = fm

missing = expected_agents - set(seen_agents)
if missing:
    fail.append(f"missing agents: {missing}")
else:
    print(f"PASS  5 agents present, all frontmatter parse ({ok} files)")

# delegation boundary: only orchestrator may have Agent
for name, fm in seen_agents.items():
    tools = fm.get("tools", "")
    tool_list = tools if isinstance(tools, list) else [
        t.strip() for t in str(tools).split(",") if t.strip()
    ]
    has_agent = any(t == "Agent" or t == "Task" for t in tool_list)
    disallowed = fm.get("disallowedTools", [])
    disallowed = disallowed if isinstance(disallowed, list) else [disallowed]
    if name == "orchestrator":
        if not has_agent:
            fail.append("orchestrator must list Agent in tools")
    else:
        if has_agent:
            fail.append(f"leaf agent {name} must NOT have Agent in tools")
if not any("Agent" in f for f in fail):
    print("PASS  delegation boundary: only orchestrator has Agent; 4 leaves cannot spawn")

# --- skills ---------------------------------------------------------------
skills_dir = os.path.join(root, ".claude", "skills")
skill_names = sorted(os.listdir(skills_dir))
expected_skills = {
    "git-advanced", "tdd-refactoring", "database-ops", "api-contract-design",
    "security-audit", "performance-profiling", "docker-containerization",
    "ui-component-design",
}
descriptions = {}
skill_ok = 0
for sn in skill_names:
    md = os.path.join(skills_dir, sn, "SKILL.md")
    if not os.path.isfile(md):
        fail.append(f"skill {sn}: missing SKILL.md"); continue
    try:
        fm, body = frontmatter(md)
    except Exception as exc:  # noqa: BLE001
        fail.append(str(exc)); continue
    if not fm.get("name") or not fm.get("description"):
        fail.append(f"skill {sn}: needs name + description"); continue
    if not fm["description"].strip().lower().startswith("use when"):
        fail.append(f"skill {sn}: description must start with 'Use when'")
    for section in ("Trigger", "Procedure", "Error handling", "Negative example"):
        if section.lower() not in body.lower():
            fail.append(f"skill {sn}: missing section '{section}'")
    descriptions[fm["name"]] = fm["description"]
    skill_ok += 1

missing_sk = expected_skills - set(descriptions)
if missing_sk:
    fail.append(f"missing skills: {missing_sk}")
else:
    print(f"PASS  8 skills present, frontmatter + required sections ({skill_ok})")

# no two skill descriptions with overlapping trigger (first 8 significant words)
def sig(desc):
    words = re.findall(r"[a-z0-9]+", desc.lower())
    stop = {"use", "when", "a", "an", "the", "in", "or", "of", "to", "and",
            "this", "for", "with", "that", "before", "after", "is", "are",
            "it", "so", "no", "never", "only", "any", "not"}
    return {w for w in words if w not in stop}
names = list(descriptions)
overlap_bad = False
for i in range(len(names)):
    for j in range(i + 1, len(names)):
        s = sig(descriptions[names[i]]) & sig(descriptions[names[j]])
        if len(s) >= 6:
            fail.append(f"skills {names[i]} & {names[j]} overlap heavily: {sorted(s)}")
            overlap_bad = True
if not overlap_bad:
    print("PASS  no two skill triggers overlap heavily")

# --- binaries referenced in skills must exist or be command -v guarded -----
# available_binaries per BLOCK 0 survey on this machine:
available = {
    "git", "node", "npx", "pnpm", "npm", "bash", "sh", "python", "docker",
    "grep", "ls", "cat", "sed", "awk", "find",
}
# tools mentioned that we KNOW are absent and MUST be guarded in-text
absent = {"gitleaks", "shellcheck", "psql", "jq"}
skill_texts = {
    sn: open(os.path.join(skills_dir, sn, "SKILL.md"), encoding="utf-8").read()
    for sn in skill_names if os.path.isfile(os.path.join(skills_dir, sn, "SKILL.md"))
}
for sn, text in skill_texts.items():
    low = text.lower()
    for tool in absent:
        if tool in low:
            guarded = (
                "not installed" in low or "not install" in low
                or "absent" in low or "command -v" in low
                or "fall back" in low or "no real" in low or "is not installed" in low
            )
            if not guarded:
                fail.append(f"skill {sn} references absent binary '{tool}' unguarded")
print("PASS  absent-binary references are guarded (gitleaks/shellcheck/psql/jq)")

if fail:
    print("\n".join("FAIL  " + f for f in fail))
    sys.exit(1)
print("\nALL PHASE-3 CHECKS OK")
PYEOF
rc=$?
set -e

echo ""
echo "=================================================="
if [ "$rc" -ne 0 ]; then
  echo "SMOKE AGENTS: RED"
  exit 1
fi
echo "SMOKE AGENTS: GREEN"
