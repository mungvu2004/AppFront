import { type WallNode } from '@pascal-app/core';
/**
 * A split session: the wall's `reshaping` scope (so the snapping chip and the
 * kind's HUD hints resolve), one centred cut, and the watchers that end it —
 * Esc, the wall or its edit rights going away, another interaction, leaving
 * select mode. Both views render the same draft; either can commit.
 */
export declare function openWallSplit(wall: WallNode): void;
export declare function closeWallSplit(): void;
/** Pointer projected onto the wall; Alt (`free`) skips snapping. */
export declare function hoverWallSplit(raw: number, free?: boolean): void;
export declare function setWallSplitCuts(cuts: number): void;
/** Re-plan against the current scene (after an external edit). */
export declare function refreshWallSplit(): void;
export declare function commitWallSplit(): void;
//# sourceMappingURL=split-session.d.ts.map