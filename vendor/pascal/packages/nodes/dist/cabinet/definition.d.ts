import type { AnyNode, AnyNodeId, CabinetNode as CabinetNodeType, FloorPlacedFootprint, NodeDefinition, SceneApi } from '@pascal-app/core';
import { CabinetModuleNode, CabinetNode } from './schema';
export declare function cabinetFloorPlacedFootprints(node: CabinetNodeType, nodes?: Readonly<Record<AnyNodeId, AnyNode>>): FloorPlacedFootprint[];
export type CabinetRunFootprint = {
    parentId: AnyNodeId | null;
    x: number;
    z: number;
    reach: number;
};
export declare function cabinetRunFootprint(run: CabinetNodeType, nodes: Readonly<Record<AnyNodeId, AnyNode>>): CabinetRunFootprint;
/**
 * Re-key sibling cabinet runs whose countertop join could be affected by a
 * run that moved / resized / re-flowed. A run's overhang trims against
 * adjacent sibling runs (`siblingCabinetSpansInRunLocal`), but a neighbor's
 * own `geometryKey` doesn't change when THIS run moves — marking it dirty
 * alone would be swallowed by the geometry system's key-skip cache. Bumping
 * `cabinetAdjacencyRevision` (folded into the run geometryKey) both dirties
 * and re-keys it. History is paused: the counter is derived presentation
 * state, and an undo of the triggering move re-fires the watcher anyway.
 */
export declare function bumpCabinetRunsNear(sceneApi: SceneApi, footprints: readonly CabinetRunFootprint[], moverIds: ReadonlySet<string>): void;
/** Inputs of a run that can change a NEIGHBOR's countertop join. */
export declare function cabinetRunNeighborSignature(run: CabinetNodeType): string;
export declare const cabinetDefinition: NodeDefinition<typeof CabinetNode>;
export declare const cabinetModuleDefinition: NodeDefinition<typeof CabinetModuleNode>;
//# sourceMappingURL=definition.d.ts.map