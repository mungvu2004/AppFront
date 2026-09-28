/**
 * Selection-time affordances for a placed duct fitting — the 3D twin of the
 * duct-segment selection rig. A CLICK-to-latch cube sits at the fitting center;
 * clicking it opens (click again to close) a cluster of:
 *
 *  - **Six move arrows** (±X / ±Y / ±Z): translate the whole fitting along one
 *    world axis. Connected runs follow via port connectivity.
 *  - **Three rotation arcs** (X / Y / Z): spin the fitting about each world
 *    axis. Connected runs re-aim via port follow.
 *  - **Two profile cubes** on the fitting's visible side/top faces: resize
 *    non-round fitting width and height without occupying the inside corner.
 *
 * The handle rig is PORTALED into the fitting group's PARENT — never the
 * fitting group itself — because the selection outliner (`MergedOutlineNode`)
 * traces every descendant mesh of the SELECTED node, so a hit-area cylinder
 * parented under the fitting would be swept into its selection outline. Walls /
 * doors / windows dodge it the same way. The fitting's local `position` is
 * expressed in the parent's frame, so an identity group under the parent lets
 * us place handles at absolute level-local coords with world-aligned axes.
 *
 * History does the single-undo dance: paused during the drag (live ticks are
 * untracked), reverted on release, resumed, then the final transform re-applied
 * as one tracked change so the whole joint is one undo step.
 */
declare const DuctFittingSelectionAffordance: () => import("react").JSX.Element | null;
export default DuctFittingSelectionAffordance;
//# sourceMappingURL=selection.d.ts.map