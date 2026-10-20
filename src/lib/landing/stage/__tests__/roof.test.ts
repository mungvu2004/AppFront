import { Mesh } from 'three';
import { describe, expect, it } from 'vitest';

import { LANDING_HOUSE } from '@/lib/landing/house';
import { STOREY } from '@/lib/landing/house/openings';

import type { LandingState } from '../../types';
import { roleFor } from '../facade';
import { buildRoofs, hipHeight } from '../roof';

const state = (roof: number, roofLiftM: number): LandingState => ({ build: { roof, roofLiftM, upperLiftM: 1 } }) as unknown as LandingState;

describe('roofs', () => {
  const [rf1] = LANDING_HOUSE.roofs.hips;

  it('is a hip: eave height at the edge, rising by tan(pitch) inward, corners lifted', () => {
    if (rf1 === undefined) throw new Error('no RF1');
    const [x0, z0] = [rf1.eave[0]![0] / 1000, rf1.eave[0]![1] / 1000];
    const mid = x0 + 12;
    expect(hipHeight(rf1, mid, z0)).toBeCloseTo(rf1.eaveMm / 1000, 2);
    const slope = Math.tan((rf1.pitchDeg * Math.PI) / 180);
    expect(hipHeight(rf1, mid, z0 + 2) - hipHeight(rf1, mid, z0)).toBeCloseTo(2 * slope, 2);
    expect(hipHeight(rf1, x0, z0)).toBeCloseTo((rf1.eaveMm + rf1.cornerUpturnMm) / 1000, 3);
  });

  it('clears every wall top by the roof build-up (no wall pokes through the tiles from above)', () => {
    const tops: Record<string, number> = { RF1: STOREY / 1000, RF2: (2 * STOREY) / 1000, RF3: (2 * STOREY + 3000) / 1000 };
    const hips = LANDING_HOUSE.roofs.hips.filter((h) => h.levelId !== 'site');
    hips.forEach((roof, i) => {
      const o = roof.overhangMm / 1000;
      const xs = roof.eave.map((p) => p[0] / 1000);
      const zs = roof.eave.map((p) => p[1] / 1000);
      const [x0, x1, z0, z1] = [Math.min(...xs) + o, Math.max(...xs) - o, Math.min(...zs) + o, Math.max(...zs) - o];
      const above = hips[i + 1];
      const inUpper = (x: number, z: number): boolean => {
        if (above === undefined) return false;
        const ao = above.overhangMm / 1000;
        const ax = above.eave.map((p) => p[0] / 1000);
        const az = above.eave.map((p) => p[1] / 1000);
        return x > Math.min(...ax) + ao && x < Math.max(...ax) - ao && z > Math.min(...az) + ao && z < Math.max(...az) - ao;
      };
      const top = tops[roof.id] ?? NaN;
      let checked = 0;
      for (const d of [-0.13, 0, 0.13]) {
        for (let t = 0; t <= 1; t += 0.5 / Math.max(x1 - x0, z1 - z0)) {
          const pts: [number, number][] = [
            [x0 + (x1 - x0) * t, z0 - d], [x0 + (x1 - x0) * t, z1 + d], [x0 - d, z0 + (z1 - z0) * t], [x1 + d, z0 + (z1 - z0) * t],
          ];
          for (const [x, z] of pts) {
            if (inUpper(x, z)) continue;
            expect(hipHeight(roof, x, z), `${roof.id} at ${x.toFixed(2)}, ${z.toFixed(2)}`).toBeGreaterThanOrEqual(top + 0.12);
            checked += 1;
          }
        }
      }
      expect(checked).toBeGreaterThan(40);
    });
  });

  it('builds every hip, canopy and column, lands and lifts by state', () => {
    const r = buildRoofs(LANDING_HOUSE);
    const names = new Set<string>();
    r.group.traverse((o) => o instanceof Mesh && names.add(o.name));
    for (const hip of LANDING_HOUSE.roofs.hips) expect(names.has(hip.id)).toBe(true);
    r.apply(state(0, 0));
    expect(r.group.visible).toBe(false);
    r.apply(state(1, 2));
    expect(r.group.visible).toBe(true);
    expect(r.group.children[0]?.position.y).toBe(2);
    expect(r.group.children[1]?.position.y).toBe(0);
    // RF3 rides two storeys of lift: roofLiftM + 2 × upperLiftM.
    const rf3 = r.group.getObjectByName('RF3');
    rf3?.updateWorldMatrix(true, false);
    expect(rf3?.parent?.position.y).toBe(2);
    r.dispose();
  });

  it('recolours Pascal slots into palette roles', () => {
    expect(roleFor('tree', 'slot_foliage')).toBe('foliage');
    expect(roleFor('sofa', 'slot_body')).toBe('linen');
    expect(roleFor('sofa', 'slot_cushion')).toBe('accent');
    expect(roleFor('rectangular-carpet', 'slot_a')).toBe('textile');
    expect(roleFor('coffee-table', 'slot_base')).toBe('wood');
    expect(roleFor('floor-lamp', 'slot_shade')).toBe('lampShade');
    expect(roleFor('dining-table', 'slot_legs')).toBe('metal');
    expect(roleFor('fridge', 'Material')).toBe('metal');
  });
});
