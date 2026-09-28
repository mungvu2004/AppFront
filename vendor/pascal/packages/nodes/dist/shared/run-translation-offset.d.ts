import { type AnyNode, type AnyNodeId, DuctSegmentNode, type PortConnection } from '@pascal-app/core';
import type { DuctFittingNode } from '../duct-fitting/schema';
import { type DuctProfile } from './auto-fitting';
import type { ScenePort } from './ports';
type Point = [number, number, number];
export type RunTranslationOffsetPlan = {
    ductPath: Point[];
    fittings: DuctFittingNode[];
    connectors: DuctSegmentNode[];
    updates: {
        id: AnyNodeId;
        data: Partial<AnyNode>;
    }[];
};
export declare function planRunTranslationOffsets(args: {
    duct: DuctSegmentNode;
    translatedPath: Point[];
    profile: DuctProfile;
    connections: PortConnection[];
    scenePorts: ScenePort[];
    nodesById: Record<string, AnyNode>;
}): RunTranslationOffsetPlan | null;
export {};
//# sourceMappingURL=run-translation-offset.d.ts.map