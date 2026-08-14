---
name: tdd-refactoring
description: Use when changing behavior in src/ under a red-green-refactor discipline, or restructuring code while keeping tests green, in this Vite + vitest project.
---

# tdd-refactoring

## Trigger
Implementing or changing logic where a failing test should be written first,
or refactoring existing code that must stay behavior-preserving.

## Inputs / Outputs
- Inputs: the behavior to add/change; the target file(s) in src/.
- Outputs: new/updated tests + implementation, with a green `pnpm test` log.

## Procedure
1. Red: write a failing test next to the target (`Name.test.ts(x)`), run
   `pnpm vitest run <path>` and confirm it fails for the right reason.
2. Green: write the minimum code to pass. Keep logic in src/lib or a hook, not
   in a component (CLAUDE.md D).
3. Refactor: improve names/structure; re-run `pnpm vitest run <path>`.
4. Guard the whole suite: `pnpm test` then `pnpm typecheck` then `pnpm lint`.
5. For a pure refactor, do not change tests first — run the suite before and
   after and confirm identical results.

## Error handling
- If a test is flaky, isolate with `pnpm vitest run <path> -t "<name>"` before
  touching source.
- If typecheck fails after refactor, fix types — do not add `any` to silence it.

## Negative example (do NOT use this skill)
For a pure style/token swap with existing coverage, run the suite once; a full
red-green cycle is unnecessary.
