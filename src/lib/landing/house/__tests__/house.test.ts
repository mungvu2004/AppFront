import { Box3 } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { assembleHouse, createMaterials, readPalette } from '@/lib/three/present';
import { stubNoCanvas } from '@/lib/three/present/__tests__/fixtures';

import { buildStair, LANDING_HOUSE, planSvg } from '..';

const { plan, stair } = LANDING_HOUSE;
type Box = readonly [x0: number, y0: number, x1: number, y1: number];
type Outline = readonly (readonly number[])[];

const polyArea = (o: Outline): number =>
  Math.abs(o.reduce((s, p, i) => s + (p[0] ?? 0) * (o[(i + 1) % o.length]?.[1] ?? 0) - (o[(i + 1) % o.length]?.[0] ?? 0) * (p[1] ?? 0), 0)) / 2;

const inside = (o: Outline, x: number, y: number): boolean =>
  o.reduce((c, p, i) => {
    const q = o[(i + 1) % o.length] ?? p;
    const [px, py, qx, qy] = [p[0] ?? 0, p[1] ?? 0, q[0] ?? 0, q[1] ?? 0];
    return py > y !== qy > y && x < ((qx - px) * (y - py)) / (qy - py) + px ? !c : c;
  }, false);

const overlap = (a: Box, b: Box): boolean => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

const footprint = (f: (typeof plan.furniture)[number]): Box => {
  const turned = f.facing === 'east' || f.facing === 'west';
  const w = (turned ? f.sizeMm[1] : f.sizeMm[0]) ?? 0;
  const d = (turned ? f.sizeMm[0] : f.sizeMm[1]) ?? 0;
  const [x, y] = [f.centreMm[0] ?? 0, f.centreMm[1] ?? 0];
  return [x - w / 2, y - d / 2, x + w / 2, y + d / 2];
};

const wallOf = (id: string) => {
  const w = plan.walls.find((x) => x.id === id);
  if (w === undefined) {
    throw new Error(id);
  }
  return w;
};

const wallBox = (w: (typeof plan.walls)[number]): Box => {
  const [sx, sy, ex, ey] = [w.start[0] ?? 0, w.start[1] ?? 0, w.end[0] ?? 0, w.end[1] ?? 0];
  const h = w.thicknessMm / 2;
  return [Math.min(sx, ex) - h, Math.min(sy, ey) - h, Math.max(sx, ex) + h, Math.max(sy, ey) + h];
};

const levelOf = (f: (typeof plan.furniture)[number]): string => f.levelId ?? 'T1';
const floorPieces = plan.furniture.filter((f) => (f.liftMm ?? 0) === 0 && f.variant !== 'rug');
/** The stair's plan footprint (both flights + landing): x 13.2–15.8, y 11–14.36. */
const STAIR_BOX: Box = [13200, 11000, 15800, 14360];

