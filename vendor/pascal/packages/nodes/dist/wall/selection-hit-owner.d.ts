/**
 * Who "owns" a raycast hit, for the hidden-wall nearest-first selection rule
 * (`pointer-transparency.ts`)?
 *
 * The live R3F event raycast recurses through the level/building wrapper
 * groups (they carry pointer handlers), so `event.intersections` contains
 * every mesh under them — including PASSIVE geometry that owns no selection
 * semantics: plugin overlay members (the Bones framing InstancedMeshes sit
 * exactly at the wall's depth), helper meshes, the grid. Distance alone
 * cannot rank those against a hidden wall; ownership can:
 *
 * - 'self-wall'   — the hit resolves to THIS wall (its own collision mesh,
 *                   render mesh, treatments). Neutral: a wall cannot outrank
 *                   itself, and must not yield to itself either.
 * - 'other-wall'  — the hit resolves to a different wall. Never a direct
 *                   competitor (two hidden walls must not both yield and
 *                   drop the event into the room behind — delivery order
 *                   already gives the nearest one the event), but an ANCHOR
 *                   for the wall-mounted test.
 * - 'selectable'  — the hit resolves to a node the editor can select
 *                   (furniture, devices, openings, slabs …). These are the
 *                   real competitors.
 * - 'passive'     — no selectable-node ancestry (framing members, gizmos,
 *                   the grid, unregistered helpers). Never outranks a wall.
 *
 * Ownership = the hit object's NEAREST ancestor registered in
 * `sceneRegistry` (every node's renderer registers its root). A hosted
 * door's meshes resolve to the door (registered deeper than its host wall),
 * a wall's own trim resolves to the wall, a framing member resolves to the
 * plugin's overlay node (registered, but not selectable → passive).
 */
export type WallRayHitOwnership = 'self-wall' | 'other-wall' | 'selectable' | 'passive';
/** Injectable seams so the classifier is testable without the live editor. */
export type HitOwnerDeps = {
    /** Bumped whenever a node (un)registers — invalidates the reverse map. */
    registryRevision: () => number;
    /** All registered (nodeId, root Object3D) pairs. */
    registeredEntries: () => Iterable<[string, object]>;
    /** The node kind for a registered id (undefined once the node is gone). */
    kindOf: (id: string) => string | undefined;
    /** Plugin kinds that declare `capabilities.selectable`. */
    isRegistrySelectableKind: (kind: string) => boolean;
};
type ObjectLike = {
    parent?: ObjectLike | null;
};
/**
 * Build a classifier for one wall's pointer gate. `selfWallId` is that
 * wall's node id; hits resolving to it are 'self-wall'.
 */
export declare const createWallRayHitClassifier: (selfWallId: string, deps?: HitOwnerDeps) => ((object: ObjectLike) => WallRayHitOwnership);
export {};
//# sourceMappingURL=selection-hit-owner.d.ts.map