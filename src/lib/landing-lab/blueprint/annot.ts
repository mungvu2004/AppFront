/**
 * Plan annotations: grid axes with bubbles, dimension strings with 45° ticks, room tags,
 * the dashed overhead outline of the cantilevered upper floor, a north arrow and a scale bar.
 * All in plan mm through the camera; text stays upright in screen space.
 */

import { AXES, type Floor, type V2 } from './model';
import { project, type Cam } from './camera';
import { strokeAll, type Kit } from './floor';
import { PEN, tracePartial } from './pen';

export const SERIF = 'Newsreader, Georgia, serif';
export const SANS = "'Be Vietnam Pro', system-ui, sans-serif";

const BUBBLE_Y = 5200;
const BUBBLE_X = 1500;

export function drawAxes(kit: Kit, cam: Cam, alpha: number, r: number): void {
  if (alpha <= 0) return;
  const { ctx, k } = kit;
  ctx.save();
  ctx.strokeStyle = kit.pal.ink;
  ctx.fillStyle = kit.pal.ink;
  ctx.globalAlpha = alpha;
  const rad = 10.5 * k;
  AXES.forEach((ax, i) => {
    const t = Math.min(1, Math.max(0, r * 1.6 - i * 0.08));
    if (t <= 0) return;
    const a = ax.along === 'x' ? project(cam, ax.atMm, BUBBLE_Y, 0) : project(cam, BUBBLE_X, ax.atMm, 0);
    const b = ax.along === 'x' ? project(cam, ax.atMm, 25600, 0) : project(cam, 29200, ax.atMm, 0);
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u: V2 = [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
    ctx.lineWidth = PEN.hair * k;
    ctx.setLineDash([14 * k, 3 * k, 1.5 * k, 3 * k]);
    ctx.beginPath();
    tracePartial(ctx, [[a[0] + u[0] * rad, a[1] + u[1] * rad], b], t);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = PEN.fine * k;
    ctx.beginPath();
    ctx.arc(a[0], a[1], rad, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * Math.min(1, t * 2));
    ctx.stroke();
    ctx.globalAlpha = alpha * Math.min(1, Math.max(0, t * 3 - 1.2));
    ctx.font = `italic 400 ${String(14 * k)}px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ax.id, a[0], a[1] + 0.5 * k);
    ctx.globalAlpha = alpha;
  });
  ctx.restore();
}

interface Chain {
  readonly stops: readonly number[];
  readonly along: 'x' | 'y';
  readonly at: number;
  /** Where the extension lines start (near the wall). */
  readonly from: number;
}

const CHAINS: readonly Chain[] = [
  { stops: [4000, 10000, 16000, 22000, 28000], along: 'x', at: 7050, from: 7900 },
  { stops: [4000, 28000], along: 'x', at: 6350, from: 7050 },
  { stops: [9000, 15000, 21000], along: 'y', at: 3000, from: 3600 },
  { stops: [9000, 21000], along: 'y', at: 2300, from: 3000 },
];

export function drawDims(kit: Kit, cam: Cam, alpha: number, r: number): void {
  if (alpha <= 0 || r <= 0) return;
  const { ctx, k } = kit;
  ctx.save();
  ctx.strokeStyle = kit.pal.ink;
  ctx.fillStyle = kit.pal.ink;
  ctx.lineWidth = PEN.hair * k;
  const pt = (c: Chain, s: number, off: number): V2 => (c.along === 'x' ? project(cam, s, off, 0) : project(cam, off, s, 0));
  CHAINS.forEach((c, ci) => {
    const t = Math.min(1, Math.max(0, r * 1.7 - ci * 0.22));
    if (t <= 0) return;
    ctx.globalAlpha = alpha;
    const first = c.stops[0] ?? 0;
    const last = c.stops[c.stops.length - 1] ?? 0;
    ctx.beginPath();
    tracePartial(ctx, [pt(c, first - 400, c.at), pt(c, last + 400, c.at)], t);
    for (const s of c.stops) {
      tracePartial(ctx, [pt(c, s, c.from), pt(c, s, c.at - 350)], t);
      const m = pt(c, s, c.at);
      const tk = 5 * k * Math.min(1, t * 2);
      ctx.moveTo(m[0] - tk, m[1] + tk);
      ctx.lineTo(m[0] + tk, m[1] - tk);
    }
    ctx.stroke();
    ctx.globalAlpha = alpha * Math.min(1, Math.max(0, t * 2 - 1));
    ctx.font = `300 ${String(10.5 * k)}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (let i = 1; i < c.stops.length; i += 1) {
      const a = c.stops[i - 1] ?? 0;
      const b = c.stops[i] ?? 0;
      const m = pt(c, (a + b) / 2, c.at);
      const label = String(b - a);
      if (c.along === 'x') ctx.fillText(label, m[0], m[1] - 4 * k);
      else {
        ctx.save();
        ctx.translate(m[0] - 4 * k, m[1]);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }
    }
  });
  ctx.restore();
}

export function drawTags(kit: Kit, cam: Cam, f: Floor, alpha: number, r: number, z0 = 0): void {
  if (alpha <= 0 || r <= 0) return;
  const { ctx, k } = kit;
  ctx.save();
  ctx.fillStyle = kit.pal.ink;
  ctx.strokeStyle = kit.pal.ink;
  ctx.font = `italic 400 ${String(12.5 * k)}px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  f.rooms.forEach((room, i) => {
    const t = Math.min(1, Math.max(0, r * 1.5 - (i / f.rooms.length) * 0.5));
    if (t <= 0) return;
    const [x, y] = project(cam, room.at[0], room.at[1] + (room.id === 'G1' ? -1300 : 0), z0);
    ctx.globalAlpha = alpha * t;
    ctx.fillText(room.tag, x, y);
    ctx.lineWidth = PEN.hair * k;
    ctx.beginPath();
    ctx.moveTo(x - 11 * k, y + 9 * k);
    ctx.lineTo(x - 11 * k + 22 * k * t, y + 9 * k);
    ctx.stroke();
  });
  ctx.restore();
}

/** The upper floor's cantilever over the veranda: dashed, as overhead linework is drawn. */
export function drawOverhead(kit: Kit, cam: Cam, alpha: number, r: number): void {
  if (alpha <= 0 || r <= 0) return;
  strokeAll(
    kit,
    cam,
    [{ pts: [[3890, 21110], [3890, 23110], [22110, 23110], [22110, 21110]], pen: 'fine', dashed: true }],
    0,
    alpha,
    () => r,
  );
  kit.ctx.globalAlpha = 1;
}

/** North arrow and a 0–5 m scale bar under the plan's south-east corner. */
export function drawPlate(kit: Kit, cam: Cam, alpha: number): void {
  if (alpha <= 0) return;
  const { ctx, k } = kit;
  const [x, y] = project(cam, 24000, cam.flip === true ? 3700 : 4300, 0);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = kit.pal.ink;
  ctx.fillStyle = kit.pal.ink;
  ctx.lineWidth = PEN.hair * k;
  const m = 1000 * cam.s;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.rect(x + i * m, y, m, 4 * k);
    if (i % 2 === 0) ctx.fill();
    ctx.stroke();
  }
  ctx.font = `300 ${String(10 * k)}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ['0', '1', '2', '3', '4', '5 m'].forEach((s, i) => ctx.fillText(s, x + i * m + (i === 5 ? 6 * k : 0), y + 9 * k));
  const nx = x + 5 * m + 34 * k;
  const ny = y - 4 * k;
  const up = cam.flip === true ? -1 : 1; // north points down the sheet in the true top view
  ctx.beginPath();
  ctx.arc(nx, ny, 11 * k, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(nx, ny - 11 * k * up);
  ctx.lineTo(nx + 4.5 * k, ny + 6 * k * up);
  ctx.lineTo(nx, ny + 3 * k * up);
  ctx.closePath();
  ctx.fill();
  ctx.font = `italic 400 ${String(12 * k)}px ${SERIF}`;
  ctx.textBaseline = up === 1 ? 'alphabetic' : 'top';
  ctx.fillText('B', nx, ny - 15 * k * up);
  ctx.restore();
}
