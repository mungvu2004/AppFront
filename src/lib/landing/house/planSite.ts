/**
 * The site layer of the static plan (planSvg): every `LandingSite` / `LandingRoofs`
 * record as a plain outline in plan mm, drawn under the house — lawns as a light
 * tint, beds hatched loose, path slabs and stepping stones, the pond's coping as a
 * double line, boundary walls as poché with gate gaps, trees as canopy circles,
 * roofs and canopies dashed above the plan (the "mái đua" convention).
 */

import { LANDING_PALETTE as C } from '../palette';
import type { LandingHouse, PlanPt, Polygon } from '../types';

const f = (n: number): string => String(Math.round(n));
const pts = (o: Polygon): string => o.map((p) => `${f(p[0])},${f(p[1])}`).join(' ');
const poly = (o: Polygon, style: string): string => `<polygon points="${pts(o)}" ${style}/>`;
const ink = `stroke="${C.graphite}"`;

const FILL: Readonly<Record<string, string>> = {
  lawn: `fill="${C.jade}" fill-opacity="0.08" stroke="none"`,
  bed: `fill="${C.jade}" fill-opacity="0.16" ${ink} stroke-width="10" stroke-opacity="0.4"`,
  path: `fill="none" ${ink} stroke-width="10" stroke-opacity="0.5"`,
  island: `fill="${C.jade}" fill-opacity="0.2" ${ink} stroke-width="20"`,
};

/** The point `t` of the way along a segment, and its unit direction. */
function along(a: PlanPt, b: PlanPt, t: number): { p: PlanPt; d: PlanPt } {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], d: [(b[0] - a[0]) / len, (b[1] - a[1]) / len] };
}

export function siteShapes(house: LandingHouse): string[] {
  const { site, roofs } = house;
  const out: string[] = [poly(site.plot, `fill="none" ${ink} stroke-width="16" stroke-dasharray="400 120 60 120"`)];

  for (const s of site.surfaces) {
    out.push(poly(s.outline, FILL[s.kind] ?? `fill="${C.mineral}" fill-opacity="0.25" ${ink} stroke-width="10" stroke-opacity="0.5"`));
    for (const slab of s.slabs ?? []) {
      out.push(poly(slab, `fill="${C.mineral}" fill-opacity="0.5" ${ink} stroke-width="10"`));
    }
  }
  for (const st of site.steps) {
    out.push(poly(st.outline, `fill="none" ${ink} stroke-width="10"`));
  }
  for (const w of site.water) {
    out.push(
      poly(w.outline, `fill="${C.signal}" fill-opacity="0.12" ${ink} stroke-width="14"`),
      poly(w.outline, `fill="none" ${ink} stroke-width="${String(w.copingMm * 2)}" stroke-opacity="0.12" stroke-linejoin="round"`),
    );
    for (const l of w.lotus ?? []) {
      out.push(`<circle cx="${f(l.at[0])}" cy="${f(l.at[1])}" r="${f(l.radiusMm)}" fill="${C.jade}" fill-opacity="0.35"/>`);
    }
  }
  for (const w of site.walls) {
    out.push(`<line x1="${f(w.start[0])}" y1="${f(w.start[1])}" x2="${f(w.end[0])}" y2="${f(w.end[1])}" ${ink} stroke-width="${String(w.thicknessMm)}"/>`);
  }
  for (const g of site.gates) {
    const w = site.walls.find((x) => x.id === g.wallId);
    if (w === undefined) {
      continue;
    }
    const { p, d } = along(w.start, w.end, g.relativePosition);
    const h = g.widthMm / 2;
    out.push(
      `<line x1="${f(p[0] - d[0] * h)}" y1="${f(p[1] - d[1] * h)}" x2="${f(p[0] + d[0] * h)}" y2="${f(p[1] + d[1] * h)}" stroke="${C.paper}" stroke-width="${String(w.thicknessMm + 20)}"/>`,
      `<line x1="${f(p[0] - d[0] * h)}" y1="${f(p[1] - d[1] * h)}" x2="${f(p[0] + d[0] * h)}" y2="${f(p[1] + d[1] * h)}" ${ink} stroke-width="20" data-gate="${g.id}"/>`,
    );
    for (const pier of g.piers) {
      const s = pier.sizeMm / 2;
      out.push(`<rect x="${f(pier.at[0] - s)}" y="${f(pier.at[1] - s)}" width="${f(pier.sizeMm)}" height="${f(pier.sizeMm)}" fill="${C.graphite}"/>`);
    }
  }
  for (const t of site.plants) {
    out.push(`<circle cx="${f(t.at[0])}" cy="${f(t.at[1])}" r="${f(t.canopyMm)}" fill="${C.jade}" fill-opacity="0.1" ${ink} stroke-width="12" stroke-opacity="0.6"/>`);
  }
  for (const r of roofs.hips) {
    out.push(poly(r.eave, `fill="none" ${ink} stroke-width="14" stroke-dasharray="200 120" opacity="0.6"`));
  }
  for (const c of roofs.canopies) {
    out.push(poly(c.outline, `fill="none" ${ink} stroke-width="10" stroke-dasharray="80 80" opacity="0.6"`));
  }
  for (const row of roofs.columns) {
    for (let i = 0; i < row.count; i += 1) {
      const { p } = along(row.start, row.end, row.count === 1 ? 0 : i / (row.count - 1));
      out.push(`<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${f(row.sizeMm / 2)}" fill="${C.graphite}"/>`);
    }
  }
  return out;
}
