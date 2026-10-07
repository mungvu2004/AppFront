/**
 * Click-place tool for duct terminals (registers / diffusers / grilles).
 *
 * **Mount drives the target surface** (cycle with **M**): a floor register
 * snaps to the floor grid, a ceiling diffuser snaps to a horizontal plane at
 * ceiling height (derived from the level's ceilings/walls), and a wall
 * register snaps flush onto whichever wall the cursor is over, its face
 * oriented along the wall's outward normal. **R / T** rotate the floor/ceiling
 * yaw ±45°; wall yaw is fixed by the wall it mates to.
 */
declare const DuctTerminalTool: () => import("react").JSX.Element | null;
export default DuctTerminalTool;
//# sourceMappingURL=tool.d.ts.map