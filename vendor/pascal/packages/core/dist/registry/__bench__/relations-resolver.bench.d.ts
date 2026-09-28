/**
 * Bench harness for the relations cascade resolver.
 *
 * Phase 1 risk gate: at 5000 nodes the resolver step must stay under
 * 2ms p95 per `cascadeDirty` invocation. Above that, the registry-driven
 * dispatch will tank framerate during a corner drag in Phase 3.
 *
 * Run via:
 *   bun run packages/core/src/registry/__bench__/relations-resolver.bench.ts
 *
 * Output: JSON to stdout with { p50, p95, p99, mean, max, n } in milliseconds.
 * Doubles as a regression gate — wire into CI when we have a baseline.
 */
export {};
//# sourceMappingURL=relations-resolver.bench.d.ts.map