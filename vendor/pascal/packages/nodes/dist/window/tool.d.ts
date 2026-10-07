/**
 * Window tool — places WindowNodes on walls and on roof-segment wall
 * faces (the generated base walls under a roof, including coplanar gable
 * ends — a window can sit in the gable pediment).
 *
 * The ghost follows the cursor everywhere (like moving an item): over open
 * floor it floats as an invalid (unplaceable) ghost; the moment the cursor ray
 * hovers a wall (or roof-segment face) the real draft snaps onto it. Snapping
 * engages only on an actual mesh hover — no proximity magnet.
 */
declare const WindowTool: React.FC;
export default WindowTool;
//# sourceMappingURL=tool.d.ts.map