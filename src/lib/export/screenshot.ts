/**
 * One picture of what is on screen, taken without disturbing what is on screen.
 *
 * A reviewer asks for a screenshot far more often than for a GLB or a dossier:
 * they want one image to paste into a report or send in a message. The whole
 * difficulty is that the obvious way to take it — resize the canvas to 1440,
 * render, read the pixels back, resize it again — is a visible flash and a
 * moved camera, and it is taken on the very frame the person was looking at.
 *
 * So nothing here draws to the screen. The frame is rendered into an **offscreen
 * render target**, read back, and the target is freed at once. Three promises
 * follow from that, and they are the reason this module is shaped the way it is:
 *
 * - **The camera is never written to.** Not its aspect, not its projection
 *   matrix, not its position. The capture keeps the viewport's own aspect ratio
 *   — the height comes from `1440 × viewport.height / viewport.width` — so
 *   there is no aspect to correct and no correction to undo. What the file shows
 *   is what the person was looking at, framed exactly as they framed it.
 * - **The renderer is put back.** The two things a capture must change on it —
 *   which target it draws into, and the clear alpha when the background is asked
 *   to be transparent — are read before and restored in a `finally`, so a render
 *   that throws leaves the renderer exactly as it was found. Its size and pixel
 *   ratio are never touched at all, because the offscreen target carries the
 *   capture's dimensions instead.
 * - **The buffer is freed every time.** {@link CaptureTargetLike.dispose} is
 *   called in the same `finally`. A render target is a texture and a depth
 *   buffer in the driver — around 84 MB at `resolution: 3` — and a garbage
 *   collector cannot free either of them, exactly as `three/perf/dispose.ts`
 *   explains. Four captures in a row therefore cost one target's worth of
 *   graphics memory, not four; `screenshotQueue.ts` depends on that and its test
 *   proves it.
 *
 * ## The information band
 *
 * A picture with no caption is a picture nobody can file. The band under the
 * frame carries the four facts that make one usable months later — project,
 * storey, colouring mode, the moment it was taken — and optionally the legend
 * and a scale bar.
 *
 * It is **drawn on an opaque surface even when the frame behind it is
 * transparent**. Contrast is a ratio between two colours, and text laid over
 * transparency has no second colour: its readability would depend on whatever
 * the reader happened to paste the image onto. Invariant A13 is a promise about
 * the file, so the band brings its own background with it.
 *
 * Colour values are never written here. Every fill and every text run carries a
 * {@link ColorTokenName}, resolved against a {@link Palette} at drawing time —
 * the same arrangement `src/lib/coloring/legend.ts` uses, and for the same
 * reason: `src/styles/globals.css` is the single source of colour and this file
 * must not hold a second copy. Without a palette the band writes every string in
 * the strongest text token, because a quieter token whose contrast cannot be
 * checked is a guess.
 *
 * ## Layout is separate from drawing
 *
 * {@link composeCapture} returns a {@link CaptureComposition}: rectangles, text
 * runs, token names and numbers, and no drawing at all. {@link drawCapture}
 * takes that and a 2D context and paints it. The split is what makes the band
 * testable without a canvas — the same division of labour `exportPdf.ts` keeps
 * between building a dossier's text and rendering its pages.
 *
 * ## Field names
 *
 * The brief names this `chupKhungNhin({ doPhanGiai, nenTrongSuot, coChuGiai,
 * coThuocTiLe })`. Invariants B and E.11 of `CLAUDE.md` forbid Vietnamese
 * identifiers and `CLAUDE.md` wins, so:
 *
 * | Brief            | Here                                     |
 * |------------------|------------------------------------------|
 * | `chupKhungNhin`  | {@link captureViewport}                  |
 * | `doPhanGiai`     | `resolution`                             |
 * | `nenTrongSuot`   | `transparentBackground`                  |
 * | `coChuGiai`      | `includeLegend`                          |
 * | `coThuocTiLe`    | `includeScaleBar`                        |
 *
 * Every string a person reads stays Vietnamese with full diacritics, lower case
 * and sentence style, as invariant A6 requires.
 */

import { WebGLRenderTarget, type Camera, type Object3D } from 'three';

import {
  checkContrast,
  CONTRAST_MINIMUM_BODY,
  LEGEND_SURFACE_TOKEN,
  LEGEND_TEXT_TOKEN,
  type ContrastCheck,
  type Legend,
  type Palette,
} from '@/lib/coloring/legend';
import { COLORING_MODE_LABELS, type ColoringModeId } from '@/lib/coloring/modes';
import type { ColorTokenName } from '@/lib/coloring/scales';
import { formatCalendarDate, formatClockTime, type TimeInput } from '@/lib/format/datetime';
import { formatLength } from '@/lib/format/measure';
import { formatNumber, MISSING_VALUE } from '@/lib/format/number';

import { formatExportTimestamp, toFileSlug } from './exportGlb';
import { PDF_FONT } from './pdfSchema';

/* -------------------------------------------------------------------------- */
/* What a capture is.                                                          */
/* -------------------------------------------------------------------------- */

/** The width every capture is rendered at, whatever the viewport is. */
export const CAPTURE_WIDTH_PX = 1440;

/** The PNG mime type. Lossless, and the only common format that keeps alpha. */
export const SCREENSHOT_MIME_TYPE = 'image/png';

/** Bytes per pixel in the buffer read back from the render target. */
const CHANNELS_PER_PIXEL = 4;

const BYTES_PER_MEGABYTE = 1024 * 1024;

/**
 * How many times the 1440 px grid a capture is rendered at.
 *
 * One is the picture as designed. Two and three are for a report that will be
 * printed, where 1440 px across a page is visibly soft. The band is scaled with
 * the frame rather than left at its 1× size, so the type stays the same
 * proportion of the image at every setting.
 */
export type CaptureResolution = 1 | 2 | 3;

