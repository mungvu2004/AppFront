export type VerticalSceneMigration = {
    changed: boolean;
    nodes: Record<string, unknown>;
};
/**
 * Applies the vertical-model load migration to serialized scene nodes.
 *
 * This must remain pure, idempotent, and server-safe: the editor loader and
 * hosted scene authority both call it so they compare and persist the same
 * canonical fields during collaboration.
 */
export declare function migrateVerticalSceneNodes(sourceNodes: Record<string, unknown>): VerticalSceneMigration;
//# sourceMappingURL=vertical-scene-migration.d.ts.map