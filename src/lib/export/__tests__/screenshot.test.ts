/**
 * What a capture must never do, proved rather than promised.
 *
 * Three of these tests are the reason the module exists in the shape it does:
 * the renderer is the same after a capture as before it, the camera is never
 * written to at all, and four storeys in a row cost one offscreen buffer rather
 * than four. The fakes below exist to make those three measurable — a stand-in
 * renderer that records every call it is given, and a stand-in render target
 * that reports when it is taken and when it is given back.
 *
 * Nothing here needs a WebGL context. The scene and camera are real three.js
 * objects, because constructing them costs nothing and a fake camera could not
 * prove that the real one was left alone.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PerspectiveCamera, Scene } from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LevelId } from '@/domain/spatial/types';
import {
  CONTRAST_MINIMUM_BODY,
  generateLegend,
  parsePalette,
  type Palette,
} from '@/lib/coloring/legend';
import { createColoringMode, type PaintSubject } from '@/lib/coloring/modes';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';

import {
  BAND_SURFACE_TOKEN,
  CAPTURE_LAYOUT,
  CAPTURE_WIDTH_PX,
  captureFontOf,
  captureViewport,
  chooseScaleBar,
  composeCapture,
  DEFAULT_CAPTURE_OPTIONS,
  drawCapture,
  EMPTY_VIEWPORT_MESSAGE,
  estimateCaptureMemoryMb,
  fitText,
  formatCaptureMoment,
  frameSizeOf,
  missingTokenMessage,
  SCREENSHOT_MIME_TYPE,
  buildScreenshotFileName,
  toImageData,
  type CaptureCanvasLike,
  type CaptureContext2DLike,
  type CaptureImageDataLike,
  type CaptureInfoInput,
  type CaptureRendererLike,
  type CaptureTargetLike,
  type CaptureViewportInput,
} from '../screenshot';
import {
  createFloorCapture,
  progressMessage,
  ScreenshotQueue,
  type ScreenshotJob,
  type ScreenshotQueueProgress,
} from '../screenshotQueue';

/* -------------------------------------------------------------------------- */
/* The standard sample set: 48 / 21 / 34 / 14 / 4 and 248,60 m².               */
/* -------------------------------------------------------------------------- */

const FLOOR_COUNT = 4;
const ROOM_COUNT = 14;
const HALL_AREA_M2 = 248.6;

const PROJECT_NAME = 'Chung cư Hoàng Anh';
const VIEWPORT = { widthPx: 1280, heightPx: 720 };
const TIME_ZONE = 'Asia/Ho_Chi_Minh';
const CAPTURED_AT = new Date('2026-08-17T07:32:05.000Z');

/** The four storeys of the sample building, bottom first. */
const FLOORS: readonly ScreenshotJob[] = Array.from(
  { length: FLOOR_COUNT },
  (_unused, index): ScreenshotJob => ({
    levelId: `L-0${String(index + 1)}` as LevelId,
    levelName: `Tầng ${String(index + 1)}`,
  }),
);

/** Fourteen rooms, the largest of them the 248,60 m² hall of the sample set. */
function sampleRooms(): readonly PaintSubject[] {
  return Array.from({ length: ROOM_COUNT }, (_unused, index): PaintSubject => {
    const areaM2 = index === 0 ? HALL_AREA_M2 : 6 + index * 2;

    return {
      id: `R-${String(index).padStart(2, '0')}`,
      levelId: FLOORS[index % FLOOR_COUNT]?.levelId ?? null,
      review: { confidence: 0.5, source: 'ai', reviewed: index % 3 === 0 },
      usage: null,
      areaM2: areaM2 as PaintSubject['areaM2'],
      worstSeverity: null,
    };
  });
}

function projectFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

/** The real palette, read from the one file that declares colour values. */
function stylesheetPalette(): Palette {
  return parsePalette(projectFile('src/styles/globals.css'));
}

function sampleLegend(palette: Palette = stylesheetPalette()) {
  const subjects = sampleRooms();

  return generateLegend(createColoringMode('area', { subjects }), subjects, palette);
}

function sampleInfo(): CaptureInfoInput {
  return {
    projectName: PROJECT_NAME,
    levelName: FLOORS[0]?.levelName ?? '',
    coloringMode: 'area',
    capturedAt: CAPTURED_AT,
    timeZone: TIME_ZONE,
  };
}

/* -------------------------------------------------------------------------- */
/* Stand-ins for the graphics stack.                                           */
/* -------------------------------------------------------------------------- */

/** A render target that says when it was taken and when it was given back. */
interface TrackedTarget extends CaptureTargetLike {
  disposed: boolean;
}

/**
 * A ledger of offscreen buffers, in the spirit of `three/perf/dispose.ts`:
 * freeing correctly is not something to be believed.
 */
class TargetLedger {
  readonly created: TrackedTarget[] = [];
  /** The most that were ever alive at the same moment. */
  peakLive = 0;

  get live(): number {
    return this.created.filter((target) => !target.disposed).length;
  }

  get disposed(): number {
    return this.created.filter((target) => target.disposed).length;
  }

  /** Bytes the driver is still holding, on the same estimate the module makes. */
  get liveMemoryMb(): number {
    return this.created
      .filter((target) => !target.disposed)
      .reduce((total, target) => total + estimateCaptureMemoryMb(target.width, target.height), 0);
  }

