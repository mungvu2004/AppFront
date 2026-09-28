export declare function notifyWallRebuilt(wallId: string): void;
export declare function subscribeWallRebuilds(listener: (wallId: string) => void): () => void;
/** Moves every rebuild notice collected so far into `into`. */
export declare function drainRebuiltWalls(into: Set<string>): void;
//# sourceMappingURL=wall-rebuild-notifications.d.ts.map