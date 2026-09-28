/**
 * Selection-time editing for committed DWV pipe runs: every path point gets
 * the same click-to-open directional cube used by duct runs, with DWV port
 * snapping and pipe elbow re-aim.
 *
 * Handles are PORTALED into the pipe's registered scene group so they
 * share its exact frame — path coords are node-local, and the level /
 * building transform above the group applies to the handles for free.
 * Drag raycasts run in world space and convert hits back into the
 * group's local frame before writing the path.
 *
 * Drag model: along-run arrows lengthen / shorten; across-run and vertical
 * arrows swing endpoint vertices around their neighbour at a fixed radius,
 * matching duct corner UX. Dragged endpoints still snap onto nearby typed DWV
 * ports, and a straight run whose other end sits on a pipe elbow collar
 * re-aims that elbow to follow the drag.
 *
 * Modifiers (mirroring the duct corner drag):
 * - **Alt** detaches: the joint breaks for this drag — the elbow does NOT
 *   re-aim and mated fittings / runs do NOT follow; the endpoint moves on its
 *   own (port re-mate still allowed so it can be reattached elsewhere).
 * - Snapping follows the active editor snapping mode.
 *
 * History is paused during the drag while live overrides drive the preview.
 * On release, history resumes and the final path is applied as one tracked
 * change.
 */
declare const PipeSegmentSelectionAffordance: () => import("react").JSX.Element | null;
export default PipeSegmentSelectionAffordance;
//# sourceMappingURL=selection.d.ts.map