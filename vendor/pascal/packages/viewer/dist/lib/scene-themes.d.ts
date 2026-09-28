import type { SurfaceRole } from '@pascal-app/core';
export type SceneTheme = {
    id: string;
    name: string;
    appearance: 'light' | 'dark';
    background: string;
    backgroundSky?: string;
    ground: string;
    ambient: {
        color: string;
        intensity: number;
    };
    hemi?: {
        sky: string;
        ground: string;
        intensity: number;
    };
    lights: Array<{
        position: [number, number, number];
        color: string;
        intensity: number;
        castShadow?: boolean;
    }>;
    toneMappingExposure: number;
    clayTints?: Partial<Record<SurfaceRole, string>>;
};
export declare const SCENE_THEMES: SceneTheme[];
export declare const SCENE_THEME_IDS: string[];
export declare function getSceneTheme(id: string): SceneTheme;
//# sourceMappingURL=scene-themes.d.ts.map