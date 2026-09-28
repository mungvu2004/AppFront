import type { AnyNode, AnyNodeId } from '../schema/index.js';
import type { Collection, CollectionId } from '../schema/collections.js';
import type { SceneMaterial, SceneMaterialId } from '../schema/scene-material.js';
export type SceneGraph = {
    nodes: Record<AnyNodeId, AnyNode>;
    rootNodeIds: AnyNodeId[];
    collections?: Record<CollectionId, Collection>;
    materials?: Record<SceneMaterialId, SceneMaterial>;
    installedPlugins?: string[];
};
/**
 * Deep clones a scene graph with all node IDs regenerated while preserving
 * parent-child relationships and other internal references.
 *
 * The hand-written remaps here and in `cloneLevelSubtree` are inventoried in
 * `contracts/reference-inventory.ts`, which records the references they miss;
 * `contracts/fidelity.test.ts` fails when either drifts from the inventory.
 * P-03 replaces both passes with the one extractor over `capabilities.refs`.
 *
 * This is useful for:
 * - Duplicating a project (host app creates a new project record, then loads the cloned scene)
 * - Copying nodes between different projects
 * - Multi-scene in-memory scenarios
 */
export declare function cloneSceneGraph(sceneGraph: SceneGraph): SceneGraph;
/**
 * Deep clones a level node and all its descendants with fresh IDs.
 * All internal references (parentId, children, wallId) are remapped to the new IDs.
 * The cloned level node's parentId is preserved (building ID) — not remapped.
 *
 * Unlike `cloneSceneGraph` (which operates on serialized data), this function works
 * on live runtime nodes that may have non-serializable properties (Three.js objects,
 * etc.). It uses JSON roundtrip to safely strip them.
 *
 * @returns clonedNodes - flat array of all cloned nodes (level + descendants)
 * @returns newLevelId - the ID of the cloned level node
 * @returns idMap - old ID → new ID mapping
 */
export declare function cloneLevelSubtree(nodes: Record<AnyNodeId, AnyNode>, levelId: AnyNodeId): {
    clonedNodes: AnyNode[];
    newLevelId: AnyNodeId;
    idMap: Map<string, string>;
};
export type ForkSceneGraphOptions = {
    preserveScans?: boolean;
};
/**
 * Forks a scene graph for use as a new project: clones with new IDs and, by
 * default, strips scan and guide nodes since they contain user-uploaded imagery.
 */
export declare function forkSceneGraph(sceneGraph: SceneGraph, options?: ForkSceneGraphOptions): SceneGraph;
//# sourceMappingURL=clone-scene-graph.d.ts.map