/**
 * The chú giải: what a colour on the model means, how many objects wear it, and
 * where the label can be written so a person can actually read it.
 *
 * A colouring mode is only worth having if the reader can decode it, and that is
 * two separate problems. The first is *what the bands mean*, which is a data
 * question: the boundaries move with the view, so a legend that was typed by
 * hand is wrong the moment somebody filters to one level. Everything in
 * {@link generateLegend} is therefore derived — the bands come from the mode, the
 * ranges come from the mode's quantile cuts, and the counts come from running
 * the mode's own `paint` over the objects in view. Nothing in a legend is
 * written by hand, so a legend cannot disagree with the picture beside it.
 *
 * The second is *whether the label is legible*, which is a colour question, and
 * it has an uncomfortable answer this module refuses to paper over. The ramp
 * tokens were chosen as fills for geometry seen at plan scale, not as backgrounds
 * for eight-point type. Three of them — `--wall-220`, `--state-verified` and
 * `--state-violation` — sit in the middle of the lightness range, where **no**
 * text token in the palette reaches 4,5:1: the dark text tops out at 3,4–4,0 and
 * white tops out at 3,2–3,9. A legend that wrote on them anyway would be
 * decorative, not readable.
 *
 * So each item decides for itself. {@link LegendItem.labelPlacement} is
 * `onSwatch` where a text token clears 4,5:1 against the fill, and
 * `besideSwatch` where none does — the label then sits on the panel surface,
 * which clears 12,8:1. Every legend item ends up with a background/text pair that
 * passes, and the test file proves it for all seven modes. Widening the palette
 * so those three could host text would mean editing the token source, which is a
 * design decision with an owner; picking the readable placement instead is a
 * decision this module is allowed to make.
 *
 * ## Colours come from the stylesheet, never from here
 *
 * Contrast is a fact about colour *values*, but `src/styles/globals.css` is the
 * single source of those and this module must not hold a second copy. So a
 * {@link Palette} is a parameter: {@link parsePalette} builds one from the
 * stylesheet text, and a browser caller builds the same shape from
 * `getComputedStyle`. There is not one colour literal in this file, and
 * `expectNoRawColor` in `src/lib/testing` is pointed at it to keep it that way.
 *
 * ## Field names
 *
 * The brief names these `sinhChuGiai(cheDo, duLieu)` and the item fields `nhan`,
 * `khoangGiaTri`, `soLuong`, and names the contrast check `kiemTuongPhan`.
 * Invariants B and E.11 of `CLAUDE.md` forbid Vietnamese identifiers and
 * `CLAUDE.md` wins, so:
 *
 * | Brief             | Here                     |
 * |-------------------|--------------------------|
 * | `sinhChuGiai`     | {@link generateLegend}   |
 * | `cheDo`           | `mode`                   |
 * | `duLieu`          | `subjects`               |
 * | `nhan`            | `label`                  |
 * | `khoangGiaTri`    | `range`                  |
 * | `soLuong`         | `count`                  |
 * | `kiemTuongPhan`   | {@link checkContrast}    |
 * | `tokenNen`        | `backgroundToken`        |
 * | `tokenChu`        | `textToken`              |
 *
 * Every string a person reads stays Vietnamese with full diacritics, lower case
 * and sentence style, as invariant A6 requires.
 */

import type { ColoringMode, ColoringModeId, PaintSubject } from './modes';
import { isColorTokenName, UNPAINTED_TOKEN, type ColorTokenName } from './scales';

/* -------------------------------------------------------------------------- */
/* Colour values, read from the stylesheet.                                    */
/* -------------------------------------------------------------------------- */

/**
 * What each token resolves to, as written in the stylesheet.
 *
 * Partial on purpose: a caller reading from `getComputedStyle` on a page that
 * has not loaded the theme yet gets some tokens and not others, and that should
 * narrow what can be checked rather than crash the panel.
 */
export type Palette = Readonly<Partial<Record<ColorTokenName, string>>>;

/** A colour taken apart. `alpha` is `1` for every opaque notation. */
export interface ParsedColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

