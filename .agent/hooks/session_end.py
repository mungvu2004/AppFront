#!/usr/bin/env python
"""SessionEnd hook. ROLE: finalize state + budget report => FAIL-OPEN.

SessionEnd hooks share a ~1.5s budget (verified against official docs), so
this does the minimum: mark the session ended, compare counters against the
budgets in HARNESS.yaml, append one telemetry record.
"""

from __future__ import annotations

import json
import os
import sys
import time


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
        from engine import SessionEngine, emit_telemetry

        engine = SessionEngine(root)
        state = engine.handle(
            "session_end", {"reason": payload.get("reason", "other")}
        )
        budgets = engine.cfg.get("budgets", {})
        duration_min = 0
        if state.get("started_epoch_s"):
            duration_min = int(
                (int(time.time()) - int(state["started_epoch_s"])) / 60
            )
        over_calls = int(state.get("tool_calls", 0)) > int(
            budgets.get("max_tool_calls_per_session", 10**9)
        )
        over_time = duration_min > int(budgets.get("max_session_minutes", 10**9))
        emit_telemetry(
            root,
            {
                "event": "session_budget",
                "epoch_s": int(time.time()),
                "session_id": str(state.get("session_id", "")),
                "detail": (
                    f"tool_calls={state.get('tool_calls', 0)} "
                    f"duration_min={duration_min} "
                    f"over_calls={over_calls} over_time={over_time}"
                ),
            },
        )
    except Exception as exc:  # noqa: BLE001 - auxiliary hook must not break session
        sys.stderr.write(f"session_end: ignored error: {exc}\n")
    sys.exit(0)


if __name__ == "__main__":
    main()