/** The three settings, smallest first. */
export const CAPTURE_RESOLUTIONS: readonly CaptureResolution[] = [1, 2, 3];

/** The four choices a capture is asked for. */
export interface CaptureOptions {
  /** `doPhanGiai`: multiples of the 1440 px grid. */
  readonly resolution: CaptureResolution;
  /**
   * `nenTrongSuot`: render the frame with no background at all.
   *
   * Needs a renderer built with `alpha: true`; on one built without it the
   * clear alpha has no effect and the picture comes back opaque. The band keeps
   * its own opaque surface either way — see the module note.
   */
  readonly transparentBackground: boolean;
  /** `coChuGiai`: include the colouring legend in the band. */
  readonly includeLegend: boolean;
  /** `coThuocTiLe`: include a scale bar in the band. */
  readonly includeScaleBar: boolean;
}

/** What a capture does when the caller says nothing: the picture as designed. */
export const DEFAULT_CAPTURE_OPTIONS: CaptureOptions = Object.freeze({
  resolution: 1,
  transparentBackground: false,
  includeLegend: true,
  includeScaleBar: true,
});

/** The four facts that make a picture filable a year later. */
export interface CaptureInfoInput {
  readonly projectName: string;
  /** The storey on screen, as the storey picker names it. */
  readonly levelName: string;
  /** How the model was coloured; the band prints this mode's own label. */
  readonly coloringMode: ColoringModeId;
  /** When the picture was taken. Passed in, never read from the clock. */
  readonly capturedAt: TimeInput;
  /** IANA zone the moment is written in. Tests should always name one. */
  readonly timeZone?: string;
}

/** How much building one screen pixel covers, for the scale bar. */
export interface CaptureScaleInput {
  /**
   * Millimetres of building per **on-screen** pixel.
   *
   * The caller knows this and the capture cannot work it out: it depends on the
   * camera's projection, and only an orthographic view has one honest answer
   * for the whole frame. A perspective view should pass nothing, and the scale
   * bar is then left off rather than drawn as a number that is only true across
   * the middle of the picture.
   */
  readonly millimetresPerPixel: number;
}

/** The size of the canvas the viewer is drawn on, in CSS pixels. */
export interface CaptureViewportSize {
  readonly widthPx: number;
  readonly heightPx: number;
}

/* -------------------------------------------------------------------------- */
/* The little of three.js a capture touches.                                   */
/* -------------------------------------------------------------------------- */

/**
 * The little of a `WebGLRenderTarget` this module holds: a size, and the one
 * method that frees the driver's memory.
 *
 * A real target satisfies this without a cast, and a test can stand in for one
 * without a WebGL context — which is what lets the queue's memory test count
 * every buffer that was taken and every buffer that was given back.
 */
export interface CaptureTargetLike {
  readonly width: number;
  readonly height: number;
  dispose(): void;
}

/**
 * The little of a `WebGLRenderer` a capture uses.
 *
 * Every method here is either read-and-restore (`getRenderTarget` /
 * `setRenderTarget`, `getClearAlpha` / `setClearAlpha`) or read-only
 * (`render`, `readRenderTargetPixels`). There is deliberately no `setSize` and
 * no `setPixelRatio` on this interface: the capture cannot resize the canvas
 * the person is looking at, because it cannot name the method that would.
 */
export interface CaptureRendererLike {
  render(scene: Object3D, camera: Camera): void;
  getRenderTarget(): CaptureTargetLike | null;
  setRenderTarget(target: CaptureTargetLike | null): void;
  readRenderTargetPixels(
    target: CaptureTargetLike,
    x: number,
    y: number,
    width: number,
    height: number,
    buffer: Uint8Array,
  ): void;
  getClearAlpha(): number;
  setClearAlpha(alpha: number): void;
}

/** The real target. Sized in device pixels, freed after every capture. */
export function createCaptureTarget(widthPx: number, heightPx: number): CaptureTargetLike {
  return new WebGLRenderTarget(widthPx, heightPx);
}

/* -------------------------------------------------------------------------- */
/* The little of a 2D canvas a capture uses.                                   */
/* -------------------------------------------------------------------------- */

/** Pixels arranged the way `putImageData` wants them. */
export interface CaptureImageDataLike {
  readonly data: Uint8ClampedArray;
}

/**
 * The little of `CanvasRenderingContext2D` the band is painted with.
 *
 * `fillStyle` keeps the platform's wide type so a real context is assignable
 * without a cast; nothing here ever assigns anything but a colour string to it.
 */
export interface CaptureContext2DLike {
  fillStyle: string | CanvasGradient | CanvasPattern;
  font: string;
  textBaseline: CanvasTextBaseline;
  fillRect(x: number, y: number, width: number, height: number): void;
  clearRect(x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number): void;
  createImageData(width: number, height: number): CaptureImageDataLike;
  putImageData(image: CaptureImageDataLike, dx: number, dy: number): void;
}

/** The little of a canvas a capture needs: a context, and a file at the end. */
export interface CaptureCanvasLike {
  readonly width: number;
  readonly height: number;
  getContext2D(): CaptureContext2DLike | null;
  toBlob(mimeType: string): Promise<Blob>;
}

/**
 * An offscreen canvas of the given size.
 *
 * `OffscreenCanvas` where the runtime has it — it never enters the document, so
 * nothing can lay it out or paint it — and a detached `<canvas>` element
 * otherwise. Both are wrapped rather than returned raw, because the two spell
 * "give me the file" differently (`convertToBlob` against `toBlob`) and the
 * difference has no business leaking into the capture.
 */
