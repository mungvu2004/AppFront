import { type AnyNode, type AnyNodeId, type CabinetModuleNode, type CabinetNode, type SceneApi } from '@pascal-app/core';
/**
 * Kind-owned cabinet run mutations, shared by the properties panel, the
 * quick-action menu, and the placement tool. Everything routes through
 * `SceneApi` so each caller (panel with `useScene`, actions with the
 * registry's api) gets identical behavior — these used to be copy-pasted
 * per surface and had already drifted (gap checks, hood support, revision
 * scope).
 */
export declare const CABINET_BASE_WIDTH = 0.5;
export declare const CABINET_WALL_DEPTH = 0.32;
export declare const CABINET_BASE_DEPTH: 0.6;
export declare const CABINET_WALL_CARCASS_HEIGHT: 0.8;
export declare const CABINET_TALL_DEPTH: 0.6;
export declare const CABINET_TALL_PLINTH_HEIGHT: 0.1;
export declare const CABINET_TALL_CARCASS_HEIGHT = 2.07;
export declare const CABINET_EDGE_EPSILON = 0.0001;
export type CabinetEditableNode = CabinetNode | CabinetModuleNode;
type CornerSide = 'left' | 'right';
export type WallCornerDepthIndex = ReadonlyArray<{
    baseLegRunId?: AnyNodeId;
    bridgeRunId?: AnyNodeId;
    side: CornerSide;
    sourceModuleId: AnyNodeId;
    sourceRunId: AnyNodeId;
    turnSide: CornerSide;
    wallLegRunId: AnyNodeId;
}>;
export type CabinetRunStylePatch = Pick<Partial<CabinetNode>, 'frontStyle' | 'frontOverlay' | 'handleStyle' | 'handlePosition' | 'frontGap'>;
export declare function cabinetMetadataRecord(metadata: CabinetEditableNode['metadata']): Record<string, unknown>;
export declare function buildWallCornerDepthIndex(nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>): WallCornerDepthIndex;
/**
 * Deleting one member of an L-corner group removes ONLY that node (plus its
 * normal descendants) — never the other corner runs. These patches keep the
 * metadata links consistent afterwards:
 *  - deleting a derived leg run → drop its id from the source module's
 *    `cabinetCornerSourceLink.linkedRunIds` (drop the link when empty);
 *  - deleting the source module → strip `cabinetCornerDerivedRun` from the
 *    surviving legs so they become plain independent runs.
 * Patches targeting nodes that are also being deleted are skipped by the
 * store, so deleting the whole source run (subtree cascade) stays clean.
 */
export declare function cabinetCornerUnlinkPatchesOnDelete(node: CabinetNode | CabinetModuleNode, nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>): Array<{
    id: AnyNodeId;
    data: Partial<AnyNode>;
}>;
/**
 * A cabinet run is a grouping container — once its last child is deleted
 * the empty run must go too, so no orphan group lingers in the scene graph
 * or the persisted data. Children may be modules or derived corner leg
 * runs (which position themselves relative to the run). Hosted assets do not
 * keep an empty run alive. `pendingDeleteIds` covers multi-select deletes:
 * siblings already part of the same gesture count as gone.
 */
export declare function cabinetEmptyRunCascadeDeleteIds(node: CabinetEditableNode, nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>, pendingDeleteIds: ReadonlySet<AnyNodeId>): AnyNodeId[];
/**
 * Bump the run's layout revision — the geometryKey input that forces its
 * composite geometry (spans, countertop, plinth) to re-flow when a child
 * module changes in a way the run's own fields don't capture. Sibling runs
 * are re-keyed separately by the adjacency watcher in `system.tsx`, so no
 * level-wide sweep is needed here.
 */
