"""Harness engine: session state machine + workflow DAG loader.

This is the component that actually READS HARNESS.yaml (via policy.load_config),
state.schema.json, telemetry.schema.json and .agent/workflows/*.workflow.yaml.
The lifecycle hooks are thin dispatchers into SessionEngine; evals/runner.py
reuses load_workflow/topo_sort.

CLI:
  python .agent/runtime/engine.py --simulate        # fake session, exit 0/1
  python .agent/runtime/engine.py --validate-state  # state.json vs schema
"""

from __future__ import annotations

import json
import os
import sys
import time
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import policy  # noqa: E402
from state_store import StateStore  # noqa: E402

VALID_STATUSES = ("active", "ended")


class EngineError(Exception):
    pass


class WorkflowCycleError(EngineError):
    pass


def _load_schema(root: str, name: str) -> dict[str, Any]:
    path = os.path.join(root, ".agent", "schema", name)
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def emit_telemetry(root: str, record: dict[str, Any]) -> None:
    """Append a validated, secret-masked record to telemetry/events.jsonl."""
    schema = _load_schema(root, "telemetry.schema.json")
    errors = policy._schema_errors(schema, record, "$")
    if errors:
        raise EngineError("telemetry record invalid: " + "; ".join(errors))
    telemetry_dir = os.path.join(root, ".agent", "telemetry")
    os.makedirs(telemetry_dir, exist_ok=True)
    line = policy.mask_secrets(json.dumps(record, ensure_ascii=False))
    with open(
        os.path.join(telemetry_dir, "events.jsonl"), "a", encoding="utf-8"
    ) as fh:
        fh.write(line + "\n")


class SessionEngine:
    def __init__(self, root: str) -> None:
        self.root = root
        self.cfg = policy.load_config(root)
        self.store = StateStore(os.path.join(root, ".agent", "memory", "state.json"))

    def handle(self, event: str, payload: dict[str, Any]) -> dict[str, Any]:
        handlers = {
            "session_start": self._on_session_start,
            "post_tool_use": self._on_post_tool_use,
            "post_tool_use_failure": self._on_post_tool_use_failure,
            "session_end": self._on_session_end,
        }
        if event not in handlers:
            raise EngineError(f"unknown lifecycle event {event!r}")
        state = handlers[event](payload)
        emit_telemetry(
            self.root,
            {
                "event": event,
                "epoch_s": int(time.time()),
                "session_id": str(state.get("session_id", "")),
                "detail": str(payload.get("tool_name", payload.get("reason", ""))),
            },
        )
        return state

    def _on_session_start(self, payload: dict[str, Any]) -> dict[str, Any]:
        session_id = str(payload.get("session_id", "")) or f"local-{os.getpid()}"

        def mutate(state: dict[str, Any]) -> dict[str, Any]:
            return {
                "schema_version": 1,
                "session_id": session_id,
                "status": "active",
                "source": str(payload.get("source", "startup")),
                "started_epoch_s": int(time.time()),
                "ended_epoch_s": 0,
                "end_reason": "",
                "tool_calls": 0,
                "tool_failures": 0,
                "retries": {},
                "last_event": "session_start",
                "updated_epoch_s": int(time.time()),
            }

        state = self.store.update(mutate)
        self.validate_state(state)
        return state

    def _touch(
        self, state: dict[str, Any], event: str, **extra: Any
    ) -> dict[str, Any]:
        state.update(extra)
        state["last_event"] = event
        state["updated_epoch_s"] = int(time.time())
        return state

    def _ensure_session(self, state: dict[str, Any]) -> dict[str, Any]:
        if not state:
            # Hook fired without a prior SessionStart (e.g. resumed transcript).
            state = {
                "schema_version": 1,
                "session_id": f"recovered-{os.getpid()}",
                "status": "active",
                "source": "recovered",
                "started_epoch_s": int(time.time()),
                "ended_epoch_s": 0,
                "end_reason": "",
                "tool_calls": 0,
                "tool_failures": 0,
                "retries": {},
                "last_event": "session_start",
                "updated_epoch_s": int(time.time()),
            }
        return state

    def _on_post_tool_use(self, payload: dict[str, Any]) -> dict[str, Any]:
        def mutate(state: dict[str, Any]) -> dict[str, Any]:
            state = self._ensure_session(state)
            state["tool_calls"] = int(state.get("tool_calls", 0)) + 1
            return self._touch(state, "post_tool_use")

        state = self.store.update(mutate)
        self.validate_state(state)
        return state

    def _on_post_tool_use_failure(self, payload: dict[str, Any]) -> dict[str, Any]:
        tool = str(payload.get("tool_name", "unknown"))

        def mutate(state: dict[str, Any]) -> dict[str, Any]:
            state = self._ensure_session(state)
            state["tool_failures"] = int(state.get("tool_failures", 0)) + 1
            retries = dict(state.get("retries", {}))
            retries[tool] = int(retries.get(tool, 0)) + 1
            state["retries"] = retries
            return self._touch(state, "post_tool_use_failure")

        state = self.store.update(mutate)
        self.validate_state(state)
        return state

    def _on_session_end(self, payload: dict[str, Any]) -> dict[str, Any]:
        def mutate(state: dict[str, Any]) -> dict[str, Any]:
            state = self._ensure_session(state)
            return self._touch(
                state,
                "session_end",
                status="ended",
                ended_epoch_s=int(time.time()),
                end_reason=str(payload.get("reason", "unknown")),
            )

        state = self.store.update(mutate)
        self.validate_state(state)
        return state

    def validate_state(self, state: dict[str, Any]) -> None:
        schema = _load_schema(self.root, "state.schema.json")
        errors = policy._schema_errors(schema, state, "$")
        if errors:
            raise EngineError("state.json schema violations: " + "; ".join(errors))


