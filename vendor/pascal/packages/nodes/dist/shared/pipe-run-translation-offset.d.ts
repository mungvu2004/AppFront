import { type AnyNode, type AnyNodeId, PipeSegmentNode, type PortConnection } from '@pascal-app/core';
import type { PipeFittingNode } from '../pipe-fitting/schema';
import type { ScenePort } from './ports';
type Point = [number, number, number];
type PipeProfile = {
    diameter: number;
    pipeMaterial: PipeFittingNode['pipeMaterial'];
};
export type PipeRunTranslationOffsetPlan = {
    pipePath: Point[];
    fittings: PipeFittingNode[];
    connectors: PipeSegmentNode[];
    updates: {
        id: AnyNodeId;
        data: Partial<AnyNode>;
    }[];
};
export declare function planPipeRunTranslationOffsets(args: {
    pipe: PipeSegmentNode;
    translatedPath: Point[];
    profile: PipeProfile;
    connections: PortConnection[];
    scenePorts: ScenePort[];
    nodesById: Record<string, AnyNode>;
}): PipeRunTranslationOffsetPlan | null;
export {};
//# sourceMappingURL=pipe-run-translation-offset.d.ts.map