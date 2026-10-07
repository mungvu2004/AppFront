import type { AnyNode, AnyNodeId, LevelNode, SlabNode } from '../../schema/index.js';
export declare function resolveLevelId(node: AnyNode, nodes: Record<string, AnyNode>): string;
/**
 * Walks the parent chain of `nodeId` and returns the id of the first ancestor
 * whose `type` is `'level'`, or `null` when no level ancestor exists (orphaned
 * node, top-level building node, etc.). Unlike `resolveLevelId`, this variant:
 *
 * - accepts a node **id** rather than a resolved node, saving the caller a
 *   `nodes[id]` lookup when only the id is at hand.
 * - returns `null` instead of the `'default'` fallback, which lets callers
 *   distinguish "genuinely has no level" from "is a level".
 * - has a loop guard (16 iterations) so a corrupt parent-chain cycle cannot
 *   hang the frame loop.
 */
export declare function findLevelAncestorId(nodeId: AnyNodeId, nodes: Record<string, AnyNode>): string | null;
/**
 * Returns the building id that contains the given level, or `null` if
 * the level is unparented or no enclosing building exists.
 *
 * Most scenes record the relationship via `level.parentId →
 * building.id`, but older serialisations occasionally drop `parentId`
 * even though the building's `children` array still references the
 * level. The fallback scan covers that case.
 *
 * Used by `FloorplanRegistryLayer` to discover building-scoped kinds
 * (`def.floorplanScope === 'building'`) without hardcoding any kind
 * name in the editor layer.
 */
export declare function resolveBuildingForLevel(levelId: AnyNodeId, nodes: Record<AnyNodeId, AnyNode>): AnyNodeId | null;
export declare function initSpatialGridSync(): () => void;
/**
 * Bulk slab-change guard. A scene load, reload, paste or import changes tens to
 * thousands of slabs in one store write, and scanning every node twice per slab
 * is O(slabs × nodes): a 4,600-slab scene blocked the main thread for ~5 s on
 * every load. When at least this many slabs are added, removed or reshaped in
 * one write, `markAllSlabDependents` dirties every node any slab could affect,
 * once, and the per-slab scans are skipped. The marks are a superset of the
 * per-slab result — and `setScene` marks every node dirty right after `set()`
 * regardless — so load-time behaviour is unchanged; the saving is the scans.
 */
export declare const BULK_SLAB_CHANGE_THRESHOLD = 32;
export declare function countBulkSlabChanges(nodes: Record<string, AnyNode>, prevNodes: Record<string, AnyNode>): number;
/**
 * Every node a slab change can dirty, without looking at any slab: walls and
 * ceilings (overlap and covering-below rules), stairs (deck attachment) and
 * level-hosted floor-placed kinds (the generic re-elevation sweep).
 */
export declare function markAllSlabDependents(nodes: Record<string, AnyNode>, markDirty: (id: AnyNodeId) => void): void;
/**
 * A level's stored height moved: plane-bound walls follow the new plane,
 * stair rise re-derives, and ceilings/fences re-resolve their clamp — mark
 * them all so their systems rebuild. Restacking the level containers alone
 * leaves their geometry stale.
 */
export declare function markLevelHeightDependents(level: LevelNode, nodes: Record<string, AnyNode>, markDirty: (id: AnyNodeId) => void): void;
/**
 * A deck slab's walking surface moved: stairs attached to it via
 * `deckSlabId` derive their rise from that elevation, so their geometry
 * (and rise-derived affordances) must rebuild.
 */
export declare function markDeckAttachedStairs(slabId: string, nodes: Record<string, AnyNode>, markDirty: (id: AnyNodeId) => void): void;
/**
 * Dirty every consumer of a slab's top or underside. Kept pure so committed
 * scene writes and live handle previews use the same dependency boundary.
 */
