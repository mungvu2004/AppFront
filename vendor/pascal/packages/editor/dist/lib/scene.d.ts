export type SceneGraph = {
    nodes: Record<string, unknown>;
    rootNodeIds: string[];
    collections?: Record<string, unknown>;
    materials?: Record<string, unknown>;
    installedPlugins?: string[];
};
export declare function writePersistedSelection(selection: {
    buildingId: string | null;
    levelId: string | null;
    zoneId: string | null;
    selectedIds: string[];
}): void;
export declare function syncEditorSelectionFromCurrentScene(): void;
export declare function normalizeSceneGraphNodes(nodes: Readonly<Record<string, unknown>>): Record<string, unknown>;
export declare function applySceneGraphToEditor(sceneGraph?: SceneGraph | null): void;
export declare function saveSceneToLocalStorage(scene: SceneGraph): void;
export declare function loadSceneFromLocalStorage(): SceneGraph | null;
//# sourceMappingURL=scene.d.ts.map