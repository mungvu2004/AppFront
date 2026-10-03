import { type AnyNode } from '@pascal-app/core';
import * as THREE from 'three';
export declare const PRINT_GOLDEN_HOUSE_IDS: {
    readonly building: "building_print-golden-house";
    readonly groundLevel: "level_print-golden-ground";
    readonly upperLevel: "level_print-golden-upper";
    readonly groundWalls: readonly ["wall_print-golden-ground-front", "wall_print-golden-ground-right", "wall_print-golden-ground-back", "wall_print-golden-ground-left"];
    readonly upperWalls: readonly ["wall_print-golden-upper-front", "wall_print-golden-upper-right", "wall_print-golden-upper-back", "wall_print-golden-upper-left"];
    readonly door: "door_print-golden-ground-front";
    readonly window: "window_print-golden-upper-back";
    readonly groundSlab: "slab_print-golden-ground";
    readonly upperSlab: "slab_print-golden-upper";
    readonly roof: "rseg_print-golden-upper";
    readonly visibleFurniture: "furniture_print-golden-visible";
    readonly hiddenFurnitureParent: "furniture_print-golden-hidden-parent";
    readonly hiddenFurnitureChild: "furniture_print-golden-hidden-child";
};
export type PrintGoldenHouseFixture = {
    root: THREE.Group;
    nodes: Record<string, AnyNode>;
    structuralNodeIds: string[];
    groundStructuralNodeIds: string[];
    upperStructuralNodeIds: string[];
    dispose: () => void;
};
export declare function createPrintGoldenHouseFixture(): PrintGoldenHouseFixture;
//# sourceMappingURL=print-golden-house.test-fixture.d.ts.map