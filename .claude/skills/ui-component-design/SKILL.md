---
name: ui-component-design
description: Use when building or changing a React component/screen in src/ so it obeys this project's design invariants — tokens only, seven states, keyboard access, logic/view split.
---

# ui-component-design

## Trigger
Creating or modifying a component in src/components or a screen in src/screens.

## Inputs / Outputs
- Inputs: the component's purpose and the data it renders.
- Outputs: a logic hook + a props-only view, tokenized styling, and coverage of
  the seven states.

## Procedure
1. Reuse first: grep src/components for an existing component that fits before
   creating a new one (CLAUDE.md B).
2. Split: put state and computation in `useX`; the view takes plain props and
   only renders (CLAUDE.md D). The hook holds no JSX and no token imports.
3. Style with design tokens only — no hex/rgb/hsl in src/components or
   src/screens. One accent color; two border levels; three status colors.
4. Handle all seven states: empty, loading, partial, error, success,
   no-permission, collapsed — one story each in `ComponentName.stories.tsx`.
5. Accessibility: keyboard 100%, focus ring 2px offset 2px, Esc closes the top
   layer. Text contrast >= 4.5:1 (caption >= 3:1).
6. Verify: `pnpm lint && pnpm typecheck && pnpm test`; visual snapshot at 1440px.

## Error handling
- If a color is needed that no token provides, add/choose a token — never inline
  a hex value to "just make it work".
- No mutation via store set() in the view — go through commit(patch, label).

## Negative example (do NOT use this skill)
For a pure src/lib function with no rendering, use api-contract-design /
tdd-refactoring instead; there is no view to design.