  create = (widthPx: number, heightPx: number): CaptureTargetLike => {
    const target: TrackedTarget = {
      width: widthPx,
      height: heightPx,
      disposed: false,
      dispose: () => {
        target.disposed = true;
      },
    };

    this.created.push(target);
    this.peakLive = Math.max(this.peakLive, this.live);

    return target;
  };
}

/** Every call a capture made on the renderer, in order. */
interface RendererCall {
  readonly name: string;
  readonly clearAlpha: number;
  readonly target: CaptureTargetLike | null;
}

/**
 * A renderer that draws nothing and remembers everything.
 *
 * `readRenderTargetPixels` fills the buffer with a pattern that depends on the
 * row, so the flip {@link toImageData} performs can be checked against it.
 */
class FakeRenderer implements CaptureRendererLike {
  readonly calls: RendererCall[] = [];
  renderCount = 0;
  /** Set by a test that wants to see what a failed render leaves behind. */
  failOnRender = false;

  private target: CaptureTargetLike | null = null;
  private clearAlpha = 1;

  /** Deliberately never called by a capture; a test asserts as much. */
  readonly setSize = vi.fn();

  render(): void {
    this.record('render');
    this.renderCount += 1;

    if (this.failOnRender) {
      throw new Error('WebGL context lost');
    }
  }

  getRenderTarget(): CaptureTargetLike | null {
    return this.target;
  }

  setRenderTarget(target: CaptureTargetLike | null): void {
    this.target = target;
    this.record('setRenderTarget');
  }

  readRenderTargetPixels(
    _target: CaptureTargetLike,
    _x: number,
    _y: number,
    width: number,
    height: number,
    buffer: Uint8Array,
  ): void {
    this.record('readRenderTargetPixels');

    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const offset = (row * width + column) * 4;
        buffer[offset] = row % 256;
        buffer[offset + 1] = column % 256;
        buffer[offset + 2] = 0;
        buffer[offset + 3] = 255;
      }
    }
  }

  getClearAlpha(): number {
    return this.clearAlpha;
  }

  setClearAlpha(alpha: number): void {
    this.clearAlpha = alpha;
    this.record('setClearAlpha');
  }

  /** What a test compares before and after a capture. */
  state(): { readonly target: CaptureTargetLike | null; readonly clearAlpha: number } {
    return { target: this.target, clearAlpha: this.clearAlpha };
  }

  private record(name: string): void {
    this.calls.push({ name, clearAlpha: this.clearAlpha, target: this.target });
  }
}

/** One instruction the band drawing gave the canvas. */
type DrawCall =
  | { readonly kind: 'clearRect'; readonly args: readonly number[] }
  | { readonly kind: 'fillRect'; readonly args: readonly number[]; readonly fill: string }
  | { readonly kind: 'fillText'; readonly text: string; readonly x: number; readonly y: number; readonly fill: string; readonly font: string }
  | { readonly kind: 'putImageData'; readonly x: number; readonly y: number; readonly image: CaptureImageDataLike };

/** A 2D context that paints nothing and records everything. */
class FakeContext implements CaptureContext2DLike {
  fillStyle: string | CanvasGradient | CanvasPattern = '';
  font = '';
  textBaseline: CanvasTextBaseline = 'alphabetic';

  readonly calls: DrawCall[] = [];

  fillRect(x: number, y: number, width: number, height: number): void {
    this.calls.push({ kind: 'fillRect', args: [x, y, width, height], fill: String(this.fillStyle) });
  }

  clearRect(x: number, y: number, width: number, height: number): void {
    this.calls.push({ kind: 'clearRect', args: [x, y, width, height] });
  }

  fillText(text: string, x: number, y: number): void {
    this.calls.push({ kind: 'fillText', text, x, y, fill: String(this.fillStyle), font: this.font });
  }

  createImageData(width: number, height: number): CaptureImageDataLike {
    return { data: new Uint8ClampedArray(width * height * 4) };
  }

  putImageData(image: CaptureImageDataLike, dx: number, dy: number): void {
    this.calls.push({ kind: 'putImageData', x: dx, y: dy, image });
  }
}

class FakeCanvas implements CaptureCanvasLike {
  readonly context = new FakeContext();

  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  getContext2D(): CaptureContext2DLike {
    return this.context;
  }

  toBlob(mimeType: string): Promise<Blob> {
    return Promise.resolve(new Blob([new Uint8Array([1, 2, 3])], { type: mimeType }));
  }
}

/** Everything a capture is wired to, with the fakes in place of the driver. */
function captureHarness(overrides: Partial<CaptureViewportInput> = {}) {
  const renderer = new FakeRenderer();
  const ledger = new TargetLedger();
  const canvases: FakeCanvas[] = [];
  const camera = new PerspectiveCamera(50, VIEWPORT.widthPx / VIEWPORT.heightPx, 0.1, 1000);
  camera.position.set(12, 8, 20);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  const input: CaptureViewportInput = {
    renderer,
    scene: new Scene(),
    camera,
    viewport: VIEWPORT,
    info: sampleInfo(),
    legend: sampleLegend(),
    scale: { millimetresPerPixel: 20 },
    palette: stylesheetPalette(),
    ...overrides,
  };

  const host = {
    createTarget: ledger.create,
    createCanvas: (widthPx: number, heightPx: number): CaptureCanvasLike => {
      const canvas = new FakeCanvas(widthPx, heightPx);
      canvases.push(canvas);
      return canvas;
    },
    now: () => CAPTURED_AT,
  };

  return { renderer, ledger, canvases, camera, input, host };
}

