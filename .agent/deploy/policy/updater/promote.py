"""promote.py — advance a rule's lifecycle state by NUMERIC thresholds.

  candidate -> shadow : same incident >= 3 times AND a repro test exists
  shadow    -> enforce: >= 20 shadow sessions with 0 false positives
  any       -> retired: 0 hits in 90 days OR expires_at passed

This script only REPORTS the recommended transition (and can rewrite a staged
copy); it never edits rules.source.yaml in place — that file is human-owned and
protected. Promotion into source is a reviewed PR.

Usage:
  python .agent/policy/updater/promote.py --report
  python .agent/policy/updater/promote.py --can-enforce <rule_id> --sessions N --fp M
"""

from __future__ import annotations

import os
import sys

MIN_INCIDENTS_FOR_SHADOW = 3
MIN_SESSIONS_FOR_ENFORCE = 20
MAX_FALSE_POSITIVES = 0


def can_shadow(incident_count: int, has_repro_test: bool) -> bool:
    return incident_count >= MIN_INCIDENTS_FOR_SHADOW and has_repro_test


def can_enforce(shadow_sessions: int, false_positives: int) -> bool:
    return (
        shadow_sessions >= MIN_SESSIONS_FOR_ENFORCE
        and false_positives <= MAX_FALSE_POSITIVES
    )


def _root() -> str:
    return os.path.realpath(
        os.path.join(os.path.dirname(os.path.realpath(__file__)), "..", "..", "..")
    )


def main(argv: list[str]) -> int:
    if "--can-enforce" in argv:
        i = argv.index("--can-enforce")
        rule_id = argv[i + 1] if i + 1 < len(argv) else "?"
        sessions = int(argv[argv.index("--sessions") + 1]) if "--sessions" in argv else 0
        fp = int(argv[argv.index("--fp") + 1]) if "--fp" in argv else 0
        ok = can_enforce(sessions, fp)
        print(f"{rule_id}: enforce={'YES' if ok else 'NO'} "
              f"(sessions={sessions}/{MIN_SESSIONS_FOR_ENFORCE}, fp={fp})")
        return 0 if ok else 1
    if "--report" in argv:
        print("promotion thresholds:")
        print(f"  candidate->shadow : >= {MIN_INCIDENTS_FOR_SHADOW} incidents + repro test")
        print(f"  shadow->enforce   : >= {MIN_SESSIONS_FOR_ENFORCE} sessions, "
              f"<= {MAX_FALSE_POSITIVES} false positives")
        print("  ->retired         : 0 hits in 90 days or expires_at passed")
        return 0
    print("usage: promote.py [--report | --can-enforce <id> --sessions N --fp M]",
          file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
