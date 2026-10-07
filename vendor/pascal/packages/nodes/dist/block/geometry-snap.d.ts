import type { BlockTopology } from '@pascal-app/core';
import { type Camera, Vector3 } from 'three';
import { type BlockSelection } from './commands';
import type { BlockTransformConstraint } from './modal-transform';
type Point = [number, number, number];
export type BlockGeometrySnap = {
    delta: Point;
    kind: 'vertex' | 'edge' | 'face';
    source: Point;
    target: Point;
    targetId: string;
};
export declare function blockGeometrySnapThreshold(camera: Camera, worldPoint: Vector3, viewportHeight: number, worldScale: Vector3, radiusPixels?: number): number;
export declare function resolveBlockGeometrySnap(topology: BlockTopology, selection: BlockSelection & {
    activeId?: string | null;
}, proposedDelta: Point, constraint: BlockTransformConstraint, threshold: number): BlockGeometrySnap | null;
export {};
//# sourceMappingURL=geometry-snap.d.ts.map