---
name: database-ops
description: Use when working with persisted client-side data in this app (IndexedDB via fake-indexeddb in tests, store persistence). There is no server SQL database; treat any DROP/TRUNCATE request as out of scope and dangerous.
---

# database-ops

## Trigger
Reading, migrating, or testing persisted state: zustand persistence, IndexedDB
schemas, or seed/fixture data for tests.

## Inputs / Outputs
- Inputs: the store slice or IndexedDB object store involved; the migration goal.
- Outputs: migration/seed code plus a passing `pnpm test` log using
  fake-indexeddb.

## Procedure
1. Locate persistence: grep for `persist(` and slice files `*Slice.ts`.
2. For a schema/version bump, add a migrate function keyed by version; never
   mutate persisted data in place without a version guard.
3. Seed test data with the standard dataset (48/21/34/14/4; 248,60 m2).
4. Test against fake-indexeddb (already a devDependency): `pnpm vitest run
   <path>`; assert read-back equals written shape.

## Error handling
- No real SQL/psql exists in this stack. If asked to run `DROP DATABASE` /
  `TRUNCATE`, refuse — the guardrail blocks it and there is no such database.
- If a persisted migration corrupts state in a test, clear the fake store in
  `beforeEach` and re-run.

## Negative example (do NOT use this skill)
For plain in-memory store state with no persistence, just use the store; no
migration or IndexedDB work is needed.
