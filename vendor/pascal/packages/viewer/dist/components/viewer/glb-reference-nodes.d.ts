import { type AnyNode, type SceneGraph } from '@pascal-app/core';
import type { Object3D } from 'three';
/**
 * Kinds with `def.bake === 'strip'` (scans/LiDAR, guides/floorplan images) are
 * excluded from the baked GLB — heavy reference assets stored elsewhere. The GLB
 * viewer re-adds them at runtime from the scene graph, portaled into their parent
 * level's baked node so they ride level stacking, using the same registry
 * renderers as the parametric viewer. Selection is registry-driven; scan/guide
 * privacy is enforced upstream (`show_*_public`), so a disallowed asset is never
 * even fetched — we still honour the flags here as a second gate.
 */
export declare function buildGlbReferenceNodes(sceneGraph: SceneGraph | null | undefined, allow: {
    scans: boolean;
    guides: boolean;
}): AnyNode[];
/**
 * Kinds with `def.bake === 'replace'` — baked as static geometry (so plain glTF
 * viewers still show them) but re-rendered live here, since their runtime look
 * differs from a frozen snapshot (shader wind, interactivity). `GlbScene` hides
 * the baked meshes for these kinds; this feeds them back through the same
 * portal-into-level path as reference nodes. Registry-driven; no privacy gate
 * (dynamic scene content, not user uploads).
 */
export declare function buildGlbReplaceNodes(sceneGraph: SceneGraph | null | undefined): AnyNode[];
export declare const GlbReferenceNodes: import("react").MemoExoticComponent<({ nodes, identity, }: {
    nodes: AnyNode[];
    identity: Map<string, Object3D>;
}) => import("react").JSX.Element>;
//# sourceMappingURL=glb-reference-nodes.d.ts.map