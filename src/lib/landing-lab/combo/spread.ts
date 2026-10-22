/**
 * Chapters 1-2 of the combo: an honest drawing set on the book spread, four drawings in a 2 x 2 grid
 * (Hình 1-3: plans of tầng 1, 2, 3 in one shared frame; Hình 4: section A–A), each drawing itself with a
 * stagger. The red pencil grades all four lightly, then tầng 1 grows into the full plate for the main marks.
 */

import { easeInOut, lerp, project, span, type Cam, type Rect } from '../blueprint/camera';
import type { Kit } from '../blueprint/floor';
import { HAND } from '../blueprint/marks';
import { FLOORS, openingCentre, type V2 } from '../blueprint/model';
import { loop, pencil, PEN } from '../blueprint/pen';
import { drawSection, levelMarks } from './section';
import { CELL, drawMiniPlan, drawSheet, mixWin, planCam, SHEET } from './sheet';

export const SPREAD = { draw: [0, 0.09], grade: [0.1, 0.13], zoom: [0.13, 0.155], marks: [0.15, 0.195] } as const;
const CAPS = ['Hình 1 — Mặt bằng tầng 1', 'Hình 2 — Mặt bằng tầng 2', 'Hình 3 — Mặt bằng tầng 3', 'Hình 4 — Mặt cắt A–A'];
/** Pen scale floor for the small drawings (thinner reads as grey fuzz). */
const MIN_K = 0.62;
const PEN_REF_S = 0.0373;

const mix = (r: Rect, s: Rect, t: number): Rect => ({ x: lerp(r.x, s.x, t), y: lerp(r.y, s.y, t), w: lerp(r.w, s.w, t), h: lerp(r.h, s.h, t) });

/** The four drawing rects (caption space excluded), with the hero → spread move and a slow push-in. */
export function spreadCells(p: number, W: number, H: number): Rect[] {
  const portrait = W / H < 1.1;
  const hero: Rect = portrait ? { x: 0.04 * W, y: 0.5 * H, w: 0.92 * W, h: 0.42 * H } : { x: 0.5 * W, y: 0.13 * H, w: 0.47 * W, h: 0.76 * H };
  const set: Rect = portrait ? { x: 0.04 * W, y: 0.4 * H, w: 0.92 * W, h: 0.5 * H } : { x: 0.39 * W, y: 0.1 * H, w: 0.58 * W, h: 0.8 * H };
  const a = mix(hero, set, easeInOut(span(p, 0.02, 0.08)));
  const z = 1 + 0.045 * easeInOut(span(p, 0, SPREAD.zoom[0]));
  const cx = a.x + a.w / 2;
  const cy = a.y + a.h / 2;
  const area: Rect = { x: cx - (a.w * z) / 2, y: cy - (a.h * z) / 2, w: a.w * z, h: a.h * z };
  const gap = 26;
  const cap = 26;
  const cw = (area.w - gap) / 2;
  const ch = (area.h - gap) / 2;
  return [0, 1, 2, 3].map((i) => ({ x: area.x + (i % 2) * (cw + gap), y: area.y + Math.floor(i / 2) * (ch + gap), w: cw, h: ch - cap }));
}

const kitAt = (base: Kit, cam: Cam): Kit => ({ ...base, k: Math.max(MIN_K, cam.s / PEN_REF_S) });

/** Drafting progress of drawing i (staggered), with the on-load inking of the exterior walls. */
function draft(p: number, i: number, intro: number): number {
  const d = span(p, SPREAD.draw[0] + i * 0.012, SPREAD.draw[1] - (3 - i) * 0.008);
  return Math.max(intro * 0.22, d);
}

