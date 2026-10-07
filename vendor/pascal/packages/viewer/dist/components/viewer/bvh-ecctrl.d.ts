import '@react-three/fiber';
import { type ThreeElements } from '@react-three/fiber';
import type { ReactNode } from 'react';
import * as THREE from 'three';
export type MovementInput = {
    forward?: boolean;
    backward?: boolean;
    leftward?: boolean;
    rightward?: boolean;
    joystick?: {
        x: number;
        y: number;
    };
    run?: boolean;
    jump?: boolean;
};
export type CharacterAnimationStatus = 'IDLE' | 'WALK' | 'RUN' | 'JUMP_START' | 'JUMP_IDLE' | 'JUMP_FALL' | 'JUMP_LAND';
export type FloatCheckType = 'RAYCAST' | 'SHAPECAST' | 'BOTH';
export interface BVHEcctrlApi {
    group: THREE.Group | null;
    model: THREE.Group | null;
    resetLinVel: () => void;
    addLinVel: (v: THREE.Vector3) => void;
    setLinVel: (v: THREE.Vector3) => void;
    setMovement: (input: MovementInput) => void;
}
export interface EcctrlProps extends Omit<ThreeElements['group'], 'ref'> {
    children?: ReactNode;
    debug?: boolean;
    colliderMeshes?: THREE.Mesh[];
    colliderCapsuleArgs?: [
        radius: number,
        length: number,
        capSegments: number,
        radialSegments: number
    ];
    paused?: boolean;
    delay?: number;
    gravity?: number;
    fallGravityFactor?: number;
    maxFallSpeed?: number;
    mass?: number;
    sleepTimeout?: number;
    slowMotionFactor?: number;
    turnSpeed?: number;
    maxWalkSpeed?: number;
    maxRunSpeed?: number;
    acceleration?: number;
    deceleration?: number;
    counterAccFactor?: number;
    airDragFactor?: number;
    jumpVel?: number;
    floatCheckType?: FloatCheckType;
    maxSlope?: number;
    floatHeight?: number;
    floatPullBackHeight?: number;
    floatSensorRadius?: number;
    floatSpringK?: number;
    floatDampingC?: number;
    collisionCheckIteration?: number;
    collisionPushBackDamping?: number;
    collisionPushBackThreshold?: number;
}
type CharacterStatus = {
    position: THREE.Vector3;
    linvel: THREE.Vector3;
    quaternion: THREE.Quaternion;
    inputDir: THREE.Vector3;
    movingDir: THREE.Vector3;
    isOnGround: boolean;
    isOnMovingPlatform: boolean;
    animationStatus: CharacterAnimationStatus;
};
export declare const characterStatus: CharacterStatus;
declare const BVHEcctrl: import("react").ForwardRefExoticComponent<EcctrlProps & import("react").RefAttributes<BVHEcctrlApi>>;
export default BVHEcctrl;
//# sourceMappingURL=bvh-ecctrl.d.ts.map