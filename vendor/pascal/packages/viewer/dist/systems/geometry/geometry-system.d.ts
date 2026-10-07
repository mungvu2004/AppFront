import { type Group, type Object3D } from 'three';
/**
 * Generic geometry system.
 *
 * For every node in `dirtyNodes` whose definition exposes `def.geometry`,
 * this system:
 *  1. Looks up the registered `Group` from `sceneRegistry` (mounted by the
 *     framework's `<ParametricNodeRenderer>`, or a custom renderer that
 *     opts into the same mount contract).
 *  2. Builds a `GeometryContext` from the current scene snapshot.
 *  3. Calls `def.geometry(node, ctx)` to get the new `Object3D`.
 *  4. Disposes the registered group's existing children + their geometries
 *     and materials.
 *  5. Reparents the returned object's children onto the registered group.
 *  6. Clears the dirty flag.
 *
 * This is the "no per-kind system needed" path documented in
 * `wiki/architecture/node-definitions.md`. A kind that only rebuilds on
 * dirty (shelf, item, fence segment, etc.) ships nothing more than a pure
 * `geometry` function — no `renderer.tsx`, no `system.tsx`.
 *
 * Kinds with `def.system` declared run their own systems *in addition* to
 * this one — animation + cascade + named-mesh material poking stay
 * kind-specific.
 *
 * Frame priority 2 mirrors the per-kind shelf system it replaces. Door
 * animation systems run at priority 2 today too, marking dirty so the
 * geometry rebuild lands at priority 3-4 next frame. Door/window/wall
 * still have their own systems (they need cross-cutting work this system
 * doesn't cover) — they coexist; this system only acts on kinds that
 * declare `def.geometry`.
 */
export declare const GeometrySystem: () => null;
export default GeometrySystem;
export type GeometryBuildCacheEntry = {
    group: Group;
    key: string;
};
export declare function markGeometryBuildOutput(child: Object3D): void;
export declare function shouldReuseGeometryBuild(cache: Map<string, GeometryBuildCacheEntry>, id: string, group: Group, key: string): boolean;
//# sourceMappingURL=geometry-system.d.ts.map