---
name: docker-containerization
description: Use when building or validating the isolation sandbox for running untrusted or unallowlisted commands — non-root, read-only source, no network — in this repo's .agent/sandboxes.
---

# docker-containerization

## Trigger
Creating or changing the sandbox that runs commands the allowlist does not
cover, or verifying its isolation guarantees.

## Inputs / Outputs
- Inputs: the command class to isolate and the sandbox files under
  .agent/sandboxes.
- Outputs: a validated compose config and a container that runs non-root with
  no network and a read-only source mount.

## Procedure
1. Validate compose syntax first: `docker compose -f
   .agent/sandboxes/docker-compose.sandbox.yml config`.
2. Confirm isolation invariants in the compose file: `user:` is non-root,
   source mounted `:ro`, `network_mode: none`, `cap_drop: [ALL]`, cpu/memory
   limits set, no docker socket mount.
3. Build: `docker build -f .agent/sandboxes/Dockerfile.sandbox
   -t harness-sandbox .agent/sandboxes`.
4. Smoke the boundary: a write to the read-only source path must fail; the
   writable path is /workspace/tmp only.

## Error handling
- `docker` may be absent on some machines — check `command -v docker` and skip
  with a clear message rather than failing the whole run.
- Never add `--privileged` or mount `/var/run/docker.sock`; that breaks the
  isolation boundary.

## Negative example (do NOT use this skill)
For an allowlisted command (pnpm test, git status), run it directly — the
sandbox is only for unallowlisted/untrusted commands.