# --- workflow DAG (used by evals/runner.py, Phase 5) -----------------------

def load_workflow(path: str) -> dict[str, Any]:
    try:
        import yaml
    except ImportError as exc:  # pragma: no cover
        raise EngineError("PyYAML required for workflow files") from exc
    try:
        with open(path, encoding="utf-8") as fh:
            data = yaml.safe_load(fh)
    except (OSError, yaml.YAMLError) as exc:
        raise EngineError(f"cannot load workflow {path}: {exc}") from exc
    if not isinstance(data, dict) or "steps" not in data or "name" not in data:
        raise EngineError(f"workflow {path} must define name + steps")
    steps = data["steps"]
    if not isinstance(steps, list) or not steps:
        raise EngineError(f"workflow {path}: steps must be a non-empty list")
    ids = [s.get("id") for s in steps]
    if len(ids) != len(set(ids)) or any(not i for i in ids):
        raise EngineError(f"workflow {path}: step ids must be unique and non-empty")
    known = set(ids)
    for step in steps:
        for dep in step.get("depends_on", []):
            if dep not in known:
                raise EngineError(
                    f"workflow {path}: step {step['id']!r} depends on unknown {dep!r}"
                )
    return data


def topo_sort(steps: list[dict[str, Any]]) -> list[str]:
    """Kahn's algorithm; raises WorkflowCycleError when a cycle exists."""
    deps = {s["id"]: set(s.get("depends_on", [])) for s in steps}
    order: list[str] = []
    ready = sorted(sid for sid, d in deps.items() if not d)
    while ready:
        node = ready.pop(0)
        order.append(node)
        for sid in sorted(deps):
            if node in deps[sid]:
                deps[sid].discard(node)
                if not deps[sid] and sid not in order and sid not in ready:
                    ready.append(sid)
    if len(order) != len(deps):
        remaining = sorted(set(deps) - set(order))
        raise WorkflowCycleError(f"cycle detected among steps: {remaining}")
    return order


# --- CLI -------------------------------------------------------------------

def _simulate(root: str) -> int:
    engine = SessionEngine(root)
    engine.handle("session_start", {"session_id": "sim-1", "source": "simulate"})
    engine.handle("post_tool_use", {"tool_name": "Bash"})
    engine.handle("post_tool_use", {"tool_name": "Edit"})
    engine.handle("post_tool_use_failure", {"tool_name": "Bash"})
    engine.handle("post_tool_use", {"tool_name": "Bash"})
    state = engine.handle("session_end", {"reason": "simulate_complete"})
    print(json.dumps(state, indent=2))
    return 0


def main(argv: list[str]) -> int:
    root = policy.project_root_from(__file__)
    if "--simulate" in argv:
        return _simulate(root)
    if "--validate-state" in argv:
        engine = SessionEngine(root)
        engine.validate_state(engine.store.read())
        print("state.json valid")
        return 0
    print("usage: engine.py [--simulate | --validate-state]", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
