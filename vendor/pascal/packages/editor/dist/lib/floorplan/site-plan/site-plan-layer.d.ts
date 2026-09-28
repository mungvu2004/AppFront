/**
 * Site-plan view of the 2D editor.
 *
 * Mounted INSTEAD of `<FloorplanRegistryLayer>` when
 * `useDrawingView().drawingType === 'site-plan'`, inside the same scene `<g>`,
 * so the coordinates it draws in (site metres, origin = the geocoded point,
 * x east, y south) are the ones `clientToPlan` reports back.
 *
 * Everything is recomputed from the scene snapshot on each store change, so
 * the lot line, envelope, footprint and yard dimensions are live.
 */
export declare function FloorplanSitePlanLayer(): import("react").JSX.Element;
export default FloorplanSitePlanLayer;
//# sourceMappingURL=site-plan-layer.d.ts.map