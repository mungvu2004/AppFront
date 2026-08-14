#!/usr/bin/env python
"""Minimal stdio MCP server (JSON-RPC 2.0 over stdin/stdout).

Implements just enough of the Model Context Protocol to answer `initialize`,
`tools/list`, and `tools/call` so it can be wired into .mcp.json and smoke
tested without any third-party SDK (stdlib only, per BLOCK 5).

Tools exposed:
  - health_check         -> harness liveness + version
  - get_sample_dataset   -> the canonical 48/21/34/14/4 / 248,60 m2 dataset
  - trigger_build        -> ask_user tool; returns the command, does not run it

Protocol note: every line on stdin is one JSON-RPC request; every response is
one JSON object on stdout. Logs go to stderr only (stdout must stay clean).
"""

from __future__ import annotations

import json
import sys
from typing import Any

PROTOCOL_VERSION = "2024-11-05"
SERVER_INFO = {"name": "internal-api-mcp", "version": "1.0.0"}

TOOLS = [
    {
        "name": "health_check",
        "description": "Report harness liveness and version.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_sample_dataset",
        "description": "Return the canonical sample dataset used across the app.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "trigger_build",
        "description": "Return the build command for the operator to confirm "
        "(ask_user). Does not execute anything.",
        "inputSchema": {
            "type": "object",
            "properties": {"target": {"type": "string"}},
        },
    },
]

SAMPLE_DATASET = {
    "counts": [48, 21, 34, 14, 4],
    "total_area_m2": "248,60",
    "unit_walls": "mm",
    "unit_height": "m",
    "unit_area": "m2",
}


def _result(request_id: Any, result: dict[str, Any]) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def _error(request_id: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def _text_content(payload: Any) -> dict[str, Any]:
    text = payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)
    return {"content": [{"type": "text", "text": text}]}


def handle(request: dict[str, Any]) -> dict[str, Any] | None:
    method = request.get("method")
    request_id = request.get("id")
    if method == "initialize":
        return _result(
            request_id,
            {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {"tools": {}},
                "serverInfo": SERVER_INFO,
            },
        )
    if method == "notifications/initialized":
        return None  # notification: no response
    if method == "tools/list":
        return _result(request_id, {"tools": TOOLS})
    if method == "tools/call":
        params = request.get("params", {})
        name = params.get("name")
        if name == "health_check":
            return _result(request_id, _text_content(
                {"status": "ok", "server": SERVER_INFO["name"], "version": SERVER_INFO["version"]}
            ))
        if name == "get_sample_dataset":
            return _result(request_id, _text_content(SAMPLE_DATASET))
        if name == "trigger_build":
            target = params.get("arguments", {}).get("target", "build")
            return _result(request_id, _text_content(
                {"note": "confirm before running", "command": f"pnpm {target}"}
            ))
        return _error(request_id, -32602, f"unknown tool: {name}")
    return _error(request_id, -32601, f"method not found: {method}")


def main() -> int:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError as exc:
            sys.stderr.write(f"parse error: {exc}\n")
            print(json.dumps(_error(None, -32700, "parse error")), flush=True)
            continue
        try:
            response = handle(request)
        except Exception as exc:  # noqa: BLE001 - report as JSON-RPC error, keep serving
            response = _error(request.get("id"), -32603, f"internal error: {exc}")
        if response is not None:
            print(json.dumps(response, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
