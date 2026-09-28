/**
 * How each non-negotiable rule R1–R9 is guarded (A-02). A rule names the
 * test that checks it in this repo, the baseline gate that measures it, or
 * both. `FIDELITY_GATES` mirrors the gate keys of the private benchmark
 * fixture (`bench/fixtures/next-house/baseline.json`, owned by A-01); the
 * private inventory generator fails when the two lists differ, and
 * `reference-inventory.test.ts` fails when a rule names a missing gate, file
 * or test.
 */
export declare const FIDELITY_GATES: readonly ["gesturesOnFullHouse", "zoneRedetection", "oneUndoPerGesture", "apiV1Plugins", "interactivityAfterBake", "agentParity", "capture"];
export type FidelityGate = (typeof FIDELITY_GATES)[number];
/** A test by its file (relative to `packages/core/src`) and its describe or test title. */
export type RuleCheck = {
    file: string;
    title: string;
};
export type RuleGuard = {
    checks: readonly RuleCheck[];
    gates: readonly FidelityGate[];
    plan?: string;
};
export declare const RULE_GUARDS: Record<`R${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`, RuleGuard>;
//# sourceMappingURL=rules.d.ts.map