export function createCaptureCanvas(widthPx: number, heightPx: number): CaptureCanvasLike {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(widthPx, heightPx);

    return {
      width: widthPx,
      height: heightPx,
      getContext2D: () => canvas.getContext('2d'),
      toBlob: (mimeType) => canvas.convertToBlob({ type: mimeType }),
    };
  }

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;

  return {
    width: widthPx,
    height: heightPx,
    getContext2D: () => canvas.getContext('2d'),
    toBlob: (mimeType) =>
      new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob === null) {
            reject(new Error(CANVAS_ENCODE_FAILED_MESSAGE));
            return;
          }
          resolve(blob);
        }, mimeType);
      }),
  };
}

/** Said when the canvas refuses to encode the picture it was just given. */
export const CANVAS_ENCODE_FAILED_MESSAGE = 'Không mã hoá được ảnh chụp thành tệp PNG.';

/** Said when the runtime hands back no 2D context to draw the band with. */
export const CANVAS_CONTEXT_MISSING_MESSAGE = 'Không mở được ngữ cảnh 2D để vẽ dải thông tin.';

/* -------------------------------------------------------------------------- */
/* Layout.                                                                     */
/* -------------------------------------------------------------------------- */

/** Every measurement the band is laid out by, at `resolution: 1`, in pixels. */
export interface CaptureLayout {
  /** Space between the band's contents and its edges. */
  readonly paddingPx: number;
  /** Space between two rows of the band. */
  readonly rowGapPx: number;
  /** Space between two fields of the information row. */
  readonly columnGapPx: number;
  /** The small lower-case label above a value. */
  readonly labelFontPx: number;
  /** The value itself. */
  readonly valueFontPx: number;
  /** Space between a label and the value under it. */
  readonly labelValueGapPx: number;
  /** The side of a legend swatch. */
  readonly legendSwatchPx: number;
  /** Space between a swatch and its label. */
  readonly legendGapPx: number;
  readonly legendLabelFontPx: number;
  /** The bar itself, drawn as a solid rule. */
  readonly scaleBarHeightPx: number;
  readonly scaleLabelFontPx: number;
  readonly scaleLabelGapPx: number;
  /** The hairline between the picture and the band. */
  readonly hairlinePx: number;
  /** A scale bar shorter than this says nothing useful, so none is drawn. */
  readonly minScaleBarPx: number;
  /** A scale bar longer than this crowds the row it shares. */
  readonly maxScaleBarPx: number;
}

/**
 * The band's measurements. One constant, and deliberately only one.
 *
 * The same argument `SCENE_BUDGET` makes: numbers spread over a file drift
 * apart, and a band whose padding is written in four places is a band nobody
 * can adjust. Type sizes aside, everything sits on the 4 px grid Tailwind
 * spaces the interface by, so the picture and the screen it came from are laid
 * out to the same rhythm.
 *
 * Frozen, so a caller cannot quietly widen the band at runtime.
 */
export const CAPTURE_LAYOUT: CaptureLayout = Object.freeze({
  paddingPx: 16,
  rowGapPx: 12,
  columnGapPx: 24,
  labelFontPx: 11,
  valueFontPx: 15,
  labelValueGapPx: 4,
  legendSwatchPx: 16,
  legendGapPx: 8,
  legendLabelFontPx: 12,
  scaleBarHeightPx: 6,
  scaleLabelFontPx: 12,
  scaleLabelGapPx: 4,
  hairlinePx: 1,
  minScaleBarPx: 96,
  maxScaleBarPx: 320,
});

/**
 * Leading as a multiple of the font size.
 *
 * 1,45 rather than the usual 1,2 because Vietnamese stacks two marks on one
 * letter — `ệ`, `ữ`, `ỗ` — and a line box cut to Latin ascenders clips the
 * upper one. The band is the one place in the product where a clipped diacritic
 * cannot be fixed by scrolling: it is already a file.
 */
const VIETNAMESE_LINE_HEIGHT = 1.45;

/**
 * The width of an average glyph, as a fraction of the font size.
 *
 * Used only to decide where to cut a string that would otherwise run into the
 * next field. It is an estimate and is deliberately generous — measuring
 * properly would mean owning a canvas context before the layout exists, which
 * would make the layout untestable to save a few pixels of slack.
 */
const AVERAGE_GLYPH_RATIO = 0.58;

/** The character a truncated string ends with. */
const ELLIPSIS = '…';

/** Canvas weights, named the way the interface names them. */
export type CaptureFontWeight = 'regular' | 'medium';

const FONT_WEIGHTS: Readonly<Record<CaptureFontWeight, number>> = { regular: 400, medium: 500 };

/**
 * A canvas `font` string in the family the exports already use.
 *
 * `PDF_FONT` is read rather than restated: it is this repository's answer to
 * "which family has complete Vietnamese coverage", and a screenshot is an
 * exported artefact with the same problem as a printed page.
 */
export function captureFontOf(sizePx: number, weight: CaptureFontWeight): string {
  const families = [PDF_FONT.family, ...PDF_FONT.fallbacks]
    .map((family) => `"${family}"`)
    .join(', ');

  return `${String(FONT_WEIGHTS[weight])} ${String(sizePx)}px ${families}, sans-serif`;
}

/** The height of one line of type at a given size. */
function lineHeightOf(fontPx: number): number {
  return Math.round(fontPx * VIETNAMESE_LINE_HEIGHT);
}

/** A string cut to fit a width, with an ellipsis where it was cut. */
export function fitText(text: string, fontPx: number, maxWidthPx: number): string {
  const glyphs = Math.floor(maxWidthPx / (fontPx * AVERAGE_GLYPH_RATIO));

  if (glyphs <= 0) {
    return '';
  }
  if (text.length <= glyphs) {
    return text;
  }

  return `${text.slice(0, Math.max(glyphs - 1, 0)).trimEnd()}${ELLIPSIS}`;
}

/* -------------------------------------------------------------------------- */
/* The scale bar.                                                              */
/* -------------------------------------------------------------------------- */

/** A bar of known length, and what to write under it. */
export interface CaptureScaleBar {
  /** The building length the bar spans, in millimetres. */
  readonly lengthMm: number;
  /** How long the bar is drawn, in device pixels. */
  readonly widthPx: number;
  /** `"5,00 m"`, `"500 mm"` — written by the canonical length formatter. */
  readonly label: string;
}

