export declare const EXPLODED_GAP = 5;
/**
 * The Y a level settles at under the given presentation mode — its stacked
 * elevation plus the exploded gap. Analytic (scene store + mode), never a
 * mesh read: a level created this frame has its Object3D at y=0 until
 * LevelSystem lerps it, and a mode switch leaves meshes mid-lerp — camera
 * code framing a level must aim at the destination, not the moving target.
 */
export declare function getLevelPresentationY(levelId: string, nodes: Record<string, unknown>, levelMode: 'stacked' | 'exploded' | 'solo' | 'manual'): number;
/**
 * Whether a level renders this frame, and whether it renders as a
 * shadow-caster only.
 *
 * Two unrelated things hide a level and they do not compose: the author's own
 * `visible` flag (the sidebar eye), which hides the floor outright, and solo
 * mode, which hides every level but the soloed one — keeping the levels ABOVE
 * it in the shadow map so the sun still shadows the soloed floor through them.
 * A level the author hid never enters that shadow-caster branch: its shadows
 * on the floor below would be exactly what hiding it was meant to remove.
 */
export declare function resolveLevelVisibility({ levelMode, hasSelectedLevel, isSelected, index, selectedIndex, nodeVisible, }: {
    levelMode: 'stacked' | 'exploded' | 'solo' | 'manual';
    hasSelectedLevel: boolean;
    isSelected: boolean;
    index: number;
    selectedIndex: number | undefined;
    nodeVisible: boolean;
}): {
    visible: boolean;
    shadowOnly: boolean;
};
/**
 * Instantly snaps all level Objects3D to their true stacked Y positions
 * (ignores levelMode — always uses stacked, no exploded gap). Presentation
 * hiding is undone with it, but a level the author hid stays hidden: the
 * capture has to match the export, which prunes it.
 *
 * Returns a restore function that reverts each level's Y to what it was
 * before the snap, so lerp animations in LevelSystem can continue undisturbed.
 *
 * Usage:
 *   const restore = snapLevelsToTruePositions()
 *   renderer.render(scene, camera)
 *   restore()
 */
export declare function snapLevelsToTruePositions(): () => void;
//# sourceMappingURL=level-utils.d.ts.map