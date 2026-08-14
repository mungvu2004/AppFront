"""apply.py — runtime evaluation of compiled rules against a command.

This is what a future guardrail extension would call to fold adaptive rules on
top of the hard-coded policy engine. Semantics by state:
  - enforce: a match BLOCKS (contributes to blocked=True)
  - shadow : a match is LOGGED ONLY, never blocks (shadow-mode observation)
Candidate/retired rules are not present in the compiled file, so they cannot
act. Returns (blocked, logs) so a shadow rule can be measured before promotion.

Usage:
  python apply.py --compiled <rules.compiled.json> --command "<cmd>"
"""

from __future__ import annotations

import json
import sys


def evaluate(command: str, compiled: dict) -> tuple[bool, list[dict]]:
    blocked = False
    logs: list[dict] = []
    for rule in compiled.get("rules", []):
        if rule.get("match_kind") == "substring" and rule["pattern"] in command:
            matched = True
        elif rule.get("match_kind") == "binary" and command.split()[:1] == [rule["pattern"]]:
            matched = True
        else:
            matched = False
        if not matched:
            continue
        entry = {"rule_id": rule["id"], "state": rule["state"], "effect": rule["effect"]}
        logs.append(entry)
        if rule["state"] == "enforce" and rule["effect"] == "deny":
            blocked = True
        # shadow: logged above, never sets blocked
    return blocked, logs


def main(argv: list[str]) -> int:
    if "--compiled" not in argv or "--command" not in argv:
        print("usage: apply.py --compiled <file> --command <cmd>", file=sys.stderr)
        return 2
    compiled_path = argv[argv.index("--compiled") + 1]
    command = argv[argv.index("--command") + 1]
    with open(compiled_path, encoding="utf-8") as fh:
        compiled = json.load(fh)
    blocked, logs = evaluate(command, compiled)
    print(json.dumps({"blocked": blocked, "logs": logs}, ensure_ascii=False))
    return 2 if blocked else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
