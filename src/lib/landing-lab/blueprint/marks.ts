/**
 * The AI pass, drawn like a teacher grading in red pencil: loose loops round the doors, a
 * confident underline along the front wall, room names and areas written in, a margin tally.
 * Illustrative only (the page says "Dữ liệu minh hoạ"); counts come from the house data.
 */

import { project, span, type Cam } from './camera';
import type { Kit } from './floor';
import { FLOORS, T1_COUNTS, openingCentre, type V2 } from './model';
import { PEN, loop, pencil, underline } from './pen';

export const HAND = "'Patrick Hand', 'Segoe Print', cursive";

type Mark =
  | { kind: 'loop'; at: V2; rx: number; ry: number; t: [number, number]; seed: number }
  | { kind: 'line'; a: V2; b: V2; t: [number, number]; seed: number }
  | { kind: 'text'; at: V2; dx: number; dy: number; text: string; size: number; t: [number, number]; arrow?: V2; flip?: { at?: V2; dy?: number } };

const room = (id: string): { name: string; m2: number } => {
  const r = FLOORS[0]?.rooms.find((x) => x.id === id);
  return { name: r?.name ?? '', m2: r?.m2 ?? 0 };
};
const named = (id: string, short?: string): string => {
  const r = room(id);
  return `${short ?? r.name} · ${String(r.m2).replace('.', ',')} m²`;
};

const d1 = openingCentre('D1');
const dg6 = openingCentre('D-G6');
const dg5 = openingCentre('D-G5');

const MARKS: readonly Mark[] = [
  { kind: 'loop', at: [d1[0], d1[1] + 450], rx: 1150, ry: 900, t: [0, 0.13], seed: 3 },
  { kind: 'text', at: [d1[0] + 1100, d1[1] - 900], dx: 4, dy: 6, text: 'Cửa', size: 21, t: [0.1, 0.18], arrow: [d1[0] + 700, d1[1] - 250] },
  { kind: 'line', a: [4300, 8460], b: [11400, 8460], t: [0.16, 0.28], seed: 7 },
  { kind: 'text', at: [4300, 8460], dx: 0, dy: 24, text: 'Tường ngoài · 220', size: 19, t: [0.25, 0.34], flip: { dy: -8 } },
  { kind: 'loop', at: [dg6[0] - 300, dg6[1]], rx: 780, ry: 820, t: [0.3, 0.39], seed: 11 },
  { kind: 'loop', at: [dg5[0], dg5[1] - 380], rx: 820, ry: 720, t: [0.35, 0.44], seed: 17 },
  { kind: 'text', at: [16700, 20200], dx: 0, dy: 0, text: named('G2'), size: 23, t: [0.44, 0.56] },
  { kind: 'text', at: [4700, 16200], dx: 0, dy: 0, text: named('G4'), size: 21, t: [0.53, 0.63] },
  { kind: 'text', at: [10500, 16000], dx: 0, dy: 0, text: named('G3'), size: 21, t: [0.6, 0.7] },
  { kind: 'text', at: [6900, 9450], dx: 0, dy: 0, text: named('G6', 'Ngủ'), size: 21, t: [0.67, 0.77], flip: { at: [6900, 10250] } },
  { kind: 'text', at: [16600, 10000], dx: 0, dy: 0, text: named('G5', 'Sinh hoạt'), size: 21, t: [0.73, 0.83] },
  {
    kind: 'text',
    at: [4000, 25000],
    dx: 0,
    dy: -16,
    flip: { dy: 26 },
    text: `Đã đọc: ${String(T1_COUNTS.walls)} tường, ${String(T1_COUNTS.doors)} cửa, ${String(T1_COUNTS.rooms)} phòng`,
    size: 20,
    t: [0.84, 0.98],
  },
];

/** Text written on left to right: a clip that grows with `r`. */
function write(kit: Kit, x: number, y: number, text: string, size: number, r: number): number {
  const { ctx, k } = kit;
  ctx.font = `400 ${String(size * k)}px ${HAND}`;
  const w = ctx.measureText(text).width;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 4, y - size * k * 1.3, (w + 8) * r, size * k * 1.9);
  ctx.clip();
  ctx.fillStyle = kit.pal.red;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
  ctx.restore();
  return w;
}

/** Draw the marks at progress `q` (0..1 of the AI pass), faded by `alpha`. */
export function drawMarks(kit: Kit, cam: Cam, q: number, alpha: number): void {
  if (alpha <= 0 || q <= 0) return;
  const { ctx, k } = kit;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (const m of MARKS) {
    const r = span(q, m.t[0], m.t[1]);
    if (r <= 0) continue;
    const e = r * r * (3 - 2 * r);
    if (m.kind === 'loop') {
      const c = project(cam, m.at[0], m.at[1], 0);
      pencil(ctx, loop(c, m.rx * cam.s, m.ry * cam.s, m.seed), e, m.seed, kit.pal.red, PEN.red * k);
    } else if (m.kind === 'line') {
      pencil(ctx, underline(project(cam, m.a[0], m.a[1], 0), project(cam, m.b[0], m.b[1], 0), m.seed), e, m.seed, kit.pal.red, PEN.red * k);
    } else {
      const alt = cam.flip === true ? m.flip : undefined;
      const at = alt?.at ?? m.at;
      const [x, y] = project(cam, at[0], at[1], 0);
      const tx = x + m.dx * k;
      const ty = y + (alt?.dy ?? m.dy) * k;
      ctx.globalAlpha = alpha;
      write(kit, tx, ty, m.text, m.size, e);
      if (m.arrow !== undefined) {
        const [ax, ay] = project(cam, m.arrow[0], m.arrow[1], 0);
        const from: V2 = [tx - 4 * k, ty - m.size * k * 0.35];
        const mid: V2 = [(from[0] + ax) / 2 - 4 * k, (from[1] + ay) / 2 + 3 * k];
        pencil(ctx, [from, mid, [ax, ay], [ax + 7 * k, ay + 3 * k], [ax, ay], [ax + 2 * k, ay + 8 * k]], e, 5, kit.pal.red, PEN.red * 0.75 * k);
      }
    }
  }
  ctx.restore();
}
