/**
 * The combo's story map (story p, see timeline.ts) and its screen rectangles.
 */

import { easeInOut, lerp, span, type Rect } from '../blueprint/camera';

export const CH = { book: [0, 0.1], ai: [0.1, 0.2], axo: [0.2, 0.32], cut: [0.32, 0.38], walls: [0.38, 0.5], real: [0.5, 0.57], walk: [0.57, 1] } as const;
/** Ink → photograph cross-fade inside chapter 3; A's sequence starts moving when it ends. */
export const XFADE: readonly [number, number] = [0.345, 0.375];
export const A_RUN: readonly [number, number] = [0.375, 0.5];
/** Where the materials start painting in: the entrance in the bridge frames (fractions of the frame). */
export const ENTRANCE: readonly [number, number] = [0.6, 0.62];
const FRAME_W = 1920;
const FRAME_H = 1080;

/** Smoothstep of a 0..1 progress (camera.ts's `smooth` takes an edge pair). */
export const smooth = (t: number): number => t * t * (3 - 2 * t);
export const mix = (r: Rect, s: Rect, t: number): Rect => ({ x: lerp(r.x, s.x, t), y: lerp(r.y, s.y, t), w: lerp(r.w, s.w, t), h: lerp(r.h, s.h, t) });

/** Where the section sits during 2b: under the text column, its level lines become the guides. */
export const sectionRect = (W: number, H: number): Rect => ({ x: 0.04 * W, y: 0.6 * H, w: 0.3 * W, h: 0.26 * H });

/** The book plate on the right of the spread, pushed in very slowly until the match cut. */
export function bookRect(p: number, W: number, H: number): Rect {
  const portrait = W / H < 1.1;
  const hero: Rect = portrait ? { x: 0.04 * W, y: 0.5 * H, w: 0.92 * W, h: 0.42 * H } : { x: 0.5 * W, y: 0.14 * H, w: 0.46 * W, h: 0.72 * H };
  const plate: Rect = portrait ? { x: 0.04 * W, y: 0.4 * H, w: 0.92 * W, h: 0.5 * H } : { x: 0.4 * W, y: 0.1 * H, w: 0.56 * W, h: 0.78 * H };
  const base = mix(hero, plate, easeInOut(span(p, 0.02, 0.09)));
  const z = 1 + 0.07 * easeInOut(span(p, 0, CH.cut[0]));
  const cx = base.x + base.w / 2;
  const cy = base.y + base.h / 2;
  return { x: cx - (base.w * z) / 2, y: cy - (base.h * z) / 2, w: base.w * z, h: base.h * z };
}

/** A 1920x1080 frame rect mapped through object-fit: cover (centred) onto the W x H canvas (CSS px). */
export function coverRect(r: Rect, W: number, H: number): Rect {
  const s = Math.max(W / FRAME_W, H / FRAME_H);
  const ox = (W - FRAME_W * s) / 2;
  const oy = (H - FRAME_H * s) / 2;
  return { x: ox + r.x * s, y: oy + r.y * s, w: r.w * s, h: r.h * s };
}
