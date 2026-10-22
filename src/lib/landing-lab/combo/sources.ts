/**
 * Where the combo's photographed sequences come from. The final sets are A → `/landing-lab/combo/a/`, B →
 * `/landing-lab/combo/b/` (`{1920,1280}/NNNN.webp`); until they exist the prototypes' own sets stand in
 * (`maquette/f_NNN`, `cinema/b_NNN`). Frame counts are probed, since the final counts are not fixed yet.
 * Also loads A's registration rect when A has published it (copied to `combo/c/`).
 */

import { FrameStore } from '../cinema/frames';

export interface Seq {
  readonly store: FrameStore;
  readonly count: number;
  readonly standIn: boolean;
}

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
    if (count > 1) return { store: new FrameStore(s.urlOf, count, onFrame, which === 'a' ? 3 : 4), count, standIn: s.standIn };
  }
  return null;
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
  readonly rect?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly rotation_deg?: number;
}

export async function loadRegistration(http: Http): Promise<Registration> {
  const f = await json<RegFile>(http, '/landing-lab/combo/c/a-registration.json');
  if (f?.rect === undefined) return REG_STANDIN;
  return { ...f.rect, rot: ((f.rotation_deg ?? 0) * Math.PI) / 180 };
}
