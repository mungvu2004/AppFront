export declare function resetWallTreatmentLevels(): void;
export declare function updateWallTreatmentLevels(): void;
/**
 * Registry-driven wall system bundle.
 *
 *  - **`WallSystem`** — reads `dirtyNodes`, batches by level, runs
 *    `calculateLevelMiters(levelWalls)`, rebuilds geometry via
 *    `generateExtrudedWall(node, children, miterData, slabElevation, baseElevation, baseSegments, storeyHeight)`,
 *    and cascades to adjacent walls that share a junction. This is the
 *    bulk of the wall runtime (~820 lines in viewer).
 *  - **`WallCutout`** — cutaway-mode hide/show logic based on camera
 *    direction and `frontSide` / `backSide` interior/exterior tags.
 *  - **`WallBatchSystem`** — once a level stops changing, sews its opaque
 *    walls into one mesh per material set so a floor costs a handful of
 *    draw calls instead of one per wall face run.
 */
declare const WallSystems: () => import("react").JSX.Element;
export default WallSystems;
//# sourceMappingURL=system.d.ts.map