/** Everything about a camera a capture could possibly disturb. */
function cameraSnapshot(camera: PerspectiveCamera): string {
  return JSON.stringify({
    aspect: camera.aspect,
    fov: camera.fov,
    near: camera.near,
    far: camera.far,
    zoom: camera.zoom,
    position: camera.position.toArray(),
    quaternion: camera.quaternion.toArray(),
    projection: camera.projectionMatrix.toArray(),
    world: camera.matrixWorld.toArray(),
  });
}

/* -------------------------------------------------------------------------- */
/* The frame.                                                                  */
/* -------------------------------------------------------------------------- */

describe('frameSizeOf', () => {
  it('renders 1440 px wide whatever the viewport is', () => {
    expect(frameSizeOf({ widthPx: 800, heightPx: 600 }, 1).widthPx).toBe(CAPTURE_WIDTH_PX);
    expect(frameSizeOf({ widthPx: 3840, heightPx: 2160 }, 1).widthPx).toBe(CAPTURE_WIDTH_PX);
  });

  it('keeps the viewport ratio, so the camera needs no correction', () => {
    const wide = frameSizeOf({ widthPx: 1280, heightPx: 720 }, 1);
    const square = frameSizeOf({ widthPx: 900, heightPx: 900 }, 1);

    expect(wide.heightPx).toBe(810);
    expect(wide.widthPx / wide.heightPx).toBeCloseTo(1280 / 720, 5);
    expect(square.heightPx).toBe(CAPTURE_WIDTH_PX);
  });

  it('multiplies both sides by the resolution', () => {
    expect(frameSizeOf(VIEWPORT, 2)).toEqual({ widthPx: 2880, heightPx: 1620 });
    expect(frameSizeOf(VIEWPORT, 3)).toEqual({ widthPx: 4320, heightPx: 2430 });
  });

  it('never returns a frame with no height, however flat the viewport', () => {
    expect(frameSizeOf({ widthPx: 4000, heightPx: 1 }, 1).heightPx).toBeGreaterThanOrEqual(1);
  });
});

/* -------------------------------------------------------------------------- */
/* The promise the module is for: the viewer is not disturbed.                 */
/* -------------------------------------------------------------------------- */

