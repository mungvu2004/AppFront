import type { SceneApi, SurfacesConfig } from '../registry/types.js';
import type { ItemNode } from '../schema/nodes/item.js';
import type { AnyNode, AnyNodeId } from '../schema/types.js';
/**
 * Maximum depth a node tree can host. Guards items-on-items-on-items chains
 * from growing pathological — pre-Phase-1 the editor had no cap. Set high
 * enough to allow legitimate stacking (chair on platform on truck on floor)
 * while preventing AI/plugin-generated runaway.
 */
export declare const MAX_HOST_DEPTH = 6;
export type Vec3 = readonly [number, number, number];
export type AttachError = {
    kind: 'self-host';
    nodeId: AnyNodeId;
} | {
    kind: 'cycle';
    nodeId: AnyNodeId;
    hostId: AnyNodeId;
} | {
    kind: 'depth-exceeded';
    depth: number;
    max: number;
} | {
    kind: 'host-missing';
    hostId: AnyNodeId;
};
export type AttachResult = {
    ok: true;
} | {
    ok: false;
    error: AttachError;
};
/**
 * Validates that attaching `child` to `host` is safe and either returns an
 * actionable error or signals OK. Does NOT mutate the scene — callers apply
 * the patch after a successful check.
 *
 * Rules:
 * - A node cannot host itself.
 * - The hosting chain (child → host → host.parent → ...) must not contain
 *   `child` (cycle prevention).
 * - The resulting chain must not exceed {@link MAX_HOST_DEPTH}.
 */
export declare function canAttach(childId: AnyNodeId, hostId: AnyNodeId, scene: SceneApi): AttachResult;
export declare function wouldCreateHostingCycle(childId: string, host: Pick<AnyNode, 'id' | 'parentId'>, scene: Pick<SceneApi, 'get'>): boolean;
/**
 * Returns the surfaces declared by a host's NodeDefinition. Surfaces describe
 * where other nodes can stack/mount — the `top` of a slab, the `sides` of a
 * wall, or a custom callback. Returns null when the host's def declares no
 * surfaces (or no def is registered).
 */
export declare function getSurface(host: AnyNode): SurfacesConfig | null;
/**
 * Resolves the stackable top height of a host (e.g. table surface, slab top,
 * stair landing). Returns `null` when the host has no `surfaces.top`.
 */
export declare function getTopSurfaceHeight(host: AnyNode, nodes?: Record<string, AnyNode>): number | null;
/**
 * Whether `host` can receive a surface-resting (top-stacked) child. A
 * ceiling-mounted item hangs from the ceiling, so its visible "top" is not a
 * usable resting surface — nothing should stack on a ceiling fan. The check
 * reads the instance-level `asset.attachTo` (not the host KIND, which is shared
 * across all items) so a single gate covers every interaction path.
 */
export declare function canHostOnTop(host: AnyNode): boolean;
/**
 * Pure host-discovery helper. Given a list of candidate hosts (already
 * narrowed by spatial query) and a point, returns the first whose
 * `capabilities.hostable` lists `placedKind` AND whose surface contains the
 * point. The runtime is responsible for providing pre-filtered candidates;
 * this function does not perform spatial queries itself.
 */
export declare function pickHost(args: {
    point: Vec3;
    candidates: readonly AnyNode[];
    placedKind: string;
    hitTest?: (host: AnyNode, point: Vec3) => boolean;
}): AnyNode | null;
/**
 * Convenience: clamps a Y coordinate to the top of a host surface, when one
 * is declared. Returns the original Y if the host has no top surface.
 */
export declare function clampYToHostTop(host: AnyNode, originalY: number, nodes?: Record<string, AnyNode>): number;
export declare function clearFaceHostItemFields(host: AnyNode | undefined): Partial<ItemNode>;
//# sourceMappingURL=hosting.d.ts.map