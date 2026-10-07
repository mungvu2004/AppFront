import type { AnyNode, StructuralGridNode } from '@pascal-app/core';
export type StructuralGridPoint = readonly [x: number, z: number];
export type StructuralGridSnap = {
    point: [number, number];
    distance: number;
    kind: 'intersection' | 'line';
    axes: StructuralGridNode[];
    reference: string;
};
export declare const STRUCTURAL_GRID_SNAP_DISTANCE_M = 0.25;
export declare const STRUCTURAL_GRID_REFERENCE_TOLERANCE_M = 0.02;
export declare function collectStructuralGridAxes(nodes: Readonly<Record<string, AnyNode>>, levelId: string | null | undefined): StructuralGridNode[];
export declare function formatStructuralGridReference(axes: readonly StructuralGridNode[]): string;
export declare function resolveStructuralGridSnap(point: StructuralGridPoint, axes: readonly StructuralGridNode[], maxDistance?: number): StructuralGridSnap | null;
export declare function resolveStructuralGridReference(point: StructuralGridPoint, axes: readonly StructuralGridNode[], tolerance?: number): string | null;
//# sourceMappingURL=coordination.d.ts.map