const HEX_SHORT_LENGTH = 3;
const HEX_LONG_LENGTH = 6;
const HEX_RADIX = 16;
const CHANNEL_MAX = 255;

/** `#abc`, `#aabbcc`, `rgb(…)` and `rgba(…)`, or `null` for anything else. */
export function parseColor(value: string): ParsedColor | null {
  const text = value.trim();

  if (text.startsWith('#')) {
    return parseHex(text.slice(1));
  }

  const functional = /^rgba?\(([^)]+)\)$/i.exec(text);

  return functional === null ? null : parseFunctional(functional[1] ?? '');
}

function parseHex(digits: string): ParsedColor | null {
  const expand =
    digits.length === HEX_SHORT_LENGTH
      ? [...digits].map((digit) => `${digit}${digit}`).join('')
      : digits;

  if (expand.length !== HEX_LONG_LENGTH || !/^[0-9a-f]{6}$/i.test(expand)) {
    return null;
  }

  const channel = (start: number): number =>
    Number.parseInt(expand.slice(start, start + 2), HEX_RADIX);

  return { red: channel(0), green: channel(2), blue: channel(4), alpha: 1 };
}

function parseFunctional(body: string): ParsedColor | null {
  const parts = body
    .split(/[,/\s]+/)
    .map((part) => part.trim())
    .filter((part) => part !== '');

  const [red, green, blue, alpha] = parts.map((part) => Number.parseFloat(part));

  if (red === undefined || green === undefined || blue === undefined) {
    return null;
  }
  if (!Number.isFinite(red) || !Number.isFinite(green) || !Number.isFinite(blue)) {
    return null;
  }

  return { red, green, blue, alpha: alpha === undefined || !Number.isFinite(alpha) ? 1 : alpha };
}

/**
 * Every token the stylesheet declares, from its text.
 *
 * Declarations the token vocabulary does not know are dropped rather than kept
 * as loose strings, so a palette only ever holds names `scales.ts` can name.
 */
export function parsePalette(cssText: string): Palette {
  const palette: Partial<Record<ColorTokenName, string>> = {};

  for (const match of cssText.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    const name = match[1];
    const value = match[2];

    if (name !== undefined && value !== undefined && isColorTokenName(name)) {
      palette[name] = value.trim();
    }
  }

  return palette;
}

/* -------------------------------------------------------------------------- */
/* Contrast.                                                                   */
/* -------------------------------------------------------------------------- */

/** WCAG 2.2 minimum for body text. */
export const CONTRAST_MINIMUM_BODY = 4.5;

/** WCAG 2.2 minimum for large text and for non-text parts of the interface. */
export const CONTRAST_MINIMUM_LARGE = 3;

/** The sRGB channel transfer function of WCAG 2.2. */
function linearise(channel: number): number {
  const scaled = channel / CHANNEL_MAX;

  return scaled <= 0.03928 ? scaled / 12.92 : Math.pow((scaled + 0.055) / 1.055, 2.4);
}

/** Relative luminance, as WCAG 2.2 defines it. */
export function relativeLuminance(color: ParsedColor): number {
  return (
    0.2126 * linearise(color.red) +
    0.7152 * linearise(color.green) +
    0.0722 * linearise(color.blue)
  );
}

/**
 * The contrast ratio between two opaque colours, from `1` to `21`.
 *
 * Order does not matter — the lighter of the two goes on top of the ratio either
 * way, so a caller cannot get a different answer by swapping the arguments.
 *
 * @example
 * contrastRatio('#ffffff', '#000000')   // 21
 * contrastRatio('#33322f', '#33322f')   // 1
 */
export function contrastRatio(first: string, second: string): number {
  const left = parseColor(first);
  const right = parseColor(second);

  if (left === null || right === null) {
    throw new Error(`contrastRatio: không đọc được màu "${left === null ? first : second}".`);
  }

  const lighter = Math.max(relativeLuminance(left), relativeLuminance(right));
  const darker = Math.min(relativeLuminance(left), relativeLuminance(right));

  return (lighter + 0.05) / (darker + 0.05);
}

