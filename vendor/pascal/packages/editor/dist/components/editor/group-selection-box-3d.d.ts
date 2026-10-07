/**
 * 3D sibling of the 2D dashed group selection box: a dashed wireframe around
 * the multi-selection's transformable participants that doubles as the
 * group's whole-volume drag
 * handle — move cursor across it, press-drag anywhere on it slides the group,
 * a plain click picks it up. Holding a selection modifier passes the press
 * through so members inside can still be toggled. Rides the live drag delta
 * so it tracks the group mid-gesture.
 */
export declare function GroupSelectionBox3D(): import("react").JSX.Element | null;
//# sourceMappingURL=group-selection-box-3d.d.ts.map