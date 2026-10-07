import { type ParametricDescriptor } from '@pascal-app/core';
import type { FenceNode } from './schema';
/**
 * Inspector descriptor for fence. Mirrors the legacy `FencePanel`
 * layout 1:1:
 *  - **Style** (segmented controls): style, baseStyle, showInfill toggle.
 *  - **Dimensions**: Length (derived from start/end), Curve (sagitta
 *    with dynamic bounds), Height, Thickness.
 *  - **Structure**: Base Height, Top Rail, Post Spacing, Post Size,
 *    Post Cap + Slat Gap (horizontal-only), Ground Clear, Edge Inset.
 *
 * Length + Curve use the `custom` field kind because they don't map
 * to single number fields with static bounds — see `inspector-editors.tsx`.
 */
export declare const fenceParametrics: ParametricDescriptor<FenceNode>;
//# sourceMappingURL=parametrics.d.ts.map