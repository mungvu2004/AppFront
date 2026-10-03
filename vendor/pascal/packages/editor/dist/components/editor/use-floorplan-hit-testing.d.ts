import { type RefObject } from 'react';
import type { FloorplanSelectionBounds } from '../../lib/floorplan/types';
import type { WallPlanPoint } from '../tools/wall/wall-drafting';
type FloorplanHitTestingOptions = {
    sceneRef: RefObject<SVGGElement | null>;
};
export declare function collectRegistrySelectionIdsInBounds(scene: SVGGElement, bounds: FloorplanSelectionBounds, candidateIds?: string[]): string[];
export declare function getRegistryHitIdAtPlanPoint(scene: SVGGElement, planPoint: WallPlanPoint, candidateIds?: string[]): string | null;
export declare function useFloorplanHitTesting({ sceneRef }: FloorplanHitTestingOptions): {
    getFloorplanHitIdAtPoint: (planPoint: WallPlanPoint) => string | null;
    getFloorplanSelectionIdsInBounds: (bounds: FloorplanSelectionBounds) => string[];
};
export {};
//# sourceMappingURL=use-floorplan-hit-testing.d.ts.map