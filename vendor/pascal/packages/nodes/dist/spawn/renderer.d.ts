import { type SpawnNode } from '@pascal-app/core';
export declare const SpawnPreview: ({ layers, node }: {
    layers?: number;
    node: SpawnNode;
}) => import("react").JSX.Element;
/**
 * Registry-driven spawn renderer. Behaviorally identical to the legacy
 * `@pascal-app/viewer/components/renderers/spawn/spawn-renderer.tsx` — same
 * geometry and event surface. When the spawn definition lands
 * in `builtinPlugin.nodes`, the Phase 0 dispatch shims switch the renderer
 * here and the legacy one is short-circuited.
 *
 * Lives in `@pascal-app/nodes` (not viewer) so the kind owns its own render
 * code. Phase 5's batch migration applies the same pattern to every node.
 */
declare const SpawnRenderer: ({ node }: {
    node: SpawnNode;
}) => import("react").JSX.Element;
export default SpawnRenderer;
//# sourceMappingURL=renderer.d.ts.map