import { type Assembly, type LayerRole } from '../schema/assembly.js';
export type AssemblyDiagnosticCode = 
/**
 * The host's stored thickness is not the sum of its layers (a stale or
 * hand-edited value). The stack wins; hosts that draw from the stored
 * thickness keep their plain body until a writer re-derives it.
 */
'assembly.thickness-mismatch'
/** Nothing to stack: body and backing both sum to 0. */
 | 'assembly.empty'
/** `backing` on a host that refuses it: ignored. */
 | 'assembly.backing-refused';
export type AssemblyDiagnostic = {
    code: AssemblyDiagnosticCode;
    message: string;
};
export type ResolvedAssemblyLayer = {
    id: string;
    role: LayerRole;
    /** Depth of the layer's reference-side face below the stack's first face, metres. */
    depth: number;
    thickness: number;
    core: boolean;
    material?: string;
    slot?: string;
    src?: string;
    /** Backing only: as declared (`inset`, `bottom`, `lift`). */
    inset?: number;
    bottom?: number;
    lift?: number;
};
export type ResolvedAssembly = {
    layers: ResolvedAssemblyLayer[];
    /** Σ layer thickness: the host's body, which a wall stores as `thickness`. */
    total: number;
    /**
     * Backing layers on a host that accepts them, `depth` measured from the
     * body's far face outward; empty otherwise.
     */
    backing: ResolvedAssemblyLayer[];
    diagnostics: AssemblyDiagnostic[];
};
/**
 * Resolves the body stack of `assembly`, in the order it lists its layers.
 * The stack sets the body, so `total` is the thickness the host must store;
 * `host.body` is the value it stores today (`null` when it stores none, as a
 * roof) and only produces a diagnostic when it disagrees. Pure and total: it
 * never throws and never changes a declared thickness.
 */
export declare function resolveAssemblyStack(assembly: Assembly, host: {
    body: number | null;
    backing?: boolean;
}): ResolvedAssembly;
//# sourceMappingURL=assembly-stack.d.ts.map