import type { AnyNode, LinearResizeHandle, RadialResizeHandle, SceneApi } from '@pascal-app/core';
export declare function resolveLinearHandlePosition<N>(descriptor: LinearResizeHandle<N> | RadialResizeHandle<N>, node: N, scene: SceneApi, baseScale: number): readonly [number, number, number];
export declare function resolveLinearHandleRotation<N>(descriptor: LinearResizeHandle<N> | RadialResizeHandle<N>, position: readonly [number, number, number]): [number, number, number];
export declare function computeFreezeOffset(liveNode: AnyNode, preDragNode: AnyNode): [number, number, number];
//# sourceMappingURL=handle-placement.d.ts.map