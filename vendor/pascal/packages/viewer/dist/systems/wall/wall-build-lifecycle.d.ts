import { type PerfBatchStats } from '../../lib/perf-panel-store';
export declare const pendingAdjacentByLevel: Map<string, Set<string>>;
export declare const initiallyBuiltWalls: Set<string>;
export declare const drainStats: NonNullable<PerfBatchStats['wallDrain']>;
export declare function publishWallDrainStats(): void;
export declare function endInitialBuild(): void;
export declare function isWallInitialBuildActive(): boolean;
export declare function subscribeWallBuildInteractions(target: EventTarget | null): (() => void) | undefined;
//# sourceMappingURL=wall-build-lifecycle.d.ts.map