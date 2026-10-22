/**
 * Where the combo's photographed sequences come from. The final sets are A → `/landing-lab/combo/a/`, B →
 * `/landing-lab/combo/b/` (`{1920,1280}/NNNN.webp`); until they exist the prototypes' own sets stand in
 * (`maquette/f_NNN`, `cinema/b_NNN`). Frame counts are probed, since the final counts are not fixed yet.
 * Also loads A's registration rect when A has published it (copied to `combo/c/`).
 */

import { FrameStore } from './frames';

/**
 * A frame sequence that only starts downloading when asked (`start`), so the next chapter's frames can be
 * prefetched one chapter ahead instead of all at once on page load.
 */
export class Seq {
  private store: FrameStore | null = null;

  constructor(
    readonly urlOf: (i: number) => string,
    readonly count: number,
    readonly standIn: boolean,
    /** B only: how many leading frames are the bridge from A's end pose (chapter 5). */
    readonly bridge: number,
    private readonly onFrame: () => void,
    private readonly concurrency: number,
  ) {}

  start(): FrameStore {
    this.store ??= new FrameStore(this.urlOf, this.count, this.onFrame, this.concurrency);
    return this.store;
  }

  stop(): void {
    this.store?.stop();
  }

  pause(on: boolean): void {
    this.store?.pause(on);
  }

  /** The loaded frame nearest to i (null before any); decodes a short window ahead of it. */
  frame(i: number): HTMLImageElement | null {
    const st = this.start();
    const k = Math.min(this.count - 1, Math.max(0, Math.round(i)));
    st.warm(k - 3, k + 10);
    return st.exact(k) ?? st.nearest(k);
  }

  /** Decoded frames so far (dev diagnostics). */
  loaded(): string {
    const miss: number[] = [];
    for (let i = 0; i < this.count; i += 1) if (this.store?.exact(i) == null) miss.push(i);
    return `${String(this.count - miss.length)}/${String(this.count)} missing ${miss.slice(0, 12).join(',')}`;
  }

  /** Is a decoded frame within ±tol of i? (The readiness gate: nearest-frame drawing is fine that close.) */
  near(i: number, tol = 4): boolean {
    const st = this.start();
    const k = Math.round(i);
    for (let d = 0; d <= tol; d += 1) if (st.exact(k - d) !== null || st.exact(k + d) !== null) return true;
    return false;
  }
}

/** Stand-in bridge length: the first cinema frames (the crane down) play as chapter 5. */
const STANDIN_BRIDGE = 24;

interface Set {
  readonly urlOf: (i: number) => string;
  readonly standIn: boolean;
}

/** Static files are read through a transport handed in by the screen (repo rule: no direct fetch in src/lib). */
export type Http = (url: string, init?: RequestInit) => Promise<Response>;

/** A webp that really exists (the dev server answers missing files with the SPA's HTML). */
async function exists(http: Http, url: string): Promise<boolean> {
  try {
    const r = await http(url, { method: 'HEAD' });
    return r.ok && (r.headers.get('content-type') ?? '').includes('image');
  } catch {
    return false;
  }
}

/** Number of consecutive frames 0..n-1 that exist (binary search, ≤ 10 requests). */
async function countFrames(http: Http, urlOf: (i: number) => string, max = 1024): Promise<number> {
  if (!(await exists(http, urlOf(0)))) return 0;
  let lo = 0; // exists
  let hi = max; // assumed missing
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (await exists(http, urlOf(mid))) lo = mid;
    else hi = mid;
  }
  return lo + 1;
}

const pad = (i: number, n: number): string => String(i).padStart(n, '0');

function sets(which: 'a' | 'b', wide: boolean): Set[] {
  const size = wide ? '1920' : '1280';
  const final: Set = { urlOf: (i) => `/landing-lab/combo/${which}/${size}/${pad(i, 4)}.webp`, standIn: false };
  const stand: Set =
    which === 'a'
      ? { urlOf: (i) => `/landing-lab/maquette/${size}/f_${pad(i, 3)}.webp`, standIn: true }
      : { urlOf: (i) => `/landing-lab/cinema/${size}/b_${pad(i, 3)}.webp`, standIn: true };
  return [final, stand];
}

export async function openSeq(http: Http, which: 'a' | 'b', wide: boolean, onFrame: () => void): Promise<Seq | null> {
  for (const s of sets(which, wide)) {
    const count = await countFrames(http, s.urlOf);
    if (count > 1) return new Seq(s.urlOf, count, s.standIn, which === 'b' ? STANDIN_BRIDGE : 0, onFrame, 2);
  }
  return null;
}

