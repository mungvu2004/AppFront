import { type BlockFace, type BlockTopology } from '@pascal-app/core';
import type { BlockSelection } from './selection-model';
export type { BlockSelection } from './selection-model';
type Point = [number, number, number];
export type BlockCommand = {
    type: 'extrude-faces';
    faceIds: string[];
    distance: number;
    axis?: 'x' | 'y' | 'z';
} | {
    type: 'translate-components';
    selection: BlockSelection;
    delta: Point;
} | {
    type: 'rotate-components';
    selection: BlockSelection;
    pivot: Point;
    axis: Point;
    angle: number;
} | {
    type: 'scale-components';
    selection: BlockSelection;
    pivot: Point;
    factors: Point;
} | {
    type: 'inset-faces';
    faceIds: string[];
    amount: number;
    depth: number;
} | {
    type: 'delete-components';
    selection: BlockSelection;
} | {
    type: 'merge-vertices';
    vertexIds: string[];
} | {
    type: 'dissolve-edges';
    edgeIds: string[];
} | {
    type: 'dissolve-faces';
    faceIds: string[];
} | {
    type: 'loop-cut';
    edgeId: string;
    factor: number;
    cuts?: number;
} | {
    type: 'bevel-edges';
    edgeIds: string[];
    width: number;
    segments: number;
    profile: number;
    clampOverlap: boolean;
};
export type BlockCommandResult = {
    ok: true;
    topology: BlockTopology;
    selection: BlockSelection;
} | {
    ok: false;
    error: string;
};
export declare function blockFaceNormal(topology: BlockTopology, face: BlockFace): Point | null;
export declare function blockFaceCentroid(topology: BlockTopology, face: BlockFace): Point | null;
export declare function blockLoopCutSegments(topology: BlockTopology, edgeId: string, factor: number, cuts?: number): [Point, Point][] | null;
export declare function blockSelectionVertexIds(topology: BlockTopology, selection: BlockSelection): Set<string>;
export declare function applyBlockCommand(topology: BlockTopology, command: BlockCommand): BlockCommandResult;
//# sourceMappingURL=commands.d.ts.map