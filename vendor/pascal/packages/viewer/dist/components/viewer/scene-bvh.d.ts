import { type ReactNode } from 'react';
import { type Group, Mesh } from 'three';
import { type SplitStrategy } from 'three-mesh-bvh';
type SceneBvhProps = {
    children?: ReactNode;
    enabled?: boolean;
    firstHitOnly?: boolean;
    strategy?: SplitStrategy;
    verbose?: boolean;
    setBoundingBox?: boolean;
    maxDepth?: number;
    maxLeafSize?: number;
    indirect?: boolean;
};
export declare const isSceneBvhExcluded: (object: Mesh) => boolean;
export declare const SceneBvh: import("react").ForwardRefExoticComponent<SceneBvhProps & import("react").RefAttributes<Group<import("three").Object3DEventMap>>>;
export {};
//# sourceMappingURL=scene-bvh.d.ts.map