export declare function bumpCabinetRunLayoutRevision(sceneApi: SceneApi, run: CabinetNode): void;
export declare function runModuleBaseY(run: Pick<CabinetNode, 'showPlinth' | 'plinthHeight'>): number;
export declare function totalCabinetHeight(node: Pick<CabinetEditableNode, 'showPlinth' | 'plinthHeight' | 'carcassHeight' | 'withCountertop' | 'countertopThickness'>): number;
export declare function cabinetModuleTotalHeight(node: CabinetModuleNode): number;
/** Y where a wall cabinet's bottom lands so its top aligns with a tall unit's top. */
export declare function wallBottomHeightForTallAlignment(): number;
/** Resolve the remaining vertical space above a wall/tall module. */
export declare function cabinetCeilingGap(node: CabinetModuleNode, nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>): number;
/** Resolve how far a module's carcass and top finish extend above the ceiling. */
export declare function cabinetModuleCeilingOverflow(node: CabinetModuleNode, nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>): number;
/** Local Z offset that makes a shallower wall cabinet's back flush with its deeper base. */
export declare function backAlignZ(baseDepth: number, wallDepth: number): number;
export declare function wallChildOf(module: CabinetModuleNode, nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>): CabinetModuleNode | null;
export declare function nestedCornerRunPositionOverrides(module: CabinetModuleNode, nextPosition: CabinetModuleNode['position'], nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>): ReadonlyArray<readonly [AnyNodeId, Partial<AnyNode>]>;
export declare function applyCabinetModuleFrontPatch({ module, patch, sceneApi, }: {
    module: CabinetModuleNode;
    patch: CabinetRunStylePatch;
    sceneApi: SceneApi;
}): void;
export declare function resolveCabinetType(module: CabinetModuleNode, run?: CabinetNode): 'base' | 'tall';
export declare function cabinetModulesForRun(run: CabinetNode, nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>): CabinetModuleNode[];
export declare function cabinetModuleCanEqualizeWidth(module: CabinetModuleNode, run: CabinetNode): boolean;
export declare function cabinetRunWidthEqualizationPlan(run: CabinetNode, nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>): import("./run-layout").RunModuleWidthEqualizationPlan<{
    object: "node";
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    position: [number, number, number];
    rotation: number;
    width: number;
    depth: number;
    carcassHeight: number;
    operationState: number;
    plinthHeight: number;
    toeKickDepth: number;
    boardThickness: number;
    countertopThickness: number;
    countertopOverhang: number;
    countertopBackOverhang: number;
    withFinishedBack: boolean;
    frontThickness: number;
    frontGap: number;
    frontStyle: "slab" | "shaker" | "raised-arch";
    panelReady: boolean;
    handleStyle: "none" | "bar" | "cutout" | "hole" | "knob";
    handlePosition: "center" | "top" | "auto";
    frontOverlay: "inset" | "full";
    withBottomPanel: boolean;
    showPlinth: boolean;
    withCountertop: boolean;
    id: `cabinet-module_${string}`;
    type: "cabinet-module";
    children: string[];
    cabinetType: "base" | "tall";
    moduleKind: "standard" | "corner-filler";
    topFinish: "trim" | "none" | "top-cabinet";
    topFinishHeight: number;
    topFinishDepth: number;
    name?: string | undefined;
    camera?: {
        position: [number, number, number];
        target: [number, number, number];
        mode: "perspective" | "orthographic";
        fov?: number | undefined;
        zoom?: number | undefined;
    } | undefined;
    provenance?: {
        refs: {
            id: string;
            ns?: string | undefined;
            role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
        }[];
        lineage?: {
            op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
            fromIds: string[];
        } | undefined;
    } | undefined;
    supportSlabId?: string | undefined;
    material?: {
        id?: string | undefined;
        preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
        properties?: {
            color: string;
            roughness: number;
            metalness: number;
            opacity: number;
            transparent: boolean;
            side: "front" | "back" | "double";
        } | undefined;
        texture?: {
            url: string;
            repeat?: [number, number] | undefined;
            scale?: number | undefined;
        } | undefined;
    } | undefined;
    materialPreset?: string | undefined;
    slots?: Record<string, string> | undefined;
    stack?: ({
        type: "shelf";
        id: string;
        shelfCount?: number | undefined;
        height?: number | undefined;
    } | {
        type: "drawer";
        id: string;
        drawerCount?: number | undefined;
        height?: number | undefined;
    } | {
        type: "door";
        id: string;
        doorType?: "glass" | "double" | "single-left" | "single-right" | undefined;
        shelfCount?: number | undefined;
        height?: number | undefined;
    } | {
        type: "sink";
        id: string;
        sinkLayout?: "single" | "double" | "double-offset" | undefined;
        height?: number | undefined;
    } | {
        type: "oven";
        id: string;
        height?: number | undefined;
    } | {
        type: "microwave";
        id: string;
        height?: number | undefined;
    } | {
        type: "dishwasher";
        id: string;
        height?: number | undefined;
    } | {
        type: "cooktop-gas";
        id: string;
        cooktopLayout?: "gas-2burner" | "gas-4burner" | "gas-5burner-wok" | "gas-6burner" | undefined;
        cooktopBurnersOn?: boolean | undefined;
        cooktopActiveBurners?: number[] | undefined;
        cooktopKnobProgress?: number[] | undefined;
        cooktopShowGrate?: boolean | undefined;
        height?: number | undefined;
    } | {
        type: "cooktop-induction";
        id: string;
        cooktopLayout?: "induction-2zone" | "induction-4zone" | undefined;
        cooktopBurnersOn?: boolean | undefined;
        cooktopActiveBurners?: number[] | undefined;
        cooktopKnobProgress?: number[] | undefined;
        cooktopShowGrate?: boolean | undefined;
        height?: number | undefined;
    } | {
        type: "pull-out-pantry";
        id: string;
        shelfCount?: number | undefined;
        pantryRackStyle?: "glass" | "wire" | "tray" | undefined;
        height?: number | undefined;
    } | {
        type: "fridge-single";
        id: string;
        height?: number | undefined;
    } | {
        type: "fridge-double";
        id: string;
        height?: number | undefined;
    } | {
        type: "fridge-top-freezer";
        id: string;
        height?: number | undefined;
    } | {
        type: "fridge-bottom-freezer";
        id: string;
        height?: number | undefined;
    } | {
        type: "hood-pyramid";
        id: string;
        height?: number | undefined;
    } | {
        type: "hood-curved-glass";
        id: string;
        height?: number | undefined;
    })[] | undefined;
    openSide?: "left" | "right" | undefined;
    cornerShelf?: boolean | undefined;
}>;
export declare function equalizeCabinetRunWidths({ run, sceneApi, }: {
    run: CabinetNode;
    sceneApi: SceneApi;
}): boolean;
export type CabinetRunArrayDirection = 'left' | 'right';
export type CabinetRunArrayPlan = {
    ok: true;
    sourceModuleId: AnyNodeId;
    positions: CabinetModuleNode['position'][];
} | {
    ok: false;
    reason: 'no-source' | 'invalid-options' | 'no-space';
};
export declare function cabinetRunArrayPlan(run: CabinetNode, nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>, options: {
    sourceModuleId: AnyNodeId | null;
    copyCount: number;
    spacing: number;
    direction: CabinetRunArrayDirection;
}): CabinetRunArrayPlan;
export declare function duplicateCabinetModuleAlongRun({ run, sceneApi, sourceModuleId, copyCount, spacing, direction, }: {
    run: CabinetNode;
    sceneApi: SceneApi;
    sourceModuleId: AnyNodeId | null;
    copyCount: number;
    spacing: number;
    direction: CabinetRunArrayDirection;
}): AnyNodeId[] | null;
export declare function backAlignedRunDepthOverrides(run: CabinetNode, nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>, depth: number): ReadonlyArray<readonly [AnyNodeId, Partial<AnyNode>]>;
export declare function wallCornerWidthOverridesForDepthTargets({ clampWidths, cornerIndex, depth, nodes, targets, widthMode, }: {
    clampWidths?: boolean;
    cornerIndex?: WallCornerDepthIndex;
    depth: number;
    nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>;
    targets: readonly CabinetEditableNode[];
    widthMode?: 'bridge' | 'corner-pair';
}): ReadonlyArray<readonly [AnyNodeId, Partial<AnyNode>]>;
export declare function cornerSourceWidthOverridesForDerivedDepth(run: CabinetNode, nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>, depth: number): ReadonlyArray<readonly [AnyNodeId, Partial<AnyNode>]>;
export declare function cornerSourceModulesForRun(run: CabinetNode, nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>): CabinetModuleNode[];
export declare function cornerPinnedEndsForRun(modules: readonly CabinetModuleNode[]): Partial<Record<'left' | 'right', boolean>>;
export declare function cornerLinkedSourceModuleForRun(run: CabinetNode, nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>): CabinetModuleNode | null;
export declare function cornerStyleSourceForRun(run: CabinetNode, nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>): {
    module: CabinetModuleNode;
    run: CabinetNode;
} | null;
export declare function syncCornerStyleGroupFromRun({ run, patch, sceneApi, }: {
    run: CabinetNode;
    patch: CabinetRunStylePatch;
    sceneApi: SceneApi;
}): boolean;
export declare function previewCornerAdditionLayout({ module, run, nodes, side, }: {
    module: CabinetModuleNode;
    run: CabinetNode;
    nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>;
    side: CornerSide;
}): {
    connectedWidth: number;
    sourceWidth: number;
} | null;
type CornerBaseLayout = 'full' | 'width-only' | 'preserve-connected-widths';
export declare function syncCornerRunsFromSourceModule({ baseLayout, module, previousModule, run, sceneApi, }: {
    baseLayout?: CornerBaseLayout;
    module: CabinetModuleNode;
    previousModule?: CabinetModuleNode;
    run: CabinetNode;
    sceneApi: SceneApi;
}): void;
export declare function syncCornerRunsFromRunSources({ baseLayout, previousModules, run, sceneApi, }: {
    baseLayout?: CornerBaseLayout;
    previousModules?: readonly CabinetModuleNode[];
    run: CabinetNode;
    sceneApi: SceneApi;
}): void;
export declare function previewCornerRunsFromRunSources({ baseLayout, initialOverrides, previousModules, run, sceneApi, }: {
    baseLayout?: CornerBaseLayout;
    initialOverrides?: ReadonlyArray<readonly [AnyNodeId, Partial<AnyNode>]>;
    previousModules?: readonly CabinetModuleNode[];
    run: CabinetNode;
    sceneApi: SceneApi;
}): ReadonlyArray<readonly [AnyNodeId, Partial<AnyNode>]>;
/**
 * Insert a new base module flush against the anchor's side (or the run's
 * outer edge with no anchor). A full run is reflowed when the anchor has a
 * flush neighbor, subject to wall and filler capacity.
 */
