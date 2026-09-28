/**
 * Shared backdrop gradient: flat background looking down, a warm haze band
 * hugging the horizon, the theme sky arriving just above it and deepening
 * toward the zenith. One formula serves the post-processing backdrop and the
 * thumbnail pipeline (per-pixel view ray) AND the site horizon disc's
 * far-field dissolve (per-fragment view direction) — the disc converges to
 * exactly this colour, so ground and backdrop meet without a seam from any
 * camera pose.
 *
 * `dirY` is the world-space view direction's Y component (horizon = 0).
 * Colour inputs are TSL nodes (uniforms or literals).
 */
export declare function backdropGradient({ dirY, background, haze, sky, skyDeep, }: {
    dirY: any;
    background: any;
    haze: any;
    sky: any;
    skyDeep: any;
}): any;
/**
 * Atmospheric haze at the horizon: the theme's *sky* colour pulled toward a
 * warm sun tint — skyish and sunish at once, so the band reads as part of
 * the sky rather than a white stripe. Dark themes keep it faint (a low glow
 * over the night zenith).
 */
export declare function horizonHazeColor(sky: string, appearance: 'light' | 'dark'): string;
/**
 * Zenith colour derived from the theme's sky: saturated and darkened in HSL
 * so the hue stays the theme's own (blue studio, lavender sunset, near-black
 * night) while the top of the frame gets real colour depth.
 */
export declare function deepSkyColor(sky: string): string;
//# sourceMappingURL=backdrop.d.ts.map