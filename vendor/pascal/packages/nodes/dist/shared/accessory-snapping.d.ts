import { type ScenePort } from './ports';
export declare function subscribeAccessorySnapping(refresh: () => void): () => void;
export declare function snapAccessoryPoint(point: [number, number, number], step: number, normal?: readonly [number, number, number]): [number, number, number];
export declare function findAccessoryPort(point: [number, number, number], ports: ScenePort[], enabled: boolean, onSurface: boolean): ScenePort | null;
//# sourceMappingURL=accessory-snapping.d.ts.map