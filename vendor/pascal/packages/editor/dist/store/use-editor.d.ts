import type { AssetInput } from '@pascal-app/core';
import { type AnyNode, type AnyNodeId, type BrushSettings, type ChimneyMaterialRole, type DormerSurfaceMaterialRole, type RoofSurfaceMaterialRole, type Space, type StairSurfaceMaterialRole, type TerrainVerb, type WallSurfaceSide } from '@pascal-app/core';
import { type ContinuationContext, type ContinuationMode } from '../lib/continuation';
import { type ActivePaintMaterial, type PaintableMaterialTarget, type SingleSurfaceMaterialRole } from '../lib/material-paint';
import { type CreatableMeasurementKind } from '../lib/measurement-kind';
import type { ModelExport } from '../lib/model-export';
import { type PaintHoverInfo, type PaintScope } from '../lib/paint-scope';
import { type SnapContext, type SnappingMode } from '../lib/snapping-mode';
export type ViewMode = '3d' | '2d' | 'split';
export type SplitOrientation = 'horizontal' | 'vertical';
export type WorkspaceMode = 'edit' | 'studio' | 'sheets';
export type SnapshotCropMode = 'standard' | 'viewport' | 'area';
/** Aspect presets available to `standard` crops. */
export type SnapshotStandardAspect = '16:9' | '9:16' | '4:3' | '3:4' | '1:1';
export type CaptureMode = {
    mode: 'idle';
} | {
    mode: 'standard';
    crop?: SnapshotCropMode;
    standardAspect?: SnapshotStandardAspect;
    /** The host needs this exact output shape (e.g. the publish cover) —
     *  hide the crop/aspect switcher instead of merely preselecting it. */
    lockCrop?: boolean;
} | {
    mode: 'preset';
    isolated: AnyNodeId[];
    framingBounds?: {
        min: [number, number];
        max: [number, number];
        center: [number, number];
        size: [number, number];
    };
};
/**
 * How the first-person camera moves. `walk` is the grounded street-view
 * controller (gravity, collision, door interaction); `drone` is a free camera
 * with no gravity or collision, offered by the snapshot capture overlay so a
 * shot can be framed from anywhere in the scene.
 */
export type FirstPersonMovementMode = 'walk' | 'drone';
/** Degrees. Range of the capture-mode field-of-view control. */
export declare const CAPTURE_FOV_MIN = 15;
export declare const CAPTURE_FOV_MAX = 110;
export type Phase = 'site' | 'structure' | 'furnish';
/**
 * `terrain-sculpt` is a mode, not a build tool, and that is the whole answer to
 * "how does terrain editing avoid conflicting with everything else".
 *
 * A build tool places a node and hands the pointer back. Sculpting is a
 * sustained brush over the *ground* — the one surface every other tool uses as
 * its reference plane — so while it is armed, clicks must not select a wall,
 * drag a window, or arm a ghost. Modeling it as a mode gets that for free: it is
 * mutually exclusive with `build`/`select`/`delete` by construction, every
 * selection manager already early-returns unless `mode === 'select'`, and it
 * holds a `sculpting` interaction scope for its whole lifetime so conflicting
 * controls stay stepped back. `material-paint` is the existing precedent for
 * exactly this shape.
 */