describe('captureViewport leaves the viewer alone', () => {
  it('gives the renderer back exactly the state it was found in', async () => {
    const { renderer, input, host } = captureHarness();
    const before = renderer.state();

    await captureViewport(input, host);

    expect(renderer.state()).toEqual(before);
    expect(renderer.getRenderTarget()).toBeNull();
    expect(renderer.getClearAlpha()).toBe(1);
  });

  it('restores the render target the viewer was already drawing into', async () => {
    const { renderer, input, host } = captureHarness();
    const viewerTarget: CaptureTargetLike = { width: 4, height: 4, dispose: vi.fn() };

    renderer.setRenderTarget(viewerTarget);
    await captureViewport(input, host);

    expect(renderer.getRenderTarget()).toBe(viewerTarget);
    expect(viewerTarget.dispose).not.toHaveBeenCalled();
  });

  it('never writes to the camera — not its aspect, not its projection', async () => {
    const { camera, input, host } = captureHarness();
    const before = cameraSnapshot(camera);

    await captureViewport(input, { ...host, createCanvas: host.createCanvas });

    expect(cameraSnapshot(camera)).toBe(before);
  });

  it('never resizes the canvas the person is looking at', async () => {
    const { renderer, input, host } = captureHarness();

    await captureViewport(input, host);

    expect(renderer.setSize).not.toHaveBeenCalled();
  });

  it('puts the renderer back even when the render throws', async () => {
    const { renderer, ledger, input, host } = captureHarness();
    const before = renderer.state();
    renderer.failOnRender = true;

    await expect(captureViewport(input, host)).rejects.toThrow('WebGL context lost');

    expect(renderer.state()).toEqual(before);
    expect(ledger.live).toBe(0);
  });

  it('clears alpha only for the capture, and puts the old alpha back', async () => {
    const { renderer, input, host } = captureHarness();

    await captureViewport({ ...input, options: { transparentBackground: true } }, host);

    const duringRender = renderer.calls.find((call) => call.name === 'render');

    expect(duringRender?.clearAlpha).toBe(0);
    expect(renderer.getClearAlpha()).toBe(1);
  });

  it('renders into an offscreen target, never into the visible framebuffer', async () => {
    const { renderer, ledger, input, host } = captureHarness();

    await captureViewport(input, host);

    const duringRender = renderer.calls.find((call) => call.name === 'render');

    expect(duringRender?.target).toBe(ledger.created[0]);
    expect(renderer.renderCount).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* The other promise: the buffer is freed.                                     */
/* -------------------------------------------------------------------------- */

describe('captureViewport frees what it takes', () => {
  it('disposes the offscreen target before the caller hears anything', async () => {
    const { ledger, input, host } = captureHarness();

    await captureViewport(input, host);

    expect(ledger.created).toHaveLength(1);
    expect(ledger.live).toBe(0);
    expect(ledger.liveMemoryMb).toBe(0);
  });

  it('unbinds the target before disposing it', async () => {
    const { renderer, ledger, input, host } = captureHarness();

    await captureViewport(input, host);

    const target = ledger.created[0];
    const unbind = renderer.calls.findIndex(
      (call, index) => call.name === 'setRenderTarget' && index > 0 && call.target === null,
    );
    const read = renderer.calls.findIndex((call) => call.name === 'readRenderTargetPixels');

    expect(target?.disposed).toBe(true);
    expect(unbind).toBeGreaterThan(read);
  });

  it('sizes the target to the frame, not to the whole image', async () => {
    const { ledger, input, host } = captureHarness();

    await captureViewport({ ...input, options: { resolution: 2 } }, host);

    expect(ledger.created[0]).toMatchObject({ width: 2880, height: 1620 });
  });
});

/* -------------------------------------------------------------------------- */
/* The picture that comes out.                                                 */
/* -------------------------------------------------------------------------- */

describe('captureViewport output', () => {
  it('returns a PNG named after the project, the storey and the moment', async () => {
    const { input, host } = captureHarness();

    const result = await captureViewport(input, host);

    expect(result.blob.type).toBe(SCREENSHOT_MIME_TYPE);
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.fileName).toMatch(/^chung-cu-hoang-anh_tang-1_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/);
  });

  it('is 1440 wide with a band under the frame', async () => {
    const { input, host } = captureHarness();

    const result = await captureViewport(input, host);

    expect(result.widthPx).toBe(CAPTURE_WIDTH_PX);
    expect(result.heightPx).toBeGreaterThan(result.composition.frame.heightPx);
    expect(result.composition.band?.yPx).toBe(result.composition.frame.heightPx);
  });

  it('scales the whole image, band included, with the resolution', async () => {
    const { input, host } = captureHarness();

    const single = await captureViewport({ ...input, options: { resolution: 1 } }, host);
    const double = await captureViewport({ ...input, options: { resolution: 2 } }, host);

    expect(double.widthPx).toBe(single.widthPx * 2);
    expect(double.heightPx).toBe(single.heightPx * 2);
    expect((double.composition.band?.heightPx ?? 0) / (single.composition.band?.heightPx ?? 1)).toBe(2);
  });

  it('refuses a viewport with no area rather than dividing by zero', async () => {
    const { input, host } = captureHarness();

    await expect(
      captureViewport({ ...input, viewport: { widthPx: 0, heightPx: 720 } }, host),
    ).rejects.toThrow(EMPTY_VIEWPORT_MESSAGE);
  });

  it('takes the picture and no more when nothing is asked for the band', async () => {
    const { input, host } = captureHarness();
    const bare: CaptureViewportInput = {
      renderer: input.renderer,
      scene: input.scene,
      camera: input.camera,
      viewport: VIEWPORT,
      options: { includeLegend: false },
      palette: stylesheetPalette(),
    };

    const result = await captureViewport(bare, host);

    expect(result.composition.band).toBeNull();
    expect(result.heightPx).toBe(result.composition.frame.heightPx);
  });
});

/* -------------------------------------------------------------------------- */
/* The band.                                                                   */
/* -------------------------------------------------------------------------- */

describe('the information band', () => {
  it('carries the project, the storey, the colouring mode and the moment', () => {
    const composition = composeCapture({
      frameWidthPx: 1440,
      frameHeightPx: 810,
      resolution: 1,
      options: DEFAULT_CAPTURE_OPTIONS,
      info: sampleInfo(),
      palette: stylesheetPalette(),
    });

    const written = composition.texts.map((run) => run.text);

    expect(written).toContain('dự án');
    expect(written).toContain('tầng');
    expect(written).toContain('chế độ tô màu');
    expect(written).toContain('thời điểm');
    expect(written).toContain(PROJECT_NAME);
    expect(written).toContain('Tầng 1');
    expect(written).toContain('theo diện tích');
    expect(written).toContain('17/08/2026 14:32');
  });

  it('writes the moment with the comma decimals and 24-hour clock of the product', () => {
    expect(formatCaptureMoment(CAPTURED_AT, TIME_ZONE)).toBe('17/08/2026 14:32');
    expect(formatCaptureMoment(null)).toBe('—');
  });

  it('reaches 4,5:1 on every pair it writes, against the real stylesheet', () => {
    const composition = composeCapture({
      frameWidthPx: 1440,
      frameHeightPx: 810,
      resolution: 1,
      options: DEFAULT_CAPTURE_OPTIONS,
      info: sampleInfo(),
      legend: sampleLegend(),
      millimetresPerPixel: 20,
      palette: stylesheetPalette(),
    });

    expect(composition.contrast.length).toBeGreaterThan(0);

    for (const check of composition.contrast) {
      expect(check.backgroundToken).toBe(BAND_SURFACE_TOKEN);
      expect(check.ratio, `${check.textToken} on ${check.backgroundToken}`).toBeGreaterThanOrEqual(
        CONTRAST_MINIMUM_BODY,
      );
      expect(check.passes).toBe(true);
    }
  });

  it('writes only in tokens that were checked and passed', () => {
    const palette = stylesheetPalette();
    const composition = composeCapture({
      frameWidthPx: 1440,
      frameHeightPx: 810,
      resolution: 1,
      options: DEFAULT_CAPTURE_OPTIONS,
      info: sampleInfo(),
      legend: sampleLegend(palette),
      millimetresPerPixel: 20,
      palette,
    });

    const passed = new Set(
      composition.contrast.filter((check) => check.passes).map((check) => check.textToken),
    );

    for (const run of composition.texts) {
      expect(passed.has(run.token), `${run.token} was never checked`).toBe(true);
    }
  });

  it('falls back to one strong token when no palette can be checked', () => {
    const composition = composeCapture({
      frameWidthPx: 1440,
      frameHeightPx: 810,
      resolution: 1,
      options: DEFAULT_CAPTURE_OPTIONS,
      info: sampleInfo(),
    });

    expect(composition.contrast).toHaveLength(0);
    expect(new Set(composition.texts.map((run) => run.token)).size).toBe(1);
  });

  it('keeps its own opaque surface even when the frame is transparent', () => {
    const composition = composeCapture({
      frameWidthPx: 1440,
      frameHeightPx: 810,
      resolution: 1,
      options: { ...DEFAULT_CAPTURE_OPTIONS, transparentBackground: true },
      info: sampleInfo(),
      palette: stylesheetPalette(),
    });

    expect(composition.band?.token).toBe(BAND_SURFACE_TOKEN);
    expect(composition.rects[0]?.token).toBe(BAND_SURFACE_TOKEN);
  });

  it('gives every legend band a swatch in its own token', () => {
    const legend = sampleLegend();
    const composition = composeCapture({
      frameWidthPx: 1440,
      frameHeightPx: 810,
      resolution: 1,
      options: DEFAULT_CAPTURE_OPTIONS,
      legend,
      palette: stylesheetPalette(),
    });

    const swatches = composition.rects.filter((rect) =>
      legend.items.some((item) => item.token === rect.token),
    );

    expect(legend.items.length).toBeGreaterThan(0);
    expect(swatches).toHaveLength(legend.items.length);
    expect(composition.texts.some((run) => run.text.startsWith('nhỏ nhất'))).toBe(true);
  });

  it('leaves the legend out when it was not asked for', () => {
    const legend = sampleLegend();
    const composition = composeCapture({
      frameWidthPx: 1440,
      frameHeightPx: 810,
      resolution: 1,
      options: { ...DEFAULT_CAPTURE_OPTIONS, includeLegend: false },
      info: sampleInfo(),
      legend,
      palette: stylesheetPalette(),
    });

    for (const item of legend.items) {
      expect(composition.rects.some((rect) => rect.token === item.token)).toBe(false);
    }
  });

  it('cuts a long value rather than letting it run into the next field', () => {
    const long = 'Khu phức hợp thương mại và căn hộ cao cấp Hoàng Anh Gia Lai giai đoạn hai';
    const composition = composeCapture({
      frameWidthPx: 1440,
      frameHeightPx: 810,
      resolution: 1,
      options: DEFAULT_CAPTURE_OPTIONS,
      info: { ...sampleInfo(), projectName: long },
      palette: stylesheetPalette(),
    });

    const value = composition.texts.find((run) => run.text.startsWith('Khu phức hợp'));

    expect(value?.text).not.toBe(long);
    expect(value?.text.endsWith('…')).toBe(true);
  });
});

describe('fitText', () => {
  it('leaves a string that fits exactly as it is', () => {
    expect(fitText('Tầng 2', 15, 400)).toBe('Tầng 2');
  });

  it('marks where it cut', () => {
    const cut = fitText('Chung cư Hoàng Anh giai đoạn hai', 15, 60);

    expect(cut.endsWith('…')).toBe(true);
    expect(cut.length).toBeLessThan('Chung cư Hoàng Anh giai đoạn hai'.length);
  });

  it('writes nothing at all rather than an ellipsis in no space', () => {
    expect(fitText('Tầng 2', 15, 4)).toBe('');
  });
});

/* -------------------------------------------------------------------------- */
/* The scale bar.                                                              */
/* -------------------------------------------------------------------------- */

describe('chooseScaleBar', () => {
  it('picks the longest round length that fits', () => {
    const bar = chooseScaleBar(20, 320);

    expect(bar?.lengthMm).toBe(5000);
    expect(bar?.widthPx).toBe(250);
    expect(bar?.label).toBe('5,00 m');
  });

  it('only ever spends a 1, a 2 or a 5', () => {
    for (let millimetresPerPixel = 1; millimetresPerPixel <= 200; millimetresPerPixel += 1) {
      const bar = chooseScaleBar(millimetresPerPixel, 320, 0);

      if (bar !== null) {
        const mantissa = bar.lengthMm / Math.pow(10, Math.floor(Math.log10(bar.lengthMm)));

        expect([1, 2, 5]).toContain(Math.round(mantissa));
      }
    }
  });

  it('never draws a bar longer than the room it was given', () => {
    for (let millimetresPerPixel = 1; millimetresPerPixel <= 200; millimetresPerPixel += 3) {
      const bar = chooseScaleBar(millimetresPerPixel, 320, 0);

      // A hair of tolerance: the length is chosen in millimetres and divided
      // back into pixels, and the last bit of a float does not survive that.
      expect(bar?.widthPx ?? 0).toBeLessThanOrEqual(320 + 1e-6);
    }
  });

  it('writes millimetres under a metre and metres above it', () => {
    expect(chooseScaleBar(1, 320)?.label).toBe('200 mm');
    expect(chooseScaleBar(100, 320)?.label).toBe('20,00 m');
  });

  it('draws nothing rather than a bar too short to measure with', () => {
    expect(chooseScaleBar(20, 320, 300)).toBeNull();
  });

  it('draws nothing when the reading is not a usable number', () => {
    expect(chooseScaleBar(0, 320)).toBeNull();
    expect(chooseScaleBar(-5, 320)).toBeNull();
    expect(chooseScaleBar(Number.NaN, 320)).toBeNull();
  });

  it('is left out of the band when the caller passes no reading', () => {
    const composition = composeCapture({
      frameWidthPx: 1440,
      frameHeightPx: 810,
      resolution: 1,
      options: DEFAULT_CAPTURE_OPTIONS,
      info: sampleInfo(),
      palette: stylesheetPalette(),
    });

    expect(composition.scaleBar).toBeNull();
    expect(composition.texts.some((run) => run.text === 'thước tỉ lệ')).toBe(false);
  });

  it('converts the screen reading to the image before choosing a length', async () => {
    const { input, host } = captureHarness();

    // 1280 screen pixels become 1440 image pixels, so a millimetre reading taken
    // on screen covers fewer millimetres per pixel in the file.
    const result = await captureViewport(input, host);

    expect(result.composition.scaleBar).not.toBeNull();
    expect(result.composition.scaleBar?.widthPx).toBeCloseTo(
      (result.composition.scaleBar?.lengthMm ?? 0) / ((20 * VIEWPORT.widthPx) / CAPTURE_WIDTH_PX),
      5,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Drawing.                                                                    */
/* -------------------------------------------------------------------------- */

describe('drawCapture', () => {
  it('resolves every token through the palette and spells no colour itself', async () => {
    const { canvases, input, host } = captureHarness();
    const palette = stylesheetPalette();

    await captureViewport(input, host);

    const drawn = canvases[0]?.context.calls ?? [];
    const values = new Set(Object.values(palette));

    expect(drawn.length).toBeGreaterThan(0);

    for (const call of drawn) {
      if (call.kind === 'fillRect' || call.kind === 'fillText') {
        expect(values.has(call.fill), `${call.fill} is not a token value`).toBe(true);
      }
    }
  });

  it('places the rendered pixels at the top and the band under them', async () => {
    const { canvases, input, host } = captureHarness();

    const result = await captureViewport(input, host);
    const drawn = canvases[0]?.context.calls ?? [];
    const image = drawn.find((call) => call.kind === 'putImageData');
    const band = drawn.find((call) => call.kind === 'fillRect');

    expect(image).toMatchObject({ x: 0, y: 0 });
    expect(band?.kind === 'fillRect' ? band.args[1] : -1).toBe(result.composition.frame.heightPx);
  });

  it('starts from nothing, so a transparent capture stays transparent', async () => {
    const { canvases, input, host } = captureHarness();

    await captureViewport({ ...input, options: { transparentBackground: true } }, host);

    expect(canvases[0]?.context.calls[0]?.kind).toBe('clearRect');
  });

  it('writes with the top baseline and the export font', async () => {
    const { canvases, input, host } = captureHarness();

    await captureViewport(input, host);

    const context = canvases[0]?.context;
    const text = context?.calls.find((call) => call.kind === 'fillText');

    expect(context?.textBaseline).toBe('top');
    expect(text?.kind === 'fillText' ? text.font : '').toContain('Noto Sans');
  });

  it('refuses to draw in a colour nobody chose', () => {
    const composition = composeCapture({
      frameWidthPx: 8,
      frameHeightPx: 4,
      resolution: 1,
      options: DEFAULT_CAPTURE_OPTIONS,
      info: sampleInfo(),
      palette: stylesheetPalette(),
    });

    expect(() =>
      drawCapture(new FakeContext(), composition, new Uint8Array(8 * 4 * 4), {}),
    ).toThrow(missingTokenMessage(BAND_SURFACE_TOKEN));
  });
});

describe('toImageData', () => {
  it('turns the framebuffer the right way up', () => {
    const width = 2;
    const height = 3;
    const pixels = new Uint8Array(width * height * 4);

    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        pixels[(row * width + column) * 4] = row;
      }
    }

    const image = toImageData(new FakeContext(), pixels, width, height);

    // WebGL's bottom row (2) has to arrive as the canvas's top row (0).
    expect(image.data[0]).toBe(height - 1);
    expect(image.data[(height - 1) * width * 4]).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Small pieces.                                                               */
/* -------------------------------------------------------------------------- */

describe('naming and measuring', () => {
  it('slugs the project and the storey and stamps the moment', () => {
    expect(buildScreenshotFileName('Chung cư Hoàng Anh', 'Tầng 2', CAPTURED_AT)).toMatch(
      /^chung-cu-hoang-anh_tang-2_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/,
    );
  });

  it('leaves the storey out of the name when there is none', () => {
    expect(buildScreenshotFileName('Chung cư Hoàng Anh', '  ', CAPTURED_AT).split('_')).toHaveLength(3);
  });

  it('estimates what a capture costs the driver while it is being taken', () => {
    const frame = frameSizeOf(VIEWPORT, 3);

    expect(estimateCaptureMemoryMb(frame.widthPx, frame.heightPx)).toBeGreaterThan(100);
    expect(estimateCaptureMemoryMb(0, 0)).toBe(0);
  });

  it('names a canvas font with a weight, a size and the Vietnamese family', () => {
    expect(captureFontOf(15, 'medium')).toBe('500 15px "Noto Sans", "Be Vietnam Pro", "DejaVu Sans", sans-serif');
  });

  it('keeps every band measurement a whole number of pixels', () => {
    for (const [name, value] of Object.entries(CAPTURE_LAYOUT)) {
      expect(Number.isInteger(value), `${name} is not a whole pixel`).toBe(true);
    }
  });
});

describe('no module here spells a colour out', () => {
  it('keeps screenshot.ts and screenshotQueue.ts free of colour literals', () => {
    expect(() => expectNoRawColor('src/lib/export/screenshot.ts')).not.toThrow();
    expect(() => expectNoRawColor('src/lib/export/screenshotQueue.ts')).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* The queue.                                                                  */
/* -------------------------------------------------------------------------- */

describe('ScreenshotQueue', () => {
  let harness: ReturnType<typeof captureHarness>;
  let shown: LevelId[];
  let restored: number;

  function queueOf(overrides: Partial<ConstructorParameters<typeof ScreenshotQueue>[0]> = {}) {
    return new ScreenshotQueue({
      capture: createFloorCapture(harness.input, harness.host),
      showFloor: (job) => {
        shown.push(job.levelId);
      },
      restore: () => {
        restored += 1;
      },
      ...overrides,
    });
  }

  beforeEach(() => {
    harness = captureHarness();
    shown = [];
    restored = 0;
  });

  it('photographs four storeys in the order they were queued', async () => {
    const queue = queueOf();
    queue.enqueue(FLOORS);

    const outcome = await queue.run();

    expect(outcome.status).toBe('done');
    expect(outcome.images).toHaveLength(FLOOR_COUNT);
    expect(shown).toEqual(FLOORS.map((floor) => floor.levelId));
    expect(outcome.images.map((image) => image.fileName)).toEqual([
      ...new Set(outcome.images.map((image) => image.fileName)),
    ]);
  });

  it('names each file after the storey it is a picture of', async () => {
    const queue = queueOf();
    queue.enqueue(FLOORS);

    const outcome = await queue.run();

    outcome.images.forEach((image, index) => {
      expect(image.fileName).toContain(`tang-${String(index + 1)}`);
    });
  });

  /* The verification the brief asks for, twice over. */

  it('costs one offscreen buffer for four storeys, not four', async () => {
    const queue = queueOf();
    queue.enqueue(FLOORS);

    await queue.run();

    expect(harness.ledger.created).toHaveLength(FLOOR_COUNT);
    expect(harness.ledger.disposed).toBe(FLOOR_COUNT);
    expect(harness.ledger.live).toBe(0);
    expect(harness.ledger.peakLive).toBe(1);
    expect(harness.ledger.liveMemoryMb).toBe(0);
  });

  it('holds no graphics memory between storeys', async () => {
    const liveAfterEach: number[] = [];
    const queue = queueOf({
      capture: async (job) => {
        const image = await createFloorCapture(harness.input, harness.host)(job);
        liveAfterEach.push(harness.ledger.liveMemoryMb);
        return image;
      },
    });
    queue.enqueue(FLOORS);

    await queue.run();

    expect(liveAfterEach).toEqual(Array.from({ length: FLOOR_COUNT }, () => 0));
  });

  it('leaves the viewer exactly where it was after four captures', async () => {
    const before = { renderer: harness.renderer.state(), camera: cameraSnapshot(harness.camera) };
    const queue = queueOf();
    queue.enqueue(FLOORS);

    await queue.run();

    expect(harness.renderer.state()).toEqual(before.renderer);
    expect(cameraSnapshot(harness.camera)).toBe(before.camera);
    expect(harness.renderer.setSize).not.toHaveBeenCalled();
  });

  it('puts the reviewer back on the storey they were reviewing', async () => {
    const queue = queueOf();
    queue.enqueue(FLOORS);

    await queue.run();

    expect(restored).toBe(1);
  });

  /* Progress. */

  it('reports both halves of every storey, with the totals as they stand', async () => {
    const progress: ScreenshotQueueProgress[] = [];
    const queue = queueOf({ onProgress: (report) => progress.push(report) });
    queue.enqueue(FLOORS);

    await queue.run();

    expect(progress).toHaveLength(FLOOR_COUNT * 2);
    expect(progress[0]).toMatchObject({ phase: 'showing', completed: 0, total: FLOOR_COUNT });
    expect(progress[1]).toMatchObject({ phase: 'capturing', completed: 0, total: FLOOR_COUNT });
    expect(progress.at(-1)).toMatchObject({
      phase: 'capturing',
      completed: FLOOR_COUNT - 1,
      total: FLOOR_COUNT,
    });
  });

  it('writes a Vietnamese sentence a status line can show', () => {
    expect(progressMessage('capturing', 'Tầng 2', 1, 4)).toBe('Đang chụp Tầng 2 (2/4).');
    expect(progressMessage('showing', 'Tầng 1', 0, 4)).toBe('Đang mở Tầng 1 (1/4).');
  });

  it('hands each picture over the moment it exists', async () => {
    const arrived: string[] = [];
    const queue = queueOf({ onImage: (image) => arrived.push(image.fileName) });
    queue.enqueue(FLOORS);

    const outcome = await queue.run();

    expect(arrived).toEqual(outcome.images.map((image) => image.fileName));
  });

  it('counts storeys enqueued while it is running into the same total', async () => {
    const progress: ScreenshotQueueProgress[] = [];
    const queue = queueOf({
      onProgress: (report) => {
        progress.push(report);
        if (progress.length === 1) {
          queue.enqueue(FLOORS.slice(2));
        }
      },
    });
    queue.enqueue(FLOORS.slice(0, 2));

    const outcome = await queue.run();

    expect(outcome.images).toHaveLength(FLOOR_COUNT);
    expect(progress[0]?.total).toBe(2);
    expect(progress.at(-1)?.total).toBe(FLOOR_COUNT);
  });

  /* Stopping. */

  it('stops after the storey in flight and drops the rest', async () => {
    const queue = queueOf({
      onProgress: (report) => {
        if (report.phase === 'capturing' && report.completed === 1) {
          queue.cancel();
        }
      },
    });
    queue.enqueue(FLOORS);

    const outcome = await queue.run();

    expect(outcome.status).toBe('cancelled');
    expect(outcome.images).toHaveLength(2);
    expect(outcome.skipped.map((job) => job.levelId)).toEqual([FLOORS[2]?.levelId, FLOORS[3]?.levelId]);
    expect(restored).toBe(1);
  });

  it('frees the buffer of the capture it let finish', async () => {
    const queue = queueOf({
      onProgress: (report) => {
        if (report.phase === 'capturing') {
          queue.cancel();
        }
      },
    });
    queue.enqueue(FLOORS);

    await queue.run();

    expect(harness.ledger.live).toBe(0);
    expect(harness.ledger.disposed).toBe(harness.ledger.created.length);
  });

  it('photographs nothing once cancelled, however much is queued afterwards', async () => {
    const queue = queueOf();
    queue.cancel();
    queue.enqueue(FLOORS);

    const outcome = await queue.run();

    expect(outcome.status).toBe('cancelled');
    expect(outcome.images).toHaveLength(0);
    expect(harness.ledger.created).toHaveLength(0);
    expect(shown).toEqual([]);
  });

  /* Failing. */

  it('keeps the pictures it already took when a storey fails', async () => {
    const failing = vi.fn(async (job: ScreenshotJob) => {
      if (job.levelId === FLOORS[2]?.levelId) {
        throw new Error('Không dựng lại được tầng.');
      }
      return createFloorCapture(harness.input, harness.host)(job);
    });
    const queue = queueOf({ capture: failing });
    queue.enqueue(FLOORS);

    const outcome = await queue.run();

    expect(outcome.status).toBe('failed');
    expect(outcome.failure).toBe('Không dựng lại được tầng.');
    expect(outcome.images).toHaveLength(2);
    expect(outcome.skipped).toHaveLength(2);
    expect(restored).toBe(1);
  });

  it('reports a storey that could not be shown rather than photographing the wrong one', async () => {
    const queue = queueOf({
      showFloor: (job) => {
        if (job.levelId === FLOORS[0]?.levelId) {
          throw new Error('Tầng không tồn tại.');
        }
      },
    });
    queue.enqueue(FLOORS);

    const outcome = await queue.run();

    expect(outcome.status).toBe('failed');
    expect(outcome.images).toHaveLength(0);
    expect(harness.ledger.created).toHaveLength(0);
  });

  it('never rejects, even when putting the viewer back fails', async () => {
    const queue = queueOf({
      restore: () => {
        throw new Error('Không quay lại được tầng cũ.');
      },
    });
    queue.enqueue(FLOORS.slice(0, 1));

    const outcome = await queue.run();

    expect(outcome.status).toBe('failed');
    expect(outcome.failure).toBe('Không quay lại được tầng cũ.');
    expect(outcome.images).toHaveLength(1);
  });

  /* Running. */

  it('answers a second run with the first rather than starting two', async () => {
    const queue = queueOf();
    queue.enqueue(FLOORS);

    const first = queue.run();
    const second = queue.run();

    expect(first).toBe(second);

    const outcome = await first;

    expect(outcome.images).toHaveLength(FLOOR_COUNT);
    expect(harness.ledger.created).toHaveLength(FLOOR_COUNT);
  });

  it('knows what it is doing while it does it', async () => {
    const queue = queueOf();
    queue.enqueue(FLOORS);

    expect(queue.pendingCount).toBe(FLOOR_COUNT);
    expect(queue.isRunning).toBe(false);

    const running = queue.run();

    expect(queue.isRunning).toBe(true);
    await running;

    expect(queue.isRunning).toBe(false);
    expect(queue.completedCount).toBe(FLOOR_COUNT);
    expect(queue.pendingCount).toBe(0);
  });
});
