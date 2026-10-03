import type { AnyNode, AnyNodeId, CabinetModuleNode, CabinetNode, GeometryContext } from '@pascal-app/core';
/**
 * Straight-line run layout math — the single home for the "modules sit on the
 * run's local X axis" assumption. Ordering, edges, adjacency, spans, and
 * insert positions all live here so a future corner (L-shape) module changes
 * one file instead of five call sites.
 */
export declare const RUN_ADJACENCY_EPSILON = 0.0001;
type ModuleLike = Pick<CabinetModuleNode, 'id' | 'position' | 'width'>;
type ReflowRunModulesOptions = {
    wallConstraints?: RunWallConstraints;
    resizeSide?: 'left' | 'right';
    consumeAdjacentGap?: boolean;
    adjacentGapSide?: 'left' | 'right';
    eligibleDonorIds?: ReadonlySet<CabinetModuleNode['id']>;
    maximumWidth?: number;
    maximumWidthById?: ReadonlyMap<CabinetModuleNode['id'], number>;
    minimumWidth?: number;
    minimumWidthById?: ReadonlyMap<CabinetModuleNode['id'], number>;
    nominalWidthById?: ReadonlyMap<CabinetModuleNode['id'], number>;
    restorableWidthById?: ReadonlyMap<CabinetModuleNode['id'], number>;
};
export type RunWallEndConstraint = {
    constrained: boolean;
    slack: number;
};
export type RunWallConstraints = {
    left: RunWallEndConstraint;
    right: RunWallEndConstraint;
};
type RunWallConstraintOptions = {
    widthGrowth?: number;
};
export declare function sortRunModules<T extends ModuleLike>(modules: readonly T[]): T[];
export declare function moduleMinX(module: Pick<CabinetModuleNode, 'position' | 'width'>): number;
export declare function moduleMaxX(module: Pick<CabinetModuleNode, 'position' | 'width'>): number;
export declare function runWallConstraints(run: Pick<CabinetNode, 'depth' | 'parentId' | 'position' | 'rotation' | 'width'>, modules: readonly ModuleLike[], nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>, options?: RunWallConstraintOptions): RunWallConstraints;
export declare function runMinX(modules: readonly ModuleLike[]): number;
export declare function runMaxX(modules: readonly ModuleLike[]): number;
/**
 * Whether a module's side has no flush neighbor — i.e. the side is free for a
 * width-resize handle or an adjacent insert.
 */
export declare function moduleSideOpen<T extends ModuleLike>(modules: readonly T[], moduleId: string, side: 'left' | 'right', epsilon?: number): boolean;
export type RunSpan = {
    minX: number;
    maxX: number;
    centerX: number;
    centerZ: number;
    width: number;
    depth: number;
    minZ: number;
    maxZ: number;
    topY: number;
    hasCountertop: boolean;
};
type SpanModule = Pick<CabinetModuleNode, 'position' | 'width' | 'depth' | 'carcassHeight' | 'cabinetType'>;
/**
 * Contiguous same-height module groups along the run — the units the
 * countertop, plinth, and appliance-gap logic operate on. A gap, a
 * base↔tall transition, a top-height change, or a depth-footprint change
 * starts a new span.
 */
export declare function getRunSpans(modules: readonly SpanModule[], opts?: {
    runTier?: CabinetNode['runTier'];
}): RunSpan[];
export declare function getRunSpanGroups<T extends SpanModule>(modules: readonly T[], opts?: {
    runTier?: CabinetNode['runTier'];
}): Array<{
    span: RunSpan;
    modules: T[];
}>;
export declare function derivedCornerRole(metadata: unknown): {
    role: 'base-leg' | 'wall-leg' | 'bridge';
    side: 'left' | 'right';
} | null;
export type RunSpanEnds = {
    /** Countertop side overhang after neighbor / corner / bar suppression. */
    leftOverhang: number;
    rightOverhang: number;
    /** Run end with nothing abutting — where a waterfall panel would show. */
    exposedLeft: boolean;
    exposedRight: boolean;
};
/**
 * Per-span end conditions shared by the 3D run geometry and the 2D plan
 * outline, so the countertop reads identically in both views. The side
 * overhang is suppressed where a span abuts a tall neighbor in the same run,
 * an adjacent collinear run, a side bar ledge, or the mating edge of an
 * L-corner leg (either direction of the link).
 */
