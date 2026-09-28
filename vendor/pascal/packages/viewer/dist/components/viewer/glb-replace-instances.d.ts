import { type AnyNode } from '@pascal-app/core';
import type { Object3D } from 'three';
/**
 * Re-renders `bake: 'replace'` kinds (e.g. plugin trees) live over the baked GLB.
 * The baked static meshes are hidden by `GlbScene`; these nodes are grouped by
 * `(parent level, kind)` and each group is handed to the kind's collective
 * `bakeReplaceRenderer` (an instanced renderer), portaled into that level's baked
 * `Object3D`. Local-space instances therefore ride level stacking/explode for
 * free, and a forest stays a few instanced draw calls.
 *
 * Memoized: `GlbScene` re-renders each frame on camera move; `nodes` and
 * `identity` are stable refs, so this whole subtree short-circuits.
 */
export declare const GlbReplaceInstances: import("react").MemoExoticComponent<({ nodes, identity, }: {
    nodes: AnyNode[];
    identity: Map<string, Object3D>;
}) => import("react").JSX.Element>;
//# sourceMappingURL=glb-replace-instances.d.ts.map