/** The verdict on one background/text pair. */
export interface ContrastCheck {
  readonly backgroundToken: ColorTokenName;
  readonly textToken: ColorTokenName;
  /** From `1` to `21`. */
  readonly ratio: number;
  /** What the pair had to clear. */
  readonly threshold: number;
  readonly passes: boolean;
}

/**
 * Does this text token read on this background token?
 *
 * Throws when either token is missing from the palette or is translucent. Both
 * are programming errors rather than states to render around: a contrast ratio
 * against a colour that is partly see-through depends on whatever is behind it,
 * and quietly returning a number computed from the opaque form would be a
 * confident wrong answer.
 *
 * @param threshold Defaults to {@link CONTRAST_MINIMUM_BODY}; pass
 *   {@link CONTRAST_MINIMUM_LARGE} for large text or for a swatch outline.
 */
export function checkContrast(
  backgroundToken: ColorTokenName,
  textToken: ColorTokenName,
  palette: Palette,
  threshold: number = CONTRAST_MINIMUM_BODY,
): ContrastCheck {
  const background = requireOpaque(backgroundToken, palette);
  const text = requireOpaque(textToken, palette);
  const ratio = contrastRatio(background, text);

  return { backgroundToken, textToken, ratio, threshold, passes: ratio >= threshold };
}

function requireOpaque(token: ColorTokenName, palette: Palette): string {
  const value = palette[token];

  if (value === undefined) {
    throw new Error(`checkContrast: bảng màu không có token ${token}.`);
  }

  const parsed = parseColor(value);

  if (parsed === null) {
    throw new Error(`checkContrast: không đọc được giá trị "${value}" của token ${token}.`);
  }
  if (parsed.alpha < 1) {
    throw new Error(
      `checkContrast: token ${token} trong suốt một phần, tỉ số tương phản phụ thuộc nền phía sau.`,
    );
  }

  return value;
}

/* -------------------------------------------------------------------------- */
/* Where a label can be written.                                               */
/* -------------------------------------------------------------------------- */

/** The panel a legend is drawn on, and the fallback background for its labels. */
export const LEGEND_SURFACE_TOKEN: ColorTokenName = '--bg-surface';

/** The text token used on {@link LEGEND_SURFACE_TOKEN}. */
export const LEGEND_TEXT_TOKEN: ColorTokenName = '--text-primary';

/**
 * The text tokens a swatch may be written on, in no particular order.
 *
 * `--bg-surface` is in the list because it is the palette's only light value,
 * and a dark fill such as `--wall-330` needs one; it is the token a designer
 * means by "white text", named as a token rather than spelled as a colour.
 */
const TEXT_TOKEN_CANDIDATES: readonly ColorTokenName[] = [
  '--text-primary',
  '--text-secondary',
  '--bg-surface',
];

/** Whether a label sits inside its swatch or next to it. */
export type LabelPlacement = 'onSwatch' | 'besideSwatch';

/** The readable way to write on a fill, or the verdict that there is none. */
export interface LabelTreatment {
  readonly placement: LabelPlacement;
  /** The background the label is actually drawn on. */
  readonly backgroundToken: ColorTokenName;
  readonly textToken: ColorTokenName;
  readonly ratio: number;
}

/**
 * How to write a label for one swatch so it clears 4,5:1.
 *
 * Picks the candidate with the highest ratio on the fill; when the best of them
 * still falls short, the label moves off the swatch onto the panel surface
 * rather than being written illegibly.
 */
export function resolveLabelTreatment(
  swatchToken: ColorTokenName,
  palette: Palette,
): LabelTreatment {
  let best: ContrastCheck | null = null;

  for (const candidate of TEXT_TOKEN_CANDIDATES) {
    if (palette[candidate] === undefined || palette[swatchToken] === undefined) {
      continue;
    }

    const check = checkContrast(swatchToken, candidate, palette);

    if (best === null || check.ratio > best.ratio) {
      best = check;
    }
  }

  if (best !== null && best.passes) {
    return {
      placement: 'onSwatch',
      backgroundToken: swatchToken,
      textToken: best.textToken,
      ratio: best.ratio,
    };
  }

  const onSurface =
    palette[LEGEND_SURFACE_TOKEN] === undefined || palette[LEGEND_TEXT_TOKEN] === undefined
      ? null
      : checkContrast(LEGEND_SURFACE_TOKEN, LEGEND_TEXT_TOKEN, palette);

  return {
    placement: 'besideSwatch',
    backgroundToken: LEGEND_SURFACE_TOKEN,
    textToken: LEGEND_TEXT_TOKEN,
    ratio: onSurface?.ratio ?? 0,
  };
}

