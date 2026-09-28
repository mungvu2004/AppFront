import type { RoofSegmentNode } from '@pascal-app/core';
type Vec3 = [number, number, number];
/**
 * Live "distance to roof edge" guides shown while a dormer ghost is being
 * placed or dragged — the roof-plane analog of the window's sill/head +
 * edge-proximity pills. Renders measured lines from each side-center of
 * the dormer's occupied roof area out to the active roof face edges, each
 * with a distance pill at its midpoint.
 *
 * Mounted as a sibling of `<DormerPreview>` INSIDE the segment-local frame
 * (the `segmentXform` group) but OUTSIDE the dormer's `hitLocal` + rotation
 * groups, so its coordinates are segment-local. The roof-face boundary is
 * resolved from the actual visible top face under `center`, not from the
 * wall footprint dimensions.
 *
 * Normal roof accessories use side-center readouts. Linear accessories
 * like ridge vents and gutters use their own two-end guide mode.
 */
export declare function DormerPlacementGuides({ segment, center, width, depth, rotation, movingId, }: {
    segment: RoofSegmentNode;
    center: Vec3;
    width: number;
    depth: number;
    rotation: number;
    movingId?: string;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=placement-guides.d.ts.map