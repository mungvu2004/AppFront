import type { AnyNode, BaseNode, BuildingNode, LevelNode, UnitNode, ZoneNode } from '@pascal-app/core';
import type { Object3D } from 'three';
import type { EdgeMode } from '../lib/edge-style';
import type { ColorPreset, RenderShading } from '../lib/materials';
export type RenderContext = 'editor' | 'viewer';
export type MetricNotation = 'meters' | 'millimeters';
export type WallMode = 'up' | 'cutaway' | 'down' | 'translucent';
type SelectionPath = {
    buildingId: BuildingNode['id'] | null;
    levelId: LevelNode['id'] | null;
    zoneId: ZoneNode['id'] | null;
    selectedIds: BaseNode['id'][];
};
type Outliner = {
    selectedObjects: Object3D[];
    hoveredObjects: Object3D[];
};
type ViewerState = {
    selection: SelectionPath;
    focusedUnitId: UnitNode['id'] | null;
    setFocusedUnit: (id: UnitNode['id'] | null) => void;
    previewSelectedIds: BaseNode['id'][];
    setPreviewSelectedIds: (ids: BaseNode['id'][]) => void;
    /** Host-owned selection highlights rendered through the viewer's native
     * selection paths without changing the local user's editable selection. */
    externalSelectedIds: BaseNode['id'][];
    setExternalSelectedIds: (ids: BaseNode['id'][]) => void;
    hoverHighlightMode: string;
    setHoverHighlightMode: (mode: string) => void;
    hoveredId: AnyNode['id'] | ZoneNode['id'] | null;
    setHoveredId: (id: AnyNode['id'] | ZoneNode['id'] | null) => void;
    cameraMode: 'perspective' | 'orthographic';
    setCameraMode: (mode: 'perspective' | 'orthographic') => void;
    sceneTheme: string;
    setSceneTheme: (id: string) => void;
    renderContext: RenderContext;
    setRenderContext: (context: RenderContext) => void;
    /** True during a GLB bake/export pass. Renderers that normally draw via a
     * collective InstancedMesh (`def.system`) and mount only an invisible per-node
     * proxy can watch this to emit real, visible geometry so the exporter — which
     * clones only the `scene-renderer` subtree — captures them. Transient (never
     * persisted). */
    isExporting: boolean;
    setExporting: (value: boolean) => void;
    /** Item model loads that exhausted their retries — nodeId → asset URL. The
     * scene renders without these items (they settle as skipped); a bake host
     * can persist the map onto the artifact's metadata so a missing item is
     * queryable instead of silently absent. Transient (never persisted). */
    itemLoadFailures: Record<string, string>;
    reportItemLoadFailure: (nodeId: string, url: string) => void;
    clearItemLoadFailure: (nodeId: string) => void;
    /** Suspend the render loop while the canvas is fully covered (e.g. studio gallery). */
    renderPaused: boolean;
    setRenderPaused: (value: boolean) => void;
    shading: RenderShading;
    shadingByContext: Partial<Record<RenderContext, RenderShading>>;
    setShading: (shading: RenderShading) => void;
    textures: boolean;
    setTextures: (textures: boolean) => void;
    colorPreset: ColorPreset;
    setColorPreset: (preset: ColorPreset) => void;
    edges: EdgeMode;
    setEdges: (edges: EdgeMode) => void;
    shadows: boolean;
    setShadows: (shadows: boolean) => void;
    unit: 'metric' | 'imperial';
    setUnit: (unit: 'metric' | 'imperial') => void;
    metricNotation: MetricNotation;
    setMetricNotation: (notation: MetricNotation) => void;
    /** True once the user explicitly picked a unit. Until then `unit` is a
     * locale-derived default and is not persisted, so the default can keep
     * tracking the browser locale across sessions. */
    unitExplicit: boolean;
    levelMode: 'stacked' | 'exploded' | 'solo' | 'manual';
    setLevelMode: (mode: 'stacked' | 'exploded' | 'solo' | 'manual') => void;
    wallMode: WallMode;
    setWallMode: (mode: WallMode) => void;
    showScans: boolean;
    setShowScans: (show: boolean) => void;
    showGuides: boolean;
    setShowGuides: (show: boolean) => void;
    showGrid: boolean;
    setShowGrid: (show: boolean) => void;
    showMeasurements: boolean;
    setShowMeasurements: (show: boolean) => void;
    showZones: boolean;
    setShowZones: (show: boolean) => void;
    transparentBackground: boolean;
    setTransparentBackground: (transparent: boolean) => void;
    inkOpacity: number | null;
    setInkOpacity: (opacity: number | null) => void;
    projectId: string | null;
    setProjectId: (id: string | null) => void;
    projectPreferences: Record<string, {
        showScans?: boolean;
        showGuides?: boolean;
        showGrid?: boolean;
        showMeasurements?: boolean;
    }>;
    setSelection: (updates: Partial<SelectionPath>) => void;
    resetSelection: () => void;
    outliner: Outliner;
    /** Bumped by GeometrySystem after each rebuild pass so selection/outline
     * effects can re-apply to the freshly swapped meshes. */
    geometryRevision: number;
    bumpGeometryRevision: () => void;
    exportScene: ((format?: 'glb' | 'usdz' | 'stl' | 'obj') => Promise<void>) | null;
    setExportScene: (fn: ((format?: 'glb' | 'usdz' | 'stl' | 'obj') => Promise<void>) | null) => void;
    debugColors: boolean;
    setDebugColors: (enabled: boolean) => void;
    walkthroughMode: boolean;
    setWalkthroughMode: (mode: boolean) => void;
    /** Pointer lock temporarily released mid-walkthrough (⌘/PrintScreen — OS
     *  screenshot needs a movable cursor); clicking the canvas re-locks. */
    walkthroughSuspended: boolean;
    setWalkthroughSuspended: (suspended: boolean) => void;
    cameraDragging: boolean;
    setCameraDragging: (dragging: boolean) => void;
    /**
     * True while a host-driven drag is in progress (editor handles —
     * height arrow, width arrow, etc.). Suppresses node pointer event
     * routing so the synthetic click on pointerup doesn't reroute
     * selection to whatever mesh the cursor lands on at release.
     * Conceptually a sibling of `cameraDragging` — both mean "user is
     * dragging; don't treat the next pointerup as a click on the
     * scene." Set by the host (e.g. `NodeArrowHandles` in the editor);
     * the viewer only reads it.
     */
    inputDragging: boolean;
    setInputDragging: (dragging: boolean) => void;
};
declare const useViewer: import("zustand").UseBoundStore<Omit<import("zustand").StoreApi<ViewerState>, "setState" | "persist"> & {
    setState(partial: ViewerState | Partial<ViewerState> | ((state: ViewerState) => ViewerState | Partial<ViewerState>), replace?: false | undefined): unknown;
    setState(state: ViewerState | ((state: ViewerState) => ViewerState), replace: true): unknown;
    persist: {
        setOptions: (options: Partial<import("zustand/middleware").PersistOptions<ViewerState, {
            metricNotation: MetricNotation;
            levelMode: "manual" | "stacked" | "exploded" | "solo";
            wallMode: WallMode;
            projectPreferences: Record<string, {
                showScans?: boolean;
                showGuides?: boolean;
                showGrid?: boolean;
                showMeasurements?: boolean;
            }>;
            unit?: "metric" | "imperial" | undefined;
            cameraMode: "perspective" | "orthographic";
            sceneTheme: string;
            shadingByContext: Partial<Record<RenderContext, RenderShading>>;
            textures: boolean;
            colorPreset: ColorPreset;
            edges: EdgeMode;
            shadows: boolean;
        }, unknown>>) => void;
        clearStorage: () => void;
        rehydrate: () => Promise<void> | void;
        hasHydrated: () => boolean;
        onHydrate: (fn: (state: ViewerState) => void) => () => void;
        onFinishHydration: (fn: (state: ViewerState) => void) => () => void;
        getOptions: () => Partial<import("zustand/middleware").PersistOptions<ViewerState, {
            metricNotation: MetricNotation;
            levelMode: "manual" | "stacked" | "exploded" | "solo";
            wallMode: WallMode;
            projectPreferences: Record<string, {
                showScans?: boolean;
                showGuides?: boolean;
                showGrid?: boolean;
                showMeasurements?: boolean;
            }>;
            unit?: "metric" | "imperial" | undefined;
            cameraMode: "perspective" | "orthographic";
            sceneTheme: string;
            shadingByContext: Partial<Record<RenderContext, RenderShading>>;
            textures: boolean;
            colorPreset: ColorPreset;
            edges: EdgeMode;
            shadows: boolean;
        }, unknown>>;
    };
}>;
/** Apply an authoritative country code (e.g. IP-derived by the host app) as
 * the unit default. Stronger signal than the timezone heuristic used at store
 * creation, but still a default: it never overrides an explicit user choice
 * and is not persisted (the unit only sticks once the user touches the
 * toggle). */
export declare function applyCountryUnitDefault(country: string | null | undefined): void;
export default useViewer;
//# sourceMappingURL=use-viewer.d.ts.map