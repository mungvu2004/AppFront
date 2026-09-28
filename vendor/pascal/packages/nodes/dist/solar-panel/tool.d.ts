/**
 * Solar panel placement tool. The preview shows the array at the
 * cursor with the analytical roof-surface tilt applied (no raycast in
 * the placement preview — uses `getAnalyticalNormal` derived from the
 * segment's roof type + dimensions). On commit, snaps the position's
 * Y to the segment's surface height and stores the analytical normal
 * in the node so the renderer reproduces the same orientation.
 */
declare const SolarPanelTool: () => import("react").JSX.Element;
export default SolarPanelTool;
//# sourceMappingURL=tool.d.ts.map