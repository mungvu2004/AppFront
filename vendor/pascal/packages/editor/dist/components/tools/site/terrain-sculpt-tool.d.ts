/**
 * The sculpt tool: pointer motion → terrain, while `mode === 'terrain-sculpt'`.
 *
 * Pointer handling is DOM-level on the canvas rather than R3F mesh events, for
 * the same reason `useGridEvents` is: a mesh handler can be swallowed by any
 * geometry that calls `stopPropagation`, and the ground is precisely the surface
 * that everything else sits on top of. Sculpting must reach it even with a wall
 * under the cursor.
 *
 * Four properties are what keep this from fighting the rest of the editor:
 *
 * - It is a *mode*, so it is mutually exclusive with select/build/delete/paint
 *   by construction. Nothing else can be armed at the same time.
 * - The selection managers all early-return unless `mode === 'select'`, so while
 *   the brush is armed a click cannot select, move, or reshape a node — no
 *   matter what geometry is under it.
 * - The `sculpting` interaction scope is held by the mode, not by this
 *   component's drag, so every other object's handles and the floating action
 *   menu stay stepped back between dabs rather than flickering back.
 * - Camera drags are respected: `cameraDragging` suppresses dabs at pointer-down
 *   *and* per dab, so neither starting a drag as an orbit nor zooming mid-stroke
 *   carves the terrain. The stroke commits once, as one undo step, on pointer-up.
 */
export declare const TerrainSculptTool: React.FC;
export default TerrainSculptTool;
//# sourceMappingURL=terrain-sculpt-tool.d.ts.map