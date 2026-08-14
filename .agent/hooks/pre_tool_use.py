#!/usr/bin/env python
"""PreToolUse guardrail hook.

ROLE: guardrail => FAIL-CLOSED. Any unreadable payload, broken config,
import error, or analysis overrun results in exit 2 (the only blocking
exit code). exit 1 is a non-blocking error and is never used here.

Contract:
  stdin : one JSON object from Claude Code ({tool_name, tool_input, ...})
  stdout: nothing (decision is carried by the exit code alone)
  stderr: the reason, fed back to the model when blocking
  exit 0: neutral — the normal permission flow decides
  exit 2: block the tool call

An internal watchdog stops analysis before the runtime timeout (declared as
5s in .claude/settings.json), because a timed-out PreToolUse hook blocks
NOTHING — the tool call would proceed normally.
"""

from __future__ import annotations

import json
import os
import sys
import time

_START = time.monotonic()


def _deny(reason: str) -> "None":
    sys.stderr.write(f"guardrail deny: {reason}\n")
    sys.exit(2)


def _elapsed_ms() -> float:
    return (time.monotonic() - _START) * 1000.0


def main() -> None:
    root = os.environ.get("CLAUDE_PROJECT_DIR", "").strip()
    hook_dir = os.path.dirname(os.path.realpath(__file__))
    if not root:
        root = os.path.realpath(os.path.join(hook_dir, "..", ".."))

    sys.path.insert(0, os.path.join(root, ".agent", "runtime"))
    try:
        import policy
    except Exception as exc:  # noqa: BLE001 - fail-closed on any import problem
        _deny(f"cannot import policy engine: {exc}")
        return

    try:
        raw = sys.stdin.read()
    except OSError as exc:
        _deny(f"cannot read stdin: {exc}")
        return
    if not raw or not raw.strip():
        _deny("empty stdin payload")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        _deny(f"stdin is not valid JSON: {exc}")
        return
    if not isinstance(data, dict):
        _deny("payload is not a JSON object")

    try:
        cfg = policy.load_config(root)
    except policy.PolicyError as exc:
        _deny(str(exc))
        return

    budget_ms = cfg["guardrail"]["budget_ms"]
    if _elapsed_ms() > budget_ms:
        _deny(f"watchdog: analysis exceeded {budget_ms}ms budget")

    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input")
    if not isinstance(tool_input, dict):
        _deny(f"missing or malformed tool_input for tool {tool_name!r}")
        return

    verdict = policy.ALLOW
    try:
        if tool_name == "Bash":
            command = tool_input.get("command", "")
            if not isinstance(command, str) or not command.strip():
                _deny("Bash call without a command string")
            verdict = policy.evaluate_command(command, cfg, root)
        elif tool_name == "PowerShell":
            command = tool_input.get("command", "")
            if not isinstance(command, str) or not command.strip():
                _deny("PowerShell call without a command string")
            verdict = policy.evaluate_powershell(command, cfg, root)
        elif tool_name in ("Write", "Edit", "MultiEdit", "NotebookEdit"):
            path = tool_input.get("file_path") or tool_input.get("notebook_path")
            verdict = policy.evaluate_file_write(path or "", cfg, root)
        else:
            sys.exit(0)  # matcher should not send other tools; stay neutral
    except policy.PolicyError as exc:
        _deny(str(exc))
        return

    if _elapsed_ms() > budget_ms:
        _deny(f"watchdog: analysis exceeded {budget_ms}ms budget")

    if verdict.deny:
        _log_denial(root, tool_name, tool_input, verdict.reason, policy)
        _deny(verdict.reason)
    sys.exit(0)


def _log_denial(
    root: str, tool_name: str, tool_input: dict, reason: str, policy_mod: object
) -> None:
    """Best-effort telemetry; a logging failure must never change the verdict."""
    try:
        record = {
            "event": "guardrail_deny",
            "epoch_s": int(time.time()),
            "tool": tool_name,
            "input": policy_mod.mask_secrets(json.dumps(tool_input)[:2000]),
            "reason": reason,
        }
        telemetry_dir = os.path.join(root, ".agent", "telemetry")
        os.makedirs(telemetry_dir, exist_ok=True)
        with open(
            os.path.join(telemetry_dir, "guardrail.jsonl"), "a", encoding="utf-8"
        ) as fh:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")
    except OSError as exc:
        sys.stderr.write(f"telemetry write failed (non-fatal): {exc}\n")


if __name__ == "__main__":
    main()
