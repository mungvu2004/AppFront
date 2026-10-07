import { type RoofNode, type RoofSegmentNode } from '@pascal-app/core';
import type { RelativeRoofDragTarget } from './relative-roof-drag';
export type RoofSurfaceGuideMode = 'side-center' | 'linear-edge';
export type RoofSurfaceGuideFootprint = {
    width: number;
    depth: number;
    rotation?: number;
};
type RoofGuideBounds = {
    centerX: number;
    centerZ: number;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
};
type RoofGuideSide = 'left' | 'right' | 'bottom' | 'top';
type RoofSiblingSpacingResult<T> = {
    guides: T[];
    blockedSides: Record<RoofGuideSide, boolean>;
};
export declare function roofSurfaceFootprintFromNode(node: unknown, options?: {
    segment?: RoofSegmentNode;
}): RoofSurfaceGuideFootprint;
export declare function publishRoofSurfacePlacementGuides(args: {
    roof: RoofNode;
    segment: RoofSegmentNode;
    center: readonly [number, number, number];
    footprint: RoofSurfaceGuideFootprint;
    mode?: RoofSurfaceGuideMode;
    movingId?: string;
}): void;
export declare function publishRoofSurfaceNodePlacementGuides(args: {
    roof: RoofNode;
    segment: RoofSegmentNode;
    center: readonly [number, number, number];
    node: unknown;
    mode?: RoofSurfaceGuideMode;
    movingId?: string;
}): void;
export declare function snapRoofSurfaceNodeTarget(args: {
    target: RelativeRoofDragTarget;
    node: unknown;
    movingId?: string;
    bypass?: boolean;
}): RelativeRoofDragTarget;
export declare function clearRoofSurfacePlacementGuides(): void;
export declare function roofGuideBounds(center: readonly [number, number, number], footprint: RoofSurfaceGuideFootprint): RoofGuideBounds;
export declare function roofSiblingSpacingGuides<T>(args: {
    segment: RoofSegmentNode;
    movingId?: string;
    movingBounds: RoofGuideBounds;
    faceKey: string;
    dimension: (id: string, from: [number, number], to: [number, number]) => T | null;
}): T[];
export declare function roofSiblingSpacing<T>(args: {
    segment: RoofSegmentNode;
    movingId?: string;
    movingBounds: RoofGuideBounds;
    faceKey: string;
    dimension: (id: string, from: [number, number], to: [number, number]) => T | null;
    alignLine?: (id: string, from: [number, number], to: [number, number]) => T | null;
    badge?: (id: string, at: [number, number], value: number) => T | null;
    measure?: (from: [number, number], to: [number, number]) => number;
}): RoofSiblingSpacingResult<T>;
export declare function roofFaceKey(polygon: readonly (readonly [number, number])[]): string;
export {};
//# sourceMappingURL=roof-surface-placement-guides.d.ts.map