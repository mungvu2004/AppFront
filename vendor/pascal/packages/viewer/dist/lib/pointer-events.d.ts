import { events as createWebEvents, type EventManager, type RootStore } from '@react-three/fiber';
import * as THREE from 'three';
/** Opt in only when the raycast appends hits without reading prior hits or mutating scene/query state. */
export declare function markPureRaycast<T extends THREE.Object3D['raycast']>(raycast: T): T;
export declare function choosePointerEvents(search?: string): typeof createWebEvents;
export declare function createPascalPointerEvents(store: RootStore): EventManager<HTMLElement>;
//# sourceMappingURL=pointer-events.d.ts.map