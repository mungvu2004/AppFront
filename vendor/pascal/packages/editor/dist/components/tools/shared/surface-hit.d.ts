import { type AnyNode, type NodeEvent, type SurfaceHit } from '@pascal-app/core';
import { type Matrix4 } from 'three';
export declare function surfaceWorldNormalY(normal: NodeEvent<AnyNode>['normal'], matrixWorld: Matrix4): number;
export declare function itemEventToSurfaceHit(host: AnyNode, event: NodeEvent<AnyNode>): SurfaceHit | null;
//# sourceMappingURL=surface-hit.d.ts.map