export type Mode = 'select' | 'edit' | 'delete' | 'build' | 'material-paint' | 'terrain-sculpt';
type BuiltInStructureTool = 'wall' | 'fence' | 'room' | 'custom-room' | 'slab' | 'ceiling' | 'roof' | 'column' | 'structural-grid' | 'elevator' | 'stair' | 'item' | 'zone' | 'spawn' | 'window' | 'door' | 'shelf' | 'box-vent' | 'ridge-vent' | 'turbine-vent' | 'cupola' | 'eyebrow-vent' | 'chimney' | 'solar-panel' | 'skylight' | 'dormer' | 'gutter' | 'downspout' | 'duct-segment' | 'duct-fitting' | 'duct-terminal' | 'hvac-equipment' | 'lineset' | 'liquid-line' | 'pipe-segment' | 'pipe-fitting' | 'pipe-trap';
/** Registry node kinds are valid build tools without central union edits. */
export type StructureTool = BuiltInStructureTool | (string & {});
export type FurnishTool = 'item' | 'cabinet';
export type SiteTool = 'property-line';
export type CatalogCategory = 'furniture' | 'appliance' | 'bathroom' | 'kitchen' | 'outdoor' | 'window' | 'door';
export type StructureLayer = 'zones' | 'elements';
export type FloorplanSelectionTool = 'click' | 'marquee';
export type GridSnapStep = 0.5 | 0.25 | 0.1 | 0.05;
export type NavigationSyncSource = '2d' | '3d';
export type NavigationSyncPose = {
    source: NavigationSyncSource;
    revision: number;
    target: [number, number, number];
    azimuth: number;
    viewWidth: number;
};
export type NavigationSyncPoseInput = Omit<NavigationSyncPose, 'revision'>;
export type KnownTool = SiteTool | StructureTool | FurnishTool;
export type Tool = KnownTool | (string & {});
export type ToolMode = {
    mode: 'select';
} | {
    mode: 'edit';
} | {
    mode: 'delete';
} | {
    mode: 'build';
    tool: StructureTool;
} | {
    mode: 'material-paint';
} | {
    mode: 'terrain-sculpt';
};
/**
 * Starting parameters seeded into a draw tool before it mints a node.
 * A loose param bag — the tool's create path validates it through the
 * kind's schema (`FenceNode.parse({ ...defaults, start, end })`), which
 * is the real type gate, so unknown keys are simply ignored.
 */
