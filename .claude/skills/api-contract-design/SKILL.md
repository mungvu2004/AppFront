---
name: api-contract-design
description: Use when defining or changing a typed contract between units — component props, store slice actions, hook return shapes, or zod schemas — before implementation in this TypeScript app.
---

# api-contract-design

## Trigger
A new component/hook/slice boundary, or a change to an existing one, where the
shape (props in, data out, actions) should be fixed before code is written.

## Inputs / Outputs
- Inputs: the units on each side of the boundary and the data crossing it.
- Outputs: TypeScript interfaces/types and, where data is validated at runtime,
  a zod schema — English identifiers only.

## Procedure
1. Grep existing contracts to reuse types before inventing new ones.
2. Define the view props as a plain data interface (no store, no functions that
   compute — CLAUDE.md D). Callbacks are allowed as `onX` props.
3. Define the hook return type: state fields + action functions (short English
   verbs).
4. For external/persisted data, write a `zod` schema and derive the type with
   `z.infer`, so validation and type stay in sync.
5. Typecheck the contract in isolation: `pnpm typecheck`.

## Error handling
- If two units disagree on a field name/shape, fix the contract first; do not
  paper over it with `any` or a cast.
- Keep optional vs required explicit; do not widen to `| undefined` to dodge a
  null check.

## Negative example (do NOT use this skill)
For an internal helper used in one file, a local type inline is enough — no
formal contract needed.
