/**
 * Light interactions on the realtime (drawn) chapters: hover a room on any plan → a pencil wash and a paper tag
 * with its name and area; in the exploded axonometric, hover/click (or Enter on the floor buttons) lifts a floor;
 * a pointer parallax of at most 8 px on the drawing. The stage records what it drew (`Hits`) so the pointer can
 * be tested against exactly that.
 */

import { LANDING_HOUSE } from '@/lib/landing/house';

import { project, type Cam } from '../blueprint/camera';
import type { Kit } from '../blueprint/floor';
import type { Floor, V2 } from '../blueprint/model';
import { PEN, tracePoly } from '../blueprint/pen';

/** Knob: largest pointer parallax on the drawing, CSS px. */
export const PARALLAX_PX = 8;
/** Knob: how high a lifted floor rises in the exploded view, mm. */
export const LIFT_MM = 2600;

export interface RoomRef {
  readonly level: string;
  readonly id: string;
}

export interface Ui {
  /** Smoothed pointer offset from the screen centre, -1..1 each. */
  readonly parallax: V2;
  readonly room: RoomRef | null;
  /** Per floor 0..1: how far it is lifted (eased in the hook). */
  readonly lift: readonly number[];
}

export const NO_UI: Ui = { parallax: [0, 0], room: null, lift: [0, 0, 0] };

export interface Hits {
  /** Plans drawn flat this frame (camera, storey, screen offset applied when drawn). */
  plans: { cam: Cam; floor: Floor; off: V2 }[];
  /** Exploded view: per floor, its slab top polygon on screen. */
  floors: (readonly V2[] | null)[];
  /** Screen position of each floor label (for the keyboard buttons), or null when hidden. */
  labels: (V2 | null)[];
}

export const emptyHits = (): Hits => ({ plans: [], floors: [null, null, null], labels: [null, null, null] });

function inside(pt: V2, poly: readonly V2[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const a = poly[i];
    const b = poly[j];
    if (a === undefined || b === undefined) continue;
    if (a[1] > pt[1] !== b[1] > pt[1] && pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

const outline = (id: string): V2[] => (LANDING_HOUSE.plan.rooms.find((r) => r.id === id)?.outline ?? []).map((p) => [p[0] ?? 0, p[1] ?? 0] as V2);

/** The room under the pointer on any flat plan (plan cameras are top views: invert the affine map). */
export function pickRoom(hits: Hits, x: number, y: number): RoomRef | null {
  for (let k = hits.plans.length - 1; k >= 0; k -= 1) {
    const h = hits.plans[k];
    if (h === undefined) continue;
    const { cam, off } = h;
    const px = (x - off[0] - cam.ox) / cam.s;
    const py = (cam.flip === true ? y - off[1] - cam.oy : cam.oy - (y - off[1])) / cam.s;
    for (const r of h.floor.rooms) if (inside([px, py], outline(r.id))) return { level: h.floor.id, id: r.id };
  }
  return null;
}

/** The exploded floor under the pointer, top floor first. */
export function pickFloor(hits: Hits, x: number, y: number): number {
  for (let i = hits.floors.length - 1; i >= 0; i -= 1) {
    const poly = hits.floors[i];
    if (poly !== null && poly !== undefined && inside([x, y], poly)) return i;
  }
  return -1;
}

/** Pencil wash over the hovered room and a small paper tag with its name and area. */
export function drawRoomHover(kit: Kit, cam: Cam, floor: Floor, room: RoomRef): void {
  if (room.level !== floor.id) return;
  const info = floor.rooms.find((r) => r.id === room.id);
  if (info === undefined) return;
  const { ctx, k } = kit;
  const poly = outline(room.id).map((p) => project(cam, p[0], p[1], 0));
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = kit.pal.red;
  ctx.beginPath();
  tracePoly(ctx, poly);
  ctx.fill();
  ctx.globalAlpha = 1;
  const [cx, cy] = project(cam, info.at[0], info.at[1], 0);
  const text = `${info.name} · ${String(info.m2).replace('.', ',')} m²`;
  ctx.font = `400 ${String(13 * Math.max(1, k))}px 'Be Vietnam Pro', sans-serif`;
  const w = ctx.measureText(text).width + 20;
  const h = 26;
  const x = cx - w / 2;
  const y = cy - h - 10;
  ctx.fillStyle = kit.pal.paper;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = kit.pal.ink;
  ctx.lineWidth = PEN.hair * 1.4;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = kit.pal.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, y + h / 2 + 1);
  ctx.restore();
}
