import type { BlockTopology } from '@pascal-app/core';
import type { Camera, Object3D } from 'three';
import { Vector2 } from 'three';
import { type BlockSelection } from './commands';
export type BlockPoint = [number, number, number];
export declare function blockSelectionCentroid(topology: BlockTopology, selection: BlockSelection): BlockPoint | null;
export declare function blockLocalPointToClient(point: BlockPoint, target: Object3D, camera: Camera, canvas: HTMLCanvasElement): Vector2 | null;
export declare function blockTopologyClientExtent(topology: BlockTopology, target: Object3D, camera: Camera, canvas: HTMLCanvasElement): number | null;
//# sourceMappingURL=selection-geometry.d.ts.map