/** The 1–2–5 series: the lengths a person reads off a bar without arithmetic. */
const NICE_MANTISSAS: readonly number[] = [1, 2, 5];

/**
 * The longest round length that fits, and how wide it is drawn.
 *
 * Round means the 1–2–5 series — 1 m, 2 m, 5 m, 10 m — because a bar labelled
 * `7,43 m` is a bar nobody can halve by eye. `null` when the reading is not a
 * usable number, or when even the smallest round length would draw a bar too
 * short to measure anything with.
 *
 * @param millimetresPerPixel Building millimetres per pixel **of the image**.
 * @param maxWidthPx The most room the bar may take.
 *
 * @example
 * chooseScaleBar(20, 320)   // { lengthMm: 5000, widthPx: 250, label: '5,00 m' }
 */
export function chooseScaleBar(
  millimetresPerPixel: number,
  maxWidthPx: number,
  minWidthPx = CAPTURE_LAYOUT.minScaleBarPx,
): CaptureScaleBar | null {
  if (!Number.isFinite(millimetresPerPixel) || millimetresPerPixel <= 0 || maxWidthPx <= 0) {
    return null;
  }

  const longestMm = millimetresPerPixel * maxWidthPx;
  const exponent = Math.floor(Math.log10(longestMm));
  let chosenMm = 0;

  // Walk down from the decade that contains the longest bar that fits, taking
  // the largest round length that still fits. Two decades is enough: the
  // largest mantissa of the next decade down is smaller than the smallest of
  // this one, so a third pass could never beat what the second already found.
  for (const decade of [exponent, exponent - 1]) {
    for (const mantissa of NICE_MANTISSAS) {
      const candidateMm = mantissa * Math.pow(10, decade);

      if (candidateMm <= longestMm && candidateMm > chosenMm) {
        chosenMm = candidateMm;
      }
    }
  }

  if (chosenMm <= 0) {
    return null;
  }

  const widthPx = chosenMm / millimetresPerPixel;

  return widthPx < minWidthPx
    ? null
    : { lengthMm: chosenMm, widthPx, label: formatLength(chosenMm) };
}

/* -------------------------------------------------------------------------- */
/* What the band is made of.                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The band's own surface, which is opaque whatever the frame behind it is.
 *
 * The same token the legend panel is drawn on, read from `coloring/legend.ts`
 * rather than written again: the band *is* a legend panel that happens to have
 * been flattened into a picture, and a second copy of the name is a second
 * thing to update when the panel moves to another surface.
 */
export const BAND_SURFACE_TOKEN: ColorTokenName = LEGEND_SURFACE_TOKEN;

/** The hairline between the picture and the band. */
export const BAND_BORDER_TOKEN: ColorTokenName = '--border-default';

/** The token every string is written in when nothing quieter can be verified. */
export const BAND_STRONG_TEXT_TOKEN: ColorTokenName = '--text-primary';

/** The quieter token, used for labels only when it clears 4,5:1 on the surface. */
export const BAND_QUIET_TEXT_TOKEN: ColorTokenName = '--text-secondary';

/** One run of text, already placed and already truncated. */
export interface CaptureTextRun {
  readonly text: string;
  readonly xPx: number;
  /** The top of the line box; the drawing uses the `top` baseline. */
  readonly topYPx: number;
  readonly fontPx: number;
  readonly weight: CaptureFontWeight;
  readonly token: ColorTokenName;
}

/** One filled rectangle: a swatch, a rule, the band itself. */
export interface CaptureRect {
  readonly xPx: number;
  readonly yPx: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly token: ColorTokenName;
}

/** Where the rendered frame sits in the finished image. */
export interface CaptureFrameBox {
  readonly xPx: number;
  readonly yPx: number;
  readonly widthPx: number;
  readonly heightPx: number;
}

/**
 * The finished layout: rectangles, text and token names, and no drawing.
 *
 * Everything is in device pixels — the resolution has already been applied — so
 * a drawing step never multiplies anything.
 */
export interface CaptureComposition {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly resolution: CaptureResolution;
  /** Where the rendered pixels go. Always the top of the image. */
  readonly frame: CaptureFrameBox;
  /** The band under the frame; `null` when there was nothing to say. */
  readonly band: CaptureRect | null;
  /** Swatches, rules and the scale bar, in drawing order. */
  readonly rects: readonly CaptureRect[];
  readonly texts: readonly CaptureTextRun[];
  /** The bar that was drawn, or `null` when none could be. */
  readonly scaleBar: CaptureScaleBar | null;
  /**
   * Every background/text pair the band used, already checked.
   *
   * Empty when no palette was supplied — which is also the case in which the
   * band writes everything in {@link BAND_STRONG_TEXT_TOKEN}, so an unchecked
   * pair is never a quiet one.
   */
  readonly contrast: readonly ContrastCheck[];
}

/** The text tokens the band may use, and the checks that chose them. */
interface BandTypography {
  /** Values and the scale bar: the darkest text token in the palette. */
  readonly strong: ColorTokenName;
  /** Field labels — quieter, but only when it is still readable. */
  readonly quiet: ColorTokenName;
  /** Legend rows, written in the token the legend panel itself uses. */
  readonly legend: ColorTokenName;
  readonly checks: readonly ContrastCheck[];
}

/**
 * Which tokens the band writes in, on this palette.
 *
 * The strong token is the fallback for everything, because it is the darkest
 * text token the palette has and the band surface is its lightest. The quieter
 * label token and the legend's own text token are kept **only** when they clear
 * {@link CONTRAST_MINIMUM_BODY} against that surface; where one does not, its
 * strings are written strong instead. A label in a token that fails is not a
 * quieter label, it is an unreadable one.
 *
 * With no palette nothing can be checked, so nothing quieter is used: every
 * string comes back strong, which is the choice that is always safe.
 */
