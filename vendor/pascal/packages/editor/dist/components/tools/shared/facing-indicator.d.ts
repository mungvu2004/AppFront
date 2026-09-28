/**
 * @param depth    bbox depth (along local Z) of the ghost — positions the
 *                 triangle just past the front edge.
 * @param center   optional [x, z] of the bbox centre in the ghost's local frame.
 * @param reversed point along local -Z (the front is the -Z side, e.g. a stair
 *                 entry) instead of +Z.
 * @param y        small lift off the floor to avoid z-fighting.
 */
export declare function FacingIndicator({ depth, center, reversed, y, }: {
    depth: number;
    center?: [number, number];
    reversed?: boolean;
    y?: number;
}): import("react").JSX.Element;
//# sourceMappingURL=facing-indicator.d.ts.map