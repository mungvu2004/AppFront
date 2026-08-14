---
name: performance-profiling
description: Use when a React/Three.js view is slow, re-renders too often, or a bundle grows — measure before changing, in this Vite build.
---

# performance-profiling

## Trigger
A visible slowdown, jank in the 3D canvas, excessive re-renders, or a bundle
size regression.

## Inputs / Outputs
- Inputs: the slow view/interaction and a way to reproduce it.
- Outputs: a measured before/after plus the specific fix (memoization, split,
  virtualization).

## Procedure
1. Measure first. Build and inspect size: `pnpm build` and read the Vite output;
   compare against the prior build.
2. Re-renders: check for missing memoized selectors (this repo uses memoized
   store selectors) and unstable props/deps. Prefer selector memoization over
   ad-hoc `useMemo` in views (logic belongs in hooks/lib).
3. Long lists: use `@tanstack/react-virtual` (already a dependency) instead of
   rendering all rows.
4. Three.js: avoid reallocating geometries/materials per frame; hoist them.
5. Re-measure and record the delta. Only keep changes that measurably help.

## Error handling
- If you cannot reproduce the slowness, do not "optimize" speculatively — say so.
- Respect prefers-reduced-motion and the 5 allowed durations (CLAUDE.md).

## Negative example (do NOT use this skill)
Do not micro-optimize a component that renders a handful of nodes and is not on
any hot path.
