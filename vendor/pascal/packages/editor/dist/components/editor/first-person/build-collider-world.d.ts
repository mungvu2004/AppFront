import * as THREE from 'three';
export declare const FIRST_PERSON_SPAWN_EYE_HEIGHT = 1.65;
export type FirstPersonColliderWorld = {
    mesh: THREE.Mesh;
    bounds: THREE.Box3 | null;
    dispose: () => void;
};
export type FirstPersonSpawn = {
    position: [number, number, number];
    yaw: number;
};
export declare function buildFirstPersonColliderWorldFromRegistry(): FirstPersonColliderWorld | null;
export declare function deriveFirstPersonSpawn(camera: THREE.Camera, world: FirstPersonColliderWorld): FirstPersonSpawn;
//# sourceMappingURL=build-collider-world.d.ts.map