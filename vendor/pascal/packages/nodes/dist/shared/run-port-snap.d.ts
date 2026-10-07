import type { ScenePort } from './ports';
export type PortScreenPoint = {
    x: number;
    y: number;
    depth: number;
};
export declare function findScreenPort(ports: readonly ScenePort[], pointer: readonly [number, number], project: (point: ScenePort['position']) => PortScreenPoint | null, source: Pick<ScenePort, 'nodeId' | 'id'> | null, radius?: number): {
    port: ScenePort;
    screen: PortScreenPoint;
} | null;
//# sourceMappingURL=run-port-snap.d.ts.map