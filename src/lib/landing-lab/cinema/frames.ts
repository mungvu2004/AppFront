/**
 * Scroll-scrubbed image sequences (offline Cycles renders): the photoreal move and the blueprint line pass,
 * rendered from the same camera so they align pixel for pixel.
 * Progressive load: frame 0 first, then every 8th, 4th, 2nd, then the rest; drawing uses the nearest decoded
 * frame, so scrubbing works from the first paint and sharpens as gaps fill.
 */

/** Beauty frames cover p 0..1; line frames cover the first LINE_COUNT beauty indices (the dissolve). */
export const FRAME_COUNT = 120;
export const LINE_COUNT = 52;

/** 1920-wide set for large/dense screens, 1280-wide set for viewports up to ~1440 CSS px at DPR 1. */
export function frameBase(cssWidth: number, dpr: number): string {
  return cssWidth * dpr > 1500 ? '/landing-lab/cinema/1920/' : '/landing-lab/cinema/1280/';
}

export function frameUrl(base: string, kind: 'b' | 'l', i: number): string {
  return `${base}${kind}_${String(i).padStart(3, '0')}.webp`;
}

/** 0, then strides 8 → 4 → 2 → 1, each index once. */
export function loadOrder(n: number): number[] {
  const seen = new Set<number>([0]);
  const order = [0];
  for (const stride of [8, 4, 2, 1]) {
    for (let i = 0; i < n; i += stride) {
      if (!seen.has(i)) {
        seen.add(i);
        order.push(i);
      }
    }
  }
  if (!seen.has(n - 1)) order.push(n - 1);
  return order;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  return img.decode().then(
    () => img,
    () => null,
  );
}

export class FrameStore {
  readonly first: Promise<void>;
  readonly all: Promise<void>;
  private readonly imgs: (HTMLImageElement | null)[];
  private stopped = false;

  constructor(urlOf: (i: number) => string, n: number, onFrame: () => void, concurrency = 4) {
    this.imgs = new Array<HTMLImageElement | null>(n).fill(null);
    const queue = loadOrder(n);
    const take = async (i: number): Promise<void> => {
      if (this.stopped) return;
      this.imgs[i] = await loadImage(urlOf(i));
      if (!this.stopped) onFrame();
    };
    this.first = take(queue[0] ?? 0);
    const rest = queue.slice(1);
    const worker = async (): Promise<void> => {
      await this.first;
      for (let i = rest.shift(); i !== undefined; i = rest.shift()) await take(i);
    };
    this.all = Promise.all(Array.from({ length: concurrency }, worker)).then(() => undefined);
  }

  stop(): void {
    this.stopped = true;
  }

  get length(): number {
    return this.imgs.length;
  }

  /** The loaded frame closest to `i` (ties prefer the earlier one), or null before any frame arrives. */
  nearest(i: number): HTMLImageElement | null {
    const n = this.imgs.length;
    for (let d = 0; d < n; d += 1) {
      const a = this.imgs[i - d];
      if (a) return a;
      const b = this.imgs[i + d];
      if (b) return b;
    }
    return null;
  }

  exact(i: number): HTMLImageElement | null {
    return this.imgs[i] ?? null;
  }
}

/** object-fit: cover, horizontal crop biased by `anchorX` (0 = keep left edge, 1 = keep right edge). */
export function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource, iw: number, ih: number, w: number, h: number, anchorX: number, alpha = 1): void {
  const s = Math.max(w / iw, h / ih);
  const dw = iw * s;
  const dh = ih * s;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, (w - dw) * anchorX, (h - dh) / 2, dw, dh);
  ctx.globalAlpha = 1;
}

/** Draws sequence position f (frame units): the two neighbouring frames cross-faded, or the nearest loaded one. */
export function drawSequence(ctx: CanvasRenderingContext2D, store: FrameStore, f: number, w: number, h: number, anchorX: number): boolean {
  const last = store.length - 1;
  const g = Math.min(last, Math.max(0, f));
  const i = Math.floor(g);
  const t = g - i;
  const a = store.exact(i);
  const b = store.exact(Math.min(last, i + 1));
  if (a && b) {
    drawCover(ctx, a, a.naturalWidth, a.naturalHeight, w, h, anchorX);
    if (t > 0.002) drawCover(ctx, b, b.naturalWidth, b.naturalHeight, w, h, anchorX, t);
    return true;
  }
  const near = store.nearest(Math.round(g));
  if (near === null) return false;
  drawCover(ctx, near, near.naturalWidth, near.naturalHeight, w, h, anchorX);
  return true;
}

/** `data-win="a,b,c,d"`: fade in over p a→b, hold, fade out over c→d, with a small rise. */
export function applyWindows(els: readonly HTMLElement[], p: number): void {
  for (const el of els) {
    const [a = 0, b = 0, c = 2, d = 2] = (el.dataset.win ?? '').split(',').map(Number);
    const fin = b > a ? clamp01((p - a) / (b - a)) : p >= a ? 1 : 0;
    const fout = d > c ? clamp01((p - c) / (d - c)) : p >= c ? 1 : 0;
    const k = smooth(fin) * (1 - smooth(fout));
    el.style.opacity = k.toFixed(3);
    el.style.transform = `translate3d(0, ${((1 - smooth(fin)) * 18 - smooth(fout) * 14).toFixed(1)}px, 0)`;
    el.style.visibility = k < 0.002 ? 'hidden' : 'visible';
  }
}

export function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

export function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}