/* -------------------------------------------------------------------------- */
/* The legend.                                                                 */
/* -------------------------------------------------------------------------- */

/** One row of a legend. */
export interface LegendItem {
  /** The fill this row explains. */
  readonly token: ColorTokenName;
  /** Vietnamese, with diacritics, lower case — what the band means. */
  readonly label: string;
  /**
   * The readings the band covers: `"đến 7,60 m²"`, `"7,60 m² – 14,20 m²"`.
   * Empty for a mode whose bands are not a quantity.
   */
  readonly range: string;
  /** How many of the objects in view wear this fill. May be `0`. */
  readonly count: number;
  /** Where this row's label has to be written to stay readable. */
  readonly labelPlacement: LabelPlacement;
  /** The background the label is drawn on, given its placement. */
  readonly labelBackgroundToken: ColorTokenName;
  /** The text token to draw the label in. */
  readonly labelTextToken: ColorTokenName;
}

/** A whole legend, ready to render. */
export interface Legend {
  readonly modeId: ColoringModeId;
  /** The mode's own Vietnamese name. */
  readonly label: string;
  /** One row per band of the scale, in band order. Never more than five. */
  readonly items: readonly LegendItem[];
  /**
   * Objects in view this mode had no reading for — a wall under the area mode,
   * an object on no level under the level mode.
   *
   * Kept out of {@link Legend.items} so the rows stay exactly the bands of the
   * scale, and reported rather than dropped so the counts add up to the view.
   */
  readonly unpaintedCount: number;
  readonly unpaintedToken: ColorTokenName;
  readonly surfaceToken: ColorTokenName;
}

/** The modes whose bands are cut from a quantity and therefore carry ranges. */
const QUANTITY_MODE_IDS: ReadonlySet<ColoringModeId> = new Set<ColoringModeId>([
  'area',
  'aiConfidence',
]);

/**
 * What to call each band of a quantity scale.
 *
 * Named after the reading rather than after the colour, so the words stay true
 * when a mode runs its ramp backwards — the least confident band is "thấp nhất"
 * whether it is painted light or dark.
 */
const QUANTITY_BAND_LABELS: Readonly<Record<'area' | 'aiConfidence', readonly string[]>> = {
  area: ['nhỏ nhất', 'nhỏ', 'trung bình', 'lớn', 'lớn nhất'],
  aiConfidence: ['thấp nhất', 'thấp', 'trung bình', 'cao', 'cao nhất'],
};

/** The name of one band, falling back to its position when the scale is short. */
function quantityBandLabel(modeId: ColoringModeId, index: number, bandCount: number): string {
  const names = modeId === 'area' || modeId === 'aiConfidence' ? QUANTITY_BAND_LABELS[modeId] : [];

  return bandCount === names.length ? (names[index] ?? '') : `bậc ${String(index + 1)}`;
}

/**
 * The legend for one mode over the objects in view.
 *
 * Every field is derived. The rows are the mode's own bands, the ranges are the
 * band labels the mode built from its quantile cuts, and the counts come from
 * asking the mode to paint each object — so the legend is a report on the very
 * picture beside it and cannot drift from it.
 *
 * Bands with no objects in them are kept. A legend that dropped its empty rows
 * would change length as the view changed, and the reader would lose the sense
 * that the scale has five steps at all.
 *
 * @param palette Optional. Without it the readability of a fill cannot be
 *   judged, so every label is placed beside its swatch — the choice that is
 *   always safe. Pass one to let labels sit inside the swatches that can carry
 *   them.
 *
 * @example
 * const mode = createColoringMode('area', { subjects });
 * generateLegend(mode, subjects, parsePalette(css));
 * // { items: [{ label: 'nhỏ nhất', range: 'đến 7,60 m²', count: 7, … }, …] }
 */