export type ToolDefaults = Record<string, unknown>;
export type MaterialTargetRole = WallSurfaceSide | StairSurfaceMaterialRole | RoofSurfaceMaterialRole | ChimneyMaterialRole | DormerSurfaceMaterialRole | SingleSurfaceMaterialRole | string;
export type SelectedMaterialTarget = {
    nodeId: AnyNodeId;
    role: MaterialTargetRole;
};
type MaterialPaintSelectionSnapshot = {
    selectedId: string | null;
    activePaintTarget: PaintableMaterialTarget;
    activePaintMaterial: ActivePaintMaterial | null;
};
export type SurfaceHoleTarget = {
    nodeId: string;
    holeIndex: number;
};
export type GuideUiState = {
    locked?: boolean;
    scaleReferenceVisible?: boolean;
};
type EditorState = {
    phase: Phase;
    setPhase: (phase: Phase) => void;
    toolMode: ToolMode;
    armToolMode: (next: ToolMode) => void;
    armMaterialPaint: (material?: ActivePaintMaterial) => void;
    mode: Mode;
    setMode: (mode: Mode) => void;
    tool: Tool | null;
    setTool: (tool: Tool | null) => void;
    /**
     * Per-tool starting parameters for the next node a draw tool mints.
     * Transient (not persisted): host apps seed an entry just before
     * activating the tool (placing a drawn preset, or a future dimension
     * picker), the tool's create path merges it, and the tool clears its
     * own entry on deactivation so a later manual draw isn't poisoned.
     */
    toolDefaults: Partial<Record<Tool, ToolDefaults>>;
    setToolDefaults: (tool: Tool, defaults: ToolDefaults | null) => void;
    lastMeasurementKind: CreatableMeasurementKind;
    setLastMeasurementKind: (kind: CreatableMeasurementKind) => void;
    structureLayer: StructureLayer;
    setStructureLayer: (layer: StructureLayer) => void;
    catalogCategory: CatalogCategory | null;
    setCatalogCategory: (category: CatalogCategory | null) => void;
    selectedItem: AssetInput | null;
    setSelectedItem: (item: AssetInput) => void;
    /**
     * True while a move was engaged by a press-drag gizmo (the on-canvas move
     * cross) rather than a click-to-place flow. The placement coordinator reads
     * this to commit on pointer-release instead of waiting for a click.
     */
    placementDragMode: boolean;
    setPlacementDragMode: (dragMode: boolean) => void;
    roofHostDragArmedId: AnyNodeId | null;
    setRoofHostDragArmedId: (nodeId: AnyNodeId | null) => void;
    setMovingNode: (node: AnyNode | null) => void;
    /**
     * Which view (2D floor plan or 3D viewer) most recently completed
     * the active move — set by the committing or cancelling side just
     * before clearing `movingNode`. Lets the *other* side's effect
     * cleanup skip its own restore-from-snapshot when the drag was
     * already finalised elsewhere (split view mounts both the 2D
     * overlay and the 3D move tool for the same `movingNode`).
     *
     * Reset to null when the next non-null `setMovingNode` starts a
     * fresh drag (so stale values from the previous drag don't poison
     * cleanups). Preserved across `setMovingNode(null)` so the
     * non-owning side's cleanup — which fires after the clear
     * propagates — can still read who finalised. Null while a drag
     * is in progress means "no side has claimed it yet" — both
     * cleanups then restore to their pre-drag snapshot, which is the
     * same baseline, so the result is idempotent.
     */
    movingNodeOrigin: '2d' | '3d' | null;
    setMovingNodeOrigin: (origin: '2d' | '3d' | null) => void;
    /**
     * World axis the R/T keyboard rotation turns around, for kinds with
     * full 3D orientation (duct fittings). Alt cycles it Y → X → Z; the
     * kind's tool / keyboard actions read it, and the floating action
     * menu surfaces it in a pill above the selected node.
     */
    rotationAxis: 'x' | 'y' | 'z';
    cycleRotationAxis: () => 'x' | 'y' | 'z';
    selectedMaterialTarget: SelectedMaterialTarget | null;
    setSelectedMaterialTarget: (target: SelectedMaterialTarget | null) => void;
    activePaintMaterial: ActivePaintMaterial | null;
    setActivePaintMaterial: (material: ActivePaintMaterial | null) => void;
    activePaintTarget: PaintableMaterialTarget;
    setActivePaintTarget: (target: PaintableMaterialTarget) => void;
    draftVertexCount: number;
    setDraftVertexCount: (count: number) => void;
    paintScope: PaintScope;
    setPaintScope: (scope: PaintScope) => void;
    cyclePaintScope: () => PaintScope;
    paintEraser: boolean;
    setPaintEraser: (eraser: boolean) => void;
    primeMaterialPaintFromSelection: () => MaterialPaintSelectionSnapshot;
    /**
     * Terrain sculpt state. Lives here rather than in the tool component so the
     * bottom-bar HUD, the keyboard shortcuts, and the brush all read one source —
     * the same reason the paint mode's material/scope/eraser live here.
     */
    terrainVerb: TerrainVerb;
    setTerrainVerb: (verb: TerrainVerb) => void;
    terrainBrush: BrushSettings;
    setTerrainBrush: (settings: Partial<BrushSettings>) => void;
    /**
     * Absolute height in metres the `flatten` verb aims at. Sampled by clicking
     * the ground with the eyedropper, or typed. `null` means "sample on first
     * click", which is what makes flatten usable without ever opening a number
     * field.
     */
    terrainFlattenTarget: number | null;
    setTerrainFlattenTarget: (metres: number | null) => void;
    /**
     * True while the next click should sample a flatten target instead of
     * sculpting. One-shot: sampling clears it.
     */
    terrainSampling: boolean;
    setTerrainSampling: (sampling: boolean) => void;
    paintHover: PaintHoverInfo | null;
    setPaintHover: (info: PaintHoverInfo | null) => void;
    canFindNode: boolean;
    setCanFindNode: (canFind: boolean) => void;
    selectedReferenceId: string | null;
    setSelectedReferenceId: (id: string | null) => void;
    referenceScaleActiveGuideId: string | null;
    setReferenceScaleActiveGuideId: (id: string | null) => void;
    guideUi: Record<string, GuideUiState>;
    setGuideLocked: (guideId: string, locked: boolean) => void;
    setGuideScaleReferenceVisible: (guideId: string, visible: boolean) => void;
    clearGuideUi: (guideId: string) => void;
    spaces: Record<string, Space>;
    setSpaces: (spaces: Record<string, Space>) => void;
    hoveredHole: SurfaceHoleTarget | null;
    setHoveredHole: (hole: SurfaceHoleTarget | null) => void;
    isPreviewMode: boolean;
    setPreviewMode: (preview: boolean) => void;
    captureMode: CaptureMode;
    isCaptureMode: boolean;
    setCaptureMode: (next: boolean | CaptureMode) => void;
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
    splitOrientation: SplitOrientation;
    setSplitOrientation: (orientation: SplitOrientation) => void;
    isFloorplanOpen: boolean;
    setFloorplanOpen: (open: boolean) => void;
    toggleFloorplanOpen: () => void;
    isFloorplanHovered: boolean;
    setFloorplanHovered: (hovered: boolean) => void;
    isRiserOpen: boolean;
    setRiserOpen: (open: boolean) => void;
    toggleRiserOpen: () => void;
    navigationSyncPose: NavigationSyncPose | null;
    publishNavigationSyncPose: (pose: NavigationSyncPoseInput) => void;
    floorplanSelectionTool: FloorplanSelectionTool;
    setFloorplanSelectionTool: (tool: FloorplanSelectionTool) => void;
    gridSnapStep: GridSnapStep;
    setGridSnapStep: (step: GridSnapStep) => void;
    cycleGridSnapStep: () => GridSnapStep;
    magneticSnap: boolean;
    setMagneticSnap: (enabled: boolean) => void;
    snappingModeByContext: Record<SnapContext, SnappingMode>;
    setSnappingMode: (context: SnapContext, mode: SnappingMode) => void;
    cycleSnappingMode: () => SnappingMode;
    continuationByContext: Record<ContinuationContext, ContinuationMode>;
    setContinuation: (context: ContinuationContext, mode: ContinuationMode) => void;
    cycleContinuation: (context: ContinuationContext) => ContinuationMode;
    getContinuation: (context: ContinuationContext) => ContinuationMode;
    showReferenceFloor: boolean;
    toggleReferenceFloor: () => void;
    setShowReferenceFloor: (show: boolean) => void;
    referenceFloorOffset: number;
    setReferenceFloorOffset: (offset: number) => void;
    referenceFloorOpacity: number;
    setReferenceFloorOpacity: (opacity: number) => void;
    allowUndergroundCamera: boolean;
    setAllowUndergroundCamera: (enabled: boolean) => void;
    show2dVoronoi: boolean;
    setShow2dVoronoi: (enabled: boolean) => void;
    isFirstPersonMode: boolean;
    _viewModeBeforeFirstPerson: ViewMode | null;
    setFirstPersonMode: (enabled: boolean) => void;
    firstPersonMovementMode: FirstPersonMovementMode;
    setFirstPersonMovementMode: (mode: FirstPersonMovementMode) => void;
    captureFov: number | null;
    captureFovBaseline: number | null;
    setCaptureFov: (fov: number) => void;
    armCaptureFov: (fov: number | null) => void;
    captureShutterHold: boolean;
    setCaptureShutterHold: (hold: boolean) => void;
    workspaceMode: WorkspaceMode;
    _viewModeBeforeStudio: ViewMode | null;
    setWorkspaceMode: (mode: WorkspaceMode) => void;
    activeSidebarPanel: string;
    setActiveSidebarPanel: (id: string) => void;
    floorplanPaneRatio: number;
    setFloorplanPaneRatio: (ratio: number) => void;
    mobilePanelSheetHeight: number;
    setMobilePanelSheetHeight: (px: number) => void;
    modelExport: ModelExport | null;
    setModelExport: (modelExport: ModelExport | null) => void;
};
export type PersistedEditorUiState = Pick<EditorState, 'phase' | 'toolMode' | 'mode' | 'tool' | 'structureLayer' | 'catalogCategory' | 'isFloorplanOpen' | 'viewMode'>;
type PersistedEditorLayoutState = Pick<EditorState, 'activeSidebarPanel' | 'floorplanPaneRatio' | 'splitOrientation' | 'floorplanSelectionTool' | 'gridSnapStep' | 'magneticSnap' | 'lastMeasurementKind' | 'snappingModeByContext' | 'continuationByContext' | 'showReferenceFloor' | 'referenceFloorOffset' | 'referenceFloorOpacity'>;
export declare const DEFAULT_PERSISTED_EDITOR_UI_STATE: PersistedEditorUiState;
export declare const DEFAULT_PERSISTED_EDITOR_LAYOUT_STATE: PersistedEditorLayoutState;
type SelectDefaultBuildingAndLevelOptions = {
    forceGroundLevel?: boolean;
};
export declare function normalizePersistedEditorUiState(state: Partial<PersistedEditorUiState> | null | undefined): PersistedEditorUiState;
type LegacyContinuationState = {
    continuationByContext?: Partial<Record<ContinuationContext, unknown>>;
    wallChainMode?: unknown;
    fenceChainMode?: unknown;
};
export declare function normalizePersistedEditorLayoutState(state: (Omit<Partial<PersistedEditorLayoutState>, 'snappingModeByContext'> & LegacyContinuationState & {
    snappingModeByContext?: Partial<Record<SnapContext, unknown>>;
}) | null | undefined): PersistedEditorLayoutState;
export declare function hasCustomPersistedEditorUiState(state: Partial<PersistedEditorUiState> | null | undefined): boolean;
/**
 * Selects the first building and level 0 in the scene.
 * Safe to call any time — no-ops if already selected or scene is empty.
 */
