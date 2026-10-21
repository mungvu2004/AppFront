/**
 * Orthographic camera for the drawing: plan view (phi = 90°) tilting into an axonometric.
 *
 * World is plan mm with z up. The plan turns by `theta` about z, then the sheet tips by `phi`
 * (90° = looking straight down). Screen y grows downwards. `depth` is larger further away,
 * which is all the painter's algorithm needs for axis-aligned walls.
 */

import type { V2 } from './model';

export interface Cam {
  readonly theta: number;
  readonly phi: number;
  /** Pixels per mm and the screen offset, set by `fit`. */
  readonly s: number;
  readonly ox: number;
  readonly oy: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Unscaled projection: [screen x, screen y] in mm. */
export function raw(theta: number, phi: number, x: number, y: number, z: number): V2 {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const xr = x * c - y * s;
  const yr = x * s + y * c;
  return [xr, -yr * Math.sin(phi) - z * Math.cos(phi)];
}

export function project(cam: Cam, x: number, y: number, z: number): V2 {
  const [u, v] = raw(cam.theta, cam.phi, x, y, z);
  return [cam.ox + u * cam.s, cam.oy + v * cam.s];
}

/** Distance from the viewer (larger = further), for back-to-front sorting. */
export function depth(theta: number, x: number, y: number): number {
  return x * Math.sin(theta) + y * Math.cos(theta);
}

/** Is a vertical face with outward plan normal `n` turned towards the viewer? */
export function facesViewer(theta: number, n: V2): boolean {
  return n[0] * Math.sin(theta) + n[1] * Math.cos(theta) < -1e-6;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function bounds(pts: readonly V2[]): Bounds {
  const b: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const [x, y] of pts) {
    b.minX = Math.min(b.minX, x);
    b.minY = Math.min(b.minY, y);
    b.maxX = Math.max(b.maxX, x);
    b.maxY = Math.max(b.maxY, y);
  }
  return b;
}

export const mixBounds = (a: Bounds, b: Bounds, t: number): Bounds => ({
  minX: lerp(a.minX, b.minX, t),
  minY: lerp(a.minY, b.minY, t),
  maxX: lerp(a.maxX, b.maxX, t),
  maxY: lerp(a.maxY, b.maxY, t),
});

/** Scale + offset that fit unscaled bounds `b` into `r`, centred. */
export function fit(theta: number, phi: number, b: Bounds, r: Rect): Cam {
  const s = Math.min(r.w / (b.maxX - b.minX), r.h / (b.maxY - b.minY));
  return {
    theta,
    phi,
    s,
    ox: r.x + r.w / 2 - ((b.minX + b.maxX) / 2) * s,
    oy: r.y + r.h / 2 - ((b.minY + b.maxY) / 2) * s,
  };
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
/** 0..1 progress of `p` through [a, b]. */
export const span = (p: number, a: number, b: number): number => clamp01((p - a) / (b - a));
export const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOut = (t: number): number => 1 - (1 - t) ** 3;
/** Ease out with a small overshoot (follow-through). */
export const easeOutBack = (t: number, k = 0.9): number => 1 + (k + 1) * (t - 1) ** 3 + k * (t - 1) ** 2;
export const smooth = (a: number, b: number, t: number): number => {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};
