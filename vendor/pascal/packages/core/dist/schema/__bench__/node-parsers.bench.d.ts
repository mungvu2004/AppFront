/**
 * Bench harness for compiled per-kind node parsers (`z.compile`).
 *
 * Answers the four questions the flag exists to settle:
 *
 * 1. Does a compiled per-kind parser beat the interpreter on a *monomorphic*
 *    call site (one kind, parsed over and over)?
 * 2. Does it still win on a *mixed* call site (all 48 kinds in one loop), and
 *    how does it compare to the design this rejects — one compiled function for
 *    the whole union?
 * 3. What does the first parse of a kind cost (codegen), and what does keeping
 *    1 / 5 / 48 kinds compiled cost in RSS?
 * 4. What do the wired call sites actually gain end to end?
 *
 * Run via:
 *   bun run packages/core/src/schema/__bench__/node-parsers.bench.ts
 *
 * Every section runs in its own child process. Compiling is irreversible within
 * a process and a large generated function measurably perturbs everything timed
 * after it — sharing one process moved these numbers by more than 10x run to
 * run. `--section <name>` is that child mode.
 */
export {};
//# sourceMappingURL=node-parsers.bench.d.ts.map