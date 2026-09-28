import { type SceneApi } from '@pascal-app/core';
import type { Object3D } from 'three';
export declare function animateCabinetFlames(objects: Object3D[], elapsedTime: number, updateTubes: boolean): void;
/**
 * Poses door hinges / drawer slides stamped with `userData.cabinetPose`
 * directly, so `operationState` changes never trigger a geometry rebuild
 * (it is deliberately absent from the cabinet `geometryKey`s). Builders
 * still bake the current pose at build time; this system only acts when
 * the value drifts from what the mounted group last showed.
 */
declare const CabinetAnimationSystem: ({ sceneApi }: {
    sceneApi: SceneApi;
}) => null;
export default CabinetAnimationSystem;
//# sourceMappingURL=system.d.ts.map