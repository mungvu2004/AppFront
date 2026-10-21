/**
 * Canvas pens for the blueprint: ink lines that draw themselves (partial polylines), hatch
 * patterns, and a red pencil with a hand's wobble. Pure canvas 2D, no DOM besides the context.
 */

import type { V2 } from './model';

export interface Palette {
  readonly paper: string;
  readonly ink: string;
  readonly red: string;
}

/** CSS px widths of the pens at 1920 wide; the scene scales them a little with the viewport. */
export const PEN = { poche: 1.1, medium: 1.05, fine: 0.62, hair: 0.42, red: 1.9 } as const;

/** Deterministic hash noise in [0, 1). */
export function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function length(pts: readonly V2[], closed: boolean): number {
  let l = 0;
  for (let i = 1; i < pts.length; i += 1) l += dist(pts[i - 1], pts[i]);
  if (closed && pts.length > 2) l += dist(pts[pts.length - 1], pts[0]);
  return l;
}

function dist(a: V2 | undefined, b: V2 | undefined): number {
  return a === undefined || b === undefined ? 0 : Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Adds the first `r` (0..1) of the polyline to the current path. */
export function tracePartial(ctx: CanvasRenderingContext2D, pts: readonly V2[], r: number, closed = false): void {
  const first = pts[0];
  if (first === undefined || r <= 0) return;
  const all = closed ? [...pts, first] : pts;
  if (r >= 1) {
    ctx.moveTo(first[0], first[1]);
    for (let i = 1; i < all.length; i += 1) {
      const p = all[i];
      if (p !== undefined) ctx.lineTo(p[0], p[1]);
    }
    return;
  }
  let left = length(pts, closed) * r;
  ctx.moveTo(first[0], first[1]);
  for (let i = 1; i < all.length && left > 0; i += 1) {
    const a = all[i - 1];
    const b = all[i];
    if (a === undefined || b === undefined) continue;
    const d = dist(a, b);
    const t = Math.min(1, left / d);
    ctx.lineTo(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
    left -= d;
  }
}

export function tracePoly(ctx: CanvasRenderingContext2D, pts: readonly V2[]): void {
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
  ctx.closePath();
}

/** A diagonal hatch tile in ink, `gap` px apart. */
export function hatchPattern(ctx: CanvasRenderingContext2D, ink: string, gap: number, width: number, alpha: number, dpr: number): CanvasPattern | null {
  const size = Math.max(4, Math.round(gap * dpr));
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const t = tile.getContext('2d');
  if (t === null) return null;
  t.strokeStyle = ink;
  t.globalAlpha = alpha;
  t.lineWidth = width * dpr;
  t.beginPath();
  for (const o of [-size, 0, size]) {
    t.moveTo(o, size);
    t.lineTo(o + size, 0);
  }
  t.stroke();
  const p = ctx.createPattern(tile, 'repeat');
  p?.setTransform(new DOMMatrix().scale(1 / dpr));
  return p;
}

/** Fine vertical hatching (parallel to the wall's vertical edges), `gap` px apart. */
export function linePattern(ctx: CanvasRenderingContext2D, ink: string, gap: number, width: number, alpha: number, dpr: number): CanvasPattern | null {
  const size = Math.max(2, Math.round(gap * dpr));
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = 1;
  const t = tile.getContext('2d');
  if (t === null) return null;
  t.globalAlpha = alpha;
  t.fillStyle = ink;
  t.fillRect(0, 0, Math.max(1, width * dpr), 1);
  const p = ctx.createPattern(tile, 'repeat');
  p?.setTransform(new DOMMatrix().scale(1 / dpr));
  return p;
}

/**
 * A red-pencil stroke: the path wobbles a little (low-frequency, seeded) and is laid twice,
 * a soft wide pass and a firmer narrow one, like graphite catching on paper tooth.
 */
export function pencil(ctx: CanvasRenderingContext2D, pts: readonly V2[], r: number, seed: number, colour: string, width: number): void {
  if (r <= 0 || pts.length < 2) return;
  const wob = pts.map((p, i): V2 => {
    const t = i / pts.length;
    return [p[0] + Math.sin(t * 9 + seed) * 0.9 + (rand(seed + i) - 0.5) * 0.5, p[1] + Math.cos(t * 7 + seed * 1.7) * 0.9 + (rand(seed - i) - 0.5) * 0.5];
  });
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [w, a, dx] of [
    [width * 1.5, 0.28, 0.5],
    [width * 0.8, 0.8, -0.3],
  ] as const) {
    ctx.globalAlpha = a;
    ctx.lineWidth = w;
    ctx.beginPath();
    tracePartial(
      ctx,
      wob.map((p) => [p[0] + dx, p[1] - dx * 0.6] as V2),
      r,
    );
    ctx.stroke();
  }
  ctx.restore();
}

/** A loose hand-drawn loop around `c` (radii in px) that overshoots its start. */
export function loop(c: V2, rx: number, ry: number, seed: number, turns = 1.18): V2[] {
  const a0 = -2.2 + rand(seed) * 0.8;
  const n = 64;
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * turns * 2 * Math.PI;
    const grow = 1 + 0.07 * Math.sin(t * 1.5 + seed) + (0.09 * t) / (2 * Math.PI);
    return [c[0] + Math.cos(a0 + t) * rx * grow, c[1] + Math.sin(a0 + t) * ry * grow * 0.96] as V2;
  });
}

/** A slightly bowed stroke from a to b with a small flick at the end. */
export function underline(a: V2, b: V2, seed: number): V2[] {
  const n = 28;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy);
  const nx = -dy / l;
  const ny = dx / l;
  const bow = (rand(seed) - 0.5) * 6;
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const off = Math.sin(t * Math.PI) * bow;
    return [a[0] + dx * t + nx * off, a[1] + dy * t + ny * off] as V2;
  });
  pts.push([b[0] - dx * 0.03 + nx * 7, b[1] - dy * 0.03 + ny * 7]);
  return pts;
}
