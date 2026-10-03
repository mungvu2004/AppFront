import type { ChimneyNode } from './schema';
/**
 * Style presets — opinionated starting points the user can pick from
 * the panel header. Each preset sets shape / silhouette / accessory
 * fields only; dimensions (`width` / `depth` / `heightAboveRidge`),
 * placement (`position` / `rotation` / `roofSegmentId`), and paint
 * (`material*` / `topMaterial*`) are left untouched so applying a
 * preset to an already-sized chimney resizes nothing and doesn't
 * overwrite the user's paint choices.
 *
 * Presets are intentionally distinct silhouettes:
 *  - `brick`      — straight body, double band, flat overhanging cap
 *  - `modern`     — minimal flat cap, recessed decorative panels
 *  - `round`      — cylindrical body, single band, industrial look
 */
export type ChimneyPresetKey = 'brick' | 'modern' | 'round';
export declare const CHIMNEY_PRESET_KEYS: ChimneyPresetKey[];
export declare const CHIMNEY_PRESET_LABELS: Record<ChimneyPresetKey, string>;
export declare const chimneyPresets: Record<ChimneyPresetKey, Partial<ChimneyNode>>;
/**
 * Returns the preset key whose every field matches the supplied node,
 * or `null` if no preset is an exact match (i.e. the user has tweaked
 * fields after applying a preset). Used by the panel to highlight the
 * current preset in the segmented control.
 */
export declare function detectActiveChimneyPreset(node: Partial<ChimneyNode> | undefined | null): ChimneyPresetKey | null;
//# sourceMappingURL=presets.d.ts.map