export declare function selectDefaultBuildingAndLevel(options?: SelectDefaultBuildingAndLevelOptions): void;
export declare function selectSiteFloorplanContext(): void;
/**
 * Whether `mode` is one of the two sustained brush modes.
 *
 * Named because callers *outside* this store need the same test: a scope is
 * single-owner, so anything that calls `begin()` while a brush mode holds its
 * scope silently evicts it — the brush stays armed and painting while the rest of
 * the editor believes a drag is running. Almost every producer is unreachable
 * under a brush mode because it needs a selection and entering the mode clears
 * one, but the clipboard paths read the clipboard instead (see
 * `pasteSelectionAndPickUp`), so they have to ask.
 */
export declare function isBrushMode(mode: Mode): boolean;
declare const useEditor: import("zustand").UseBoundStore<Omit<import("zustand").StoreApi<EditorState>, "setState" | "persist"> & {
    setState(partial: EditorState | Partial<EditorState> | ((state: EditorState) => EditorState | Partial<EditorState>), replace?: false | undefined): unknown;
    setState(state: EditorState | ((state: EditorState) => EditorState), replace: true): unknown;
    persist: {
        setOptions: (options: Partial<import("zustand/middleware").PersistOptions<EditorState, {
            phase: Phase;
            toolMode: ToolMode;
            mode: Mode;
            tool: Tool | null;
            structureLayer: StructureLayer;
            catalogCategory: CatalogCategory | null;
            isFloorplanOpen: boolean;
            viewMode: ViewMode;
            activeSidebarPanel: string;
            floorplanPaneRatio: number;
            splitOrientation: SplitOrientation;
            floorplanSelectionTool: FloorplanSelectionTool;
            gridSnapStep: GridSnapStep;
            magneticSnap: boolean;
            lastMeasurementKind: "area" | "angle" | "distance" | "perimeter" | "volume";
            snappingModeByContext: Record<SnapContext, SnappingMode>;
            continuationByContext: Record<ContinuationContext, string>;
            showReferenceFloor: boolean;
            referenceFloorOffset: number;
            referenceFloorOpacity: number;
        }, unknown>>) => void;
        clearStorage: () => void;
        rehydrate: () => Promise<void> | void;
        hasHydrated: () => boolean;
        onHydrate: (fn: (state: EditorState) => void) => () => void;
        onFinishHydration: (fn: (state: EditorState) => void) => () => void;
        getOptions: () => Partial<import("zustand/middleware").PersistOptions<EditorState, {
            phase: Phase;
            toolMode: ToolMode;
            mode: Mode;
            tool: Tool | null;
            structureLayer: StructureLayer;
            catalogCategory: CatalogCategory | null;
            isFloorplanOpen: boolean;
            viewMode: ViewMode;
            activeSidebarPanel: string;
            floorplanPaneRatio: number;
            splitOrientation: SplitOrientation;
            floorplanSelectionTool: FloorplanSelectionTool;
            gridSnapStep: GridSnapStep;
            magneticSnap: boolean;
            lastMeasurementKind: "area" | "angle" | "distance" | "perimeter" | "volume";
            snappingModeByContext: Record<SnapContext, SnappingMode>;
            continuationByContext: Record<ContinuationContext, string>;
            showReferenceFloor: boolean;
            referenceFloorOffset: number;
            referenceFloorOpacity: number;
        }, unknown>>;
    };
}>;
export declare function armToolMode(next: ToolMode): void;
export declare function armMaterialPaint(material?: ActivePaintMaterial): void;
/**
 * Effective magnetic-snap state: the legacy `magneticSnap` flag AND the active
 * context's snapping mode. With exclusive modes, magnetic (alignment axes + wall
 * corner-join) is on only in `'lines'`. Read from the smallest magnetic choke
 * points so the mode is honoured without retuning any snap math.
 */
