"""Atomic, file-locked JSON state store.

Used by engine.py and the lifecycle hooks. Two processes updating the same
state file concurrently must never corrupt it: updates run under an OS-level
lock on a sidecar .lock file and land via atomic os.replace.
"""

from __future__ import annotations

import json
import os
import time
from typing import Any, Callable


class StateStoreError(Exception):
    pass


if os.name == "nt":
    import msvcrt

    def _lock(fh: Any) -> None:
        # msvcrt.locking(LK_LOCK) retries ~10s internally; loop for longer waits.
        deadline = time.monotonic() + 30.0
        while True:
            try:
                fh.seek(0)
                msvcrt.locking(fh.fileno(), msvcrt.LK_LOCK, 1)
                return
            except OSError:
                if time.monotonic() > deadline:
                    raise StateStoreError("timed out waiting for state lock")

    def _unlock(fh: Any) -> None:
        fh.seek(0)
        msvcrt.locking(fh.fileno(), msvcrt.LK_UNLCK, 1)
else:  # pragma: no cover - POSIX path, untested on this Windows host
    import fcntl

    def _lock(fh: Any) -> None:
        fcntl.flock(fh.fileno(), fcntl.LOCK_EX)

    def _unlock(fh: Any) -> None:
        fcntl.flock(fh.fileno(), fcntl.LOCK_UN)


class StateStore:
    def __init__(self, path: str) -> None:
        self.path = path
        self.lock_path = path + ".lock"
        os.makedirs(os.path.dirname(path), exist_ok=True)

    def read(self) -> dict[str, Any]:
        """Read without locking (single atomic file read)."""
        try:
            with open(self.path, encoding="utf-8") as fh:
                data = json.load(fh)
        except FileNotFoundError:
            return {}
        except json.JSONDecodeError as exc:
            raise StateStoreError(f"corrupt state file {self.path}: {exc}") from exc
        if not isinstance(data, dict):
            raise StateStoreError(f"state root must be an object: {self.path}")
        return data

    def update(self, mutate: Callable[[dict[str, Any]], dict[str, Any]]) -> dict[str, Any]:
        """Locked read-modify-write. `mutate` gets the current state and
        returns the next state; the write is atomic (tmp + os.replace)."""
        with open(self.lock_path, "a+b") as lock_fh:
            _lock(lock_fh)
            try:
                state = self.read()
                new_state = mutate(state)
                if not isinstance(new_state, dict):
                    raise StateStoreError("mutate() must return a dict")
                tmp = f"{self.path}.{os.getpid()}.tmp"
                with open(tmp, "w", encoding="utf-8") as fh:
                    json.dump(new_state, fh, ensure_ascii=False, indent=2)
                os.replace(tmp, self.path)
                return new_state
            finally:
                _unlock(lock_fh)
