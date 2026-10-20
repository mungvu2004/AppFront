import { Box3 } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { assembleHouse, createMaterials, readPalette } from '@/lib/three/present';
import { stubNoCanvas } from '@/lib/three/present/__tests__/fixtures';

import { buildStair, LANDING_HOUSE, planSvg } from '..';

const { plan } = LANDING_HOUSE;
type Box = readonly [x0: number, y0: number, x1: number, y1: number];

const polyArea = (o: readonly (readonly number[])[]): number =>
  Math.abs(o.reduce((s, p, i) => s + (p[0] ?? 0) * (o[(i + 1) % o.length]?.[1] ?? 0) - (o[(i + 1) % o.length]?.[0] ?? 0) * (p[1] ?? 0), 0)) / 2;

const inside = (o: readonly (readonly number[])[], x: number, y: number): boolean =>
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

const floorPieces = plan.furniture.filter((f) => (f.liftMm ?? 0) === 0 && f.variant !== 'rug');

describe('LANDING_HOUSE data', () => {
  it('has the brief counts', () => {
    const t1 = plan.openings.filter((o) => wallOf(o.wallId).levelId === 'T1');
    expect(t1.filter((o) => o.kind === 'door')).toHaveLength(5);
    expect(t1.filter((o) => o.kind === 'window')).toHaveLength(7);
    expect(t1.filter((o) => o.kind === 'void')).toHaveLength(1);
    expect(LANDING_HOUSE.stair.risers).toBe(16);
    expect(LANDING_HOUSE.stair.risers * LANDING_HOUSE.stair.riserMm).toBe(3000);
    expect(LANDING_HOUSE.checks).toHaveLength(12);
    expect(LANDING_HOUSE.checks.filter((c) => !c.pass).map((c) => c.targetId)).toEqual(['D5', LANDING_HOUSE.stair.id]);
  });

  it('states the brief areas', () => {
    const sum = (level: string): number =>
      LANDING_HOUSE.rooms
        .filter((r) => plan.rooms.find((p) => p.id === r.roomId)?.levelId === level)
        .reduce((s, r) => s + r.statedAreaM2, 0);
    expect(sum('T1')).toBe(108);
    expect(sum('T2')).toBe(72);
    // R7 is notched for the stairwell, so its polygon no longer equals the stated 40 m2.
    const r7 = plan.rooms.find((r) => r.id === 'R7');
    expect(polyArea(r7?.outline ?? []) / 1e6).toBeLessThan(40);
  });

  it('fits every opening inside its wall', () => {
    for (const o of plan.openings) {
      const w = wallOf(o.wallId);
      const len = Math.hypot((w.end[0] ?? 0) - (w.start[0] ?? 0), (w.end[1] ?? 0) - (w.start[1] ?? 0));
      const half = o.widthMm / 2 / len;
      expect(o.relativePosition - half, o.id).toBeGreaterThanOrEqual(0);
      expect(o.relativePosition + half, o.id).toBeLessThanOrEqual(1);
    }
  });

  it('keeps furniture in its room, off the walls and out of door swings', () => {
    for (const f of plan.furniture) {
      const level = f.levelId ?? 'T1';
      const c = f.centreMm;
      expect(plan.rooms.some((r) => r.levelId === level && inside(r.outline, c[0] ?? 0, c[1] ?? 0)), f.id).toBe(true);
    }
    for (const f of floorPieces) {
      for (const w of plan.walls.filter((x) => x.levelId === (f.levelId ?? 'T1'))) {
        expect(overlap(footprint(f), wallBox(w)), `${f.id} x ${w.id}`).toBe(false);
      }
    }
    for (const o of plan.openings.filter((x) => x.kind !== 'window')) {
      const w = wallOf(o.wallId);
      const [sx, sy] = [w.start[0] ?? 0, w.start[1] ?? 0];
      const [ex, ey] = [w.end[0] ?? 0, w.end[1] ?? 0];
      const len = Math.hypot(ex - sx, ey - sy);
      const [cx, cy] = [sx + (ex - sx) * o.relativePosition, sy + (ey - sy) * o.relativePosition];
      const r = o.kind === 'void' ? 1000 : o.widthMm; // a void has no leaf: keep a metre clear
      const vertical = sx === ex;
      for (const sign of [-1, 1]) {
        const zone: Box = vertical
          ? [Math.min(cx, cx + sign * r), cy - r / 2, Math.max(cx, cx + sign * r), cy + r / 2]
          : [cx - r / 2, Math.min(cy, cy + sign * r), cx + r / 2, Math.max(cy, cy + sign * r)];
        for (const f of floorPieces.filter((p) => (p.levelId ?? 'T1') === w.levelId)) {
          expect(overlap(footprint(f), zone), `${f.id} in front of ${o.id}`).toBe(false);
        }
      }
      expect(len).toBeGreaterThan(0);
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
  it('climbs 3 m in 16 risers', () => {
    const group = buildStair(LANDING_HOUSE.stair);
    group.updateMatrixWorld(true);
    const ids: string[] = [];
    group.traverse((o) => typeof o.userData['id'] === 'string' && ids.push(o.userData['id'] as string));
    expect(ids.filter((i) => i.startsWith('stair:riser:'))).toHaveLength(16);
    const top = group.children.find((c) => c.userData['id'] === 'stair:tread:15');
    expect(top).toBeDefined();
    expect(new Box3().setFromObject(top ?? group).max.y).toBeCloseTo(3.0, 3);
    expect(ids).toContain('stair:stringer');
  });

  it('draws the ground floor with Vietnamese room names', () => {
    const svg = planSvg(LANDING_HOUSE);
    expect(svg).toContain('Phòng khách');
    expect(svg).toContain('25 m²');
    expect(svg).toContain('4,5 m²');
  });
});