function resolveBandTypography(palette: Palette): BandTypography {
  if (palette[BAND_SURFACE_TOKEN] === undefined) {
    return {
      strong: BAND_STRONG_TEXT_TOKEN,
      quiet: BAND_STRONG_TEXT_TOKEN,
      legend: BAND_STRONG_TEXT_TOKEN,
      checks: [],
    };
  }

  const checks: ContrastCheck[] = [];

  /** The token if it reads on the surface, or the strong one if it does not. */
  const readable = (token: ColorTokenName): ColorTokenName => {
    if (palette[token] === undefined) {
      return BAND_STRONG_TEXT_TOKEN;
    }

    const check = checkContrast(BAND_SURFACE_TOKEN, token, palette, CONTRAST_MINIMUM_BODY);
    checks.push(check);

    return check.passes ? token : BAND_STRONG_TEXT_TOKEN;
  };

  return {
    strong: readable(BAND_STRONG_TEXT_TOKEN),
    quiet: readable(BAND_QUIET_TEXT_TOKEN),
    legend: readable(LEGEND_TEXT_TOKEN),
    checks,
  };
}

/* -------------------------------------------------------------------------- */
/* Composing.                                                                  */
/* -------------------------------------------------------------------------- */

/** What the information row is headed with. Lower case, sentence style (A6). */
export const INFO_FIELD_LABELS = Object.freeze({
  project: 'dự án',
  level: 'tầng',
  coloring: 'chế độ tô màu',
  capturedAt: 'thời điểm',
});

/** Written over the legend row, so a reader knows what the swatches explain. */
export const LEGEND_ROW_LABEL = 'chú giải';

/** Written over the scale bar. */
export const SCALE_ROW_LABEL = 'thước tỉ lệ';

/** `17/08/2026 14:32`, or the dash when there is no usable moment. */
export function formatCaptureMoment(capturedAt: TimeInput, timeZone?: string): string {
  const options = timeZone === undefined ? {} : { timeZone };
  const date = formatCalendarDate(capturedAt, options);

  return date === MISSING_VALUE ? MISSING_VALUE : `${date} ${formatClockTime(capturedAt, options)}`;
}

/** Everything {@link composeCapture} lays out, already in device pixels. */
export interface ComposeCaptureInput {
  /** The rendered frame's size in device pixels. */
  readonly frameWidthPx: number;
  readonly frameHeightPx: number;
  readonly resolution: CaptureResolution;
  readonly options: CaptureOptions;
  /** The four facts. Left out, no information row is drawn. */
  readonly info?: CaptureInfoInput;
  /** The legend of the colouring mode, as `generateLegend` built it. */
  readonly legend?: Legend;
  /** Millimetres of building per pixel **of the image**, not of the screen. */
  readonly millimetresPerPixel?: number;
  /** Token values from the stylesheet. Without it the band writes strong only. */
  readonly palette?: Palette;
}

/**
 * Lay the picture and its band out, and check every colour pair it uses.
 *
 * Pure: same input, same composition, no canvas, no clock, no store. The band
 * is omitted entirely when there is nothing to put in it, so a caller that asks
 * for no information, no legend and no scale bar gets exactly the frame.
 *
 * @example
 * composeCapture({
 *   frameWidthPx: 1440, frameHeightPx: 810, resolution: 1,
 *   options: DEFAULT_CAPTURE_OPTIONS, info, legend, millimetresPerPixel: 20, palette,
 * });
 */
