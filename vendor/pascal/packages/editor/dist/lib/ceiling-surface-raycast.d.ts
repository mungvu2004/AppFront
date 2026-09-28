import { Mesh, type Object3D, type Raycaster } from 'three';
export declare function raycastCeilingUnderside(raycaster: Raycaster, ceiling: Object3D): {
    object: Mesh<any, any, any>;
    distance: number;
    distanceToRay?: number | undefined;
    point: import("three").Vector3;
    index?: number | undefined;
    face?: import("three").Face | null | undefined;
    faceIndex?: number | null | undefined;
    barycoord?: import("three").Vector3 | null;
    uv?: import("three").Vector2 | undefined;
    uv1?: import("three").Vector2 | undefined;
    normal?: import("three").Vector3;
    instanceId?: number | undefined;
    pointOnLine?: import("three").Vector3;
    batchId?: number;
}[];
//# sourceMappingURL=ceiling-surface-raycast.d.ts.map