function write(kit: Kit, x: number, y: number, text: string, size: number, r: number): void {
  const { ctx, k } = kit;
  ctx.save();
  ctx.font = `400 ${String(size * k)}px ${HAND}`;
  const w = ctx.measureText(text).width;
  ctx.beginPath();
  ctx.rect(x - 4, y - size * k * 1.3, (w + 8) * r, size * k * 1.9);
  ctx.clip();
  ctx.fillStyle = kit.pal.red;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** The light first pass of the red pencil over the three small drawings that will fade (tầng 2, 3, section). */
function gradeOthers(base: Kit, cells: readonly Rect[], g: number): void {
  const doors: [number, string][] = [
    [1, 'D-U4'],
    [1, 'D-U5'],
    [2, 'D-P1'],
  ];
  doors.forEach(([cell, id], i) => {
    const r = span(g, i * 0.12, i * 0.12 + 0.3);
    const rect = cells[cell];
    if (r <= 0 || rect === undefined) return;
    const cam = planCam(rect, CELL);
    const c = openingCentre(id);
    const kit = kitAt(base, cam);
    pencil(kit.ctx, loop(project(cam, c[0], c[1], 0), 950 * cam.s, 900 * cam.s, 7 + i), r, 7 + i, kit.pal.red, PEN.red * 0.8);
  });
  const sec = cells[3];
  if (sec === undefined) return;
  const kit = { ...base, k: Math.max(MIN_K, base.k * 0.8) };
  levelMarks(sec).forEach((m, i) => {
    const r = span(g, 0.35 + i * 0.12, 0.55 + i * 0.12);
    if (r > 0) pencil(kit.ctx, loop([m[0] + 26, m[1] - 6], 30, 12, 21 + i), r, 21 + i, kit.pal.red, PEN.red * 0.8);
  });
  const top = levelMarks(sec)[2];
  if (top !== undefined) write(kit, top[0] - 4, top[1] - 26, '3 tầng', 20, span(g, 0.75, 1));
}

/** Small drawings other than tầng 1 (they fade as tầng 1 takes the page): plans 2-3, section, captions. */
export function drawOthers(base: Kit, p: number, intro: number, W: number, H: number): void {
  const cells = spreadCells(p, W, H);
  const z = easeInOut(span(p, SPREAD.zoom[0], SPREAD.zoom[1]));
  const ctx = base.ctx;
  ctx.save();
  FLOORS.slice(1).forEach((f, j) => {
    const rect = cells[j + 1];
    if (rect === undefined) return;
    const cam = planCam(rect, CELL);
    drawMiniPlan(kitAt(base, cam), cam, f, draft(p, j + 1, intro), 1);
  });
  const sec = cells[3];
  if (sec !== undefined) drawSection({ ...base, k: Math.max(MIN_K, base.k * 0.8) }, sec, draft(p, 3, intro), 1);
  gradeOthers(base, cells, span(p, SPREAD.grade[0], SPREAD.grade[1]));
  ctx.fillStyle = base.pal.ink;
  ctx.font = `italic 400 ${String(14 * base.k)}px Newsreader, Georgia, serif`;
  cells.forEach((r, i) => {
    if (i === 0 && z > 0) return;
    ctx.globalAlpha = Math.min(1, draft(p, i, intro) * 3);
    ctx.fillText(CAPS[i] ?? '', r.x, r.y + r.h + 20);
  });
  ctx.restore();
}

/** Tầng 1: a small plan of the set that grows into the full plate (sheet window) for the main red pencil. */
export function drawGroundFloor(base: Kit, p: number, intro: number, W: number, H: number, plate: Rect): Cam {
  const cells = spreadCells(p, W, H);
  const z = easeInOut(span(p, SPREAD.zoom[0], SPREAD.zoom[1]));
  const rect = mix(cells[0] ?? plate, plate, z);
  const cam = planCam(rect, mixWin(CELL, SHEET, z));
  const kit = kitAt(base, cam);
  drawSheet(kit, cam, { d: draft(p, 0, intro), intro, q: span(p, SPREAD.marks[0], SPREAD.marks[1]), under: 0, annot: z });
  const g = span(p, SPREAD.grade[0], SPREAD.grade[1]);
  if (g > 0) {
    // Light pass on tầng 1: the stair, before the main marks.
    const c: V2 = project(cam, 14500, 12700, 0);
    pencil(kit.ctx, loop(c, 1900 * cam.s, 2000 * cam.s, 3), span(g, 0, 0.3), 3, kit.pal.red, PEN.red * Math.max(0.8, kit.k));
  }
  return cam;
}

/** Screen centres of the small plans at the moment tầng 1 takes over (where 2b's floors fly from). */
export function flyFrom(W: number, H: number): V2[] {
  return spreadCells(SPREAD.zoom[0], W, H).map((r) => [r.x + r.w / 2, r.y + r.h / 2]);
}