export declare function isMagneticSnapActive(): boolean;
/**
 * Effective angle-lock state: the active context's snapping mode. With exclusive
 * modes the 15°/45° lock is on only in `'angles'`. Read from the smallest
 * angle-lock choke points (wall / fence draft call sites).
 */
export declare function isAngleSnapActive(): boolean;
/**
 * Effective grid-lattice state: the active context's snapping mode. With
 * exclusive modes the grid quantize is on only in `'grid'`.
 */
export declare function isGridSnapActive(): boolean;
/**
 * Whether alignment "lines" should be DISPLAYED for the active context.
 *
 * True whenever a snappable context is active — in EVERY snapping mode,
 * including `'off'`. The guides are passive reference feedback; this is
 * decoupled from the magnetic *pull*: a producer publishes guides whenever this
 * is true, but only applies the alignment delta when `isMagneticSnapActive()`
 * (i.e. `'lines'`). So the user always sees the same alignment lines while
 * snapping to grid / angles / off, and only snaps to them in `'lines'` mode.
 */
export declare function isAlignmentGuideActive(): boolean;
/**
 * The snapping context for what the user is currently doing (wall / item /
 * polygon), or null when nothing snappable is active. Derived from the
 * authoritative interaction scope, falling back to the armed build tool (the
 * `drafting` scope isn't wired). The single source every snap reader + the HUD
 * resolve their mode through.
 */
export declare function getActiveSnapContext(): SnapContext | null;
export declare function getActiveContinuationContext(): ContinuationContext | null;
export declare function getContinuation(context: ContinuationContext): ContinuationMode;
/**
 * The effective snapping mode for the active context. Falls back to `'off'` when
 * no snappable context is active (select / idle, no armed tool) so grid /
 * magnetic / angle readers — including the snap-grid overlay — stay inert
 * outside an interaction. Per-context defaults (item is `'grid'`) only take
 * effect once a tool is armed or an interaction begins; otherwise the item
 * default would light up the snap grid at idle.
 */
export declare function getActiveSnappingMode(): SnappingMode;
export default useEditor;
//# sourceMappingURL=use-editor.d.ts.map