export declare function planCabinetModuleSideAddition({ anchorModule, nodes, run, side, }: {
    anchorModule: CabinetModuleNode | null;
    nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>;
    run: CabinetNode;
    side: 'left' | 'right';
}): CabinetModuleNode | null;
export declare function addCabinetModuleSide({ anchorModule, run, sceneApi, side, }: {
    anchorModule: CabinetModuleNode | null;
    run: CabinetNode;
    sceneApi: SceneApi;
    side: 'left' | 'right';
}): AnyNodeId | null;
/**
 * Spawn an L corner off one open end of a base run: a perpendicular base leg
 * with a corner pocket filler plus cabinet, a matching wall leg, and a short
 * wall bridge above the source run's corner cabinet so the top corner doesn't
 * read empty.
 */
export declare function addCornerRun({ module, run, sceneApi, side, }: {
    module: CabinetModuleNode;
    run: CabinetNode;
    sceneApi: SceneApi;
    side: 'left' | 'right';
}): AnyNodeId | null;
export declare function wallChildAdditionOverlaps(module: CabinetModuleNode, run: CabinetNode, nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>, { depth, offsetX, }?: {
    depth?: number;
    offsetX?: number;
}): boolean;
/**
 * Nest a wall cabinet (or chimney hood) above a base module. Returns the new
 * node id, or null when the module already carries one / isn't a base unit.
 */
export declare function addWallChildAbove({ kind, module, run, sceneApi, openSide, frontOverlay, offsetX, wallDepth, }: {
    kind: 'cabinet' | 'hood';
    module: CabinetModuleNode;
    run: CabinetNode;
    sceneApi: SceneApi;
    openSide?: CabinetModuleNode['openSide'];
    frontOverlay?: CabinetModuleNode['frontOverlay'];
    offsetX?: number;
    wallDepth?: number;
}): AnyNodeId | null;
/** Convert a base module to a tall unit (deletes any nested wall cabinet). */
export declare function switchCabinetToTall({ module, run, sceneApi, }: {
    module: CabinetModuleNode;
    run: CabinetNode;
    sceneApi: SceneApi;
}): boolean;
/** Convert a tall module back to a base unit matching the run's dimensions. */
export declare function switchCabinetToBase({ module, run, sceneApi, }: {
    module: CabinetModuleNode;
    run: CabinetNode;
    sceneApi: SceneApi;
}): boolean;
export {};
//# sourceMappingURL=run-ops.d.ts.map