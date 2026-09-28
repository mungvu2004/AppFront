/**
 * Selection-time editing for committed duct runs: each path point shows a
 * cluster of directional arrows instead of a free-drag handle — four XZ
 * chevrons (±X / ±Z) plus an up / down vertical pair.
 *
 * Handles are PORTALED into the duct's registered scene group so they
 * share its exact frame — path coords are node-local, and the level /
 * building transform above the group applies to the handles for free.
 * Drag raycasts run in world space and convert hits back into the
 * group's local frame before writing the path.
 *
 * Drag model: the along-run arrow lengthens / shortens the run (locked to the
 * run axis). The across-run (side) and up / down arrows instead SWING the
 * grabbed endpoint around its neighbour at a fixed radius — the run pivots like
 * a compass arm, keeping its length, rather than stretching. Dragged run
 * endpoints still snap onto nearby typed ports (along-run drag) so a loose run
 * can be mated onto a fitting after the fact, and when the dragged endpoint
 * belongs to a straight run whose OTHER end sits on an elbow collar, the elbow
 * re-aims to follow the drag (junction + far collar fixed, bend angle adapts).
 *
 * Modifiers (mirroring the wall corner drag):
 * - **Alt** detaches: the joint breaks for this drag — the elbow does NOT
 *   re-aim and mated fittings / runs do NOT follow; the endpoint moves on its
 *   own (port re-mate still allowed so it can be reattached elsewhere).
 * - Snapping follows the active editor snapping mode.
 *
 * History is paused during the drag while live overrides drive the preview.
 * On release, history resumes and the final path is applied as one tracked
 * change.
 */
declare const DuctSegmentSelectionAffordance: () => import("react").JSX.Element | null;
export default DuctSegmentSelectionAffordance;
//# sourceMappingURL=selection.d.ts.map