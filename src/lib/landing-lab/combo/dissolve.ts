/**
 * Copied from cinema/dissolve.ts with the start point as a parameter: the combo's white model turns real
 * starting at the entrance (A's last frame → B's first frame).
 *
 * Organic dissolve mask: the blueprint line frame burns away into the photoreal frame.
 * A small 16:9 noise field (fbm value noise, built once) is thresholded each frame into an alpha mask with a
 * soft edge; the browser scales it up bilinearly, so it is resolution-independent and cheap on integrated GPUs.
 * The field is biased by distance from the house, so the house turns real first and the site follows.
 */

const MW = 192;
const MH = 108;
const SOFT = 0.05;

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(x: number, y: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let o = 0; o < 4; o += 1) {
    sum += amp * valueNoise(x * f, y * f, seed + o);
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / 0.9375;
}

export class Dissolve {
  readonly canvas: HTMLCanvasElement;
  readonly width = MW;
  readonly height = MH;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly base = new Float32Array(MW * MH);
  private readonly drift = new Float32Array(MW * 2 * MH);
  private readonly img: ImageData;
  private lastT = Number.NaN;

  /** `from`: where the dissolve starts (fractions of width/height), e.g. the front door. */
  constructor(from: readonly [number, number]) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = MW;
    this.canvas.height = MH;
    const ctx = this.canvas.getContext('2d');
    if (ctx === null) throw new Error('2d context unavailable');
    this.ctx = ctx;
    this.img = ctx.createImageData(MW, MH);
    for (let y = 0; y < MH; y += 1) {
      for (let x = 0; x < MW; x += 1) {
        const dx = x / MW - from[0];
        const dy = (y / MH - from[1]) * 0.5625;
        const radial = Math.min(1, Math.hypot(dx, dy) / 0.62);
        this.base[y * MW + x] = 0.55 * fbm(x / 26, y / 26, 7) + 0.45 * radial;
      }
    }
    for (let y = 0; y < MH; y += 1) {
      for (let x = 0; x < MW * 2; x += 1) this.drift[y * MW * 2 + x] = fbm(x / 11, y / 11, 31) - 0.5;
    }
  }

  /** Mask for dissolve progress t (0 = all lines, 1 = none): white alpha where the lines still show. */
  update(t: number): HTMLCanvasElement {
    if (t === this.lastT) return this.canvas;
    this.lastT = t;
    const thr = -0.1 + t * 1.2; // n spans about -0.06..1.06: t 0 shows every line, t 1 none
    const shift = Math.floor(t * MW * 0.6);
    const px = this.img.data;
    for (let y = 0; y < MH; y += 1) {
      for (let x = 0; x < MW; x += 1) {
        const n = (this.base[y * MW + x] ?? 0) + 0.12 * (this.drift[y * MW * 2 + x + shift] ?? 0);
        const a = Math.min(1, Math.max(0, (n - thr) / SOFT + 0.5));
        const k = (y * MW + x) * 4;
        px[k] = 255;
        px[k + 1] = 255;
        px[k + 2] = 255;
        px[k + 3] = Math.round(a * a * (3 - 2 * a) * 255);
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
    return this.canvas;
  }
}
