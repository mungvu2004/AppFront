import { type AnyNode, type AnyNodeDefinition, type AnyNodeId, type FloorplanAffordanceSession, type FloorplanGeometry, type FloorplanPalette, type FloorplanPoint, type FloorplanScope, type LiveNodeOverrides, type LiveTransform } from '@pascal-app/core';
import { type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { type FloorplanWallDimensionReference } from '../../../lib/floorplan/floorplan-extension';
import { buildFloorplanContext, floorplanLayerRank } from '../../../lib/floorplan/floorplan-readonly';
import { type ActiveInteractionScope } from '../../../lib/interaction/scope';
import { type Mode } from '../../../store/use-editor';
export declare function resolveFloorplanHandleUnitsPerPixel(unitsPerPixel: number): number;
/**
 * Snapshot of node fields captured at drag-start, used by the single-undo
 * dance to revert untracked before re-applying as a single tracked
 * change. The dispatcher only knows about the `affectedIds` the
 * affordance declares; it captures whatever fields exist on each node by
 * cloning the full record minus the registry-managed `id` / `type`.
 */
type NodeSnapshot = {
    id: AnyNodeId;
    data: Record<string, unknown>;
};
type ActiveDrag = {
    pointerId: number;
    captureTarget: Element;
    /** Key for the visual `active` flag — e.g. `${nodeId}:${endpoint}`. */
    handleId: string;
    session: FloorplanAffordanceSession;
    snapshots: NodeSnapshot[];
    historyPaused: boolean;
    /**
     * Last plan point handed to `session.apply` (the grab point until the first
     * move). Lets the modifier-key listeners re-run the session immediately on
     * an Alt/Shift flip instead of waiting for the next pointer move.
     */
    lastPlanPoint: FloorplanPoint;
    /**
     * Set only for rotate-arrow drags (handles that carry a `pivot`). Drives
     * the live angle wedge + degree readout — the 2D twin of the 3D rotate
     * gizmo's readout. The bearing sweep is measured the same way every
     * rotate affordance measures it: `atan2(pointer − pivot)`.
     */
    rotation?: {
        pivot: FloorplanPoint;
        initialAngle: number;
        radius: number;
    };
    /**
     * Node id of the reshaping scope this drag began (boundary / curve / endpoint
     * edits), so the matching `endIf` on release/cancel tears down exactly this
     * scope. Unset for affordances that drive no snapping scope (resize / rotate).
     */
    reshapeScopeNodeId?: string;
};
type FloorplanAffordanceCancelEffects = {
    restoreSnapshots: (snapshots: NodeSnapshot[]) => void;
    resumeHistory: () => void;
    clearPreview: (id: AnyNodeId) => void;
    clearSnapFeedback: () => void;
    endReshapeScope: (drag: ActiveDrag) => void;
    clearDragFeedback?: () => void;
};
export declare function cancelFloorplanAffordanceDrag(dragRef: {
    current: ActiveDrag | null;
}, effects: FloorplanAffordanceCancelEffects, pointerId?: number): boolean;
export declare function subscribeFloorplanAffordanceToolCancel(cancelActiveDrag: () => boolean, consumeToolCancel: () => void): () => void;
export declare function floorplanAffordanceReshapeScope(affordance: string, nodeId: string, payload: unknown): ActiveInteractionScope | null;
/**
 * Transient live-rotation readout state. Rebuilt each pointer-move while a
 * rotate-arrow is dragged and cleared on release. World-plan coords.
 */
type RotationOverlayState = {
    pivot: FloorplanPoint;
    startAngle: number;
    endAngle: number;
    radius: number;
    /** Swept magnitude in radians, for the degree chip. */
    sweep: number;
};
/** The focused unit and its members; one stable object per focus change so
 * cached zone geometry invalidates exactly when the focus does. */
export type FloorplanUnitFocus = {
    focusedUnitId: string;
    focusedUnitMemberIds: readonly string[];
};
type NodeDeps = {
    automaticDimensions: boolean;
    node: AnyNode;
    live: LiveTransform | undefined;
    unit: 'metric' | 'imperial';
    metricNotation: 'meters' | 'millimeters';
    wallDimensionReference: FloorplanWallDimensionReference;
    selected: boolean;
    highlighted: boolean;
    hovered: boolean;
    moving: boolean;
    liveOverride: LiveNodeOverrides | undefined;
    palette: FloorplanPalette | undefined;
    unitFocus: FloorplanUnitFocus | undefined;
    siblingEpoch: number;
    committedNodes: Record<string, AnyNode> | null;
    dependencyNodes: AnyNode[];
    interactiveElevators: unknown;
    ctxOverrides: FloorplanContextOverrides | undefined;
};
type CacheEntry = {
    deps: NodeDeps;
    base: FloorplanGeometry | null;
    overlay: FloorplanGeometry | null;
    node: AnyNode;
};
type LevelDataCacheEntry = {
    nodes: Record<string, AnyNode>;
    liveOverrides: Map<string, LiveNodeOverrides>;
    ids: readonly AnyNodeId[];
    value: unknown;
};
type FloorplanContextOverrides = {
    children: AnyNode[];
    siblings: AnyNode[];
    parent: AnyNode | null;
    outputTransform?: {
        translate?: FloorplanPoint;
        rotate?: number;
    };
    trackAllNodes?: boolean;
};
export declare function collectDirectFloorplanScopeNodes(nodes: Record<string, AnyNode>, parent: AnyNode, scope: FloorplanScope): AnyNode[];
export declare function siteToFloorplanTransform(buildingPosition: readonly [number, number, number], buildingRotationY: number): {
    translate: FloorplanPoint;
    rotate: number;
};
export declare function isFloorplanOpeningPlacementState({ phase, mode, tool, movingNodeHasWallOpeningPlacement, }: {
    phase: string;
    mode: string;
    tool: string | null;
    movingNodeHasWallOpeningPlacement: boolean;
}): boolean;
/**
 * Whether a press on an entry belongs to the active tool instead of selecting
 * the entry. Build tools own the plan the way their 3D tools own the canvas,
 * where selection only runs in select mode: a wall drawn onto another wall
 * must place its point (T-junction), not select the wall under the cursor.
 */
export declare function floorplanEntryYieldsToTool(state: {
    mode: Mode;
    openingPlacement: boolean;
}): boolean;
export declare const FloorplanRegistryLayer: import("react").MemoExoticComponent<() => import("react").JSX.Element | null>;
type BuildFloorplanEntryGeometryArgs = {
    automaticDimensions: boolean;
    ctxOverrides: FloorplanContextOverrides | undefined;
    geometryCache: Map<string, CacheEntry>;
    highlighted: boolean;
    hovered: boolean;
    interactiveElevators: unknown;
    levelDataCache: Map<string, LevelDataCacheEntry>;
    levelNodeIdsByType: ReadonlyMap<string, readonly AnyNodeId[]>;
    live: LiveTransform | undefined;
    liveOverride: LiveNodeOverrides | undefined;
    liveOverrides: Map<string, LiveNodeOverrides>;
    moving: boolean;
    node: AnyNode;
    nodeId: AnyNodeId;
    nodes: Record<string, AnyNode>;
    palette: FloorplanPalette | undefined;
    unitFocus?: FloorplanUnitFocus;
    selected: boolean;
    siblingEpoch: number;
    unit: 'metric' | 'imperial';
    metricNotation: 'meters' | 'millimeters';
    wallDimensionReference: FloorplanWallDimensionReference;
    visibilityRootId: AnyNodeId | undefined;
};
export declare function collectFloorplanDependencyNodes(def: AnyNodeDefinition, node: AnyNode, nodes: Record<string, AnyNode>, liveOverrides?: Map<string, LiveNodeOverrides>): AnyNode[];
export declare function buildFloorplanEntryGeometry({ automaticDimensions, ctxOverrides, geometryCache, highlighted, hovered, interactiveElevators, levelDataCache, levelNodeIdsByType, live, liveOverride, liveOverrides, moving, node, nodeId, nodes, palette, unitFocus, selected, siblingEpoch, unit, metricNotation, wallDimensionReference, visibilityRootId, }: BuildFloorplanEntryGeometryArgs): CacheEntry | null;
export declare function getFloorplanLevelData(type: string, nodes: Record<string, AnyNode>, liveOverrides: Map<string, LiveNodeOverrides>, levelNodeIdsByType: ReadonlyMap<string, readonly AnyNodeId[]>, levelDataCache: Map<string, LevelDataCacheEntry>): unknown;
type InteractiveGeometryProps = {
    geometry: FloorplanGeometry;
    unitsPerPixel?: number;
    palette: FloorplanPalette | undefined;
    hatchPatternId: string | undefined;
    hoveredHandleId: string | null;
    activeDragId: string | null;
    activeRotateNodeId: AnyNodeId | null;
    isMarqueeSelectionActive: boolean;
    nodeId: AnyNodeId;
    sceneRotationDeg: number;
    onHandleHoverChange: (id: string | null) => void;
    onHandleDoubleClick: (affordance: string, payload: unknown, event: ReactMouseEvent<SVGElement>) => void;
    onHandlePointerDown: (affordance: string, payload: unknown, event: ReactPointerEvent<SVGGElement>, rotationPivot?: FloorplanPoint) => void;
    onMoveHandlePointerDown: (event: ReactPointerEvent<SVGGElement>) => void;
};
export declare const InteractiveGeometry: import("react").MemoExoticComponent<({ geometry, unitsPerPixel: unitsPerPixelOverride, palette, hatchPatternId, hoveredHandleId, activeDragId, activeRotateNodeId, isMarqueeSelectionActive, nodeId, sceneRotationDeg, onHandleDoubleClick, onHandleHoverChange, onHandlePointerDown, onMoveHandlePointerDown, }: InteractiveGeometryProps) => React.ReactElement>;
export declare function isFloorplanNodeVisible(node: AnyNode, liveOverride?: LiveNodeOverrides): boolean;
export declare function isFloorplanHierarchyVisible(node: AnyNode, nodes: Record<string, AnyNode>, liveOverrides: Map<string, LiveNodeOverrides>, rootId: AnyNodeId): boolean;
export declare const buildContext: typeof buildFloorplanContext;
export declare function collectFloorplanLinkedLevelNodes(nodes: Record<string, AnyNode>, levelId: AnyNodeId, excludedIds?: ReadonlySet<AnyNodeId>): Array<{
    id: AnyNodeId;
    node: AnyNode;
    children: AnyNode[];
}>;
export declare function floorplanHandleDoubleClickAffordance(geometry: FloorplanGeometry): 'delete-vertex' | null;
/**
 * Walk a `FloorplanGeometry` tree and split it into two trees: one with
 * only "base" primitives (polygons, paths, fills, strokes) and one with
 * only "overlay" primitives (handles, labels — see `OVERLAY_KINDS`).
 *
 * Groups recurse: a `kind: 'group'` is split into a base group and an
 * overlay group, both carrying the same `transform` so nested rotations
 * / translations apply in both passes. Empty groups collapse to `null`
 * so the caller can skip emitting an `<g>` when there's nothing to draw.
 */
export declare function splitFloorplanOverlay(g: FloorplanGeometry): {
    base: FloorplanGeometry | null;
    overlay: FloorplanGeometry | null;
};
export declare function computeAffectedSiblingIds(liveFlaggedIds: readonly AnyNodeId[], nodes: Record<string, AnyNode>, liveOverrides: Map<string, Record<string, unknown>>): Set<AnyNodeId>;
/**
 * Z-order bucket for floor-plan rendering. Lower rank = painted first =
 * sits under everything with a higher rank. SVG renders in document
 * order, so an earlier entry in the array ends up beneath a later one.
 *
 * Three buckets today:
 *   0 — `zone`: conceptual area regions, always under everything else.
 *   1 — `slab` / `ceiling`: the floor / ceiling surface; sits over the
 *       zone but under any structural / furniture geometry placed on it.
 *   2 — every other kind (walls, items, shelves, columns, stairs, …):
 *       structure + furniture, painted on top.
 *
 * Sort is stable in modern JS engines, so siblings within the same
 * bucket keep their DFS order (= scene tree order).
 */
export { floorplanLayerRank };
/**
 * Live rotation readout for the floor plan — the 2D twin of the 3D rotate
 * gizmo's wedge. Draws a filled sector + outline swept from the pointer's
 * bearing at grab (`startAngle`) to its current bearing (`endAngle`) around
 * the pivot, plus an upright degree chip at the wedge midpoint. All geometry
 * is in plan coords; the chip counter-rotates `sceneRotationDeg` so it reads
 * horizontally regardless of the building's on-screen orientation.
 */
export declare function RotationAngleOverlay({ overlay, palette, unitsPerPixel: unitsPerPixelOverride, sceneRotationDeg, }: {
    overlay: RotationOverlayState;
    palette: Pick<FloorplanPalette, 'measurementLabelBackground' | 'measurementLabelText' | 'measurementStroke'>;
    unitsPerPixel?: number;
    sceneRotationDeg: number;
}): React.ReactElement;
//# sourceMappingURL=floorplan-registry-layer.d.ts.map