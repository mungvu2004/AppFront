import type { AnyNodeId } from '@pascal-app/core';
import type { Object3D } from 'three';
/** True while a subtree is isolated, including before its lazy meshes mount. */
export declare function isIsolationActive(): boolean;
/** Include synthesized meshes below a selected native root, including hosted openings. */
export declare function collectIsolationSubtree(ids: ReadonlyArray<string>): Set<Object3D>;
/**
 * Select native subtrees without mutating the saved scene or cascading visibility
 * through their hosts. The next draw also filters unregistered presentation geometry.
 */
export declare function applyIsolation(ids: ReadonlyArray<AnyNodeId> | null): void;
/**
 * Reconcile immediately before viewport or snapshot rendering. Environment, sky,
 * ground and instance batches can live outside sceneRegistry or mount asynchronously.
 * Lights/cameras remain usable; masks do not cascade, so an isolated door can still
 * render under its hidden wall. Collective renderers fall back to native geometry.
 * The returned cleanup restores fog after the synchronous draw, before atmosphere
 * owners can change it again. Do not hold this cleanup across async GPU readback.
 */
export declare function refreshIsolation(scene?: Object3D): () => void;
/** Restore even detached/unregistered meshes, without undoing solo or batching holds. */
export declare function clearIsolation(): void;
//# sourceMappingURL=isolation.d.ts.map