export function generateLegend(
  mode: ColoringMode,
  subjects: readonly PaintSubject[],
  palette: Palette = {},
): Legend {
  const isQuantity = QUANTITY_MODE_IDS.has(mode.id);
  const bandCount = mode.bands.length;

  // Counted by the token the mode actually paints, which is the only way the
  // tally can be a report on the picture rather than a second opinion about it.
  const counts = new Map<ColorTokenName, number>();
  let unpaintedCount = 0;

  const bandTokens = new Set(mode.bands.map((band) => band.token));

  for (const subject of subjects) {
    const token = mode.paint(subject);

    if (bandTokens.has(token)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    } else {
      unpaintedCount += 1;
    }
  }

  const items = mode.bands.map((band, index): LegendItem => {
    const treatment = resolveLabelTreatment(band.token, palette);

    return {
      token: band.token,
      label: isQuantity ? quantityBandLabel(mode.id, index, bandCount) : band.label,
      range: isQuantity ? band.label : '',
      count: counts.get(band.token) ?? 0,
      labelPlacement: treatment.placement,
      labelBackgroundToken: treatment.backgroundToken,
      labelTextToken: treatment.textToken,
    };
  });

  return {
    modeId: mode.id,
    label: mode.label,
    items,
    unpaintedCount,
    unpaintedToken: UNPAINTED_TOKEN,
    surfaceToken: LEGEND_SURFACE_TOKEN,
  };
}

/* -------------------------------------------------------------------------- */
/* Pushing the irrelevant back.                                                */
/* -------------------------------------------------------------------------- */

/**
 * How opaque an object that is not part of the current question is drawn.
 *
 * Twelve per cent: enough that the shape of the plan survives — a reader still
 * sees where the other rooms are — and little enough that it cannot be mistaken
 * for a band of the scale.
 */
export const DIMMED_OPACITY = 0.12;

/** How opaque an object that *is* part of the question is drawn. */
export const FOCUSED_OPACITY = 1;

/** Whether an object is part of the current question. */
export type Emphasis = 'focused' | 'dimmed';

/**
 * How one object is drawn: which token, and how opaque.
 *
 * Two fields and no third. There is no overlay token, no tint token and no
 * substitute colour, because the only honest way to push something back is to
 * turn it down.
 */
export interface Appearance {
  readonly token: ColorTokenName;
  readonly opacity: number;
}

/**
 * Fade an object that is not part of the current question.
 *
 * The rule is deliberately narrow, and what it *refuses* to do is the point:
 *
 * - **The token does not change.** A dimmed room keeps the exact fill it had, so
 *   its band is still readable off the legend. Swapping it for a paler token
 *   would move it to a different rung of the very scale the legend explains.
 * - **No grey wash over the top.** Laying a translucent grey across the plan
 *   shifts the hue of everything under it, including the objects still in focus,
 *   and two greys stacked over two different bands can land on the same colour.
 *   Opacity is applied per object, so nothing bleeds onto its neighbour.
 * - **Opacity is the only channel that moves.** Not lightness, not saturation,
 *   not a border, not a shadow.
 *
 * @example
 * applyEmphasis('--state-violation', 'dimmed')
 * // the very same fill comes back, at 0.12 opacity: quieter, not another colour
 */
export function applyEmphasis(token: ColorTokenName, emphasis: Emphasis): Appearance {
  return { token, opacity: emphasis === 'dimmed' ? DIMMED_OPACITY : FOCUSED_OPACITY };
}

/**
 * The appearance of every object in view, with the ones outside the question
 * turned down.
 *
 * @param isRelevant Answers "is this object part of what the reader asked for".
 */
export function applyEmphasisTo(
  mode: ColoringMode,
  subjects: readonly PaintSubject[],
  isRelevant: (subject: PaintSubject) => boolean,
): Appearance[] {
  return subjects.map((subject) =>
    applyEmphasis(mode.paint(subject), isRelevant(subject) ? 'focused' : 'dimmed'),
  );
}