describe('LANDING_HOUSE data', () => {
  it('has the brief counts and the two failing checks', () => {
    expect(plan.levels.map((l) => [l.id, l.elevationMm])).toEqual([
      ['T1', 0],
      ['T2', 3375],
      ['T3', 6750],
    ]);
    expect(stair.risers * stair.riserMm).toBe(3375);
    expect(stair.widthMm).toBeGreaterThanOrEqual(1100);
    expect(LANDING_HOUSE.checks).toHaveLength(12);
    expect(LANDING_HOUSE.checks.filter((c) => !c.pass).map((c) => c.targetId)).toEqual(['D-G10', 'STAIR-1']);
    expect(plan.openings.find((o) => o.id === 'D-G10')?.widthMm).toBe(700);
    expect(plan.openings.find((o) => o.id === 'D1')?.widthMm).toBe(1400);
    expect(LANDING_HOUSE.detections.filter((d) => d.labelled)).toHaveLength(3);
    const ids = new Set([...plan.walls, ...plan.openings, ...plan.rooms, ...plan.levels, stair].map((x) => x.id));
    for (const c of LANDING_HOUSE.checks) {
      expect(ids.has(c.targetId), c.id).toBe(true);
    }
    for (const d of LANDING_HOUSE.detections) {
      expect(plan.furniture.some((f) => f.id === d.furnitureId), d.furnitureId).toBe(true);
    }
    expect(plan.walls.find((w) => w.id === LANDING_HOUSE.reviewGap.wallId)?.kind).toBe('partition');
  });

  it('states areas that sum to each floor and match the polygons (stair halls excepted)', () => {
    const sum = (level: string): number =>
      plan.rooms.filter((r) => r.levelId === level && r.id !== 'TR').reduce((s, r) => s + (LANDING_HOUSE.rooms.find((i) => i.roomId === r.id)?.statedAreaM2 ?? 0), 0);
    expect([sum('T1'), sum('T2'), sum('T3')]).toEqual([288, 252, 56]);
    for (const info of LANDING_HOUSE.rooms) {
      const r = plan.rooms.find((p) => p.id === info.roomId);
      const real = polyArea(r?.outline ?? []) / 1e6;
      if (info.roomId === 'U7' || info.roomId === 'P2') {
        expect(real, info.roomId).toBeCloseTo(info.statedAreaM2 - 9.408, 3); // the well, 2,8 × 3,36 m
      } else {
        expect(real, info.roomId).toBeCloseTo(info.statedAreaM2, 6);
      }
    }
  });

  it('fits every opening inside its wall, under its storey, without overlaps', () => {
    for (const o of plan.openings) {
      const w = wallOf(o.wallId);
      const len = Math.hypot((w.end[0] ?? 0) - (w.start[0] ?? 0), (w.end[1] ?? 0) - (w.start[1] ?? 0));
      const half = o.widthMm / 2 / len;
      expect(o.relativePosition - half, o.id).toBeGreaterThanOrEqual(0);
      expect(o.relativePosition + half, o.id).toBeLessThanOrEqual(1);
      const height = w.heightMm ?? plan.levels.find((l) => l.id === w.levelId)?.heightMm ?? 0;
      expect(o.sillHeightMm + o.heightMm, o.id).toBeLessThanOrEqual(height);
    }
  });

  it('keeps furniture in its room, off walls, stair, door swings and each other', () => {
    for (const f of plan.furniture) {
      const c = f.centreMm;
      expect(plan.rooms.some((r) => r.levelId === levelOf(f) && inside(r.outline, c[0] ?? 0, c[1] ?? 0)), f.id).toBe(true);
      expect(f.modelUrl, f.id).toMatch(/^\/pascal\/items\/[a-z-]+\/model\.glb$/);
    }
    for (const f of floorPieces) {
      for (const w of plan.walls.filter((x) => x.levelId === levelOf(f))) {
        expect(overlap(footprint(f), wallBox(w)), `${f.id} x ${w.id}`).toBe(false);
      }
      expect(overlap(footprint(f), STAIR_BOX), `${f.id} on the stair`).toBe(false);
      for (const g of floorPieces.filter((p) => p !== f && levelOf(p) === levelOf(f))) {
        expect(overlap(footprint(f), footprint(g)), `${f.id} x ${g.id}`).toBe(false);
      }
    }
    for (const o of plan.openings.filter((x) => x.kind !== 'window')) {
      const w = wallOf(o.wallId);
      const [sx, sy, ex, ey] = [w.start[0] ?? 0, w.start[1] ?? 0, w.end[0] ?? 0, w.end[1] ?? 0];
      const [cx, cy] = [sx + (ex - sx) * o.relativePosition, sy + (ey - sy) * o.relativePosition];
      // A door keeps its leaf's square clear; a void keeps a metre in front over its whole width.
      const [r, half] = o.kind === 'void' ? [1000, o.widthMm / 2] : [o.widthMm, o.widthMm / 2];
      for (const sign of [-1, 1]) {
        const zone: Box =
          sx === ex
            ? [Math.min(cx, cx + sign * r), cy - half, Math.max(cx, cx + sign * r), cy + half]
            : [cx - half, Math.min(cy, cy + sign * r), cx + half, Math.max(cy, cy + sign * r)];
        for (const f of floorPieces.filter((p) => levelOf(p) === w.levelId)) {
          expect(overlap(footprint(f), zone), `${f.id} in front of ${o.id}`).toBe(false);
        }
      }
    }
  });
});

describe('assembly', () => {
  beforeEach(() => stubNoCanvas());
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds with no refusals and no unknown finishes', () => {
    const palette = readPalette(() => '');
    const { refusals, unknownFinishes } = assembleHouse(plan, palette, createMaterials(palette), { batch: false });
    expect(refusals).toEqual([]);
    expect(unknownFinishes).toEqual([]);
  });
});

describe('stair and plan svg', () => {
  it('climbs 3,375 m in 18 risers round a half-landing, and lands back on its foot line', () => {
    const group = buildStair(stair);
    group.updateMatrixWorld(true);
    const ids: string[] = [];
    group.traverse((o) => typeof o.userData['id'] === 'string' && ids.push(o.userData['id'] as string));
    expect(ids.filter((i) => i.startsWith('stair:riser:'))).toHaveLength(18);
    expect(ids).toContain('stair:landing');
    expect(ids.filter((i) => i.startsWith('stair:stringer'))).toHaveLength(2);
    const find = (id: string) => {
      let hit = group as typeof group | undefined;
      group.traverse((o) => {
        if (o.userData['id'] === id) {
          hit = o as typeof group;
        }
      });
      return new Box3().setFromObject(hit ?? group);
    };
    const top = find('stair:tread:17');
    expect(top.max.y).toBeCloseTo(3.375, 3);
    // Flight 2 is west of flight 1 (x 13.2–14.4) and tops out at y = 11 m.
    expect(top.max.x).toBeLessThan(14.45);
    expect(top.min.x).toBeGreaterThan(13.15);
    expect(top.max.z).toBeCloseTo(11.025, 2);
    const whole = new Box3().setFromObject(group);
    expect(whole.min.x).toBeGreaterThan(13.1);
    expect(whole.max.x).toBeLessThan(15.9);
    expect(whole.max.z).toBeLessThan(14.4);
  });

  it('draws the site and the ground floor with Vietnamese room names', () => {
    const svg = planSvg(LANDING_HOUSE);
    for (const text of ['Phòng khách', 'Phòng ăn', 'Bếp', 'Sảnh + cầu thang', '72 m²', '7,5 m²']) {
      expect(svg).toContain(text);
    }
    expect(svg).toContain('data-gate="GATE-MAIN"');
    expect(svg).toContain('stroke-dasharray="200 120"');
  });
});
