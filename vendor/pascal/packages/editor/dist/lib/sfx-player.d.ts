type SFXConfig = {
    src: string | string[];
    rateRange?: [number, number];
    volumeRange?: [number, number];
    minIntervalMs?: number;
};
export declare const SFX: Record<string, SFXConfig>;
export type SFXName = keyof typeof SFX;
export declare const LOOP_SFX: {
    readonly terrainRaise: {
        readonly src: "/audios/sfx/terrain_raise.mp3";
        readonly volumeMultiplier: 0.2;
    };
    readonly terrainLower: {
        readonly src: "/audios/sfx/terrain_lower.mp3";
        readonly volumeMultiplier: 0.2;
    };
    readonly terrainFlatten: {
        readonly src: "/audios/sfx/terrain_flatten.mp3";
        readonly volumeMultiplier: 0.2;
    };
    readonly terrainSmooth: {
        readonly src: "/audios/sfx/terrain_smooth.mp3";
        readonly volumeMultiplier: 0.2;
    };
};
export type LoopSFXName = keyof typeof LOOP_SFX;
export type SFXPlaybackOptions = {
    source?: 'local' | 'remote';
    stereo?: number;
    volumeMultiplier?: number;
};
export declare function preloadSFX(): void;
export declare function disposeSFX(): void;
export declare function startLoopSFX(name: LoopSFXName): void;
export declare function stopLoopSFX(): void;
/**
 * Play a sound effect with volume based on audio settings
 */
export declare function playSFX(name: SFXName, options?: SFXPlaybackOptions): void;
/**
 * Update all cached SFX volumes (useful when settings change)
 */
export declare function updateSFXVolumes(): void;
export {};
//# sourceMappingURL=sfx-player.d.ts.map