export declare function getRunSpanEnds(node: CabinetNode, ctx: GeometryContext | undefined, spans: readonly RunSpan[]): RunSpanEnds[];
/**
 * X center for inserting a `width`-wide module on the given side of the
 * anchor (or on the run's outer edge with no anchor). Returns null when a
 * flush neighbor leaves no room on that side.
 */
export declare function sideInsertX({ anchorModule, modules, side, width, epsilon, }: {
    anchorModule: ModuleLike | null;
    modules: readonly ModuleLike[];
    side: 'left' | 'right';
    width: number;
    epsilon?: number;
}): number | null;
/**
 * Re-pack the run after one module's width changes. A single constrained end
 * may consume its wall gap. When both ends are constrained, the run extent is
 * fixed and eligible donors absorb the growth, nearest first. Manual edge
 * resize may consume an open inter-module gap before shifting its neighbor.
 * The change is rejected only when their combined capacity is insufficient.
 */
export declare function reflowRunModules<T extends ModuleLike>(modules: readonly T[], selectedId: CabinetModuleNode['id'], selectedWidth: number, options?: ReflowRunModulesOptions): Array<{
    id: T['id'];
    position: T['position'];
    width: number;
}>;
export type RunModuleWidthEqualizationPlan<T extends ModuleLike> = {
    ok: true;
    changed: boolean;
    targetWidth: number;
    equalizedIds: T['id'][];
    modules: Array<{
        id: T['id'];
        position: T['position'];
        width: number;
    }>;
} | {
    ok: false;
    reason: 'not-enough-modules' | 'width-limits';
};
/**
 * Distribute a run's existing span evenly across the requested modules. The
 * non-requested modules keep their widths, so fixed appliances and structural
 * fillers remain part of the run without becoming resize targets.
 */
export declare function planRunModuleWidthEqualization<T extends ModuleLike>({ modules, equalizedIds, minimumWidthById, maximumWidthById, }: {
    modules: readonly T[];
    equalizedIds: ReadonlySet<T['id']>;
    minimumWidthById?: ReadonlyMap<T['id'], number>;
    maximumWidthById?: ReadonlyMap<T['id'], number>;
}): RunModuleWidthEqualizationPlan<T>;
export type RunModuleInsertionPlan<T extends ModuleLike> = {
    ok: true;
    inserted: {
        id: T['id'];
        position: T['position'];
        width: number;
    };
    modules: Array<{
        id: T['id'];
        position: T['position'];
        width: number;
    }>;
    pushedSide: 'left' | 'right' | null;
    shrunkFillerIds: T['id'][];
} | {
    ok: false;
    reason: 'invalid-width' | 'duplicate-id' | 'no-space';
};
/**
 * Plan inserting one module at a run-local X coordinate. Existing gaps are
 * consumed first; a full run is re-packed toward the selected push side, with
 * only eligible filler modules allowed to donate width when both ends are
 * wall-constrained.
 */
export declare function planRunModuleInsertion<T extends ModuleLike>({ modules, insertion, wallConstraints, fillerIds, minimumFillerWidth, preserveEnd, preserveEnds, anchorInsertionSide, }: {
    modules: readonly T[];
    insertion: {
        id: T['id'];
        position: T['position'];
        width: number;
    };
    wallConstraints?: RunWallConstraints;
    fillerIds?: ReadonlySet<T['id']>;
    minimumFillerWidth?: number;
    preserveEnd?: 'left' | 'right';
    preserveEnds?: Partial<Record<'left' | 'right', boolean>>;
    anchorInsertionSide?: 'left' | 'right';
}): RunModuleInsertionPlan<T>;
/** Full-run bounds in run-local frame (X along the run). */
export declare function runLocalXExtent(modules: readonly ModuleLike[]): {
    minX: number;
    maxX: number;
    centerX: number;
    width: number;
} | null;
export type RunLike = Pick<CabinetNode, 'position' | 'rotation'>;
/** Rotate + translate a run-local point into the plan (level) frame. */
export declare function runLocalToPlan(run: RunLike, local: readonly [number, number, number]): [number, number, number];
/** Inverse of {@link runLocalToPlan}. */
export declare function planToRunLocal(run: RunLike, planX: number, localY: number, planZ: number): [number, number, number];
export {};
//# sourceMappingURL=run-layout.d.ts.map