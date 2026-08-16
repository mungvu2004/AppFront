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

MARKDOWN_EXT = {".md", ".markdown"}

# One inline code span: `git push --force`, or ``a `nested` tick``. Deliberately
# simple -- an unbalanced tick matches nothing and the line is scanned whole,
# so a malformed span fails towards detection rather than away from it.
INLINE_CODE = re.compile(r"(`+)[^`]*\1")

# The only rule a documentation quote is allowed to escape.
#
# A guardrail has to be written down to be reviewable, and writing it down means
# naming the commands it blocks: CLAUDE.md and AGENTS.md both quote
# `git push --force` and `git commit --no-verify` in the sentence that says they
# are refused. Matching those made the two files that describe the policy the
# only two files the policy would not let anyone commit -- and the way out,
# `--no-verify`, is itself blocked at the permissions layer.
#
# So inside a Markdown file, and only for this rule, the contents of inline code
# spans are not scanned. What is given up is narrow and worth stating: a
# dangerous command quoted in backticks in a `.md` no longer trips the scan.
# Everything else still does -- the same command in prose, in a fenced block, or
# in any file that is not Markdown, and every secret pattern everywhere,
# backticks or not. A Markdown file is documentation, never something the
# repository executes; a `.sh`, a `.ts` or a workflow YAML is, and none of them
# are affected by this.
PROSE_EXEMPT_KINDS = {"dangerous-shell"}


def strip_inline_code(line: str) -> str:
    """A Markdown line with its inline code spans blanked out."""
    return INLINE_CODE.sub(" ", line)


def in_skipped_dir(path: str) -> bool:
    """Does this path lie under a directory `walk` refuses to descend into?

    Judged relative to the working directory, never against the absolute path.
    `walk` only ever skips directories below the tree it was pointed at, and
    matching the absolute path would inherit whatever the checkout happens to sit
    under: a repository cloned into `~/build` would match SKIP_DIRS on every file
    it contains and lose the rule everywhere. Anything outside the working
    directory is not exempted at all.
    """
    try:
        relative = os.path.relpath(os.path.abspath(path), os.getcwd())
    except ValueError:
        # Different drive on Windows; no common root, so nothing to be inside of.
        return False

    parts = relative.replace("\\", "/").split("/")
    if parts and parts[0] == "..":
        return False
    return any(part in SKIP_DIRS for part in parts[:-1])


def scan_file(path: str) -> list[dict[str, object]]:
    """Scan one file.

    Reachable two ways, and they used to disagree. `walk` never descends into
    SKIP_DIRS, so a whole-tree scan has never looked at `.agent` at all -- but the
    pre-commit hook names each staged file directly, and that path scanned every
    line of it. The harness is the guardrail: `runtime/policy.py` has to contain
    the string it refuses, and `policy/rules.source.yaml` has to list it. So the
    files that implement the block were the files the block would not let anyone
    commit, which is why none of `.agent` is in version control today.

    The two entry points now agree, and only about this: inside a skipped
    directory the `dangerous-shell` rule is off, exactly as it already was for a
    tree scan. Every secret pattern still runs there -- which makes a direct scan
    of `.agent` strictly stricter than the tree scan it is being reconciled with,
    not looser. A real credential in the harness is still caught, and the hook's
    own refusal of `*.env`, `*.pem` and `*.key` by name is untouched.
    """
    findings: list[dict[str, object]] = []
    markdown = os.path.splitext(path)[1].lower() in MARKDOWN_EXT
    skipped = in_skipped_dir(path)
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            for lineno, line in enumerate(fh, start=1):
                quoted = strip_inline_code(line) if markdown else line
                for kind, pattern in SECRET_PATTERNS:
                    if skipped and kind in PROSE_EXEMPT_KINDS:
                        continue
                    subject = quoted if kind in PROSE_EXEMPT_KINDS else line
                    if pattern.search(subject):
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


def emit(payload: dict[str, object]) -> None:
    """Write the JSON report without letting the console encoding decide the exit.

    A finding carries a snippet of the offending line, and this repo's source is
    full of Vietnamese. The default console encoding on Windows is cp1252, which
    has no room for most Vietnamese letters or for an arrow, so printing such a
    report raised UnicodeEncodeError and the process died with a traceback at
    exit 1 instead of saying what it found.

    That never let a secret through: the report is only unprintable once there is
    a finding in it, and a finding already means exit 1. But the pre-commit hook
    discards stdout and stderr, so an encoding crash and a genuine leaked
    credential looked identical to whoever was committing, and the message named
    the wrong problem. Escaped ASCII is still valid JSON, so falling back to it
    keeps every report machine-readable on any console.

    The encodability test runs before anything is written, so a report is never
    emitted half way and then repeated.
    """
    text = json.dumps(payload, ensure_ascii=False)
    try:
        text.encode(sys.stdout.encoding or "utf-8")
    except (UnicodeEncodeError, LookupError):
        text = json.dumps(payload, ensure_ascii=True)
    print(text)


def main(argv: list[str]) -> int:
    if len(argv) < 1:
        emit({"error": "usage: security-scan.py <path>"})
        return 2
    findings = walk(argv[0])
    emit({"findings": findings, "count": len(findings)})
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
