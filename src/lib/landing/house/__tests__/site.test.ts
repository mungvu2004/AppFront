import { describe, expect, it } from 'vitest';

import { LANDING_HOUSE } from '..';
import { hip } from '../roofs';
import type { PlanPt, Polygon } from '../../types';

const { site, roofs, plan } = LANDING_HOUSE;
const [W, D] = [40000, 34000];

const inPlot = (p: PlanPt): boolean => p[0] >= 0 && p[0] <= W && p[1] >= 0 && p[1] <= D;
const area = (o: Polygon): number => o.reduce((s, p, i) => s + p[0] * (o[(i + 1) % o.length]?.[1] ?? 0) - (o[(i + 1) % o.length]?.[0] ?? 0) * p[1], 0) / 2;
const inside = (o: Polygon, [x, y]: PlanPt): boolean =>
  o.reduce((c, p, i) => {
    const q = o[(i + 1) % o.length] ?? p;
    return p[1] > y !== q[1] > y && x < ((q[0] - p[0]) * (y - p[1])) / (q[1] - p[1]) + p[0] ? !c : c;
  }, false);

const closed = (o: Polygon, id: string): void => {
  expect(o.length, id).toBeGreaterThanOrEqual(3);
  expect(o[0], `${id} repeats its first point`).not.toEqual(o[o.length - 1]);
  expect(Math.abs(area(o)), id).toBeGreaterThan(0);
  for (const p of o) {
    expect(inPlot(p), `${id} ${String(p)}`).toBe(true);
  }
};

describe('site', () => {
  it('has well-formed closed outlines inside the plot', () => {
    closed(site.plot, 'plot');
    for (const s of site.surfaces) {
      closed(s.outline, s.id);
      for (const slab of s.slabs ?? []) {
        closed(slab, `${s.id} slab`);
        const c: PlanPt = [slab.reduce((t, p) => t + p[0], 0) / slab.length, slab.reduce((t, p) => t + p[1], 0) / slab.length];
        expect(inside(s.outline, c), `${s.id} slab outside its extent`).toBe(true);
      }
    }
    for (const x of [...site.steps, ...site.water]) {
      closed(x.outline, x.id);
    }
    for (const w of site.walls) {
      expect(inPlot(w.start) && inPlot(w.end), w.id).toBe(true);
    }
    for (const x of [...site.plants, ...site.items]) {
      expect(inPlot(x.at), x.id).toBe(true);
    }
  });

  it('fits gates in their walls and keeps the water below its coping', () => {
    for (const g of site.gates) {
      const w = site.walls.find((x) => x.id === g.wallId);
      expect(w, g.id).toBeDefined();
      const len = Math.hypot((w?.end[0] ?? 0) - (w?.start[0] ?? 0), (w?.end[1] ?? 0) - (w?.start[1] ?? 0));
      expect(g.relativePosition * len - g.widthMm / 2, g.id).toBeGreaterThan(0);
      expect(g.relativePosition * len + g.widthMm / 2, g.id).toBeLessThan(len);
    }
    // The main gate lines up with the main door's axis, x = 13 m.
    expect(site.gates.find((g) => g.id === 'GATE-MAIN')?.relativePosition).toBeCloseTo((13000 - 100) / 39800, 6);
    for (const w of site.water) {
      expect(w.waterLevelMm, w.id).toBeLessThan(w.copingTopMm);
      expect(Math.abs(area(w.outline)) / 1e6, w.id).toBeGreaterThan(80); // ~14 × 7 m with the organic bite
    }
    const island = site.surfaces.find((s) => s.kind === 'island');
    expect(island && site.water.some((w) => island.outline.every((p) => inside(w.outline, p)))).toBe(true);
  });

  it('plants hedges in beds and keeps trees out of the house and the pond', () => {
    const beds = site.surfaces.filter((s) => s.kind === 'bed');
    for (const p of site.plants.filter((x) => x.slug === 'bush')) {
      expect(beds.some((b) => inside(b.outline, p.at)), p.id).toBe(true);
    }
    expect(site.plants.filter((x) => x.slug === 'bush')).toHaveLength(40);
    const house = plan.rooms.filter((r) => r.levelId === 'T1').map((r) => r.outline.map((q): PlanPt => [q[0] ?? 0, q[1] ?? 0]));
    for (const p of [...site.plants, ...site.items].filter((x) => x.id !== 'P-BONSAI')) {
      expect(house.some((o) => inside(o, p.at)), p.id).toBe(false);
      expect(site.water.some((w) => inside(w.outline, p.at)), p.id).toBe(false);
    }
  });
});

describe('roofs', () => {
  it('steps three hip roofs up the storeys with deep timber eaves', () => {
    const storeys = roofs.hips.filter((r) => r.levelId !== 'site');
    expect(storeys.map((r) => r.levelId)).toEqual(['T1', 'T2', 'T3']);
    for (const r of storeys) {
      closed(r.eave, r.id);
      expect(r.overhangMm, r.id).toBeGreaterThanOrEqual(1500);
      expect(r.pitchDeg, r.id).toBeGreaterThanOrEqual(15);
      expect(r.pitchDeg, r.id).toBeLessThanOrEqual(22);
      expect(r.cornerUpturnMm, r.id).toBeGreaterThanOrEqual(200);
      expect(r.cornerUpturnMm, r.id).toBeLessThanOrEqual(350);
      expect(r.ridgeMm, r.id).toBeGreaterThan(r.eaveMm);
    }
    const eaves = storeys.map((r) => r.eaveMm);
    expect([...eaves].sort((a, b) => a - b)).toEqual(eaves);
  });

  it('computes a hip from its walls', () => {
    const r = hip({ id: 'X', name: 'x', levelId: 'T1', walls: [0, 0, 10000, 6000], wallTopMm: 3000, overhangMm: 1000, pitchDeg: 45, cornerUpturnMm: 300 });
    expect(r.eave[0]).toEqual([-1000, -1000]);
    expect(r.eaveMm).toBe(2000);
    expect(r.ridgeAxis).toBe('x');
    expect(r.ridgeLengthMm).toBe(4000);
    expect(r.ridgeMm).toBe(6000);
  });

  it('places posts, canopies and cladding on real things', () => {
    for (const c of roofs.canopies) {
      closed(c.outline, c.id);
    }
    const carried = new Set([...roofs.hips.map((r) => r.id), ...roofs.canopies.map((c) => c.id), ...plan.levels.map((l) => l.id)]);
    for (const row of roofs.columns) {
      expect(carried.has(row.carries), row.id).toBe(true);
      expect(row.topMm, row.id).toBeGreaterThan(row.baseMm);
      expect(inPlot(row.start) && inPlot(row.end), row.id).toBe(true);
    }
    for (const c of roofs.cladding) {
      expect(plan.walls.find((w) => w.id === c.wallId)?.kind, c.wallId).toBe('loadBearing');
      expect(c.from).toBeGreaterThanOrEqual(0);
      expect(c.to).toBeLessThanOrEqual(1);
      expect(c.to).toBeGreaterThan(c.from);
    }
  });
});
