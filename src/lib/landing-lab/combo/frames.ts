/**
 * The combo's frame store (copied from cinema/frames.ts and hardened for ~400 full-HD frames on one page):
 * progressive load (0, then strides 8 → 4 → 2 → 1) of the bytes only, a load that cannot hang (timeout, retry), and
 * decoding kept to a small window just ahead of the playhead (`warm`).
 */

import { loadOrder } from '../cinema/frames';

/** Knob: how long one frame may take before its worker moves on (ms). */
const LOAD_TIMEOUT_MS = 10000;
/** Knob: a frame that failed or timed out is queued again this many times. */
const RETRIES = 3;

function loadImage(url: string): Promise<HTMLImageElement | null> {
  const img = new Image();
  img.decoding = 'async';
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(ok ? img : null);
    };
    // A timeout guards a stuck request; it is a load budget, not a motion duration.
    // eslint-disable-next-line local/no-raw-duration -- network budget, not UI motion
    const timer = setTimeout(() => finish(img.complete && img.naturalWidth > 0), LOAD_TIMEOUT_MS);
    // Loaded = bytes in. Decoding is left to `warm` (a window ahead of the playhead): ~400 decoded full-HD
    // frames would be ~3 GB, which stalls the renderer; Chrome's image cache keeps the warm window decoded.
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = url;
  });
}

export class FrameStore {
  private readonly imgs: (HTMLImageElement | null)[];
  private stopped = false;
  private paused = false;
  private waiters: (() => void)[] = [];

  constructor(urlOf: (i: number) => string, n: number, onFrame: () => void, concurrency = 4) {
    this.imgs = new Array<HTMLImageElement | null>(n).fill(null);
    const queue = loadOrder(n);
    const tries = new Array<number>(n).fill(0);
    const rest = queue.slice(1);
    const take = async (i: number): Promise<void> => {
      if (this.stopped) return;
      const img = await loadImage(urlOf(i));
      this.imgs[i] = img;
      // Busy dev server or a dropped request: try again after the rest of the queue.
      if (img === null && (tries[i] = (tries[i] ?? 0) + 1) <= RETRIES) rest.push(i);
      if (!this.stopped) onFrame();
    };
    const first = take(queue[0] ?? 0);
    const worker = async (): Promise<void> => {
      await first;
      for (let i = rest.shift(); i !== undefined; i = rest.shift()) {
        while (this.paused && !this.stopped) await new Promise<void>((r) => this.waiters.push(r));
        await take(i);
      }
    };
    for (let k = 0; k < concurrency; k += 1) void worker();
  }

  private warmed = new Set<number>();

  /** Decodes frames from..to off the main thread ahead of drawing them (no-op for frames already warm). */
  warm(from: number, to: number): void {
    for (let i = Math.max(0, Math.round(from)); i <= Math.min(this.imgs.length - 1, Math.round(to)); i += 1) {
      const img = this.imgs[i];
      if (img === null || img === undefined || this.warmed.has(i)) continue;
      if (this.warmed.size > 48) this.warmed.clear();
      this.warmed.add(i);
      img.decode().catch(() => undefined);
    }
  }

  stop(): void {
    this.stopped = true;
    this.pause(false);
  }

  /** Holds the download/decode trickle (the reader is scrolling through drawn chapters) or lets it go on. */
  pause(on: boolean): void {
    this.paused = on;
    if (!on) {
      for (const w of this.waiters.splice(0)) w();
    }
  }

  exact(i: number): HTMLImageElement | null {
    return this.imgs[i] ?? null;
  }

  /** The loaded frame closest to `i`, or null before any frame arrives. */
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
}
