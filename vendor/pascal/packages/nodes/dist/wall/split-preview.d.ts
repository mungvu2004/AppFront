import { type AnyNode, type AnyNodeId, type WallNode, type WallPlanPoint } from '@pascal-app/core';
export declare const WALL_SPLIT_MAX_CUTS = 32;
/** Cut markers in both views: warm when the cuts can commit, red when they can't. */
export declare function wallSplitMarkerColor(valid: boolean): "#c86f45" | "#a63d2e";
/** The pointer projected onto the wall, as a distance from its start; curved walls included. */
export declare function wallSplitDistance(wall: WallNode, point: readonly [number, number]): number;
/** Like a loop cut: one cut follows the pointer, more cuts divide the wall evenly. */
export declare function wallSplitDistances(length: number, cuts: number, distance: number): number[];
export type WallSplitSnap = {
    kind: 'grid';
} | {
    kind: 'midpoint';
} | {
    kind: 'alignment';
    anchor: WallPlanPoint;
} | null;
export type WallSplitSnapOptions = {
    /** Grid step while the 'grid' snapping mode is active. */
    gridStep: number | null;
    /** Other wall ends to align with while the 'lines' mode is active. */
    anchors: readonly WallPlanPoint[] | null;
    /** How far (m) the pointer may be from an alignment target to catch it. */
    tolerance: number;
};
/**
 * Snaps a single cut along its wall with the active snapping mode: grid steps
 * counted from the wall start, or — in 'lines' — the midpoint and where the
 * level's other wall ends project onto the wall.
 */
export declare function snapWallSplitDistance(wall: WallNode, raw: number, options: WallSplitSnapOptions): {
    distance: number;
    snap: WallSplitSnap;
};
/** Ends of the level's other walls, for 'lines' alignment. */
export declare function wallSplitAnchors(nodes: Record<AnyNodeId, AnyNode>, wall: WallNode): WallPlanPoint[];
export declare function wallSplitPreview(nodes: Record<AnyNodeId, AnyNode>, wall: WallNode, distances: readonly number[]): {
    distances: number[];
    length: number;
    frames: {
        point: import("@pascal-app/core").Point2D;
        tangent: import("@pascal-app/core").Point2D;
        normal: import("@pascal-app/core").Point2D;
    }[];
    valid: boolean;
    message: string;
};
export type WallSplitPreview = ReturnType<typeof wallSplitPreview>;
/** What to label: both sides of a single cut, or one length repeated across even cuts. */
export declare function wallSplitSegmentLabels(wall: WallNode, preview: WallSplitPreview): {
    length: number;
    count: number;
    midpoint: WallPlanPoint;
    direction: WallPlanPoint;
}[];
//# sourceMappingURL=split-preview.d.ts.map