export function composeCapture(input: ComposeCaptureInput): CaptureComposition {
  const scale = input.resolution;
  const layout = CAPTURE_LAYOUT;

  /** A layout measurement in device pixels. */
  const px = (value: number): number => value * scale;

  /**
   * A line box in device pixels.
   *
   * Rounded at 1× and *then* scaled, never rounded after scaling: rounding
   * twice would make the band at 2× a pixel or two off exactly twice the band
   * at 1×, and "the same picture, larger" is the whole promise of the
   * resolution setting.
   */
  const line = (fontPx: number): number => lineHeightOf(fontPx) * scale;

  const frame: CaptureFrameBox = {
    xPx: 0,
    yPx: 0,
    widthPx: input.frameWidthPx,
    heightPx: input.frameHeightPx,
  };

  const typography = resolveBandTypography(input.palette ?? {});
  const rects: CaptureRect[] = [];
  const texts: CaptureTextRun[] = [];

  const legend =
    input.options.includeLegend && input.legend !== undefined && input.legend.items.length > 0
      ? input.legend
      : null;
  const scaleBar = input.options.includeScaleBar
    ? chooseScaleBar(
        input.millimetresPerPixel ?? 0,
        px(layout.maxScaleBarPx),
        px(layout.minScaleBarPx),
      )
    : null;

  const info = input.info ?? null;

  if (info === null && legend === null && scaleBar === null) {
    return {
      widthPx: frame.widthPx,
      heightPx: frame.heightPx,
      resolution: input.resolution,
      frame,
      band: null,
      rects: [],
      texts: [],
      scaleBar: null,
      contrast: typography.checks,
    };
  }

  const labelLine = line(layout.labelFontPx);
  const valueLine = line(layout.valueFontPx);
  const legendLine = Math.max(px(layout.legendSwatchPx), line(layout.legendLabelFontPx));
  const scaleLine =
    labelLine +
    px(layout.scaleLabelGapPx) +
    px(layout.scaleBarHeightPx) +
    px(layout.scaleLabelGapPx) +
    line(layout.scaleLabelFontPx);

  const rowHeights: number[] = [];
  if (info !== null) {
    rowHeights.push(labelLine + px(layout.labelValueGapPx) + valueLine);
  }
  if (legend !== null) {
    rowHeights.push(labelLine + px(layout.labelValueGapPx) + legendLine);
  }
  if (scaleBar !== null) {
    rowHeights.push(scaleLine);
  }

  const bandHeight =
    px(layout.hairlinePx) +
    px(layout.paddingPx) * 2 +
    rowHeights.reduce((total, height) => total + height, 0) +
    px(layout.rowGapPx) * Math.max(rowHeights.length - 1, 0);

  const band: CaptureRect = {
    xPx: 0,
    yPx: frame.heightPx,
    widthPx: frame.widthPx,
    heightPx: bandHeight,
    token: BAND_SURFACE_TOKEN,
  };

  rects.push(band);
  rects.push({
    xPx: 0,
    yPx: frame.heightPx,
    widthPx: frame.widthPx,
    heightPx: px(layout.hairlinePx),
    token: BAND_BORDER_TOKEN,
  });

  const contentLeft = px(layout.paddingPx);
  const contentWidth = frame.widthPx - px(layout.paddingPx) * 2;
  let rowTop = frame.heightPx + px(layout.hairlinePx) + px(layout.paddingPx);

  if (info !== null) {
    const fields: readonly (readonly [string, string])[] = [
      [INFO_FIELD_LABELS.project, info.projectName],
      [INFO_FIELD_LABELS.level, info.levelName],
      [INFO_FIELD_LABELS.coloring, COLORING_MODE_LABELS[info.coloringMode]],
      [INFO_FIELD_LABELS.capturedAt, formatCaptureMoment(info.capturedAt, info.timeZone)],
    ];

    const gap = px(layout.columnGapPx);
    const columnWidth = (contentWidth - gap * (fields.length - 1)) / fields.length;

    fields.forEach(([label, value], index) => {
      const columnLeft = contentLeft + index * (columnWidth + gap);

      texts.push({
        text: fitText(label, px(layout.labelFontPx), columnWidth),
        xPx: columnLeft,
        topYPx: rowTop,
        fontPx: px(layout.labelFontPx),
        weight: 'regular',
        token: typography.quiet,
      });
      texts.push({
        text: fitText(value, px(layout.valueFontPx), columnWidth),
        xPx: columnLeft,
        topYPx: rowTop + labelLine + px(layout.labelValueGapPx),
        fontPx: px(layout.valueFontPx),
        weight: 'medium',
        token: typography.strong,
      });
    });

    rowTop += labelLine + px(layout.labelValueGapPx) + valueLine + px(layout.rowGapPx);
  }

  if (legend !== null) {
    texts.push({
      text: LEGEND_ROW_LABEL,
      xPx: contentLeft,
      topYPx: rowTop,
      fontPx: px(layout.labelFontPx),
      weight: 'regular',
      token: typography.quiet,
    });

    const swatchTop = rowTop + labelLine + px(layout.labelValueGapPx);
    const gap = px(layout.columnGapPx);
    const cellWidth = (contentWidth - gap * (legend.items.length - 1)) / legend.items.length;
    const labelWidth = cellWidth - px(layout.legendSwatchPx) - px(layout.legendGapPx);

    legend.items.forEach((item, index) => {
      const cellLeft = contentLeft + index * (cellWidth + gap);

      rects.push({
        xPx: cellLeft,
        yPx: swatchTop,
        widthPx: px(layout.legendSwatchPx),
        heightPx: px(layout.legendSwatchPx),
        token: item.token,
      });

      // Always beside the swatch, never inside it. `resolveLabelTreatment` in
      // `coloring/legend.ts` explains why three of the ramp tokens can carry no
      // readable text; at this size no swatch could hold a word anyway, so the
      // band takes that module's always-safe placement for every row.
      const range = item.range === '' ? '' : ` ${item.range}`;
      const text = `${item.label}${range} (${formatNumber(item.count, { fractionDigits: 0 })})`;

      const labelLead = Math.max(
        (px(layout.legendSwatchPx) - line(layout.legendLabelFontPx)) / 2,
        0,
      );

      texts.push({
        text: fitText(text, px(layout.legendLabelFontPx), labelWidth),
        xPx: cellLeft + px(layout.legendSwatchPx) + px(layout.legendGapPx),
        topYPx: swatchTop + labelLead,
        fontPx: px(layout.legendLabelFontPx),
        weight: 'regular',
        token: typography.legend,
      });
    });

    rowTop += labelLine + px(layout.labelValueGapPx) + legendLine + px(layout.rowGapPx);
  }

  if (scaleBar !== null) {
    texts.push({
      text: SCALE_ROW_LABEL,
      xPx: contentLeft,
      topYPx: rowTop,
      fontPx: px(layout.labelFontPx),
      weight: 'regular',
      token: typography.quiet,
    });

    const barTop = rowTop + labelLine + px(layout.scaleLabelGapPx);

    rects.push({
      xPx: contentLeft,
      yPx: barTop,
      widthPx: scaleBar.widthPx,
      heightPx: px(layout.scaleBarHeightPx),
      token: typography.strong,
    });

    texts.push({
      text: scaleBar.label,
      xPx: contentLeft,
      topYPx: barTop + px(layout.scaleBarHeightPx) + px(layout.scaleLabelGapPx),
      fontPx: px(layout.scaleLabelFontPx),
      weight: 'medium',
      token: typography.strong,
    });
  }

  return {
    widthPx: frame.widthPx,
    heightPx: frame.heightPx + bandHeight,
    resolution: input.resolution,
    frame,
    band,
    rects,
    texts,
    scaleBar,
    contrast: typography.checks,
  };
}

/* -------------------------------------------------------------------------- */
/* Drawing.                                                                    */
/* -------------------------------------------------------------------------- */

/** Said when a token the composition needs is missing from the palette. */
export function missingTokenMessage(token: ColorTokenName): string {
  return `Bảng màu không có token ${token}, không vẽ được dải thông tin.`;
}

