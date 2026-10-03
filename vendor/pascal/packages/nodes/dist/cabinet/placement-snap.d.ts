import type { AnyNode } from '@pascal-app/core';
export declare function snapCabinetFootprintCenter(value: number, extent: number, step: number): number;
/** Resolve the XZ frame of a level from scene data, without consulting the
 * mounted Three.js registry. Levels inherit their plan transform from their
 * building; an unparented or unavailable level uses the plan origin. */
export declare function resolveCabinetLevelPlanFrame(levelId: string, nodes: Readonly<Record<string, AnyNode>>): {
    position: [number, number];
    rotationY: number;
};
export declare function resolveCabinetGridPosition({ raw, dimensions, footprintOffset, yaw, step, }: {
    raw: [number, number, number];
    dimensions: [number, number, number];
    footprintOffset?: [number, number];
    yaw: number;
    step: number;
}): [number, number, number];
export declare function resolveCabinetGridPositionInFrame({ raw, dimensions, footprintOffset, yaw, step, frame, }: {
    raw: [number, number, number];
    dimensions: [number, number, number];
    footprintOffset?: [number, number];
    yaw: number;
    step: number;
    frame: {
        position: [number, number];
        rotationY: number;
    };
}): [number, number, number];
//# sourceMappingURL=placement-snap.d.ts.map