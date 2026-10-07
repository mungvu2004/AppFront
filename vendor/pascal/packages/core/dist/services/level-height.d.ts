import type { CeilingNode } from '../schema/index.js';
import type { AnyNode, AnyNodeId } from '../schema/types.js';
export declare const DEFAULT_LEVEL_HEIGHT = 2.5;
/**
 * Effective ceiling height in level-local meters. An explicit stored
 * `height` wins; absent height means the ceiling follows the level top —
 * the same bound its write-clamp uses: min(storey plane, lowest
 * covering-slab underside over its polygon) − CEILING_CLAMP_MARGIN (see
 * {@link getCeilingClampBound}). Falls back to the default plane minus
 * the same margin when the owning level is unresolvable.
 */
export declare function resolveCeilingHeight(ceiling: Pick<CeilingNode, 'height' | 'parentId' | 'polygon'>, nodes: Record<AnyNodeId, AnyNode>): number;
export declare function deriveLegacyLevelHeight(levelId: string, nodes: Record<AnyNodeId, AnyNode>): number;
/**
 * The ceiling covering level-local point `[x, z]`, or `null` when none
 * sits over it. Points inside a ceiling's hole are treated as uncovered.
 * When ceilings overlap, the lowest one wins — that's the surface a duct
 * would actually hang from.
 */
export declare function getCeilingAt(levelId: string, nodes: Record<AnyNodeId, AnyNode>, x: number, z: number): CeilingNode | null;
/**
 * Underside elevation (meters above the level floor) of the ceiling
 * covering level-local point `[x, z]`, or `null` when no ceiling sits
 * over that point. See {@link getCeilingAt}.
 */
export declare function getCeilingHeightAt(levelId: string, nodes: Record<AnyNodeId, AnyNode>, x: number, z: number): number | null;
//# sourceMappingURL=level-height.d.ts.map