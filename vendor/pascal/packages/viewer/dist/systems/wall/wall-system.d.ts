import { type AnyNode, type AnyNodeId, type WallMiterData, type WallNode, type WallSlabSupportSegment } from '@pascal-app/core';
import * as THREE from 'three';
import { Brush } from 'three-bvh-csg';
export { isWallInitialBuildActive } from './wall-build-lifecycle';
export { drainRebuiltWalls } from './wall-rebuild-notifications';
export declare function mergeWallCutoutBrushes(brushes: readonly Brush[]): {
    cutter: Brush | null;
    fallbackBrushes: Brush[];
    droppedCount: number;
};
export declare function shouldDeferWallRebuild(wallId: string, nodes: Record<AnyNodeId, AnyNode>, rebuiltThisFrame: number, elapsedMs: number): boolean;
/** Rebuilds this system still owes — neighbours deferred during a drag. */
export declare function getPendingWallRebuildCount(): number;
export type WallGeometryAdapterContext = {
    isLive: (id: AnyNodeId) => boolean;
};
export type WallGeometryAdapter = {
    prepareChildren?: (wall: WallNode, children: readonly AnyNode[], context: WallGeometryAdapterContext) => {
        envelopeChildren: AnyNode[];
        renderChildren: AnyNode[];
    };
    buildGeometry?: (wall: WallNode, envelope: THREE.BufferGeometry, children: readonly AnyNode[]) => THREE.BufferGeometry;
    syncAuxiliaryGeometry?: (wall: WallNode, mesh: THREE.Mesh, geometry: THREE.BufferGeometry) => void;
};
export declare const WallSystem: ({ geometryAdapter }?: {
    geometryAdapter?: WallGeometryAdapter;
}) => null;
export declare function runWallBuildFrame(geometryAdapter?: WallGeometryAdapter): void;
type WallTerrainBottomSampler = (x: number, z: number) => number | null;
export declare function generateExtrudedWall(wallNode: WallNode, childrenNodes: AnyNode[], miterData: WallMiterData, slabElevation?: number, baseElevation?: number, baseSegments?: readonly WallSlabSupportSegment[], storeyHeight?: number, terrainBottomAt?: WallTerrainBottomSampler): THREE.BufferGeometry;
//# sourceMappingURL=wall-system.d.ts.map