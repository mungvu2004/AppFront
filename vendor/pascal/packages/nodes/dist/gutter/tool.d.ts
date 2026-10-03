/**
 * Gutter placement tool. Cursor preview snaps to the OUTER eave — the
 * drip edge of the roof, NOT the wall line. The eave sits at
 * `Z = ±(depth/2 + overhang)` in segment-local frame; the gutter
 * mounts against the fascia there, hanging outward from the building.
 *
 * Which eave: `eave-snap.ts` picks the side closest to the cursor
 * (roof-type aware — 4-way for hip/flat, low side only for shed, ±Z
 * for the rest) and returns the segment-local snap pose. The same
 * snap drives the ghost AND the commit, so picking-up + putting-down
 * land at identical world coordinates.
 *
 * Ghost transform: we mount the GutterPreview under the exact same
 * chain the GutterRenderer applies — roof.position + roof.rotation →
 * segment.position + segment.rotation → snap.eave + snap.rotation.
 * No `worldToBuildingLocal` + `previewYaw`-sum shortcut: that
 * collapses three Y rotations into one scalar and converts world
 * coords back into building-local, which is mathematically
 * equivalent for pure-Y stacks but drifts under any future non-Y
 * roof/segment transform. Sharing the renderer's chain means the
 * ghost and the placed mesh are guaranteed pixel-identical.
 */
declare const GutterTool: () => import("react").JSX.Element;
export default GutterTool;
//# sourceMappingURL=tool.d.ts.map