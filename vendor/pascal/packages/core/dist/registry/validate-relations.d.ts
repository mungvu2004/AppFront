import type { AnyNode, AnyNodeId } from '../schema/types.js';
/** Validate the proposed graph before a mutation publishes it, including affected hosts. */
export declare function validateNodeRelations(before: Record<AnyNodeId, AnyNode>, next: Record<AnyNodeId, AnyNode>, changedIds: Iterable<AnyNodeId>): void;
//# sourceMappingURL=validate-relations.d.ts.map