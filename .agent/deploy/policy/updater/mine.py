"""mine.py — turn collected signals into candidate rules by NUMERIC threshold.

No LLM decides state transitions here (BLOCK 6). A pattern becomes a
`candidate` only when the same incident reason appears >= MIN_INCIDENTS times.
Every mined rule is effect=deny/warn (a TIGHTENING); this script is
STRUCTURALLY incapable of emitting effect=allow.

Output: writes one YAML candidate file to .agent/policy/candidates/.
Usage:
  python .agent/policy/updater/mine.py --from <collect.json> [--min N]
"""

from __future__ import annotations

import json
import os
import re
import sys

MIN_INCIDENTS_DEFAULT = 3
ALLOWED_EFFECTS = ("deny", "warn")


def _root() -> str:
    return os.path.realpath(
        os.path.join(os.path.dirname(os.path.realpath(__file__)), "..", "..", "..")
    )


def _slug(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return (s or "rule")[:48]


def mine(summary: dict, min_incidents: int) -> list[dict]:
    candidates: list[dict] = []
    for reason, count in summary.get("incidents", {}).items():
        if count < min_incidents:
            continue
        candidates.append({
            "id": f"cand-{_slug(reason)}",
            "effect": "deny",  # tightening only; never 'allow'
            "match_kind": "substring",
            "pattern": _pattern_from_reason(reason),
            "state": "candidate",
            "reason": f"Auto-mined from {count} incidents: {reason}",
            "expires_at": "2027-01-01",
            "hits": 0,
        })
    return candidates


def _pattern_from_reason(reason: str) -> str:
    # Extract a quoted token from the reason if present, else a safe keyword.
    m = re.search(r"'([^']+)'", reason)
    if m:
        return m.group(1)
    return reason.split(":")[0][:40]


def to_yaml(candidates: list[dict]) -> str:
    lines = ["# AUTO-GENERATED candidate rules. Review before promotion.",
             "version: 1", "rules:"]
    for c in candidates:
        assert c["effect"] in ALLOWED_EFFECTS, "mine.py must not emit allow"
        lines.append(f"  - id: {c['id']}")
        lines.append(f"    effect: {c['effect']}")
        lines.append(f"    match_kind: {c['match_kind']}")
        lines.append(f"    pattern: \"{c['pattern']}\"")
        lines.append(f"    state: {c['state']}")
        lines.append(f"    reason: \"{c['reason']}\"")
        lines.append(f"    expires_at: \"{c['expires_at']}\"")
        lines.append(f"    hits: {c['hits']}")
    return "\n".join(lines) + "\n"


def main(argv: list[str]) -> int:
    root = _root()
    src = None
    min_incidents = MIN_INCIDENTS_DEFAULT
    i = 0
    while i < len(argv):
        if argv[i] == "--from" and i + 1 < len(argv):
            src = argv[i + 1]; i += 2
        elif argv[i] == "--min" and i + 1 < len(argv):
            min_incidents = int(argv[i + 1]); i += 2
        else:
            i += 1
    if not src:
        print("usage: mine.py --from <collect.json> [--min N]", file=sys.stderr)
        return 2
    with open(src, encoding="utf-8") as fh:
        summary = json.load(fh)
    candidates = mine(summary, min_incidents)
    if not candidates:
        print("no candidates met the threshold", file=sys.stderr)
        return 0
    out_dir = os.path.join(root, ".agent", "policy", "candidates")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"mined-{candidates[0]['id']}.yaml")
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(to_yaml(candidates))
    print(f"wrote {len(candidates)} candidate(s) to {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
