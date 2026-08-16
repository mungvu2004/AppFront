# Agent Harness — Architecture

Built for `app-front` (TypeScript 5.5 + Vite 5 + pnpm). Runtime target:
`claude-code` (VSCode extension **2.1.232**). All lifecycle behavior is wired
through `.claude/settings.json` hooks — no bespoke engine replaces the CLI.

## Security model — three independent layers

```
                         a dangerous tool call
                                  |
        +-------------------------+--------------------------+
        v                         v                          v
  LAYER 1 (hard)            LAYER 2 (hook)            LAYER 3 (isolation)
  permissions.deny         PreToolUse guardrail      Docker sandbox
  in settings.json         .agent/hooks/             .agent/sandboxes/
  - cannot timeout         pre_tool_use.py           - non-root
  - survives               -> policy.py analysis     - source read-only
    disableAllHooks        - shlex token parse       - --network=none
  - prefix/glob rules      - $( )/backtick recursion - cap_drop ALL
                           - FAIL-CLOSED (exit 2)    (for unallowlisted cmds)
```

Every dangerous family appears in **both** layer 1 and layer 2 (asserted by
`smoke_guardrail.sh` infra-4 and `redteam.sh` 8b). Layer 1 is the authority
because a hook can timeout, crash, mis-path, or be disabled — all four are
non-blocking. Red-team scenario 8b proves the system still blocks with every
hook disabled.

## Lifecycle event flow (Claude Code events -> handlers)

```
SessionStart ---------> session_start.py  (FAIL-OPEN)
                          -> engine.SessionEngine.handle("session_start")
                          -> state.json init + git-branch additionalContext
UserPromptSubmit         (reserved: context injection)
PreToolUse -----------> pre_tool_use.py   (FAIL-CLOSED, guardrail)
                          -> policy.evaluate_command / _powershell / _file_write
PostToolUse ----------> post_tool_use.py  (FAIL-OPEN, async)
                          -> tool_calls++
PostToolUseFailure ---> post_tool_use_failure.py (FAIL-OPEN, async)
                          -> tool_failures++, retries[tool]++
ConfigChange ---------> config_change.py  (FAIL-CLOSED)
                          -> sha256(rules.compiled.json) == ledger ? 0 : 2
SessionEnd -----------> session_end.py    (FAIL-OPEN, <=1s)
                          -> status=ended, budget compare -> telemetry
```

State is a single JSON file (`.agent/memory/state.json`) guarded by an
OS-level lock (`state_store.py`, `msvcrt.locking` on Windows) with atomic
`os.replace` writes; two concurrent writers converge (smoke_lifecycle #4).

## Delegation topology

```
                    orchestrator  (only agent with the Agent tool)
                   /      |       \        \
     architect-planner  software-  qa-test-  devops-secops
        (read-only)     engineer   engineer   (audit/ops)
                        \_________ leaves: Agent removed, cannot spawn _________/
```

`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=2` in settings.json; leaves have no
`Agent` tool (redteam scenario 4).

## Adaptive policy — asymmetric evolution (Phase 6)

```
telemetry --collect.py--> summary --mine.py(numeric threshold)--> candidate(deny/warn)
                                                                       |
   rules.source.yaml (HUMAN-ONLY) --compile.py--> rules.compiled.json + sha256 -> ledger.jsonl
                                                                       |
   apply.py: shadow=log-only, enforce=block         ConfigChange hook verifies sha256
```

- **Tightening** (deny/warn) can be auto-mined. **Loosening** (allow) is
  structurally impossible on the updater path: `compile.py` rejects any rule
  with `effect: allow` and rejects the whole file on any unknown field.
- Lifecycle: `candidate -> shadow -> enforce -> retired`; every rule has a
  mandatory `expires_at` TTL.
- The working session cannot write `.agent/policy/**` (permissions.deny +
  guardrail). The updater uses a separate credential and writes only
  `candidates/` and `ledger.jsonl`.

## Design decisions

1. **Config cache keyed by source sha256.** `policy.load_config` compiles
   HARNESS.yaml to a JSON cache so the slow `yaml` import stays off the
   PreToolUse hot path (p99 321ms -> 114ms). The cache is re-validated against
   the schema on every load; it can go stale but never bypass validation.
2. **Subset JSON-Schema validator in pure stdlib** (`policy._schema_errors`)
   — avoids a `jsonschema` dependency (not installed) while still validating
   HARNESS.yaml, state.json, and telemetry records.
3. **Binary-mode compiled-policy write** so on-disk bytes equal the hashed
   bytes (Windows text mode would inject `\r\n` and break the integrity hook).
4. **PowerShell analyzed best-effort**, not hard-denied on parse failure —
   PS syntax is not POSIX; unparseable-but-harmless commands fall through to
   the normal permission prompt rather than a false block.

## Operator-owned artifacts (the working agent cannot write these)

These are protected; apply them by hand from `.agent/deploy/` outside a guarded
session (see README / CLAUDE.md section G):

| Target (protected) | Canonical source |
|---|---|
| `.claude/settings.json` | `.agent/deploy/settings.json` |
| `.githooks/{pre,post}-commit` | `.agent/deploy/githooks/*` |
| `.agent/policy/**` | `.agent/deploy/policy/*` |

`verify_install.sh` diffs live wiring against these and prints RED/GREEN per
layer. Note: hooks do not fire until the workspace-trust dialog is accepted in
a fresh (non `-p`) session.

## Kill switch

`claude --settings '{"disableAllHooks": true}'` disables every Claude Code hook.
Still active when disabled: **layer-1 `permissions.deny`**, **layer-2 git
hooks**, **layer-3 sandbox**. Only an operator (not the agent) may disable;
record reason + timestamp in `.agent/telemetry/killswitch.log`; re-enable when
done. (CLAUDE.md section G.)

## Ownership & review cadence (BLOCK 9 #3)

- **Owner:** the repository maintainer (Mung Vu Xuan) owns the harness and the
  policy source of truth. Reassign here on handover.
- **Quarterly review:** which rules are `enforce`, which have 0 hits (prune
  candidates), recurring false positives. Run:
  `python .agent/policy/updater/prune.py --dry-run --today <YYYY-MM-DD>` and
  `python .agent/evals/runner.py --dry-run`.
- **Health metrics** (from telemetry / evals runner): false-positive rate
  (target < 2%), number of hook-disable events per month (rising = harness is
  obstructing), median time from agent start to green PR.

## Test map (all run on a real machine; logs are the proof)

| Phase | Smoke test | Asserts |
|---|---|---|
| 1 | `smoke_guardrail.sh` | 12 core + hardening + latency + fail-closed + parity |
| 2 | `smoke_lifecycle.sh` | state machine, retries, telemetry, concurrency |
| 3 | `smoke_agents.sh` | frontmatter, delegation boundary, skill sections |
| 4 | `smoke_mcp.sh` | .mcp.json, permission matrix, stdio server, sandbox |
| 5 | `smoke_workflows.sh` | DAG parse, topo sort, cycle detection, evals |
| 6 | `smoke_policy.sh` | compile, allow-rejection, shadow, tamper, prune, mine |
| 7 | `redteam.sh` | 8 adversarial scenarios, all blocked |
| all | `verify_install.sh` | per-layer RED/GREEN after clone |
