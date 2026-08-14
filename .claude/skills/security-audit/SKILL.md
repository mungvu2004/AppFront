---
name: security-audit
description: Use when reviewing changes for secret leaks, dangerous shell/command patterns, dependency risk, or gaps in the guardrail — a read-only audit that proposes tightening only, never loosening.
---

# security-audit

## Trigger
Before merging risky changes, after adding a dependency, or when reviewing the
guardrail policy for gaps.

## Inputs / Outputs
- Inputs: the diff or files under review.
- Outputs: a findings list (severity, location, fix) and, optionally, a
  tightening candidate for .agent/policy/candidates/ — never a loosening one.

## Procedure
1. Secrets: grep the diff for hardcoded tokens/keys; confirm nothing reads or
   echoes env values. `gitleaks` is not installed here — fall back to
   `grep -rInE "(secret|token|api[_-]?key|password)\s*[:=]" src` and manual review.
2. Dangerous commands: scan added scripts for `rm -rf`, `curl|sh`, `$IFS`,
   `--no-verify`, `--force`. Confirm each is covered by BOTH permissions.deny
   and the guardrail hook (run `bash .agent/tests/smoke_guardrail.sh`).
3. Dependencies: list new entries in package.json; justify each or flag it.
4. Guardrail gaps: if a new dangerous family isn't blocked, write a tightening
   candidate; do not edit rules.compiled.json directly (it is protected).

## Error handling
- If a binary you want (gitleaks, shellcheck) is absent, note it and use the
  grep fallback — do not skip the check silently.

## Negative example (do NOT use this skill)
For a pure token/color refactor with no new deps and no shell, a full audit is
overkill — a quick secret grep suffices.
