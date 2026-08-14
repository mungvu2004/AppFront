"""Reader/validator for .agent/mcp/permissions.json.

Ensures the matrix is well-formed and answers "what is the decision for
(server, tool)?" so the config is not a dead file (BLOCK 8). Also cross-checks
that every server named in .mcp.json has a permission entry and vice-versa.

CLI:
  python .agent/mcp/check_permissions.py --validate
  python .agent/mcp/check_permissions.py --decide filesystem read_file
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any

VALID_CATEGORIES = ("auto_allow", "ask_user", "blocked")


class PermissionError_(Exception):
    pass


def _root() -> str:
    return os.path.realpath(
        os.path.join(os.path.dirname(os.path.realpath(__file__)), "..", "..")
    )


def load(root: str | None = None) -> dict[str, Any]:
    root = root or _root()
    path = os.path.join(root, ".agent", "mcp", "permissions.json")
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, dict) or "servers" not in data:
        raise PermissionError_("permissions.json must have a 'servers' object")
    return data


def validate(root: str | None = None) -> list[str]:
    root = root or _root()
    data = load(root)
    problems: list[str] = []
    if data.get("default") not in VALID_CATEGORIES:
        problems.append(f"default must be one of {VALID_CATEGORIES}")
    for server, entry in data["servers"].items():
        if not isinstance(entry, dict):
            problems.append(f"{server}: entry must be an object")
            continue
        for cat in VALID_CATEGORIES:
            if cat in entry and not isinstance(entry[cat], list):
                problems.append(f"{server}.{cat} must be a list")
        # a tool must not sit in two categories at once
        seen: dict[str, str] = {}
        for cat in VALID_CATEGORIES:
            for tool in entry.get(cat, []):
                if tool in seen:
                    problems.append(
                        f"{server}: tool {tool!r} in both {seen[tool]} and {cat}"
                    )
                seen[tool] = cat

    # cross-check against .mcp.json
    mcp_path = os.path.join(root, ".mcp.json")
    try:
        with open(mcp_path, encoding="utf-8") as fh:
            servers = set(json.load(fh).get("mcpServers", {}))
    except (OSError, json.JSONDecodeError) as exc:
        problems.append(f"cannot read .mcp.json: {exc}")
        servers = set()
    matrix_servers = set(data["servers"])
    for missing in servers - matrix_servers:
        problems.append(f".mcp.json server {missing!r} has no permission entry")
    for extra in matrix_servers - servers:
        problems.append(f"permission entry {extra!r} has no server in .mcp.json")
    return problems


def decide(server: str, tool: str, root: str | None = None) -> str:
    data = load(root)
    entry = data["servers"].get(server)
    if entry is None:
        return str(data.get("default", "ask_user"))
    for cat in VALID_CATEGORIES:
        if tool in entry.get(cat, []):
            return cat
    return str(data.get("default", "ask_user"))


def main(argv: list[str]) -> int:
    if "--validate" in argv:
        problems = validate()
        if problems:
            print("\n".join("INVALID: " + p for p in problems), file=sys.stderr)
            return 1
        data = load()
        print(f"permissions.json valid ({len(data['servers'])} servers)")
        return 0
    if "--decide" in argv:
        i = argv.index("--decide")
        try:
            server, tool = argv[i + 1], argv[i + 2]
        except IndexError:
            print("usage: --decide <server> <tool>", file=sys.stderr)
            return 1
        print(decide(server, tool))
        return 0
    print("usage: check_permissions.py [--validate | --decide <server> <tool>]",
          file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
