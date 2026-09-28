import { type AnyNode, type AnyNodeId } from '@pascal-app/core';
import { Box3, Matrix4 } from 'three';
export declare const CORNER_OFFSET = 0.3;
export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type ParticipantKind = 'vec3' | 'scalar' | 'endpoint' | 'polygon';
export declare function classifyParticipant(node: AnyNode | undefined, levelId: string | null, sceneNodes: Record<string, AnyNode | undefined>): ParticipantKind | null;
export type ParticipantStart = {
    id: AnyNodeId;
    kind: 'vec3';
    position: Vec3;
    rotation: Vec3;
} | {
    id: AnyNodeId;
    kind: 'scalar';
    position: Vec3;
    rotation: number;
} | {
    id: AnyNodeId;
    kind: 'endpoint';
    start: Vec2;
    end: Vec2;
} | {
    id: AnyNodeId;
    kind: 'polygon';
    polygon: Vec2[];
    holes: Vec2[][] | null;
};
export type LinkedNeighbor = {
    id: AnyNodeId;
    start: Vec2;
    end: Vec2;
    startLinked: boolean;
    endLinked: boolean;
};
export declare function collectParticipants(ids: string[], sceneNodes: Record<string, AnyNode | undefined>, levelId: string | null): {
    starts: ParticipantStart[];
    links: LinkedNeighbor[];
};
export type GroupPatch = readonly [AnyNodeId, Record<string, unknown>];
export declare function rotateGroupPatches(starts: ParticipantStart[], links: LinkedNeighbor[], center: {
    x: number;
    z: number;
}, delta: number): GroupPatch[];
export declare function rotateGroupSnapshots(starts: ParticipantStart[], links: LinkedNeighbor[], center: {
    x: number;
    z: number;
}, delta: number): {
    starts: ParticipantStart[];
    links: LinkedNeighbor[];
};
export type GroupPlanBounds = {
    minX: number;
    minZ: number;
    maxX: number;
    maxZ: number;
};
/**
 * The selection's footprint in the level frame — the plan's own coordinates,
 * measured from node data wherever the plan draws from data: walls by their
 * mitered outline, polygon hosts (slab, ceiling, zone) by their polygon, fences
 * by their run. Only placed objects (items, columns, stairs…) measure their
 * meshes: bounds go through `frameInv × matrixWorld` (a world box can't be
 * carried into a rotated building's frame), placeholders — unbuilt while the
 * 3D scene is paused in 2D-only view — are skipped, and a node with no built
 * mesh falls back to its anchor.
 */
export declare function groupPlanBounds(starts: ParticipantStart[], frameInv: Matrix4): GroupPlanBounds | null;
/** `groupPlanBounds` for a selection: the dashed boxes and gizmos measure this. */
export declare function computeGroupPlanBox(ids: string[], levelId: string | null): GroupPlanBounds | null;
export declare const planBoundsCenter: (b: GroupPlanBounds) => Vec2;
export declare function rotatePlanBounds(b: GroupPlanBounds, center: {
    x: number;
    z: number;
}, delta: number): GroupPlanBounds;
export declare function translateGroupPatches(starts: ParticipantStart[], links: LinkedNeighbor[], dx: number, dz: number): GroupPatch[];
export declare function levelFrame(levelId: string | null): {
    matrix: Matrix4;
    inverse: Matrix4;
};
export declare function computeGroupBox(ids: string[]): Box3 | null;
//# sourceMappingURL=group-transform-shared.d.ts.map