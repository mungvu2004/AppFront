import { type FenceNode } from '@pascal-app/core';
/**
 * Custom inspector editors for fence fields that don't map to a single
 * node property in the canonical way:
 *
 * - **Length** is derived from `start`/`end`. Adjusting the slider
 *   moves `end` along the existing direction so the fence resizes from
 *   the start point. Matches the legacy `FencePanel`'s "Length" slider.
 * - **Curve** is a slider on `curveOffset` with min/max bounded by the
 *   chord length (per-node), normalized via `normalizeWallCurveOffset`.
 *   Can't use a plain `number` field because the bounds change with
 *   the fence's shape.
 *
 * Both are wired through `parametrics.fields[].kind: 'custom'`.
 */
export declare function FenceLengthEditor({ node, onUpdate, }: {
    node: FenceNode;
    onUpdate: (patch: Partial<FenceNode>) => void;
}): import("react").JSX.Element;
export declare function FenceCurveEditor({ node, onUpdate, }: {
    node: FenceNode;
    onUpdate: (patch: Partial<FenceNode>) => void;
}): import("react").JSX.Element;
//# sourceMappingURL=inspector-editors.d.ts.map