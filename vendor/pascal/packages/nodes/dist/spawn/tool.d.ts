/**
 * Registry-driven spawn placement tool. Reads `activeLevelId` from useViewer
 * directly (no props), broadcasts placement via store updates + SFX, and
 * shows the real spawn model as a translucent placement ghost, and supports
 * R/T yaw before commit. Snapping is mode-driven (grid + Figma-style
 * alignment "lines"), matching the shelf / column build tools.
 */
declare const SpawnTool: () => import("react").JSX.Element | null;
export default SpawnTool;
//# sourceMappingURL=tool.d.ts.map