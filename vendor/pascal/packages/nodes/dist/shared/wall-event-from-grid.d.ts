import { type AnyNode, type AnyNodeId, type GridEvent, type WallEvent } from '@pascal-app/core';
import { type Object3D } from 'three';
/** Canvas surface queries still reach the host when a rendered child consumes mesh events. */
export declare function wallEventFromGrid(event: GridEvent, activeLevelId: AnyNodeId | null, nodes: Record<AnyNodeId, AnyNode>, objects: ReadonlyMap<string, Object3D>): WallEvent | null;
//# sourceMappingURL=wall-event-from-grid.d.ts.map