export declare function markSlabChangeDependents(previous: SlabNode, next: SlabNode, nodes: Record<string, AnyNode>, markDirty: (id: AnyNodeId) => void, previousNodes?: Record<string, {
    object: "node";
    id: `site_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    polygon: {
        type: "polygon";
        points: [number, number][];
    };
    children: string[];
    type: "site";
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
    terrain?: {
        type: "heightfield";
        origin: [number, number];
        spacing: number;
        cols: number;
        rows: number;
        step: number;
        heights: string;
    } | undefined;
    address?: {
        street?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zip?: string | undefined;
    } | undefined;
    parcel?: {
        apn?: string | undefined;
        source?: string | undefined;
        county?: string | undefined;
        state?: string | undefined;
        lotAreaSqFt?: number | undefined;
        originLngLat?: [number, number] | undefined;
        resolvedAt?: string | undefined;
        layer?: string | undefined;
        notes?: string[] | undefined;
    } | undefined;
    setbacks?: {
        front: number;
        side: number;
        rear: number;
        left?: number | undefined;
        right?: number | undefined;
        streetSide?: number | undefined;
    } | undefined;
    setbacksSource?: string | undefined;
    zone?: string | undefined;
    frontEdge?: number | undefined;
    streetEdges?: number[] | undefined;
    sightTriangleFt?: number | undefined;
    northRotation?: number | undefined;
    dossier?: {
        [x: string]: unknown;
        provider: string;
        asOf: string;
        sections: Record<string, {
            [x: string]: unknown;
            status: string;
            summary?: string | undefined;
            reason?: string | undefined;
            source?: {
                name?: string | undefined;
                kind?: string | undefined;
                vintage?: string | undefined;
                attribution?: string | undefined;
            } | undefined;
        }>;
        point?: {
            lat?: number | undefined;
            lng?: number | undefined;
            source?: string | undefined;
        } | undefined;
        address?: {
            formatted?: string | undefined;
            precision?: string | undefined;
        } | undefined;
        parcel?: Record<string, unknown> | undefined;
        flood?: Record<string, unknown> | undefined;
        codeBasis?: Record<string, unknown> | undefined;
        zoning?: Record<string, unknown> | undefined;
        utilities?: Record<string, unknown> | undefined;
        soils?: Record<string, unknown> | undefined;
        wetlands?: Record<string, unknown> | undefined;
        structures?: Record<string, unknown> | undefined;
        elevation?: Record<string, unknown> | undefined;
        boundaries?: Record<string, unknown> | undefined;
    } | undefined;
    contourIntervalIn?: number | undefined;
    contours3d?: boolean | undefined;
    terrainContours?: {
        datum: string;
        intervalFt: number;
        lines: {
            elevationFt: number;
            points: [number, number][];
        }[];
        source?: string | undefined;
    } | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `building_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    rotation: [number, number, number];
    children: (`elevator_${string}` | `level_${string}` | `unit_${string}`)[];
    type: "building";
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
} | {
    object: "node";
    position: [number, number, number];
    id: `elevator_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    depth: number;
    rotation: number;
    width: number;
    shaftWallThickness: number;
    shaftStyle: "glass" | "solid";
    cabHeight: number;
    doorWidth: number;
    doorHeight: number;
    doorStyle: "center-opening" | "single-left" | "single-right";
    doorPanelStyle: "glass-frame" | "solid-panel" | "segmented-panel";
    fromLevelId: string | null;
    toLevelId: string | null;
    disabledLevelIds: string[];
    serviceOnlyLevelIds: string[];
    defaultLevelId: string | null;
    speed: number;
    doorDurationMs: number;
    dwellMs: number;
    type: "elevator";
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
    slots?: Record<string, string> | undefined;
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
    shaftWidth?: number | undefined;
    shaftDepth?: number | undefined;
    servedLevelIds?: string[] | undefined;
} | {
    object: "node";
    id: `unit_${string}`;
    name: string;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    kind: "apartment" | "hotel-room" | "commercial" | "common";
    color: string;
    members: `zone_${string}`[];
    type: "unit";
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
} | {
    object: "node";
    id: `level_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    children: (`block_${string}` | `ceiling_${string}` | `item_${string}` | `procedural-item_${string}` | `column_${string}` | `construction-dimension_${string}` | `wall_${string}` | `roof_${string}` | `slab_${string}` | `fence_${string}` | `structural-grid_${string}` | `imesh_${string}` | `zone_${string}` | `stair_${string}` | `scan_${string}` | `guide_${string}` | `measurement_${string}` | `spawn_${string}` | `shelf_${string}` | `duct-segment_${string}` | `duct-fitting_${string}` | `duct-terminal_${string}` | `hvac-equipment_${string}` | `lineset_${string}` | `liquid-line_${string}` | `pipe-segment_${string}` | `pipe-fitting_${string}` | `pipe-trap_${string}`)[];
    level: number;
    baseElevation: number;
    type: "level";
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
    height?: number | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `leanto_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    rotation: [number, number, number];
    children: (`column_${string}` | `roof_${string}`)[];
    pitch: number;
    shingleThickness: number;
    canopyForm: "gable" | "mono" | "butterfly";
    hostKind: "wall" | "slab-edge" | "freestanding" | "conical-roof";
    hostHeightOffset: number;
    span: number;
    autoSpan: boolean;
    projection: number;
    highEdgeHeight: number;
    lowEdgeHeight: number;
    resizeLock: "preserve-high-edge" | "preserve-low-edge" | "preserve-pitch";
    leftEndCondition: "open" | "wall-abutment" | "joined";
    rightEndCondition: "open" | "wall-abutment" | "joined";
    autoMiterCorners: boolean;
    sideFlashing: boolean;
    flashingProjection: number;
    flashingHeight: number;
    highSideMode: "wall-ledger" | "independent-high-beam";
    ledgerVerticalOffset: number;
    lowBeamInset: number;
    gutterEnabled: boolean;
    gutterProfile: "box" | "k-style" | "half-round";
    gutterSize: number;
    downspoutEnabled: boolean;
    downspoutPosition: number;
    connectionMode: "manual" | "auto";
    connectionOffset: number;
    connectionInset: number;
    matchHostRoofMaterial: boolean;
    matchHostRoofStructure: boolean;
    roofThickness: number;
    highOverhang: number;
    lowOverhang: number;
    leftOverhang: number;
    rightOverhang: number;
    coveringType: "generic" | "shingle" | "metal-panel";
    beamWidth: number;
    beamHeight: number;
    ledgerDepth: number;
    ledgerHeight: number;
    rafterWidth: number;
    rafterHeight: number;
    rafterSpacing: number;
    rafterEndInset: number;
    framingStrategy: "hidden" | "rafters" | "purlins" | "covering-specific";
    purlinWidth: number;
    purlinHeight: number;
    purlinSpacing: number;
    postWidth: number;
    postDepth: number;
    postCount: number;
    postLayoutMode: "count" | "target-spacing";
    postSpacing: number;
    postInset: number;
    omittedPostSlots: {
        side: "low" | "high";
        index: number;
        layoutCount: number;
    }[];
    postBracing: "none" | "knee";
    footingStyle: "none" | "base-plate" | "concrete-pad";
    type: "lean-to-extension";
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
    slots?: Record<string, string> | undefined;
    hostSlabId?: `slab_${string}` | undefined;
    hostSlabEdgeIndex?: number | undefined;
    hostSlabEdgeT?: number | undefined;
    spanArcCenterZ?: number | undefined;
    spanArcRadius?: number | undefined;
    hostRoofId?: `roof_${string}` | undefined;
    hostRoofSegmentId?: string | undefined;
    hostRoofEdge?: "+X" | "-X" | "+Z" | "-Z" | undefined;
    hostRoofEdgeRange?: [number, number] | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `column_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    radius: number;
    depth: number;
    rotation: number;
    children: string[];
    width: number;
    height: number;
    baseHeight: number;
    style: "plain" | "faceted" | "fluted" | "lathe-turned" | "dravidian-carved" | "cluster";
    crossSection: "round" | "square" | "rectangular" | "octagonal" | "sixteen-sided";
    edgeSoftness: number;
    capitalHeight: number;
    shaftProfile: "straight" | "tapered" | "bulged" | "baluster" | "hourglass";
    shaftTaper: number;
    shaftBulge: number;
    shaftStartScale: number;
    shaftEndScale: number;
    shaftSegmentCount: number;
    shaftTwistStep: number;
    shaftCornerRadius: number;
    shaftDetail: "fluted" | "lathe-turned" | "none" | "spiral" | "panelled";
    baseStyle: "none" | "simple-square" | "round-rings" | "square-plinth" | "stepped-square" | "lotus" | "ribbed-lotus" | "panelled-pedestal";
    baseWidthScale: number;
    baseDepthScale: number;
    baseTierCount: number;
    baseStepSpread: number;
    basePlinthHeightRatio: number;
    baseRoundBandScale: number;
    baseNeckScale: number;
    baseRoundBandCount: number;
    baseRibCount: number;
    baseCarvingLevel: number;
    basePanelInset: number;
    capitalStyle: "none" | "simple" | "simple-slab" | "rounded" | "stepped" | "doric" | "volute" | "ionic-volute" | "leaf-carved" | "corinthian-leaf" | "south-indian-bracket" | "wood-bracket";
    capitalWidthScale: number;
    capitalDepthScale: number;
    capitalTierCount: number;
    capitalStepSpread: number;
    capitalBandCount: number;
    voluteSize: number;
    voluteCount: number;
    leafCount: number;
    leafRows: number;
    bracketDepth: number;
    bracketTierCount: number;
    pendantCount: number;
    capitalCarvingLevel: number;
    ringCount: number;
    ringPlacement: "top" | "ends" | "even" | "bottom";
    ringThickness: number;
    ringSpread: number;
    fluteCount: number;
    fluteDepth: number;
    fluteWidth: number;
    spiralTwist: number;
    spiralRibCount: number;
    panelCount: number;
    panelInsetDepth: number;
    panelShape: "rectangle" | "arched" | "diamond";
    latheRingCount: number;
    latheRingSpacing: "top" | "ends" | "even" | "bottom";
    carvingLevel: number;
    carvingPlacement: "base" | "shaft" | "capital" | "all";
    lowerBandEnabled: boolean;
    lowerBandHeight: number;
    lowerBandCarvingLevel: number;
    dentilCount: number;
    beadCount: number;
    supportStyle: "vertical" | "a-frame" | "y-frame" | "v-frame" | "x-brace" | "k-brace" | "single-strut" | "tripod" | "trestle" | "portal-frame" | "box-frame";
    braceWidth: number;
    braceDepth: number;
    braceBottomSpread: number;
    braceTopSpread: number;
    bracePlateEnabled: boolean;
    type: "column";
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
    slots?: Record<string, string> | undefined;
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
} | {
    object: "node";
    mode: "radius" | "linear" | "diameter" | "center-mark" | "chord" | "arc-length" | "angular" | "coordinate";
    id: `construction-dimension_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    anchors: ([number, number, number] | {
        kind: "feature";
        reference: {
            nodeId: string;
            featureId: string;
            parameters?: Record<string, string | number | boolean> | undefined;
        };
        fallback: [number, number, number];
    })[];
    baseline: {
        origin: [number, number];
        direction: [number, number];
    };
    chainMode: "point-to-point" | "continuous";
    featureCount: number;
    showCenterMark: boolean;
    prefix: string;
    suffix: string;
    textOverride: string | null;
    datumPolicy: "centerline" | "wall-face" | "structural-face" | "finish-face";
    terminator: "architectural-tick" | "filled-arrow" | "open-arrow" | "dot";
    textPosition: "above" | "centered";
    imperialPrecision: "1" | "1/2" | "1/4" | "1/8" | "1/16";
    metricNotation: "meters" | "millimeters";
    extensionStartGap: number;
    extensionOvershoot: number;
    drawingType: "floor-plan" | "foundation-plan" | "reflected-ceiling-plan" | "roof-plan" | "site-plan";
    drawingOverrides: {
        drawingType: "floor-plan" | "foundation-plan" | "reflected-ceiling-plan" | "roof-plan" | "site-plan";
        presentation: "shown" | "omit" | "controlled";
        suppressedSegmentIndexes: number[];
    }[];
    controllingDimensionId: `construction-dimension_${string}` | null;
    type: "construction-dimension";
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
} | {
    object: "node";
    position: [number, number, number];
    id: `block_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    rotation: number;
    children: string[];
    topology: {
        vertices: {
            id: string;
            position: [number, number, number];
        }[];
        edges: {
            id: string;
            vertexIds: [string, string];
        }[];
        faces: {
            id: string;
            vertexIds: string[];
            materialSlot: string;
        }[];
    };
    slots: Record<string, string>;
    slotNames: Record<string, string>;
    type: "block";
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
} | {
    object: "node";
    id: `structural-grid_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    label: string;
    start: [number, number];
    end: [number, number];
    showStartBubble: boolean;
    showEndBubble: boolean;
    type: "structural-grid";
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
} | {
    object: "node";
    id: `wall_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    children: (`item_${string}` | `procedural-item_${string}` | `door_${string}` | `window_${string}` | `leanto_${string}`)[];
    start: [number, number];
    end: [number, number];
    frontSide: "unknown" | "interior" | "exterior";
    backSide: "unknown" | "interior" | "exterior";
    type: "wall";
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
    slots?: Record<string, string> | undefined;
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
    height?: number | undefined;
    wallType?: "standard" | "curtain" | undefined;
    curtainWall?: {
        construction: "stick" | "unitized";
        framing: "capped" | "vertical-caps" | "horizontal-caps" | "structural-glazing";
        columns: {
            layout: "count" | "maximum-spacing" | "fixed-spacing";
            count: number;
            spacing: number;
            alignment: "center" | "start" | "end";
        };
        rows: {
            layout: "count" | "maximum-spacing" | "fixed-spacing";
            count: number;
            spacing: number;
            alignment: "center" | "start" | "end";
        };
        mullionWidth: number;
        transomWidth: number;
        perimeterWidth: number;
        jointWidth: number;
        glassThickness: number;
        panelType: "glass" | "solid" | "empty";
        spandrel: "top" | "none" | "bottom";
        frameColor: string;
        glassColor: string;
        solidColor: string;
        glassOpacity: number;
        glassRoughness: number;
        panels: {
            column: number;
            row: number;
            type: "glass" | "solid" | "empty";
        }[];
    } | undefined;
    thickness?: number | undefined;
    assembly?: {
        framing: {
            kind: "wood" | "lgs" | "cmu" | "icf";
            depth: number;
        };
        preset?: string | undefined;
        exterior?: {
            finish: "brick" | "none" | "siding" | "stucco" | "stone" | "fiber-cement";
            thickness: number;
        } | undefined;
        sheathing?: {
            material: "none" | "osb" | "plywood" | "gypsum";
            thickness: number;
        } | undefined;
        interior?: {
            finish: "plaster" | "none" | "drywall";
            thickness: number;
        } | undefined;
        cavityInsulation?: string | undefined;
    } | undefined;
    fillToTerrain?: boolean | undefined;
    interiorMaterial?: {
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
    interiorMaterialPreset?: string | undefined;
    exteriorMaterial?: {
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
    exteriorMaterialPreset?: string | undefined;
    curveOffset?: number | undefined;
    supportOffset?: number | undefined;
    underpinning?: {
        rim: number;
        stem: number;
        openings?: {
            u: number;
            width: number;
            top: number;
            bottom: number;
        }[] | undefined;
    } | undefined;
    faceBands?: {
        enabled: boolean;
        count: number;
        lowerHeight: number;
        middleHeight: number;
        upperHeight: number;
    } | undefined;
    skirting?: {
        enabled: boolean;
        sides: "interior" | "exterior" | "both";
        height: number;
        proud: number;
        profile: "flat" | "bevel" | "triangle" | "cove" | "bullnose" | "base-modern" | "base-colonial" | "base-shoe" | "base-ogee" | "crown-cove" | "crown-ogee" | "crown-craftsman" | "crown-layered" | "rail-rounded" | "rail-ogee" | "rail-picture" | "rail-stepped";
        offsetY?: number | undefined;
    } | undefined;
    crown?: {
        enabled: boolean;
        sides: "interior" | "exterior" | "both";
        height: number;
        proud: number;
        profile: "flat" | "bevel" | "triangle" | "cove" | "bullnose" | "base-modern" | "base-colonial" | "base-shoe" | "base-ogee" | "crown-cove" | "crown-ogee" | "crown-craftsman" | "crown-layered" | "rail-rounded" | "rail-ogee" | "rail-picture" | "rail-stepped";
        offsetY?: number | undefined;
    } | undefined;
    chairRail?: {
        enabled: boolean;
        sides: "interior" | "exterior" | "both";
        height: number;
        proud: number;
        profile: "flat" | "bevel" | "triangle" | "cove" | "bullnose" | "base-modern" | "base-colonial" | "base-shoe" | "base-ogee" | "crown-cove" | "crown-ogee" | "crown-craftsman" | "crown-layered" | "rail-rounded" | "rail-ogee" | "rail-picture" | "rail-stepped";
        offsetY?: number | undefined;
    } | undefined;
} | {
    object: "node";
    id: `fence_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    color: string;
    height: number;
    baseHeight: number;
    style: "slat" | "rail" | "privacy" | "horizontal" | "guard";
    baseStyle: "floating" | "grounded" | "raised";
    start: [number, number];
    end: [number, number];
    thickness: number;
    postSpacing: number;
    postSize: number;
    topRailHeight: number;
    groundClearance: number;
    edgeInset: number;
    slatGap: number;
    postCap: "flat" | "none" | "pyramid";
    showInfill: boolean;
    type: "fence";
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
    path?: [number, number][] | undefined;
    supportSlabId?: string | undefined;
    slots?: Record<string, string> | undefined;
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
    curveOffset?: number | undefined;
    supportOffset?: number | undefined;
    tangents?: ([number, number] | null)[] | undefined;
    guardInfill?: "balusters" | "cable" | "boards" | undefined;
    startPost?: boolean | undefined;
    endPost?: boolean | undefined;
    postThrough?: boolean | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `cabinet_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    depth: number;
    rotation: number;
    children: string[];
    width: number;
    operationState: number;
    runTier: "wall" | "base" | "tall";
    withWaterfall: boolean;
    withFinishedEnds: boolean;
    carcassHeight: number;
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
    type: "cabinet";
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
    slots?: Record<string, string> | undefined;
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
    barLedge?: {
        edge: "back" | "right" | "left";
        height: number;
        depth: number;
    } | undefined;
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
        sinkLayout?: "double" | "single" | "double-offset" | undefined;
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
} | {
    object: "node";
    position: [number, number, number];
    id: `cabinet-module_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    depth: number;
    rotation: number;
    children: string[];
    width: number;
    operationState: number;
    carcassHeight: number;
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
    cabinetType: "base" | "tall";
    moduleKind: "standard" | "corner-filler";
    topFinish: "trim" | "none" | "top-cabinet";
    topFinishHeight: number;
    topFinishDepth: number;
    type: "cabinet-module";
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
    slots?: Record<string, string> | undefined;
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
        sinkLayout?: "double" | "single" | "double-offset" | undefined;
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
    openSide?: "right" | "left" | undefined;
    cornerShelf?: boolean | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `item_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    scale: [number, number, number];
    rotation: [number, number, number];
    children: string[];
    asset: {
        id: string;
        category: string;
        name: string;
        thumbnail: string;
        source: "library" | "community" | "mine";
        src: string;
        dimensions: [number, number, number];
        offset: [number, number, number];
        rotation: [number, number, number];
        scale: [number, number, number];
        floorPlanUrl?: string | undefined;
        isDraft?: boolean | undefined;
        attachTo?: "wall" | "ceiling" | "wall-side" | undefined;
        recessed?: boolean | undefined;
        tags?: string[] | undefined;
        functionTags?: string[] | undefined;
        surface?: {
            height: number;
        } | undefined;
        interactive?: {
            controls: ({
                kind: "toggle";
                label?: string | undefined;
                default?: boolean | undefined;
            } | {
                kind: "slider";
                label: string;
                min: number;
                max: number;
                step: number;
                displayMode: "slider" | "stepper" | "dial";
                unit?: string | undefined;
                default?: number | undefined;
            } | {
                kind: "temperature";
                label: string;
                min: number;
                max: number;
                unit: "C" | "F";
                default?: number | undefined;
            })[];
            effects: ({
                kind: "animation";
                clips: {
                    on?: string | undefined;
                    off?: string | undefined;
                    loop?: string | undefined;
                };
            } | {
                kind: "light";
                color: string;
                intensityRange: [number, number];
                offset: [number, number, number];
                distance?: number | undefined;
            })[];
        } | undefined;
    };
    type: "item";
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
    side?: "front" | "back" | undefined;
    supportSlabId?: string | undefined;
    slots?: Record<string, string> | undefined;
    roofSegmentId?: string | undefined;
    wallId?: string | undefined;
    wallT?: number | undefined;
    roofFace?: "front" | "back" | "right" | "left" | undefined;
    blockFaceId?: string | undefined;
    collectionIds?: `collection_${string}`[] | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `procedural-item_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    rotation: [number, number, number];
    children: string[];
    slots: Record<string, string>;
    parameters: Record<string, number>;
    recipe: {
        version: 1;
        name: string;
        description: string;
        parameters: {
            id: string;
            label: string;
            default: number;
            min: number;
            max: number;
            step: number;
            unit: "count" | "m" | "rad" | "s";
            part?: string | undefined;
            axis?: "x" | "y" | "z" | undefined;
        }[];
        slots: {
            id: string;
            label: string;
            color: string;
            finish?: "wood" | "glass" | "metal" | undefined;
        }[];
        parts: {
            id: string;
            label: string;
            count: import("../../procedural-items/index.js").Expr;
            shapes: {
                id: string;
                primitive: "box" | "roundedBox" | "cylinder" | "ellipsoid";
                slot: string;
                size: [import("../../procedural-items/index.js").Expr, import("../../procedural-items/index.js").Expr, import("../../procedural-items/index.js").Expr];
                position: [import("../../procedural-items/index.js").Expr, import("../../procedural-items/index.js").Expr, import("../../procedural-items/index.js").Expr];
                rotation?: [import("../../procedural-items/index.js").Expr, import("../../procedural-items/index.js").Expr, import("../../procedural-items/index.js").Expr] | undefined;
                radius?: import("../../procedural-items/index.js").Expr | undefined;
                topScale?: import("../../procedural-items/index.js").Expr | undefined;
                support?: boolean | undefined;
            }[];
            motion?: {
                kind: "hinge";
                pivot: [import("../../procedural-items/index.js").Expr, import("../../procedural-items/index.js").Expr, import("../../procedural-items/index.js").Expr];
                axis: "x" | "y" | "z";
                angle: import("../../procedural-items/index.js").Expr;
                delay?: import("../../procedural-items/index.js").Expr | undefined;
                duration?: import("../../procedural-items/index.js").Expr | undefined;
                easing?: "linear" | "smooth" | "soft" | undefined;
            } | {
                kind: "slide";
                axis: "x" | "y" | "z";
                distance: import("../../procedural-items/index.js").Expr;
                delay?: import("../../procedural-items/index.js").Expr | undefined;
                duration?: import("../../procedural-items/index.js").Expr | undefined;
                easing?: "linear" | "smooth" | "soft" | undefined;
            } | {
                kind: "spin";
                pivot: [import("../../procedural-items/index.js").Expr, import("../../procedural-items/index.js").Expr, import("../../procedural-items/index.js").Expr];
                axis: "x" | "y" | "z";
                radiansPerSecond: import("../../procedural-items/index.js").Expr;
            } | undefined;
            light?: {
                position: [import("../../procedural-items/index.js").Expr, import("../../procedural-items/index.js").Expr, import("../../procedural-items/index.js").Expr];
                color: string;
                intensity?: number | undefined;
                distance?: number | undefined;
                emissiveSlot?: string | undefined;
            } | undefined;
        }[];
        constraints: {
            left: import("../../procedural-items/index.js").Expr;
            relation: "lte" | "gte";
            right: import("../../procedural-items/index.js").Expr;
            message: string;
        }[];
        classification?: {
            category: string;
            functionTags: string[];
            tags: string[];
        } | undefined;
        mounting?: {
            attachTo: "ceiling" | "wall-side";
            reference: string;
        } | undefined;
        surfaces?: {
            id: string;
            label: string;
            position: [import("../../procedural-items/index.js").Expr, import("../../procedural-items/index.js").Expr, import("../../procedural-items/index.js").Expr];
            size: [import("../../procedural-items/index.js").Expr, import("../../procedural-items/index.js").Expr];
            part?: string | undefined;
            rotation?: [import("../../procedural-items/index.js").Expr, import("../../procedural-items/index.js").Expr, import("../../procedural-items/index.js").Expr] | undefined;
        }[] | undefined;
    };
    attachments: Record<string, string>;
    type: "procedural-item";
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
    side?: "front" | "back" | undefined;
    supportSlabId?: string | undefined;
    wallId?: string | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `imesh_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    rotation: [number, number, number];
    primitives: {
        positions: number[];
        indices: number[];
        color: string;
        opacity: number;
        normals?: number[] | undefined;
    }[];
    type: "imported-mesh";
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
} | {
    object: "node";
    id: `zone_${string}`;
    name: string;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    polygon: [number, number][];
    color: string;
    autoFromWalls: boolean;
    boundaryWallIds: `wall_${string}`[];
    spaceRole: "generic" | "room";
    roomNumber: string;
    enclosureStatus: "auto" | "open" | "enclosed";
    floorFinish: string;
    wallFinish: string;
    ceilingFinish: string;
    ceilingHeight: number;
    occupancy: string;
    clearDimensionPolicy: "none" | "inside-faces" | "finish-faces";
    type: "zone";
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
} | {
    object: "node";
    id: `slab_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    polygon: [number, number][];
    recessed: boolean;
    holes: [number, number][][];
    holeMetadata: {
        source: "stair" | "elevator" | "manual";
        stairId?: string | undefined;
        elevatorId?: string | undefined;
    }[];
    autoFromWalls: boolean;
    elevation: number;
    thickness: number;
    type: "slab";
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
    slots?: Record<string, string> | undefined;
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
    recessedRimElevation?: number | undefined;
    fillToTerrain?: boolean | undefined;
} | {
    object: "node";
    id: `ceiling_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    polygon: [number, number][];
    children: (`item_${string}` | `procedural-item_${string}`)[];
    holes: [number, number][][];
    holeMetadata: {
        source: "stair" | "elevator" | "manual";
        stairId?: string | undefined;
        elevatorId?: string | undefined;
    }[];
    autoFromWalls: boolean;
    type: "ceiling";
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
    slots?: Record<string, string> | undefined;
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
    height?: number | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `roof_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    rotation: number;
    children: `rseg_${string}`[];
    support: {
        kind: "level";
    } | {
        kind: "walls";
    } | {
        kind: "roof";
        roofSegmentId: `rseg_${string}`;
        localPosition: [number, number];
        curbHeight: number;
    };
    type: "roof";
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
    slots?: Record<string, string> | undefined;
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
    topMaterial?: {
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
    topMaterialPreset?: string | undefined;
    edgeMaterial?: {
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
    edgeMaterialPreset?: string | undefined;
    wallMaterial?: {
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
    wallMaterialPreset?: string | undefined;
    assembly?: {
        layers: {
            id: string;
            role: "fill" | "finish" | "lining" | "substrate" | "sheathing" | "membrane" | "underlay" | "insulation" | "air" | "furring" | "structure" | "deck" | "covering" | "shell" | "glazing";
            thickness: number;
            core?: true | undefined;
            material?: string | undefined;
            slot?: string | undefined;
            returns?: boolean | undefined;
            display?: "construction" | "finished" | undefined;
            inset?: number | undefined;
            bottom?: number | undefined;
            lift?: number | undefined;
            src?: string | undefined;
        }[];
        backing?: {
            id: string;
            role: "fill" | "finish" | "lining" | "substrate" | "sheathing" | "membrane" | "underlay" | "insulation" | "air" | "furring" | "structure" | "deck" | "covering" | "shell" | "glazing";
            thickness: number;
            core?: true | undefined;
            material?: string | undefined;
            slot?: string | undefined;
            returns?: boolean | undefined;
            display?: "construction" | "finished" | undefined;
            inset?: number | undefined;
            bottom?: number | undefined;
            lift?: number | undefined;
            src?: string | undefined;
        }[] | undefined;
        face?: "front" | "exterior" | undefined;
        presetId?: string | undefined;
        cavityInsulation?: string | undefined;
    } | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `rseg_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    depth: number;
    rotation: number;
    children: string[];
    trim: {
        left: number;
        right: number;
        front: number;
        back: number;
        frontLeft: number;
        frontRight: number;
        backLeft: number;
        backRight: number;
        frontLeftX: number;
        frontLeftZ: number;
        frontRightX: number;
        frontRightZ: number;
        backLeftX: number;
        backLeftZ: number;
        backRightX: number;
        backRightZ: number;
    };
    width: number;
    roofType: "flat" | "hip" | "gable" | "shed" | "gambrel" | "dutch" | "mansard" | "conical";
    wallHeight: number;
    pitch: number;
    wallThickness: number;
    deckThickness: number;
    overhang: number;
    shingleThickness: number;
    managedByParent: boolean;
    wallShell: "omit" | "auto" | "include";
    shedInsetEndPanels: boolean;
    gambrelLowerWidthRatio: number;
    gambrelLowerHeightRatio: number;
    mansardSteepWidthRatio: number;
    mansardSteepHeightRatio: number;
    dutchHipWidthRatio: number;
    dutchHipHeightRatio: number;
    dutchWaistLengthRatio: number;
    dutchGabletRake: number;
    dutchTopRakeThickness: number;
    type: "roof-segment";
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
    topMaterial?: {
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
    topMaterialPreset?: string | undefined;
    edgeMaterial?: {
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
    edgeMaterialPreset?: string | undefined;
    wallMaterial?: {
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
    wallMaterialPreset?: string | undefined;
    conicalStartAngle?: number | undefined;
    conicalSweepAngle?: number | undefined;
    conicalFullCircle?: boolean | undefined;
    arc?: {
        centerX: number;
        centerZ: number;
        radius: number;
    } | undefined;
    shedSideInfillSpan?: number | undefined;
    shedSideInfillMinX?: number | undefined;
    shedSideInfillMaxX?: number | undefined;
    shedFootprintPieces?: [number, number][][] | undefined;
    shedOpenEndSides?: ("right" | "left")[] | undefined;
    shedJointFrame?: {
        position: [number, number, number];
        rotation: number;
    } | undefined;
    shedJointOwnerId?: string | undefined;
    shedJointNeighborIds?: string[] | undefined;
    shedJointScopeId?: string | undefined;
    fascia?: boolean | undefined;
    fasciaHighEdge?: boolean | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `shelf_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    depth: number;
    rotation: [number, number, number];
    children: string[];
    width: number;
    height: number;
    style: "wall-shelf" | "bookshelf" | "open-rack" | "cubby";
    rows: number;
    columns: number;
    thickness: number;
    withBack: boolean;
    withSides: boolean;
    withBottom: boolean;
    bracketStyle: "hidden" | "minimal" | "industrial";
    type: "shelf";
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
    slots?: Record<string, string> | undefined;
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
} | {
    object: "node";
    position: [number, number, number];
    id: `stair_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    rotation: number;
    children: `sseg_${string}`[];
    width: number;
    fromLevelId: string | null;
    toLevelId: string | null;
    thickness: number;
    stairType: "straight" | "spiral" | "curved";
    slabOpeningMode: "none" | "destination";
    openingOffset: number;
    stepCount: number;
    fillToFloor: boolean;
    innerRadius: number;
    sweepAngle: number;
    topLandingMode: "none" | "integrated";
    topLandingDepth: number;
    showCenterColumn: boolean;
    showStepSupports: boolean;
    railingMode: "right" | "left" | "none" | "both";
    railingHeight: number;
    type: "stair";
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
    slots?: Record<string, string> | undefined;
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
    railingMaterial?: {
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
    railingMaterialPreset?: string | undefined;
    treadMaterial?: {
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
    treadMaterialPreset?: string | undefined;
    sideMaterial?: {
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
    sideMaterialPreset?: string | undefined;
    deckSlabId?: string | undefined;
    totalRise?: number | undefined;
    railingStyle?: "balusters" | "cable" | "boards" | "post-and-rail" | undefined;
    railingTopPost?: boolean | undefined;
    railingTopReach?: number | undefined;
    railingPostThrough?: boolean | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `sseg_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    length: number;
    rotation: number;
    width: number;
    height: number;
    thickness: number;
    stepCount: number;
    fillToFloor: boolean;
    segmentType: "stair" | "landing";
    attachmentSide: "front" | "right" | "left";
    type: "stair-segment";
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
} | {
    object: "node";
    position: [number, number, number];
    id: `scan_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    opacity: number;
    url: string | null;
    scale: number;
    rotation: [number, number, number];
    layers: Record<string, boolean>;
    captureSession: {
        sessionId: string;
        schemaVersion?: number | undefined;
        revisionId?: string | undefined;
        manifestUrl?: string | undefined;
    } | null;
    type: "scan";
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
} | {
    object: "node";
    position: [number, number, number];
    id: `guide_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    opacity: number;
    url: string;
    scale: number;
    rotation: [number, number, number];
    scaleReference: {
        start: [number, number];
        end: [number, number];
        realLengthMeters: number;
        measuredLengthUnits: number;
        metersPerUnit: number;
        label: string;
    } | null;
    type: "guide";
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
} | {
    object: "node";
    id: `measurement_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    measurement: {
        kind: "distance";
        points: [[number, number, number] | {
            kind: "feature";
            reference: {
                nodeId: string;
                featureId: string;
                parameters?: Record<string, string | number | boolean> | undefined;
            };
            fallback: [number, number, number];
        }, [number, number, number] | {
            kind: "feature";
            reference: {
                nodeId: string;
                featureId: string;
                parameters?: Record<string, string | number | boolean> | undefined;
            };
            fallback: [number, number, number];
        }];
    } | {
        kind: "angle";
        points: [[number, number, number] | {
            kind: "feature";
            reference: {
                nodeId: string;
                featureId: string;
                parameters?: Record<string, string | number | boolean> | undefined;
            };
            fallback: [number, number, number];
        }, [number, number, number] | {
            kind: "feature";
            reference: {
                nodeId: string;
                featureId: string;
                parameters?: Record<string, string | number | boolean> | undefined;
            };
            fallback: [number, number, number];
        }, [number, number, number] | {
            kind: "feature";
            reference: {
                nodeId: string;
                featureId: string;
                parameters?: Record<string, string | number | boolean> | undefined;
            };
            fallback: [number, number, number];
        }];
    } | {
        kind: "area";
        base: ([number, number, number] | {
            kind: "feature";
            reference: {
                nodeId: string;
                featureId: string;
                parameters?: Record<string, string | number | boolean> | undefined;
            };
            fallback: [number, number, number];
        })[];
    } | {
        kind: "perimeter";
        base: ([number, number, number] | {
            kind: "feature";
            reference: {
                nodeId: string;
                featureId: string;
                parameters?: Record<string, string | number | boolean> | undefined;
            };
            fallback: [number, number, number];
        })[];
    } | {
        kind: "volume";
        base: ([number, number, number] | {
            kind: "feature";
            reference: {
                nodeId: string;
                featureId: string;
                parameters?: Record<string, string | number | boolean> | undefined;
            };
            fallback: [number, number, number];
        })[];
        extrusion: [number, number, number];
    };
    type: "measurement";
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
} | {
    object: "node";
    position: [number, number, number];
    id: `spawn_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    rotation: number;
    type: "spawn";
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
} | {
    object: "node";
    position: [number, number, number];
    id: `window_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    rotation: [number, number, number];
    width: number;
    height: number;
    constructionType: "framed" | "masonry";
    dimensionReference: "nominal" | "rough-opening" | "masonry-opening" | "finish-opening";
    operationState: number;
    openingKind: "window" | "opening";
    openingShape: "rectangle" | "rounded" | "arch";
    openingRadiusMode: "all" | "individual";
    cornerRadius: number;
    archHeight: number;
    openingRevealRadius: number;
    frameThickness: number;
    frameDepth: number;
    hingesSide: "right" | "left";
    columnRatios: number[];
    windowType: "fixed" | "sliding" | "casement" | "awning" | "hopper" | "single-hung" | "double-hung" | "bay" | "bow" | "louvered";
    awningDirection: "up" | "down";
    casementStyle: "french" | "single";
    openingCornerRadii: [number, number, number, number];
    rowRatios: number[];
    columnDividerThickness: number;
    rowDividerThickness: number;
    sill: boolean;
    sillDepth: number;
    sillThickness: number;
    type: "window";
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
    side?: "front" | "back" | undefined;
    slots?: Record<string, string> | undefined;
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
    roofSegmentId?: string | undefined;
    wallId?: string | undefined;
    roofFace?: "front" | "back" | "right" | "left" | undefined;
    mark?: string | undefined;
    roughOpeningWidth?: number | undefined;
    roughOpeningHeight?: number | undefined;
    masonryOpeningWidth?: number | undefined;
    masonryOpeningHeight?: number | undefined;
    finishOpeningWidth?: number | undefined;
    finishOpeningHeight?: number | undefined;
    dormerId?: string | undefined;
    dormerFace?: "front" | "back" | "right" | "left" | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `door_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    rotation: [number, number, number];
    width: number;
    height: number;
    leafCount: 3 | 2 | 1 | 4;
    constructionType: "framed" | "masonry";
    dimensionReference: "nominal" | "rough-opening" | "masonry-opening" | "finish-opening";
    doorCategory: "interior" | "garage";
    doorType: "double" | "hinged" | "french" | "folding" | "pocket" | "barn" | "sliding" | "garage-sectional" | "garage-rollup" | "garage-tiltup";
    operationState: number;
    slideDirection: "right" | "left";
    trackStyle: "visible" | "none" | "pocket" | "overhead";
    garagePanelCount: number;
    openingKind: "door" | "opening";
    openingShape: "rectangle" | "rounded" | "arch";
    openingRadiusMode: "all" | "individual";
    openingTopRadii: [number, number];
    cornerRadius: number;
    archHeight: number;
    openingRevealRadius: number;
    frameThickness: number;
    frameDepth: number;
    threshold: boolean;
    thresholdHeight: number;
    hingesSide: "right" | "left";
    swingDirection: "inward" | "outward";
    swingAngle: number;
    segments: {
        type: "glass" | "empty" | "panel";
        heightRatio: number;
        columnRatios: number[];
        dividerThickness: number;
        panelDepth: number;
        panelInset: number;
    }[];
    handle: boolean;
    handleHeight: number;
    handleSide: "right" | "left";
    contentPadding: [number, number];
    doorCloser: boolean;
    panicBar: boolean;
    panicBarHeight: number;
    type: "door";
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
    side?: "front" | "back" | undefined;
    slots?: Record<string, string> | undefined;
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
    roofSegmentId?: string | undefined;
    wallId?: string | undefined;
    roofFace?: "front" | "back" | "right" | "left" | undefined;
    mark?: string | undefined;
    roughOpeningWidth?: number | undefined;
    roughOpeningHeight?: number | undefined;
    masonryOpeningWidth?: number | undefined;
    masonryOpeningHeight?: number | undefined;
    finishOpeningWidth?: number | undefined;
    finishOpeningHeight?: number | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `bvent_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    depth: number;
    rotation: number;
    materialPreset: string;
    width: number;
    height: number;
    hoodOverhang: number;
    topTaper: number;
    capHeight: number;
    capGap: number;
    domeCurvature: number;
    baseInset: number;
    baseHeight: number;
    cornerBevel: number;
    style: "box" | "cap" | "dome";
    type: "box-vent";
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
    slots?: Record<string, string> | undefined;
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
    roofSegmentId?: string | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `rvent_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    length: number;
    rotation: number;
    width: number;
    height: number;
    style: "metal" | "standard" | "shingled";
    endCaps: boolean;
    type: "ridge-vent";
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
    roofSegmentId?: string | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `tvent_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    rotation: number;
    materialPreset: string;
    height: number;
    style: "cylinder" | "globe";
    diameter: number;
    neckHeight: number;
    baseOverhang: number;
    vaneCount: number;
    spinSpeed: number;
    type: "turbine-vent";
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
    slots?: Record<string, string> | undefined;
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
    roofSegmentId?: string | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `cupola_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    depth: number;
    rotation: number;
    materialPreset: string;
    width: number;
    height: number;
    roofStyle: "dome" | "pyramid";
    finial: boolean;
    type: "cupola";
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
    slots?: Record<string, string> | undefined;
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
    roofSegmentId?: string | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `eyebrow-vent_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    depth: number;
    rotation: number;
    materialPreset: string;
    width: number;
    height: number;
    style: "half-round" | "scoop" | "slant-box";
    louverCount: number;
    backRatio: number;
    type: "eyebrow-vent";
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
    slots?: Record<string, string> | undefined;
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
    roofSegmentId?: string | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `gutter_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    length: number;
    rotation: number;
    materialPreset: string;
    thickness: number;
    profile: "box" | "k-style" | "half-round";
    size: number;
    hangerStyle: "none" | "strap";
    hangerSpacing: number;
    endCapLeft: boolean;
    endCapRight: boolean;
    outlets: {
        id: string;
        offset: number;
        diameter: number;
        generatedBy?: "default-downspout" | undefined;
    }[];
    type: "gutter";
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
    slots?: Record<string, string> | undefined;
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
    roofSegmentId?: string | undefined;
    arc?: {
        centerX: number;
        centerZ: number;
        radius: number;
    } | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `chimney_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    depth: number;
    rotation: number;
    width: number;
    cornerBevel: number;
    cap: boolean;
    panelDepth: number;
    panelHeight: number;
    bodyShape: "round" | "square";
    bodyHollowDepth: number;
    bodyHollowMargin: number;
    heightAboveRidge: number;
    cutoutOffset: number;
    capShape: "flat" | "none" | "stepped" | "sloped";
    capOverhang: number;
    capThickness: number;
    flueCount: number;
    flueShape: "round" | "square";
    flueHeight: number;
    flueDiameter: number;
    flueSpacing: number;
    flueWallThickness: number;
    shoulderStyle: "tapered" | "none" | "corbeled";
    shoulderHeight: number;
    shoulderExtent: number;
    bandStyle: "double" | "none" | "single";
    bandHeight: number;
    bandExtent: number;
    bandOffset: number;
    cricketStyle: "none" | "simple";
    cricketLength: number;
    cricketHeight: number;
    cricketSide: "front" | "back";
    panelStyle: "rectangular" | "none";
    panelOffsetTop: number;
    panelMargin: number;
    type: "chimney";
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
    roofSegmentId?: string | undefined;
    topMaterial?: {
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
    topMaterialPreset?: string | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `solarpanel_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    rotation: number;
    rows: number;
    columns: number;
    frameThickness: number;
    frameDepth: number;
    panelWidth: number;
    panelHeight: number;
    gapX: number;
    gapY: number;
    mountingType: "flush" | "tilted";
    tiltAngle: number;
    standoffHeight: number;
    type: "solar-panel";
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
    roofSegmentId?: string | undefined;
    panelMaterial?: {
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
    panelMaterialPreset?: string | undefined;
    panelTypePreset?: "residential" | "residential-large" | "compact" | "frameless" | undefined;
    surfaceNormal?: [number, number, number] | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `skylight_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    rotation: number;
    width: number;
    height: number;
    glassThickness: number;
    operationState: number;
    slideDirection: "x" | "z";
    frameThickness: number;
    frameDepth: number;
    curbHeight: number;
    cutoutOffset: number;
    skylightType: "flat" | "sliding" | "opening" | "walk-on" | "lantern";
    lanternHeight: number;
    lanternTopScale: number;
    openingAngle: number;
    openingSide: "top" | "right" | "left" | "bottom";
    motorHousing: boolean;
    slideFraction: number;
    trackWidth: number;
    motorHousingSize: number;
    curb: boolean;
    type: "skylight";
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
    roofSegmentId?: string | undefined;
    surfaceNormal?: [number, number, number] | undefined;
    glassMaterial?: {
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
    glassMaterialPreset?: string | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `dormer_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    depth: number;
    rotation: number;
    children: `window_${string}`[];
    width: number;
    height: number;
    roofType: "flat" | "hip" | "gable" | "shed" | "gambrel" | "dutch" | "mansard" | "conical";
    roofHeight: number;
    shedHighSide: "front" | "back";
    wallSkirtHeight: number;
    windowWidth: number;
    windowHeight: number;
    windowOffsetX: number;
    windowOffsetY: number;
    windowFrameThickness: number;
    windowFrameDepth: number;
    windowColumns: number;
    windowRows: number;
    windowDividerThickness: number;
    windowShape: "rectangle" | "rounded" | "arch";
    windowArchHeight: number;
    windowCornerRadii: [number, number, number, number];
    windowSill: boolean;
    windowSillDepth: number;
    windowSillThickness: number;
    type: "dormer";
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
    roofSegmentId?: string | undefined;
    topMaterial?: {
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
    topMaterialPreset?: string | undefined;
    wallMaterial?: {
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
    wallMaterialPreset?: string | undefined;
    sideMaterial?: {
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
    sideMaterialPreset?: string | undefined;
} | {
    object: "node";
    id: `downspout_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    shape: "round" | "auto" | "rect";
    length: number;
    materialPreset: string;
    diameter: number;
    standoff: number;
    strapStyle: "none" | "band";
    strapSpacing: number;
    terminal: "straight" | "splash" | "kickout";
    type: "downspout";
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
    slots?: Record<string, string> | undefined;
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
    gutterId?: string | undefined;
    outletId?: string | undefined;
    lengthMode?: "manual" | "to-ground" | undefined;
} | {
    object: "node";
    id: `duct-segment_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    shape: "round" | "rect" | "oval";
    path: [number, number, number][];
    width: number;
    height: number;
    diameter: number;
    roll: number;
    ductMaterial: "spiral" | "sheet-metal" | "flex" | "duct-board";
    seamDetail: boolean;
    insulated: boolean;
    insulationR: number;
    system: "supply" | "return";
    type: "duct-segment";
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
    slots?: Record<string, string> | undefined;
    autoHangers?: boolean | undefined;
    hangerOverrides?: Record<string, {
        fraction?: number | undefined;
        skipped?: boolean | undefined;
        hostId?: string | undefined;
    }> | undefined;
    hangerStyle?: "double" | "single" | undefined;
    hangerSpacing?: number | undefined;
    hangerMaxReach?: number | undefined;
    wallAttachment?: {
        wallId: `wall_${string}`;
        side: "front" | "back";
        startUV: [number, number];
        endUV: [number, number];
        offset: number;
    } | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `duct-fitting_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    shape: "round" | "rect" | "oval";
    rotation: [number, number, number];
    width: number;
    height: number;
    angle: number;
    diameter: number;
    ductMaterial: "sheet-metal" | "flex" | "duct-board";
    system: "supply" | "return";
    fittingType: "elbow" | "tee" | "cross" | "reducer" | "transition" | "end-cap" | "damper" | "access-panel" | "coupling";
    shape2: "round" | "rect" | "oval";
    width2: number;
    height2: number;
    branchAngle: number;
    diameter2: number;
    damperAngle: number;
    panelWidth: number;
    panelHeight: number;
    type: "duct-fitting";
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
    slots?: Record<string, string> | undefined;
    inletShape?: "round" | "rect" | "oval" | undefined;
    outletShape?: "round" | "rect" | "oval" | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `duct-terminal_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    depth: number;
    rotation: number;
    width: number;
    terminalType: "supply-register" | "diffuser" | "return-grille";
    mount: "wall" | "ceiling" | "floor";
    collarShape: "round" | "rect" | "oval";
    collarDiameter: number;
    collarWidth: number;
    collarHeight: number;
    type: "duct-terminal";
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
} | {
    object: "node";
    position: [number, number, number];
    id: `hvac-equipment_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    depth: number;
    rotation: number;
    width: number;
    height: number;
    equipmentType: "furnace" | "air-handler" | "condenser";
    supplyShape: "round" | "rect" | "oval";
    returnShape: "round" | "rect" | "oval";
    supplyDiameter: number;
    returnDiameter: number;
    supplyWidth: number;
    supplyHeight: number;
    returnWidth: number;
    returnHeight: number;
    type: "hvac-equipment";
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
} | {
    object: "node";
    id: `lineset_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    path: [number, number, number][];
    insulated: boolean;
    suctionDiameter: number;
    liquidDiameter: number;
    type: "lineset";
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
} | {
    object: "node";
    id: `liquid-line_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    path: [number, number, number][];
    diameter: number;
    type: "liquid-line";
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
} | {
    object: "node";
    id: `pipe-segment_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    path: [number, number, number][];
    diameter: number;
    system: "waste" | "vent";
    pipeMaterial: "abs" | "pvc" | "cast-iron";
    type: "pipe-segment";
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
    autoHangers?: boolean | undefined;
    hangerOverrides?: Record<string, {
        fraction?: number | undefined;
        skipped?: boolean | undefined;
        hostId?: string | undefined;
    }> | undefined;
    hangerStyle?: "double" | "single" | undefined;
    hangerSpacing?: number | undefined;
    hangerMaxReach?: number | undefined;
    wallAttachment?: {
        wallId: `wall_${string}`;
        side: "front" | "back";
        startUV: [number, number];
        endUV: [number, number];
        offset: number;
    } | undefined;
} | {
    object: "node";
    position: [number, number, number];
    id: `pipe-fitting_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    rotation: [number, number, number];
    angle: number;
    diameter: number;
    system: "waste" | "vent";
    fittingType: "elbow" | "cross" | "reducer" | "end-cap" | "coupling" | "wye" | "sanitary-tee" | "cleanout";
    diameter2: number;
    pipeMaterial: "abs" | "pvc" | "cast-iron";
    cleanoutStyle: "end" | "inline";
    type: "pipe-fitting";
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
} | {
    object: "node";
    position: [number, number, number];
    id: `pipe-trap_${string}`;
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    rotation: number;
    diameter: number;
    pipeMaterial: "abs" | "pvc" | "cast-iron";
    armLengthM: number;
    type: "pipe-trap";
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
}>): void;
/**
 * The sculpted ground moved: every node the terrain *supports* must re-elevate.
 *
 * The other rules in this file gate on a footprint overlapping the changed
 * surface. Terrain has no such gate — a stroke rewrites a field that spans the
 * whole lot, and the resolver samples it at each node's own XZ — so the sweep is
 * every floor-placed node on a storey at grade, plus every wall whose explicit
 * terrain infill samples that field. During a live stroke it fires per dab, but
 * dirty ids coalesce in a Set until the frame systems consume them; the scene
 * graph itself is still written only once on commit.
 *
 * Without this a sculpt silently desyncs the scene from its own ground. Nothing
 * re-runs `getFloorPlacedElevation`, so the React commit that rebinds a node
 * group's base Y leaves it there: a column that was resting on a hillside drops
 * to the datum and stays buried under the terrain it used to stand on.
 *
 * Gated on `isLevelAtSiteDatum` — the same predicate `terrainSupportLift` uses to
 * decide whether it drapes at all, so the two cannot disagree about which storey
 * is on the ground.
 */
export declare function markTerrainSupportDependents(nodes: Record<string, AnyNode>, markDirty: (id: AnyNodeId) => void): void;
/**
 * A slab on `slabLevelId` was created/deleted or changed shape/placement:
 * the covering bound (slab underside) over the level BELOW moved, so that
 * level's plane-bound walls and clamped ceilings must rebuild.
 */
export declare function markCoveringDependentsBelow(slabLevelId: string, nodes: Record<string, AnyNode>, markDirty: (id: AnyNodeId) => void): void;
//# sourceMappingURL=spatial-grid-sync.d.ts.map