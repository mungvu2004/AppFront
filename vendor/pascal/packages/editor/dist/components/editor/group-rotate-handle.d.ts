/**
 * Group-rotate gizmo. When 2+ transformable nodes in the active level frame are
 * selected, a single rotation handle appears at the selection's bounding-box
 * center. Dragging it spins every selected node rigidly around that shared
 * center — orbiting each node's position AND turning its yaw by the same delta,
 * so the group rotates as one piece.
 *
 * The single-selection case is handled by `NodeArrowHandles`; a full-level
 * box-select promotes to a building selection, so neither reaches this gizmo.
 */
export declare function GroupRotateHandle(): import("react").JSX.Element | null;
export default GroupRotateHandle;
//# sourceMappingURL=group-rotate-handle.d.ts.map