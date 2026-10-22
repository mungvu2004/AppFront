/**
 * The combo's frame store (copied from cinema/frames.ts and hardened for ~400 full-HD frames on one page):
 * progressive load (0, then strides 8 → 4 → 2 → 1) of the bytes only, a load that cannot hang (timeout, retry), and
 * decoding kept to a small window around the playhead (`warm`).
 *
 * Frames are kept as compressed Blobs (~60–90 KB each) and decoded with `createImageBitmap(blob)`, which runs off the
 * main thread; the bitmap stays decoded until `close()`. Drawing therefore never decodes. (The old path drew
 * HTMLImageElements: Chrome evicts their decoded pixels and then decodes synchronously inside drawImage, and
 * `createImageBitmap(img)` decodes on the main thread too: 70–240 ms hitches measured on Intel UHD.)
 */

import { loadOrder } from '../cinema/frames';

/** Knob: how long one frame may take before its worker moves on (ms). */
const LOAD_TIMEOUT_MS = 10000;
/** Knob: a frame that failed or timed out is queued again this many times. */
const RETRIES = 3;
/** Knob: decoded bitmaps kept this far outside the warm window before they are freed (~8 MB each at full HD). */
const KEEP_SLACK = 6;
/**
 * Knob: decodes in flight at once. Starting a whole warm window together (up to 36 on a flick) made the frame on
 * screen wait behind far ones on a busy CPU; the rest queue nearest-to-the-playhead first.
 */
const MAX_DECODES = 3;

/** Reads one frame's bytes; null on failure. Handed in by the screen (repo rule: no direct fetch in src/lib). */
export type LoadBlob = (url: string, signal: AbortSignal) => Promise<Blob | null>;

export class FrameStore {
  private readonly blobs: (Blob | null)[];
  private readonly bitmaps = new Map<number, ImageBitmap>();
  private readonly pending = new Set<number>();
  /** Frames the warm window wants decoded, nearest to the playhead first. */
  private wanted: number[] = [];
  /** Never freed: the first frame and the last one (chapter entries and the A → B hand-over draw them). */
  private readonly pinned: Set<number>;
  private stopped = false;
  private paused = false;
  private waiters: (() => void)[] = [];

  constructor(
    urlOf: (i: number) => string,
    n: number,
    private readonly onFrame: () => void,
    load: LoadBlob,
    concurrency = 4,
  ) {
    this.blobs = new Array<Blob | null>(n).fill(null);
    this.pinned = new Set([0, n - 1]);
    const queue = loadOrder(n);
    const tries = new Array<number>(n).fill(0);
    const rest = queue.slice(1);
    // The last frame early too: the A → B hand-over draws it before the reader gets there.
    const lastAt = rest.indexOf(n - 1);
    if (lastAt > 0) rest.unshift(...rest.splice(lastAt, 1));
    const take = async (i: number): Promise<void> => {
      if (this.stopped) return;
      const ctl = new AbortController();
      // A timeout guards a stuck request; it is a load budget, not a motion duration.
      const timer = setTimeout(() => ctl.abort(), LOAD_TIMEOUT_MS);
      const blob = await load(urlOf(i), ctl.signal).catch(() => null);
      clearTimeout(timer);
      this.blobs[i] = blob;
      // Busy dev server or a dropped request: try again after the rest of the queue.
      if (blob === null && (tries[i] = (tries[i] ?? 0) + 1) <= RETRIES) rest.push(i);
      if (blob !== null && this.pinned.has(i)) this.decode(i);
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

  private decode(i: number): void {
    const blob = this.blobs[i];
    if (blob === null || blob === undefined || this.bitmaps.has(i) || this.pending.has(i)) return;
    this.pending.add(i);
    createImageBitmap(blob).then(
      (bmp) => {
        this.pending.delete(i);
        if (this.stopped) {
          bmp.close();
          return;
        }
        this.bitmaps.set(i, bmp);
        this.pump();
        // Repaint: a stand-in may be on screen and the loop sleeps once the scroll has settled.
        this.onFrame();
      },
      () => {
        this.pending.delete(i);
        this.pump();
      },
    );
  }

  /** Starts queued decodes up to MAX_DECODES in flight. */
  private pump(): void {
    while (this.pending.size < MAX_DECODES && this.wanted.length > 0) {
      const i = this.wanted.shift();
      if (i !== undefined && this.blobs[i] && !this.bitmaps.has(i) && !this.pending.has(i)) this.decode(i);
    }
  }

  /**
   * Decodes frames from..to off the main thread, nearest to `at` first, and frees bitmaps far outside that window.
   */
  warm(from: number, to: number, at = from): void {
    const lo = Math.max(0, Math.round(from));
    const hi = Math.min(this.blobs.length - 1, Math.round(to));
    for (const [i, bmp] of this.bitmaps) {
      if (!this.pinned.has(i) && (i < lo - KEEP_SLACK || i > hi + KEEP_SLACK)) {
        bmp.close();
        this.bitmaps.delete(i);
      }
    }
    const c = Math.round(at);
    this.wanted = [];
    for (let i = lo; i <= hi; i += 1)
      if (this.blobs[i] && !this.bitmaps.has(i) && !this.pending.has(i)) this.wanted.push(i);
    this.wanted.sort((a, b) => Math.abs(a - c) - Math.abs(b - c));
    this.pump();
  }

  /** The decoded bitmap nearest to `i` within ±tol, or null. */
  bitmap(i: number, tol: number): ImageBitmap | null {
    for (let d = 0; d <= tol; d += 1) {
      const b = this.bitmaps.get(i - d) ?? this.bitmaps.get(i + d);
      if (b !== undefined) return b;
    }
    return null;
  }

  /** The decoded bitmap closest to `i` at any distance (a stand-in while the window decodes), or null. */
  nearestBitmap(i: number): ImageBitmap | null {
    let best: ImageBitmap | null = null;
    let dist = Number.POSITIVE_INFINITY;
    for (const [k, b] of this.bitmaps) {
      if (Math.abs(k - i) < dist) {
        dist = Math.abs(k - i);
        best = b;
      }
    }
    return best;
  }

  stop(): void {
    this.stopped = true;
    this.pause(false);
    for (const bmp of this.bitmaps.values()) bmp.close();
    this.bitmaps.clear();
  }

  /** Holds the download trickle (the reader is scrolling through drawn chapters) or lets it go on. */
  pause(on: boolean): void {
    this.paused = on;
    if (!on) {
      for (const w of this.waiters.splice(0)) w();
    }
  }

  /** Are frame i's bytes in? */
  has(i: number): boolean {
    return (this.blobs[i] ?? null) !== null;
  }
}
