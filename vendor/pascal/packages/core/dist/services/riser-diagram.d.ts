import type { AnyNode, AnyNodeId } from '../schema/index.js';
/** A 3D level-local point (meters) projected to 2D iso screen space.
 *  Screen Y grows DOWNWARD (SVG convention), so higher elevation → lower
 *  screen Y. */
export declare function projectIso(x: number, y: number, z: number): [number, number];
export type RiserLine = {
    /** Projected endpoints in iso screen space. */
    from: [number, number];
    to: [number, number];
    system: 'waste' | 'vent';
    /** Nominal size in inches. */
    diameter: number;
    /** True for a (near-)vertical run — drawn solid/bold as a stack. */
    vertical: boolean;
    /** Source node, so the editor can link selection. */
    nodeId: AnyNodeId;
};
export type RiserMarker = {
    point: [number, number];
    kind: 'trap' | 'vent-termination' | 'fitting';
    label: string;
    nodeId: AnyNodeId;
};
export type RiserDiagram = {
    lines: RiserLine[];
    markers: RiserMarker[];
    /** Bounding box of all projected geometry, screen space. */
    bounds: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    };
};
/**
 * Build the riser diagram for the whole scene. Returns null when there's
 * no DWV geometry to draw.
 */
export declare function buildRiserDiagram(nodes: Readonly<Record<AnyNodeId, AnyNode>>): RiserDiagram | null;
//# sourceMappingURL=riser-diagram.d.ts.map