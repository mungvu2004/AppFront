import { type BoxVentNode } from '@pascal-app/core';
/**
 * Box vent renderer. The vent is parented to a roof-segment in the scene
 * graph, but the registry-era roof-segment renderer doesn't auto-nest
 * children (it's a single mesh with placeholder geometry filled by
 * `RoofSystem`). So this renderer reads the parent segment directly and
 * reproduces the segment-local transform stack manually:
 *
 *   segment.position → segment.rotation (Y) → vent.position
 *     → slope tilt (X) → vent.rotation (Y) → mesh
 *
 * The slope tilt is derived from the segment's roof shape and the vent's
 * local Z — see `computeBoxVentSlopeTilt`. The +Z side of the segment is
 * the down-slope direction, so a positive Z lands on the lower half of
 * the pitch.
 *
 * Live segment drags are honoured by subscribing to `useLiveTransforms`
 * for the parent segment ID — during the segment's move, the override
 * carries the in-progress position/rotation and the vent follows
 * smoothly without waiting for a commit.
 */
declare const BoxVentRenderer: ({ node: storeNode }: {
    node: BoxVentNode;
}) => import("react").JSX.Element | null;
export default BoxVentRenderer;
//# sourceMappingURL=renderer.d.ts.map