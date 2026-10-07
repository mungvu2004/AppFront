/**
 * Box-vent placement tool. Mounts when the palette activates the
 * box-vent kind; listens for `roof:*` events; on click commits a new
 * `BoxVentNode` parented to the targeted segment with segment-local
 * coordinates.
 *
 * Cursor preview follows the roof surface: position from `roof:move`,
 * slope tilt from the segment under the cursor, segment yaw from the
 * roof + segment rotation stack.
 */
declare const BoxVentTool: () => import("react").JSX.Element;
export default BoxVentTool;
//# sourceMappingURL=tool.d.ts.map