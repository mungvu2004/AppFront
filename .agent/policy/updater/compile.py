"""compile.py — rules.source.yaml (+ vetted candidates) -> rules.compiled.json.

Enforces the fixed grammar. Two non-negotiable rejections (BLOCK 6):
  1. Any rule with effect NOT in {deny, warn} is rejected. The updater path can
     NEVER introduce an `allow`. Loosening is a human PR editing rules.source
     by hand, which is a different (protected) action.
  2. Any unknown field, or any file that fails the grammar, rejects the WHOLE
     file — no partial salvage (prevents injection via a smuggled field).

Records the compiled artifact's sha256 into ledger.jsonl so the ConfigChange
hook can detect tampering.

Usage:
  python .agent/policy/updater/compile.py               # compile source
  python .agent/policy/updater/compile.py --check <f>   # validate a candidate, exit 1 if bad
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from typing import Any

ALLOWED_EFFECTS = {"deny", "warn"}
ALLOWED_MATCH = {"substring", "binary"}
ALLOWED_STATE = {"candidate", "shadow", "enforce", "retired"}
REQUIRED_FIELDS = {
    "id", "effect", "match_kind", "pattern", "state", "reason", "expires_at", "hits"
}
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class CompileError(Exception):
    pass


def _root() -> str:
    return os.path.realpath(
        os.path.join(os.path.dirname(os.path.realpath(__file__)), "..", "..", "..")
    )


def _load_yaml(path: str) -> Any:
    import yaml
    with open(path, encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def validate_rule(rule: dict[str, Any], where: str) -> None:
    if not isinstance(rule, dict):
        raise CompileError(f"{where}: rule must be a mapping")
    fields = set(rule)
    unknown = fields - REQUIRED_FIELDS
    if unknown:
        raise CompileError(f"{where}: unknown field(s) {sorted(unknown)} -> reject file")
    missing = REQUIRED_FIELDS - fields
    if missing:
        raise CompileError(f"{where}: missing field(s) {sorted(missing)}")
    if rule["effect"] not in ALLOWED_EFFECTS:
        raise CompileError(
            f"{where}: effect {rule['effect']!r} not allowed "
            f"(updater path cannot introduce allow)"
        )
    if rule["match_kind"] not in ALLOWED_MATCH:
        raise CompileError(f"{where}: match_kind {rule['match_kind']!r} invalid")
    if rule["state"] not in ALLOWED_STATE:
        raise CompileError(f"{where}: state {rule['state']!r} invalid")
    if not isinstance(rule["id"], str) or not ID_RE.match(rule["id"]):
        raise CompileError(f"{where}: id must be kebab-case")
    if not isinstance(rule["pattern"], str) or not rule["pattern"]:
        raise CompileError(f"{where}: pattern must be a non-empty string")
    if not isinstance(rule["expires_at"], str) or not DATE_RE.match(rule["expires_at"]):
        raise CompileError(f"{where}: expires_at must be YYYY-MM-DD (TTL required)")
    if not isinstance(rule["hits"], int) or rule["hits"] < 0:
        raise CompileError(f"{where}: hits must be a non-negative integer")


def validate_file(data: Any, where: str) -> list[dict[str, Any]]:
    if not isinstance(data, dict) or "rules" not in data:
        raise CompileError(f"{where}: top-level must have 'rules'")
    rules = data["rules"]
    if not isinstance(rules, list):
        raise CompileError(f"{where}: 'rules' must be a list")
    seen_ids: set[str] = set()
    for i, rule in enumerate(rules):
        validate_rule(rule, f"{where}[{i}]")
        if rule["id"] in seen_ids:
            raise CompileError(f"{where}: duplicate id {rule['id']!r}")
        seen_ids.add(rule["id"])
    return rules


def compile_source(root: str) -> dict[str, Any]:
    src = os.path.join(root, ".agent", "policy", "rules.source.yaml")
    data = _load_yaml(src)
    rules = validate_file(data, "rules.source.yaml")
    # Only enforce/shadow rules are active at runtime; candidates/retired excluded.
    active = [r for r in rules if r["state"] in ("shadow", "enforce")]
    compiled = {"version": 1, "rules": active}
    return compiled


def write_compiled(root: str, compiled: dict[str, Any]) -> str:
    payload = json.dumps(compiled, ensure_ascii=False, sort_keys=True, indent=2)
    data = payload.encode("utf-8")
    # Write BYTES (binary mode) so the on-disk file matches the hashed bytes
    # exactly; text mode on Windows would translate \n -> \r\n and break the
    # sha256 the ConfigChange hook re-computes.
    digest = hashlib.sha256(data).hexdigest()
    out = os.path.join(root, ".agent", "policy", "rules.compiled.json")
    tmp = out + ".tmp"
    with open(tmp, "wb") as fh:
        fh.write(data)
    os.replace(tmp, out)
    _append_ledger(root, {"action": "compile", "sha256": digest,
                          "rule_count": len(compiled["rules"])})
    return digest


def _append_ledger(root: str, record: dict[str, Any]) -> None:
    ledger = os.path.join(root, ".agent", "policy", "ledger.jsonl")
    os.makedirs(os.path.dirname(ledger), exist_ok=True)
    with open(ledger, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")


def main(argv: list[str]) -> int:
    root = _root()
    if "--check" in argv:
        i = argv.index("--check")
        try:
            path = argv[i + 1]
        except IndexError:
            print("usage: compile.py --check <file>", file=sys.stderr)
            return 2
        try:
            data = _load_yaml(path)
            validate_file(data, os.path.basename(path))
        except CompileError as exc:
            print(f"REJECT: {exc}", file=sys.stderr)
            return 1
        except Exception as exc:  # noqa: BLE001 - malformed yaml etc.
            print(f"REJECT: {exc}", file=sys.stderr)
            return 1
        print("candidate OK (grammar valid, no allow)")
        return 0
    try:
        compiled = compile_source(root)
        digest = write_compiled(root, compiled)
    except CompileError as exc:
        print(f"REJECT: {exc}", file=sys.stderr)
        return 1
    print(f"compiled {len(compiled['rules'])} active rule(s); sha256={digest[:16]}...")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