/**
 * Turn the pixels the renderer read back into an image the canvas accepts.
 *
 * WebGL numbers its rows from the bottom and a canvas numbers them from the
 * top, so the buffer is copied row by row in reverse. Doing it here rather than
 * with a second render — three has no "flip the framebuffer" switch — costs one
 * pass over the pixels and no graphics memory at all.
 */
export function toImageData(
  context: CaptureContext2DLike,
  pixels: Uint8Array,
  widthPx: number,
  heightPx: number,
): CaptureImageDataLike {
  const image = context.createImageData(widthPx, heightPx);
  const rowLength = widthPx * CHANNELS_PER_PIXEL;

  for (let row = 0; row < heightPx; row += 1) {
    const source = (heightPx - 1 - row) * rowLength;
    image.data.set(pixels.subarray(source, source + rowLength), row * rowLength);
  }

  return image;
}

/**
 * Paint a composition onto a 2D context.
 *
 * Every token is resolved through the palette here and nowhere else, which is
 * what keeps this file free of colour values. A token the palette does not
 * carry is an error rather than a silent black: a band drawn in a colour nobody
 * chose is exactly the outcome the token rule exists to prevent.
 *
 * @throws Error naming the token when the palette is missing one it needs.
 */
export function drawCapture(
  context: CaptureContext2DLike,
  composition: CaptureComposition,
  pixels: Uint8Array,
  palette: Palette,
): void {
  const colourOf = (token: ColorTokenName): string => {
    const value = palette[token];

    if (value === undefined) {
      throw new Error(missingTokenMessage(token));
    }

    return value;
  };

  // Transparency is the absence of paint, so the picture starts as nothing and
  // only the band brings a surface with it.
  context.clearRect(0, 0, composition.widthPx, composition.heightPx);

  context.putImageData(
    toImageData(context, pixels, composition.frame.widthPx, composition.frame.heightPx),
    composition.frame.xPx,
    composition.frame.yPx,
  );

  for (const rect of composition.rects) {
    context.fillStyle = colourOf(rect.token);
    context.fillRect(rect.xPx, rect.yPx, rect.widthPx, rect.heightPx);
  }

  context.textBaseline = 'top';

  for (const run of composition.texts) {
    context.fillStyle = colourOf(run.token);
    context.font = captureFontOf(run.fontPx, run.weight);
    context.fillText(run.text, run.xPx, run.topYPx);
  }
}

/* -------------------------------------------------------------------------- */
/* The capture itself.                                                         */
/* -------------------------------------------------------------------------- */

/** What the viewer looked like, before the capture and after it. */
export interface RendererState {
  readonly target: CaptureTargetLike | null;
  readonly clearAlpha: number;
}

/** Read the two things a capture is allowed to change. */
export function readRendererState(renderer: CaptureRendererLike): RendererState {
  return { target: renderer.getRenderTarget(), clearAlpha: renderer.getClearAlpha() };
}

/** Everything a capture is asked for. */
export interface CaptureViewportInput {
  readonly renderer: CaptureRendererLike;
  readonly scene: Object3D;
  readonly camera: Camera;
  /** The on-screen canvas. Only its ratio is used; it is never resized. */
  readonly viewport: CaptureViewportSize;
  /** Anything omitted falls back to {@link DEFAULT_CAPTURE_OPTIONS}. */
  readonly options?: Partial<CaptureOptions>;
  readonly info?: CaptureInfoInput;
  readonly legend?: Legend;
  readonly scale?: CaptureScaleInput;
  /** Token values, as `parsePalette` or `getComputedStyle` supplies them. */
  readonly palette?: Palette;
}

/** How the host environment is wired; every field has a production default. */
export interface CaptureHostOptions {
  /** How the offscreen target is made. A test passes a stand-in. */
  readonly createTarget?: (widthPx: number, heightPx: number) => CaptureTargetLike;
  /** How the offscreen canvas is made. A test passes a stand-in. */
  readonly createCanvas?: (widthPx: number, heightPx: number) => CaptureCanvasLike;
  /**
   * The clock the file name falls back to when the caller named no moment.
   *
   * Never read inside this module — `format/datetime.ts` states the rule and
   * `exportGlb.ts` takes the same argument for the same reason: a name stamped
   * from a clock this file fetched itself could not be asserted in a test.
   */
  readonly now?: () => Date;
}

/** The finished picture. It goes nowhere until the caller sends it somewhere. */
export interface CaptureResult {
  readonly blob: Blob;
  readonly fileName: string;
  readonly widthPx: number;
  readonly heightPx: number;
  /** What was laid out, so a caller can report the scale bar it got. */
  readonly composition: CaptureComposition;
}

/** Said when the viewport handed in has no area to take a picture of. */
export const EMPTY_VIEWPORT_MESSAGE = 'Khung nhìn không có kích thước, không chụp được.';

/** The frame size for a viewport: 1440 wide at 1×, and the viewport's own ratio. */
export function frameSizeOf(
  viewport: CaptureViewportSize,
  resolution: CaptureResolution,
): { readonly widthPx: number; readonly heightPx: number } {
  const heightAtBaseline = Math.round((CAPTURE_WIDTH_PX * viewport.heightPx) / viewport.widthPx);

  return {
    widthPx: CAPTURE_WIDTH_PX * resolution,
    heightPx: Math.max(heightAtBaseline, 1) * resolution,
  };
}

/**
 * What one capture costs in graphics memory while it is being taken.
 *
 * The target's colour and depth buffers, plus the buffer the pixels are read
 * back into. Worth checking against `SCENE_BUDGET.maxGraphicsMemoryMb` before
 * offering `resolution: 3` on a machine that is already near its ceiling —
 * which is the whole reason this is a function rather than a comment.
 */
export function estimateCaptureMemoryMb(widthPx: number, heightPx: number): number {
  const pixels = widthPx * heightPx;
  // Colour and depth on the driver's side, and one read-back buffer on ours.
  const bytes = pixels * CHANNELS_PER_PIXEL * 3;

  return bytes / BYTES_PER_MEGABYTE;
}

