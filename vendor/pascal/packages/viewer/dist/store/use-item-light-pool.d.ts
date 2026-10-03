import { type AnyNodeId, type Interactive, type LightEffect } from '@pascal-app/core';
import type { Object3D, Vector3 } from 'three';
export type LightSource = {
    key: string;
    nodeId: AnyNodeId;
    color: string;
    distance: number;
    getWorldPosition: (out: Vector3) => boolean;
    getIntensity: () => number;
    isEligible: () => boolean;
};
export declare function catalogLightSource(key: string, nodeId: AnyNodeId, effect: LightEffect, interactive: Interactive): LightSource;
type ItemLightPoolStore = {
    registrations: Map<string, LightSource>;
    bakedCanvases: Set<Object3D>;
    setBakedCanvas: (scene: Object3D, active: boolean) => void;
    register: (source: LightSource) => void;
    unregister: (key: string) => void;
};
export declare const useItemLightPool: import("zustand").UseBoundStore<import("zustand").StoreApi<ItemLightPoolStore>>;
export {};
//# sourceMappingURL=use-item-light-pool.d.ts.map