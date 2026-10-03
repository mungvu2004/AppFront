import type { AnyNode, AnyNodeId } from '../schema/index.js';
/**
 * IPC validators for the DWV (drain-waste-vent) system — the "CodeRule"
 * primitive from the domain brief. The slope, minimum-size, and
 * trap-arm rules are all geometric and read straight off the node
 * fields, so they live here in core (pure logic) where the editor can
 * surface them and analyses can reuse them.
 *
 * Scope is residential IPC, simplified:
 *   - 704.1 drainage slope by pipe size.
 *   - 909 trap-arm maximum developed length by trap size.
 *
 * These are intentionally conservative approximations, not a certified
 * plan-check — enough to flag the mistakes a drawing tool invites.
 */
/** Drainage findings, worst-first per consumer's sort. */
export type DwvSeverity = 'error' | 'warning';
export type DwvFinding = {
    severity: DwvSeverity;
    /** Stable rule id, e.g. 'slope-too-flat'. */
    code: string;
    /** Human-readable, already-formatted message. */
    message: string;
    /** Nodes the finding implicates (usually one). */
    nodeIds: AnyNodeId[];
};
/**
 * Run every DWV rule over the scene and return the findings. Empty
 * array = nothing to flag. Pure: no scene/store access, no rendering.
 */
export declare function validateDwv(nodes: Readonly<Record<AnyNodeId, AnyNode>>): DwvFinding[];
//# sourceMappingURL=validate-dwv.d.ts.map