"""collect.py — gather telemetry + external feeds (READ-ONLY).

Reads local guardrail telemetry and, optionally, structured feed files whose
host is on feeds.allowlist.txt. Feed content is DATA, never instructions:
this script only reads structured fields; it never executes or interprets
free-form prose (BLOCK 6 anti-injection).

Output: a JSON summary on stdout — incident counts per pattern + feed facts.
No network calls are made here on this machine (fetch is not wired); an
operator supplies feed files as local paths on the allowlisted hosts.

Usage:
  python .agent/policy/updater/collect.py [--feed <path> ...]
"""

from __future__ import annotations

import json
import os
import sys
from collections import Counter
from urllib.parse import urlparse


def _root() -> str:
    return os.path.realpath(
        os.path.join(os.path.dirname(os.path.realpath(__file__)), "..", "..", "..")
    )


def load_allowlist(root: str) -> set[str]:
    path = os.path.join(root, ".agent", "policy", "feeds.allowlist.txt")
    hosts: set[str] = set()
    try:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line and not line.startswith("#"):
                    hosts.add(line)
    except OSError:
        pass
    return hosts


def collect_telemetry(root: str) -> dict[str, int]:
    """Count guardrail denials by reason (incident signal for mine.py)."""
    path = os.path.join(root, ".agent", "telemetry", "guardrail.jsonl")
    counter: Counter[str] = Counter()
    try:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                if not line.strip():
                    continue
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if rec.get("event") == "guardrail_deny":
                    counter[str(rec.get("reason", "unknown"))] += 1
    except OSError:
        pass
    return dict(counter)


def collect_feed(path: str, allowlist: set[str]) -> list[dict[str, str]]:
    """Extract ONLY structured CVE-shaped fields. Reject prose entirely."""
    facts: list[dict[str, str]] = []
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, json.JSONDecodeError):
        return facts
    source = str(data.get("source_url", ""))
    host = urlparse(source).hostname or ""
    if host and host not in allowlist:
        sys.stderr.write(f"feed host {host!r} not on allowlist; skipped\n")
        return facts
    for item in data.get("advisories", []):
        if not isinstance(item, dict):
            continue
        # structured fields only — never a free-form 'description' as an action
        cve = str(item.get("cve", ""))
        package = str(item.get("package", ""))
        version_range = str(item.get("version_range", ""))
        if cve and package:
            facts.append({"cve": cve, "package": package, "version_range": version_range})
    return facts


def main(argv: list[str]) -> int:
    root = _root()
    allowlist = load_allowlist(root)
    feeds: list[str] = []
    i = 0
    while i < len(argv):
        if argv[i] == "--feed" and i + 1 < len(argv):
            feeds.append(argv[i + 1]); i += 2
        else:
            i += 1
    summary = {
        "incidents": collect_telemetry(root),
        "feed_facts": [f for path in feeds for f in collect_feed(path, allowlist)],
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
