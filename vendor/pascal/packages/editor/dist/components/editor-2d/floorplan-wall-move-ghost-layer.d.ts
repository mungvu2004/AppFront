/**
 * Renders translucent dashed previews of bridge walls that the wall
 * junction planner will insert on commit. Mirrors the 3D
 * `GhostWallPreviewMesh` so 2D and 3D show the same intent mid-drag.
 *
 * Subscribes to `useWallMoveGhosts.bridges`; writes happen inside
 * `wallFloorplanMoveTarget.apply` (cleared on `commit` and by the move
 * overlay's unmount cleanup as a safety net).
 */
export declare const FloorplanWallMoveGhostLayer: import("react").MemoExoticComponent<() => import("react").JSX.Element | null>;
//# sourceMappingURL=floorplan-wall-move-ghost-layer.d.ts.map