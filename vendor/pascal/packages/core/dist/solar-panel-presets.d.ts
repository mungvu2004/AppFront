import { z } from 'zod';
export declare const SolarPanelPresetKey: z.ZodEnum<{
    residential: "residential";
    "residential-large": "residential-large";
    compact: "compact";
    frameless: "frameless";
}>;
export type SolarPanelPresetKey = z.infer<typeof SolarPanelPresetKey>;
export type SolarPanelPresetDims = {
    panelWidth: number;
    panelHeight: number;
    frameThickness: number;
    frameDepth: number;
};
export declare const SOLAR_PANEL_PRESETS: Record<SolarPanelPresetKey, SolarPanelPresetDims>;
export declare const SOLAR_PANEL_PRESET_LABELS: Record<SolarPanelPresetKey, string>;
//# sourceMappingURL=solar-panel-presets.d.ts.map