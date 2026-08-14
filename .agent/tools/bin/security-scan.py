#!/usr/bin/env python
"""security-scan: static scan for hardcoded secrets and dangerous shell.

Stdlib-only (gitleaks is not installed on this machine). Emits JSON on stdout
and exits 1 when findings exist so it can gate CI.

Usage: python .agent/tools/bin/security-scan.py <path>
"""

from __future__ import annotations

import json
import os
import re
import sys

SECRET_PATTERNS = [
    ("hardcoded-secret", re.compile(
        r"(?i)\b(api[_-]?key|secret|token|password|passwd|bearer|credential)\b"
        r"\s*[:=]\s*['\"][^'\"]{6,}['\"]")),
    ("aws-key", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("private-key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("dangerous-shell", re.compile(
        r"rm\s+-rf\s+/|curl[^\n|]*\|\s*sh\b|\$\{?IFS\}?|--no-verify|--force")),
]

SKIP_DIRS = {"node_modules", ".git", "dist", "build", "__pycache__", ".agent"}
TEXT_EXT = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".sh", ".py",
    ".yaml", ".yml", ".env", ".txt", ".md",
}


def scan_file(path: str) -> list[dict[str, object]]:
    findings: list[dict[str, object]] = []
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            for lineno, line in enumerate(fh, start=1):
                for kind, pattern in SECRET_PATTERNS:
                    if pattern.search(line):
                        findings.append({
                            "file": path,
                            "line": lineno,
                            "kind": kind,
                            "snippet": line.strip()[:120],
                        })
    except OSError:
        return findings
    return findings


def walk(target: str) -> list[dict[str, object]]:
    findings: list[dict[str, object]] = []
    if os.path.isfile(target):
        return scan_file(target)
    for dirpath, dirnames, filenames in os.walk(target):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            ext = os.path.splitext(name)[1].lower()
            if ext and ext not in TEXT_EXT:
                continue
            findings.extend(scan_file(os.path.join(dirpath, name)))
    return findings


def main(argv: list[str]) -> int:
    if len(argv) < 1:
        print(json.dumps({"error": "usage: security-scan.py <path>"}))
        return 2
    findings = walk(argv[0])
    print(json.dumps({"findings": findings, "count": len(findings)}, ensure_ascii=False))
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
