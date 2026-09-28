/**
 * Placement tool for a fresh dormer. The dormer sits UPRIGHT on the
 * host segment at segment-local `y = 0` (the host wall foot) — the
 * CSG inside `generateDormerGeometry` carves the dormer against the
 * host roof's slope, so we don't tilt or lift it here. The ghost is
 * mounted on the hit segment's world transform (extracted via the
 * registry) so the user sees exactly where the dormer will land.
 */
declare const DormerTool: () => import("react").JSX.Element;
export default DormerTool;
//# sourceMappingURL=tool.d.ts.map