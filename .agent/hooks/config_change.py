#!/usr/bin/env python
"""ConfigChange hook. ROLE: integrity gate for compiled policy => FAIL-CLOSED.

Blocks the session (exit 2) if .agent/policy/rules.compiled.json exists but its
sha256 does not match the most recent `compile`/`promote` entry in ledger.jsonl.
This is what makes a hand-edit of the compiled artifact detectable (BLOCK 6,
Phase 6 DoD). No compiled file yet => nothing to verify => exit 0.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys


def _deny(reason: str) -> None:
    sys.stderr.write(f"config integrity deny: {reason}\n")
    sys.exit(2)


def main() -> None:
    root = os.environ.get("CLAUDE_PROJECT_DIR", "").strip()
    if not root:
        root = os.path.realpath(
            os.path.join(os.path.dirname(os.path.realpath(__file__)), "..", "..")
        )
    # Drain stdin so the caller never blocks on a full pipe; content unused.
    try:
        sys.stdin.read()
    except OSError:
        pass

    compiled = os.path.join(root, ".agent", "policy", "rules.compiled.json")
    ledger = os.path.join(root, ".agent", "policy", "ledger.jsonl")
    if not os.path.isfile(compiled):
        sys.exit(0)  # nothing compiled yet

    try:
        with open(compiled, "rb") as fh:
            actual = hashlib.sha256(fh.read()).hexdigest()
    except OSError as exc:
        _deny(f"cannot read compiled rules: {exc}")

    recorded = None
    try:
        with open(ledger, encoding="utf-8") as fh:
            for line in fh:
                if not line.strip():
                    continue
                rec = json.loads(line)
                if rec.get("action") in ("compile", "promote") and rec.get("sha256"):
                    recorded = rec["sha256"]  # last one wins
    except (OSError, json.JSONDecodeError) as exc:
        _deny(f"cannot read ledger: {exc}")

    if recorded is None:
        _deny("compiled rules present but no signed entry in ledger")
    if actual != recorded:
        _deny(
            f"rules.compiled.json sha256 {actual[:16]}... "
            f"does not match ledger {str(recorded)[:16]}... (tampering?)"
        )
    sys.exit(0)


if __name__ == "__main__":
    main()
