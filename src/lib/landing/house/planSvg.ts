/**
 * A static SVG of the ground floor for the no-WebGL2 / reduced-motion fallback.
 *
 * Everything is read from `LandingHouse` and drawn in plan millimetres (the viewBox
 * is in mm, y down the sheet like the plan): walls as filled graphite rectangles,
 * door leaves with their swing arcs, windows as three parallel lines, grid axis
 * bubbles and room names with the brief's stated areas.
 */

import type { PlanOpening, PlanWall } from '@/lib/three/present';

import { LANDING_PALETTE as C } from '../palette';
import type { LandingHouse } from '../types';

type Vec = readonly [number, number];

const COMPASS: Record<string, Vec> = { north: [0, 1], south: [0, -1], east: [1, 0], west: [-1, 0] };
const f = (n: number): string => String(Math.round(n * 10) / 10);
const area = (n: number): string => String(n).replace('.', ',');

function frameOf(w: PlanWall): { a: Vec; dir: Vec; len: number } {
  const a: Vec = [w.start[0] ?? 0, w.start[1] ?? 0];
  const dx = (w.end[0] ?? 0) - a[0];
  const dy = (w.end[1] ?? 0) - a[1];
  const len = Math.hypot(dx, dy);
  return { a, dir: [dx / len, dy / len], len };
}

function wallShapes(w: PlanWall): string {
  const { a, dir, len } = frameOf(w);
  const h = w.thicknessMm / 2;
  const n: Vec = [-dir[1], dir[0]];
  const s: Vec = [a[0] - dir[0] * h, a[1] - dir[1] * h];
  const e: Vec = [a[0] + dir[0] * (len + h), a[1] + dir[1] * (len + h)];
  const pts = [
    [s[0] + n[0] * h, s[1] + n[1] * h],
    [e[0] + n[0] * h, e[1] + n[1] * h],
    [e[0] - n[0] * h, e[1] - n[1] * h],
    [s[0] - n[0] * h, s[1] - n[1] * h],
  ];
  return `<polygon points="${pts.map((p) => `${f(p[0] ?? 0)},${f(p[1] ?? 0)}`).join(' ')}" fill="${C.graphite}"/>`;
}

function openingShapes(o: PlanOpening, w: PlanWall): string {
  const { a, dir, len } = frameOf(w);
  const h = w.thicknessMm / 2;
  const n: Vec = [-dir[1], dir[0]];
  const c = o.relativePosition * len;
  const pt = (along: number, across: number): Vec => [a[0] + dir[0] * along + n[0] * across, a[1] + dir[1] * along + n[1] * across];
  const at = (along: number, across: number): string => pt(along, across).map(f).join(',');
  const from = c - o.widthMm / 2;
  const to = c + o.widthMm / 2;
  // Clear the wall under the opening, with a little overshoot for the joint.
  const gap = `<polygon points="${at(from, -h - 5)} ${at(to, -h - 5)} ${at(to, h + 5)} ${at(from, h + 5)}" fill="${C.paper}"/>`;

  if (o.kind === 'window') {
    const lines = [-h, 0, h].map((k) => {
      const [x1, y1] = pt(from, k);
      const [x2, y2] = pt(to, k);
      return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${C.graphite}" stroke-width="18"/>`;
    });
    return gap + lines.join('');
  }
  if (o.kind !== 'door') {
    return gap;
  }
  const side = COMPASS[o.opensTowards ?? 'north'] ?? [0, 1];
  const sign = Math.sign(side[0] * n[0] + side[1] * n[1]) || 1;
  const hinge: Vec = [a[0] + dir[0] * from, a[1] + dir[1] * from];
  const leaf: Vec = [hinge[0] + n[0] * sign * o.widthMm, hinge[1] + n[1] * sign * o.widthMm];
  const closed: Vec = [a[0] + dir[0] * to, a[1] + dir[1] * to];
  const cross = dir[0] * o.widthMm * n[1] * sign * o.widthMm - dir[1] * o.widthMm * n[0] * sign * o.widthMm;
  return (
    gap +
    `<line x1="${f(hinge[0])}" y1="${f(hinge[1])}" x2="${f(leaf[0])}" y2="${f(leaf[1])}" stroke="${C.graphite}" stroke-width="30"/>` +
    `<path d="M${f(closed[0])},${f(closed[1])} A${o.widthMm},${o.widthMm} 0 0 ${cross > 0 ? 1 : 0} ${f(leaf[0])},${f(leaf[1])}" fill="none" stroke="${C.graphite}" stroke-width="12"/>`
  );
}

function centroid(outline: readonly (readonly number[])[]): Vec {
  const n = outline.length;
  return [outline.reduce((s, p) => s + (p[0] ?? 0), 0) / n, outline.reduce((s, p) => s + (p[1] ?? 0), 0) / n];
}

export function planSvg(house: LandingHouse): string {
  const { plan } = house;
  const level = plan.levels[0]?.id ?? 'T1';
  const walls = plan.walls.filter((w) => w.levelId === level);
  const parts: string[] = [`<rect x="-1800" y="-1800" width="15600" height="12600" fill="${C.paper}"/>`];

  for (const r of plan.rooms.filter((x) => x.levelId === level)) {
    const pts = r.outline.map((p) => `${p[0] ?? 0},${p[1] ?? 0}`).join(' ');
    parts.push(`<polygon points="${pts}" fill="${C.mineral}" fill-opacity="0.25"/>`);
  }
  parts.push(...walls.map(wallShapes));
  for (const o of plan.openings) {
    const w = walls.find((x) => x.id === o.wallId);
    if (w !== undefined) {
      parts.push(openingShapes(o, w));
    }
  }
  for (const ax of house.axes) {
    const [x, y] = ax.along === 'x' ? [ax.atMm, -1000] : [-1000, ax.atMm];
    const [x2, y2] = ax.along === 'x' ? [ax.atMm, 9600] : [12600, ax.atMm];
    parts.push(
      `<line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" stroke="${C.graphite}" stroke-width="8" stroke-dasharray="120 60 20 60" opacity="0.5"/>`,
      `<circle cx="${x}" cy="${y}" r="280" fill="${C.paper}" stroke="${C.graphite}" stroke-width="14"/>`,
      `<text x="${x}" y="${y + 100}" font-size="300" text-anchor="middle" fill="${C.graphite}" font-family="sans-serif">${ax.id}</text>`,
    );
  }
  for (const info of house.rooms) {
    const r = plan.rooms.find((x) => x.id === info.roomId);
    if (r === undefined || r.levelId !== level) {
      continue;
    }
    const [cx, cy] = centroid(r.outline);
    parts.push(
      `<text x="${f(cx)}" y="${f(cy)}" font-size="320" text-anchor="middle" fill="${C.graphite}" font-family="sans-serif">${info.name}</text>`,
      `<text x="${f(cx)}" y="${f(cy + 400)}" font-size="260" text-anchor="middle" fill="${C.graphite}" opacity="0.7" font-family="sans-serif">${area(info.statedAreaM2)} m²</text>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1800 -1800 15600 12600" role="img" aria-label="Mặt bằng tầng 1" preserveAspectRatio="xMidYMid meet">${parts.join('')}</svg>`;
}
