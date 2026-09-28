/**
 * Door tool — places DoorNodes on walls and on roof-segment wall faces
 * (the generated base walls under a roof, including coplanar gable ends).
 * Doors always sit at floor level (clampedY = height/2 — segment base for
 * roof-hosted doors).
 *
 * The ghost follows the cursor everywhere (like moving an item): over open
 * floor it floats as an invalid (unplaceable) ghost; the moment the cursor
 * ray hovers a wall (or roof-segment face) the real draft snaps onto it.
 * Snapping engages only on an actual mesh hover — no proximity magnet — since
 * the wall side faces are big raycast targets.
 */
declare const DoorTool: React.FC;
export default DoorTool;
//# sourceMappingURL=tool.d.ts.map