/**
 * B's chapters 5-7 as one list (`b-sequence.json`, copied next to the frames in `combo/b/`): `{ "parts": [...] }`
 * where a part is `{ "prefix": "bridge_", "count"?: n }` (files `<prefix>NNNN.webp` in combo/b; count probed if
 * absent), `{ "cinema": [from, to] }` (the cinema prototype's b_NNN, inclusive) or `{ "files": ["name.webp", ...] }`.
 * Without the json: old cinema frames + `int_NNNN` if those exist, else the plain stand-in.
 */
interface BPart {
  readonly prefix?: string;
  readonly count?: number;
  readonly cinema?: readonly [number, number];
  readonly files?: readonly string[];
}

export async function openB(http: Http, wide: boolean, onFrame: () => void): Promise<{ main: Seq | null; clay: Seq | null }> {
  const size = wide ? '1920' : '1280';
  const dir = `/landing-lab/combo/b/${size}/`;
  const cine = (i: number): string => `/landing-lab/cinema/${size}/b_${pad(i, 3)}.webp`;
  const prefixed = (prefix: string) => (i: number): string => `${dir}${prefix}${pad(i, 4)}.webp`;
  const list = await json<{ parts?: readonly BPart[]; clay?: { prefix?: string } }>(http, '/landing-lab/combo/b/b-sequence.json');
  const urls: string[] = [];
  let bridge = 0;
  let realBridge = false;
  const parts = list?.parts ?? [];
  for (const [k, part] of parts.entries()) {
    if (part.files !== undefined) urls.push(...part.files.map((f) => (f.startsWith('/') ? f : dir + f)));
    else if (part.cinema !== undefined) for (let i = part.cinema[0]; i <= part.cinema[1]; i += 1) urls.push(cine(i));
    else if (part.prefix !== undefined) {
      const at = prefixed(part.prefix);
      // Only the frames that are really there (B renders in chunks); never more than the list promises.
      const n = Math.min(part.count ?? Number.POSITIVE_INFINITY, await countFrames(http, at));
      if (part.prefix === 'bridge_' && n < (part.count ?? 1)) {
        // Bridge not (fully) rendered yet: the cinema crane before the listed cinema range stands in for it.
        const until = parts[k + 1]?.cinema?.[0] ?? STANDIN_BRIDGE;
        for (let i = 0; i < until; i += 1) urls.push(cine(i));
        bridge = until;
        continue;
      }
      for (let i = 0; i < n; i += 1) urls.push(at(i));
      if (part.prefix === 'bridge_') {
        bridge = n;
        realBridge = true;
      }
    }
  }
  if (list === null) {
    const inside = await countFrames(http, prefixed('int_'));
    if (inside > 0) {
      const outside = await countFrames(http, cine);
      for (let i = 0; i < outside; i += 1) urls.push(cine(i));
      for (let i = 0; i < inside; i += 1) urls.push(prefixed('int_')(i));
      bridge = STANDIN_BRIDGE;
    }
  }
  if (urls.length < 2) return { main: await openSeq(http, 'b', wide, onFrame), clay: null };
  const clayAt = prefixed(list?.clay?.prefix ?? 'bridge_clay_');
  const clayCount = realBridge ? await countFrames(http, clayAt) : 0;
  return {
    main: new Seq((i) => urls[i] ?? '', urls.length, false, bridge, onFrame, 2),
    clay: realBridge && clayCount >= bridge ? new Seq(clayAt, bridge, false, bridge, onFrame, 1) : null,
  };
}

/** Screen placement (1920x1080 frame px) of print-plan.png in A's intro frame 0. */
export interface Registration {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Rotation of the print on screen, radians, about the rect centre. */
  readonly rot: number;
}

/** Stand-in: where the plan sits in the maquette prototype's frame 0 (eyeballed; replaced by A's file). */
export const REG_STANDIN: Registration = { x: 640, y: 150, w: 1060, h: 795, rot: 0 };

async function json<T>(http: Http, url: string): Promise<T | null> {
  try {
    const r = await http(url);
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

interface RegFile {
  readonly print_png_rect_px?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly print_rotation_deg?: number;
}

export async function loadRegistration(http: Http): Promise<Registration> {
  const f = await json<RegFile>(http, '/landing-lab/combo/c/a-registration.json');
  const r = f?.print_png_rect_px;
  if (r === undefined) return REG_STANDIN;
  return { x: r.x, y: r.y, w: r.w, h: r.h, rot: ((f?.print_rotation_deg ?? 0) * Math.PI) / 180 };
}
