/**
 * Secondary-motion recipes (aesthetic/motion.md §4), in screens, data-agnostic:
 * they take walls/furniture/rooms as plain facts so the villa reuses them.
 *
 * - Wall rise: exterior walls nearest-first 0.07 screen apart, partitions start
 *   once 60 % of the exterior walls are up, 0.05 apart; each wall's duration
 *   scales with its length (`0.35 × (0.8 + 0.4 len/maxLen)`), so timing is never
 *   identical; staggers shrink for big plans so the rise stays ≤ ~1.6 + 0.8 screens.
 * - Furniture settle: rooms nearest-first 0.12 apart, pieces by distance from
 *   the room centre 0.04 apart, 0.18 each; the stage reads `furnitureSettle(v)`
 *   for the 6 cm drop (`power2.out`) and the 0.97 → 1 scaleY (`back.out(0.8)`).
 * - Labels: in 0.12 `power2.out`, fully visible ≥ 0.5, out 0.1 `power1.in`.
 */

import { gsap } from 'gsap';

export const WALL_EASE = 'power3.out';
export const LABEL_IN = 0.12;
export const LABEL_OUT = 0.1;
export const LABEL_MIN_VISIBLE = 0.5;
export const FURNITURE_DROP_M = 0.06;
const PIECE = 0.18;

export interface WallFact {
  readonly id: string;
  readonly ext: boolean;
  readonly len: number;
  readonly dist: number;
}

export interface Slot {
  readonly id: string;
  readonly start: number;
  readonly end: number;
}

/** Rise slots for one storey's walls starting at `t0`. */
export function wallSchedule(walls: readonly WallFact[], t0: number): Slot[] {
  const maxLen = Math.max(1e-6, ...walls.map((w) => w.len));
  const dur = (w: WallFact): number => 0.35 * (0.8 + (0.4 * w.len) / maxLen);
  const near = (a: WallFact, b: WallFact): number => a.dist - b.dist;
  const ext = walls.filter((w) => w.ext).sort(near);
  const inner = walls.filter((w) => !w.ext).sort(near);
  const extStep = Math.min(0.07, 1.2 / Math.max(1, ext.length));
  const slots = ext.map((w, k) => ({ id: w.id, start: t0 + k * extStep, end: t0 + k * extStep + dur(w) }));
  const ends = slots.map((s) => s.end).sort((a, b) => a - b);
  const partStart = ends.length > 0 ? (ends[Math.max(0, Math.ceil(0.6 * ends.length) - 1)] as number) : t0;
  const inStep = Math.min(0.05, 0.8 / Math.max(1, inner.length));
  inner.forEach((w, k) => slots.push({ id: w.id, start: partStart + k * inStep, end: partStart + k * inStep + dur(w) }));
  return slots;
}

/** When the last slot ends. */
export const slotsEnd = (slots: readonly Slot[]): number => Math.max(...slots.map((s) => s.end));

export interface PieceFact {
  readonly id: string;
  readonly room: string;
  /** Distance from the room centre, and the room's distance from the camera. */
  readonly fromCentre: number;
  readonly roomDist: number;
}

/** Settle slots for furniture starting at `t0`: rooms nearest-first, pieces centre-out. */
export function furnitureOrder(pieces: readonly PieceFact[], t0: number): Slot[] {
  const rooms = [...new Set([...pieces].sort((a, b) => a.roomDist - b.roomDist).map((x) => x.room))];
  const roomStep = Math.min(0.12, 1.2 / Math.max(1, rooms.length));
  return rooms.flatMap((room, r) =>
    pieces
      .filter((x) => x.room === room)
      .sort((a, b) => a.fromCentre - b.fromCentre)
      .map((x, k) => {
        const start = t0 + r * roomStep + k * Math.min(0.04, 0.4 / Math.max(1, pieces.length));
        return { id: x.id, start, end: start + PIECE };
      }),
  );
}

const DROP = gsap.parseEase('power2.out');
const SQUASH = gsap.parseEase('back.out(0.8)');

/** The settle for a piece at rise `v` (0..1): metres below its rest height and its vertical scale. */
export function furnitureSettle(v: number): { dropM: number; scaleY: number } {
  const q = Math.min(1, Math.max(0, v));
  return { dropM: FURNITURE_DROP_M * (1 - DROP(q)), scaleY: 0.97 + 0.03 * SQUASH(q) };
}
