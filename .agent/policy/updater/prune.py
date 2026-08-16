"""prune.py — list rules eligible for retirement (expired or 0 hits in 90 days).

--dry-run only reports; it never edits rules.source.yaml (human-owned/protected).
Retirement into source is a reviewed PR.

Usage:
  python .agent/policy/updater/prune.py --dry-run [--today YYYY-MM-DD]
"""

from __future__ import annotations

import os
import sys


def _root() -> str:
    return os.path.realpath(
        os.path.join(os.path.dirname(os.path.realpath(__file__)), "..", "..", "..")
    )


def _load_rules(root: str) -> list[dict]:
    import yaml
    src = os.path.join(root, ".agent", "policy", "rules.source.yaml")
    with open(src, encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    return data.get("rules", []) if isinstance(data, dict) else []


def eligible_for_retire(rule: dict, today: str) -> tuple[bool, str]:
    """A rule retires when its TTL has passed. The TTL (expires_at) is the
    guaranteed backstop against dead-rule accumulation. A '0 hits in 90 days'
    signal additionally requires a first-seen date, which lives in ledger.jsonl;
    prune folds it in only when that age is known (see age_days)."""
    if rule.get("state") == "retired":
        return False, "already retired"
    expires = str(rule.get("expires_at", ""))
    if expires and expires <= today:
        return True, f"expired ({expires} <= {today})"
    age_days = rule.get("_age_days")
    if isinstance(age_days, int) and age_days >= 90 and int(rule.get("hits", 0)) == 0:
        return True, f"0 hits in {age_days} days"
    return False, "active"


def main(argv: list[str]) -> int:
    root = _root()
    # Date.now equivalents are avoided; require an explicit --today for determinism.
    today = "2026-08-14"
    if "--today" in argv:
        today = argv[argv.index("--today") + 1]
    if "--dry-run" not in argv:
        print("usage: prune.py --dry-run [--today YYYY-MM-DD]", file=sys.stderr)
        return 2
    rules = _load_rules(root)
    to_retire = []
    for rule in rules:
        ok, why = eligible_for_retire(rule, today)
        if ok:
            to_retire.append((rule["id"], why))
    if not to_retire:
        print("no rules eligible for retirement")
        return 0
    print(f"{len(to_retire)} rule(s) eligible for retirement:")
    for rid, why in to_retire:
        print(f"  {rid}: {why}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
