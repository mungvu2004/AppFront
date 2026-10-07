import type { FloorplanGeometry, GeometryContext, StairNode } from '@pascal-app/core';
/**
 * Stage C floor-plan emitter for stair. The stair is the parent; its
 * children are the `stair-segment`s whose transforms are *cumulative*
 * (each flight attaches to the previous segment's end via
 * `computeFloorplanStairSegmentTransforms` — `attachmentSide` rotates
 * the chain ±π/2, segment length advances along the chain). Because no
 * individual segment can compute its polygon in isolation, the stair
 * emits the whole stack as one registry entry; `stair-segment` itself
 * has no `def.floorplan` (the registry layer renders the parent here
 * and skips children that don't ship a builder).
 *
 * The actual cumulative walk + segment / arrow / inner-band / tread-bar
 * geometry lives in `editor/src/lib/floorplan/stairs.ts` via
 * `buildFloorplanStairEntry`. We re-export that from `@pascal-app/editor`
 * and emit `FloorplanGeometry` primitives over its output — same shape
 * pattern the legacy `<FloorplanStairLayer>` consumed, minus the
 * per-pixel SVG drawing (the registry's `FloorplanGeometryRenderer`
 * handles that). Curved + spiral stairs fall back to a single curved
 * hit polygon (`buildFloorplanStairEntry` already returns it); the
 * arc-band rendering with steps along the sweep is not yet ported —
 * a follow-up will add either an `arc` primitive or expose the
 * segment-sampler helpers so we can emit a stitched polyline.
 */
export declare function buildStairFloorplan(stair: StairNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map