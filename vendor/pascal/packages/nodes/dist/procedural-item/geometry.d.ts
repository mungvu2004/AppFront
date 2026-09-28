import { type Evaluation, type ProceduralItemNode } from '@pascal-app/core/procedural-items';
import { type BufferGeometry } from 'three';
export type Batch = {
    slot: string;
    motionGroup?: string;
    geometry: BufferGeometry;
    motionGeometry?: BufferGeometry;
    ranges: {
        end: number;
        partId: string;
        shapeId: string;
    }[];
};
export type BuiltItem = {
    batches: Batch[];
    evaluation: Evaluation;
    milliseconds: number;
    triangles: number;
};
export declare const proceduralMetrics: {
    builds: number;
    cacheHits: number;
    lastBuildMs: number;
    liveEntries: number;
};
export declare const geometrySignature: (node: ProceduralItemNode) => string;
export declare function buildProceduralGeometry(node: ProceduralItemNode): BuiltItem;
export declare function acquireProceduralGeometry(node: ProceduralItemNode): {
    value: BuiltItem;
    release: () => void;
};
export declare function partAtFace(ranges: Batch['ranges'], face: number): string | null;
//# sourceMappingURL=geometry.d.ts.map