/**
 * Render the frame offscreen and hand back its pixels, leaving the renderer as
 * it was found.
 *
 * The target is freed in the `finally`, so a render that throws frees it too —
 * a leaked render target is the one failure mode of this module that a person
 * would not notice until the fourth or fifth capture.
 */
function renderFrame(
  input: CaptureViewportInput,
  widthPx: number,
  heightPx: number,
  transparentBackground: boolean,
  createTarget: (widthPx: number, heightPx: number) => CaptureTargetLike,
): Uint8Array {
  const { renderer } = input;
  const before = readRendererState(renderer);
  const target = createTarget(widthPx, heightPx);
  const pixels = new Uint8Array(widthPx * heightPx * CHANNELS_PER_PIXEL);

  try {
    if (transparentBackground) {
      renderer.setClearAlpha(0);
    }
    renderer.setRenderTarget(target);
    renderer.render(input.scene, input.camera);
    renderer.readRenderTargetPixels(target, 0, 0, widthPx, heightPx, pixels);
  } finally {
    // Unbind before freeing: a target that is still current when it is disposed
    // is a target the next frame draws into after the driver has taken it back.
    renderer.setRenderTarget(before.target);
    renderer.setClearAlpha(before.clearAlpha);
    target.dispose();
  }

  return pixels;
}

/**
 * The file name a capture is offered under.
 *
 * The same shape `buildGlbFileName` gives an export — project, storey, date and
 * time — built from that module's own helpers so the two cannot drift into
 * different conventions.
 *
 * @example
 * buildScreenshotFileName('Chung cư Hoàng Anh', 'Tầng 2', new Date())
 * // 'chung-cu-hoang-anh_tang-2_2026-08-17_14-32-05.png'
 */
export function buildScreenshotFileName(
  projectName: string,
  levelName: string,
  capturedAt: Date,
): string {
  const level = levelName.trim() === '' ? [] : [toFileSlug(levelName)];

  return [toFileSlug(projectName), ...level, formatExportTimestamp(capturedAt)].join('_') + '.png';
}

/**
 * Take one picture of the viewer, 1440 px wide, without touching the viewer.
 *
 * ```ts
 * const shot = await captureViewport({
 *   renderer, scene, camera,
 *   viewport: { widthPx: canvas.clientWidth, heightPx: canvas.clientHeight },
 *   options: { resolution: 2 },
 *   info: { projectName, levelName, coloringMode, capturedAt: new Date() },
 *   legend, scale: { millimetresPerPixel }, palette,
 * });
 * ```
 *
 * The promise settles once: with the PNG, or with the error that stopped it.
 * Either way the renderer is back where it started and the offscreen buffer has
 * been freed before the caller hears anything.
 *
 * @throws RangeError when the viewport has no area.
 * @throws Error when no 2D context or no PNG can be had, or when the palette is
 *   missing a token the band needs.
 */
export async function captureViewport(
  input: CaptureViewportInput,
  host: CaptureHostOptions = {},
): Promise<CaptureResult> {
  if (
    !Number.isFinite(input.viewport.widthPx) ||
    !Number.isFinite(input.viewport.heightPx) ||
    input.viewport.widthPx <= 0 ||
    input.viewport.heightPx <= 0
  ) {
    throw new RangeError(EMPTY_VIEWPORT_MESSAGE);
  }

  const options: CaptureOptions = { ...DEFAULT_CAPTURE_OPTIONS, ...input.options };
  const frame = frameSizeOf(input.viewport, options.resolution);
  const palette = input.palette ?? {};

  // Millimetres per pixel is a reading about the screen; the image is a
  // different number of pixels wide, so the reading is converted before any bar
  // is chosen from it.
  const millimetresPerPixel =
    input.scale === undefined
      ? undefined
      : (input.scale.millimetresPerPixel * input.viewport.widthPx) / frame.widthPx;

  const composition = composeCapture({
    frameWidthPx: frame.widthPx,
    frameHeightPx: frame.heightPx,
    resolution: options.resolution,
    options,
    ...(input.info === undefined ? {} : { info: input.info }),
    ...(input.legend === undefined ? {} : { legend: input.legend }),
    ...(millimetresPerPixel === undefined ? {} : { millimetresPerPixel }),
    palette,
  });

  const pixels = renderFrame(
    input,
    frame.widthPx,
    frame.heightPx,
    options.transparentBackground,
    host.createTarget ?? createCaptureTarget,
  );

  const canvas = (host.createCanvas ?? createCaptureCanvas)(
    composition.widthPx,
    composition.heightPx,
  );
  const context = canvas.getContext2D();

  if (context === null) {
    throw new Error(CANVAS_CONTEXT_MISSING_MESSAGE);
  }

  drawCapture(context, composition, pixels, palette);

  const blob = await canvas.toBlob(SCREENSHOT_MIME_TYPE);

  return {
    blob,
    fileName: buildScreenshotFileName(
      input.info?.projectName ?? '',
      input.info?.levelName ?? '',
      stampOf(input.info?.capturedAt, host.now),
    ),
    widthPx: composition.widthPx,
    heightPx: composition.heightPx,
    composition,
  };
}

/**
 * The moment a file name is stamped with: the one the caller named, or the
 * host's clock when they named none.
 *
 * A `Date` that is not a real instant — `new Date('nonsense')` out of an API
 * response — is treated as no moment at all rather than written into a file
 * name as `NaN`.
 */
function stampOf(capturedAt: TimeInput, now?: () => Date): Date {
  const milliseconds = capturedAt instanceof Date ? capturedAt.getTime() : capturedAt;

  return typeof milliseconds === 'number' && Number.isFinite(milliseconds)
    ? new Date(milliseconds)
    : (now ?? (() => new Date()))();
}
