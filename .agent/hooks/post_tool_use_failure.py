#!/usr/bin/env python
"""PostToolUseFailure hook. ROLE: retry tracking => FAIL-OPEN (always exit 0).

Increments state.retries[tool] so the engine (and later phases) can see
which tools are flaky and decide on self-heal / escalation.
"""

from __future__ import annotations

import json
import os
import sys


def main() -> None:
    root = os.environ.get("CLAUDE_PROJECT_DIR", "").strip()
    if not root:
        root = os.path.realpath(
            os.path.join(os.path.dirname(os.path.realpath(__file__)), "..", "..")
        )
    sys.path.insert(0, os.path.join(root, ".agent", "runtime"))
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
        if not isinstance(payload, dict):
            payload = {}
        from engine import SessionEngine

        SessionEngine(root).handle(
            "post_tool_use_failure",
            {"tool_name": payload.get("tool_name", "unknown")},
        )
    except Exception as exc:  # noqa: BLE001 - auxiliary hook must not break session
        sys.stderr.write(f"post_tool_use_failure: ignored error: {exc}\n")
    sys.exit(0)


if __name__ == "__main__":
    main()
