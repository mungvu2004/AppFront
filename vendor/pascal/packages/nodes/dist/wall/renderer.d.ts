import { type WallNode } from '@pascal-app/core';
/**
 * Thin wall renderer.
 *
 * Mounts a placeholder mesh, registers it with `sceneRegistry`, marks the
 * node dirty so `WallSystem` fills the geometry on the next frame, and
 * recursively renders hosted children (doors / windows / wall-mounted
 * items) inside the wall's local frame.
 *
 * Behaviorally identical to the legacy `WallRenderer` in
 * `@pascal-app/viewer/components/renderers/wall/wall-renderer.tsx`.
 * Phase 6 deletes the legacy file; until then both coexist and the Phase 0
 * shims pick which one renders based on `nodeRegistry.has('wall')`.
 *
 * No `geometry` field on the wall definition yet — wall's geometry depends
 * on level-batch miter data (see `WallSystem.calculateLevelMiters`), which
 * doesn't fit the generic `(node, ctx) => Group` shape without `ctx.levelData`.
 * That decision lands in a later milestone; for now the system retains
 * ownership of the rebuild loop.
 */
declare const WallRenderer: ({ node }: {
    node: WallNode;
}) => import("react").JSX.Element;
export default WallRenderer;
//# sourceMappingURL=renderer.d.ts.map