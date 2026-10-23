/**
 * Aspect-aware shot composition: turns a shot *intent* into a camera.
 *
 * The page's type sits in the left ~38 % on landscape (a little wider at 4:3, where the
 * 56 px title takes more of the width) and the bottom ~35 % on portrait (the model is
 * centred at ~42 % height there), so a shot is not a fixed position: it is "this subject, seen from
 * this direction, placed in the free part of the frame". Two kinds:
 *
 * - `fit` (exterior / overview): a world box seen from an azimuth + elevation
 *   with a given lens; the camera is dollied and trucked (orientation fixed, so
 *   no extra keystone) until the box's projection fills the free region with
 *   margins. Narrow screens widen the lens a little (as eye shots do) and pull
 *   back for the rest instead of cropping.
 * - `eye` (interior, eye level): a fixed eye point and a focus point. The camera
 *   stays level (verticals vertical, two-point perspective) and pans so the focus
 *   lands right of centre on landscape, centred on portrait; the lens widens on
 *   narrow screens to keep the horizontal field. The eye never moves, so the
 *   collision checks hold for every aspect.
 */

import type { Vec3 } from '../types';

export const DEFAULT_ASPECT = 16 / 10;

export interface FitShot {
  readonly kind: 'fit';
  readonly box: readonly [Vec3, Vec3];
  readonly azDeg: number;
  readonly elDeg: number;
  readonly fovDeg: number;
  /** Share of the free region the box fills: < 1 leaves margin (looser), > 1 lets it overflow (closer). */
  readonly fill?: number;
  /** Landscape only: the free region's left edge (NDC) when this scene's copy is short (the CTA). */
  readonly x0?: number;
}

export interface EyeShot {
  readonly kind: 'eye';
  readonly eye: Vec3;
  readonly focus: Vec3;
  readonly fovDeg: number;
  /** Look down (negative) or up; 0 keeps verticals vertical. */
  readonly pitchDeg?: number;
}

export type Shot = FitShot | EyeShot;

export interface Framed {
  readonly position: Vec3;
  readonly target: Vec3;
  readonly fovDeg: number;
}

/** Free region in NDC for an aspect: [x0, x1, y0, y1]. */
export function freeRegion(aspect: number): readonly [number, number, number, number] {
  if (aspect < 1) return [-0.84, 0.84, -0.3, 0.64];
  // x0 starts right of the two-line headline; x1 stops at the step rail (right ~17 %).
  return [0.02, aspect < 1.5 ? 0.78 : 0.66, -0.78, 0.74];
}

/** Where an `eye` shot puts its focus horizontally (NDC). */
const focusX = (aspect: number): number => (aspect >= 1 ? 0.34 : 0);

const RAD = Math.PI / 180;
type V = [number, number, number];
const sub = (a: readonly number[], b: readonly number[]): V => [
  (a[0] ?? 0) - (b[0] ?? 0),
  (a[1] ?? 0) - (b[1] ?? 0),
  (a[2] ?? 0) - (b[2] ?? 0),
];
const dot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const axpy = (a: V, s: number, b: V): V => [a[0] + s * b[0], a[1] + s * b[1], a[2] + s * b[2]];

/** Camera basis for a forward vector (y up, no roll). */
function basis(f: V): { r: V; u: V } {
  const rl = Math.hypot(f[2], f[0]) || 1;
  const r: V = [-f[2] / rl, 0, f[0] / rl];
  const u: V = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  return { r, u };
}

/** Lens widening on narrow screens (both kinds): keep the authored 16:10 horizontal field, ~70 % on portrait. */
const widen = (aspect: number): number => Math.max(1, (aspect >= 1 ? 1 : 0.72) * (DEFAULT_ASPECT / aspect));

function fit(s: FitShot, aspect: number): Framed {
  // The same widening as eye shots, so a cut between the two kinds never jumps the lens on a tablet.
  const t = Math.tan((s.fovDeg * RAD) / 2) * widen(aspect);
  const [rx0, x1, y0, y1] = freeRegion(aspect);
  const x0 = aspect >= 1 && s.x0 !== undefined ? s.x0 : rx0;
  const k = s.fill ?? 1;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rw = ((x1 - x0) * k) / 2;
  const rh = ((y1 - y0) * k) / 2;
  const el = s.elDeg * RAD;
  const az = s.azDeg * RAD;
  const back: V = [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
  const f: V = [-back[0], -back[1], -back[2]];
  const { r, u } = basis(f);
  const [lo, hi] = s.box;
  const corners: V[] = [];
  for (let i = 0; i < 8; i += 1) {
    corners.push([(i & 1 ? hi : lo)[0], (i & 2 ? hi : lo)[1], (i & 4 ? hi : lo)[2]]);
  }
  const centre: V = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  const size = Math.hypot(...sub(hi, lo));
  let pos = axpy(centre, size / t, back);
  for (let it = 0; it < 40; it += 1) {
    let ax = Infinity;
    let bx = -Infinity;
    let ay = Infinity;
    let by = -Infinity;
    for (const c of corners) {
      const q = sub(c, pos);
      const z = dot(q, f);
      const nx = dot(q, r) / (z * aspect * t);
      const ny = dot(q, u) / (z * t);
      ax = Math.min(ax, nx);
      bx = Math.max(bx, nx);
      ay = Math.min(ay, ny);
      by = Math.max(by, ny);
    }
    const zc = dot(sub(centre, pos), f);
    const grow = Math.max((bx - ax) / 2 / rw, (by - ay) / 2 / rh);
    // Dolly so the box fills the region, truck so its centre sits on the region's.
    pos = axpy(pos, -(grow - 1) * zc * 0.8, f);
    pos = axpy(pos, -(cx - (ax + bx) / 2) * zc * aspect * t * 0.8, r);
    pos = axpy(pos, -(cy - (ay + by) / 2) * zc * t * 0.8, u);
  }
  const zc = dot(sub(centre, pos), f);
  return { position: pos, target: axpy(pos, zc, f), fovDeg: (2 * Math.atan(t)) / RAD };
}

function eye(s: EyeShot, aspect: number): Framed {
  const t = Math.tan((s.fovDeg * RAD) / 2) * widen(aspect);
  const d = sub(s.focus, s.eye);
  const yaw = Math.atan2(d[0], d[2]) + Math.atan(focusX(aspect) * aspect * t);
  const pitch = (s.pitchDeg ?? 0) * RAD;
  const dist = Math.hypot(d[0], d[2]);
  const f: V = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  return { position: [...s.eye], target: axpy([...s.eye], dist, f), fovDeg: (2 * Math.atan(t)) / RAD };
}

export const frame = (s: Shot, aspect: number): Framed => (s.kind === 'fit' ? fit(s, aspect) : eye(s, aspect));
