#!/usr/bin/env python
"""SessionStart hook. ROLE: context injection + state init => FAIL-OPEN.

Never blocks a session: every failure path exits 0 (errors go to telemetry
or stderr). stdout carries exactly one JSON object with additionalContext
written as statements of fact (BLOCK 5), or nothing at all.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys


def main() -> None:
    root = os.environ.get("CLAUDE_PROJECT_DIR", "").strip()
    if not root:
        root = os.path.realpath(
            os.path.join(os.path.dirname(os.path.realpath(__file__)), "..", "..")
        )
    sys.path.insert(0, os.path.join(root, ".agent", "runtime"))

    payload: dict = {}
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
        if not isinstance(payload, dict):
            payload = {}
    except (OSError, json.JSONDecodeError) as exc:
        sys.stderr.write(f"session_start: bad payload ignored: {exc}\n")

    try:
        from engine import SessionEngine

        SessionEngine(root).handle(
            "session_start",
            {
                "session_id": payload.get("session_id", ""),
                "source": payload.get("source", "startup"),
            },
        )
    except Exception as exc:  # noqa: BLE001 - auxiliary hook must not break session
        sys.stderr.write(f"session_start: state update failed: {exc}\n")

    context_lines: list[str] = []
    try:
        branch = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, cwd=root, timeout=5,
        ).stdout.strip()
        changed = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True, text=True, cwd=root, timeout=5,
        ).stdout.strip()
        changed_count = len(changed.splitlines()) if changed else 0
        if branch:
            context_lines.append(f"The current git branch is {branch}.")
        context_lines.append(
            f"The working tree has {changed_count} changed path(s)."
        )
        context_lines.append(
            "This repo uses pnpm: lint/typecheck/test/build via pnpm scripts."
        )
    except (OSError, subprocess.SubprocessError) as exc:
        sys.stderr.write(f"session_start: git context skipped: {exc}\n")

    if context_lines:
        print(
            json.dumps(
                {
                    "hookSpecificOutput": {
                        "hookEventName": "SessionStart",
                        "additionalContext": " ".join(context_lines)[:9000],
                    }
                }
            )
        )
    sys.exit(0)


if __name__ == "__main__":
    main()
