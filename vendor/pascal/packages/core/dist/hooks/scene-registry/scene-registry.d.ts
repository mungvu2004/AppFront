import type * as THREE from 'three';
type ByTypeMap = {
    [kind: string]: Set<string>;
};
declare class RevisionedMap<K, V> extends Map<K, V> {
    revision: number;
    set(key: K, value: V): this;
    delete(key: K): boolean;
    clear(): void;
}
export declare const sceneRegistry: {
    nodes: RevisionedMap<string, THREE.Object3D<THREE.Object3DEventMap>>;
    readonly revision: number;
    byType: ByTypeMap;
    /** Remove all entries. Call when unloading a scene to prevent stale 3D refs. */
    clear(): void;
};
export declare function useRegistry(id: string, type: string, ref: React.RefObject<THREE.Object3D>): void;
export {};
//# sourceMappingURL=scene-registry.d.ts.map