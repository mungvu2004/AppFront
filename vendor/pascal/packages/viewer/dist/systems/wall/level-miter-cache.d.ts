import { type WallMiterData, type WallNode } from '@pascal-app/core';
export declare function sameMiterInputs(a: WallNode[], b: WallNode[]): boolean;
export declare function getCachedLevelMiters(levelId: string, levelWalls: WallNode[]): WallMiterData;
/**
 * The cache is module-level, so it outlives any single mount. Editor teardown
 * resets the other shared singletons; without the same reset a remount in the
 * same tab keeps every previous level's walls reachable.
 */
export declare function clearLevelMiterCache(): void;
//# sourceMappingURL=level-miter-cache.d.ts.map