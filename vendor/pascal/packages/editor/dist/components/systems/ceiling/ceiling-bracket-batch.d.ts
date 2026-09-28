import type { CeilingNode } from '@pascal-app/core';
import { BoxGeometry, InstancedMesh, type Intersection, Matrix4, MeshBasicMaterial, type Object3D } from 'three';
export declare const BRACKET_Y_OFFSET = 0.035;
export type CornerBracketData = {
    corner: [number, number];
    index: number;
    incomingEdgeIndex: number;
    incomingDirection: [number, number];
    outgoingEdgeIndex: number;
    outgoingDirection: [number, number];
    incomingLength: number;
    outgoingLength: number;
};
export type BracketPart = 'incoming' | 'outgoing' | 'cube';
export type BracketTarget = {
    ceilingId: CeilingNode['id'];
    cornerIndex: number;
    part: BracketPart;
};
export declare function growBracketCapacity(current: number, required: number): number;
export declare function getBracketHighlights(cornerCount: number, activeCornerIndex: number | null): {
    edges: Set<number>;
    corners: Set<number>;
};
export declare function getBracketMatrix(corner: CornerBracketData, part: BracketPart, height: number): Matrix4;
export declare class CeilingBracketBatchStore {
    private readonly ceilings;
    private readonly batches;
    private readonly listeners;
    private meshes;
    private readonly instanceSphere;
    readonly getSnapshot: () => InstancedMesh<BoxGeometry, MeshBasicMaterial, import("three").InstancedMeshEventMap>[];
    readonly subscribe: (listener: () => void) => () => boolean;
    getTarget(object: Object3D, instanceId: number | undefined): BracketTarget | undefined;
    resolveHitTarget(event: Pick<Intersection, 'object' | 'instanceId' | 'distance'>, hits: Array<Pick<Intersection, 'object' | 'instanceId' | 'distance'>>): BracketTarget | undefined;
    getLocation(target: BracketTarget): {
        mesh: InstancedMesh<BoxGeometry, MeshBasicMaterial, import("three").InstancedMeshEventMap>;
        instanceId: number;
    } | undefined;
    setGeometry(ceilingId: CeilingNode['id'], corners: CornerBracketData[], height: number): void;
    setHighlight(ceilingId: CeilingNode['id'], activeCornerIndex: number | null): void;
    removeCeiling(ceilingId: CeilingNode['id']): void;
    dispose(): void;
    private ensureCapacity;
    private append;
    private remove;
    private write;
}
export declare function bracketTargetKey(target: BracketTarget): string;
export declare class BracketPointerState {
    private readonly hovered;
    private initialTargets;
    over(key: string, target: BracketTarget): BracketTarget | undefined;
    out(key: string): BracketTarget | undefined;
    replaceObject(previousUuid: string, nextUuid: string): void;
    clearHover(): BracketTarget[];
    pointerDown(targets: BracketTarget[]): void;
    canClick(target: BracketTarget): boolean;
}
export declare function buildCornerBrackets(polygon: Array<[number, number]>): CornerBracketData[];
//# sourceMappingURL=ceiling-bracket-batch.d.ts.map