// jsdom: present draws its floor textures on a canvas element (null context in jsdom is fine).
import { Mesh, PerspectiveCamera, Vector3, type Material } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { buildStair, LANDING_HOUSE } from '@/lib/landing/house';
import { readPalette } from '@/lib/three/present';

import type { LandingState } from '../../types';
import { houseAnchors, projectPoint } from '../anchors';
import { applyBuild, buildStageHouse, CUTAWAY_HEIGHT_M } from '../house';

// jsdom has no 2D canvas; present falls back to flat tints on a null context.
vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

const build = () =>
  buildStageHouse(LANDING_HOUSE, (m) => buildStair(LANDING_HOUSE.stair, m.wood), readPalette(() => ''));

const state = (rise: number, extra: Partial<LandingState['build']> = {}): LandingState =>
  ({
    build: {
      wallRise: Object.fromEntries(LANDING_HOUSE.plan.walls.map((w) => [w.id, rise])),
      floors: rise,
      joinery: rise,
      furniture: Object.fromEntries(LANDING_HOUSE.plan.furniture.map((f) => [f.id, rise])),
      material: rise,
      stair: rise,
      upper: 1,
      upperLiftM: 2,
      cutaway: 0,
      ...extra,
    },
  }) as unknown as LandingState;

const materialsIn = (h: ReturnType<typeof build>): Set<Material> => {
  const out = new Set<Material>();
  h.root.traverse((o) => {
    if (o instanceof Mesh) {
      for (const m of [o.material as Material | Material[]].flat()) out.add(m);
    }
  });
  return out;
};

describe('buildStageHouse', () => {
  const h = build();

  it('maps every wall id to its object: W1–W11 on T1, U1–U5 on T2', () => {
    for (let i = 1; i <= 11; i += 1) expect(h.walls.get(`W${i}`)?.upper).toBe(false);
    for (let i = 1; i <= 5; i += 1) expect(h.walls.get(`U${i}`)?.upper).toBe(true);
    expect(h.upper).not.toBeNull();
    expect(h.furniture.size).toBe(LANDING_HOUSE.plan.furniture.length);
    expect(h.walls.get('W1')?.heightM).toBeGreaterThan(2);
  });

  it('gives each object its own patched clones', () => {
    const a = h.walls.get('W1')?.object as Mesh;
    const b = h.walls.get('W2')?.object as Mesh;
    expect((a.material as Material[])[0]).not.toBe((b.material as Material[])[0]);
    expect(a.customDepthMaterial).toBeDefined();
  });

  it('apply() writes uniforms and creates no materials', () => {
    const before = materialsIn(h);
    applyBuild(h, state(0));
    const w1 = h.walls.get('W1');
    expect(w1?.object.visible).toBe(false);
    applyBuild(h, state(0.5));
    expect(w1?.uniforms.uRiseY.value).toBeCloseTo((w1?.baseY ?? 0) + 0.5 * (w1?.heightM ?? 0));
    expect(w1?.uniforms.uMat.value).toBe(0.5);
    expect(h.upper?.position.y).toBe(2);
    const u1 = h.walls.get('U1');
    expect(u1?.uniforms.uRiseY.value).toBeCloseTo((u1?.baseY ?? 0) + 2 + 0.5 * (u1?.heightM ?? 0));
    applyBuild(h, state(1, { cutaway: 1 }));
    expect(w1?.uniforms.uRiseY.value).toBeCloseTo((w1?.baseY ?? 0) + CUTAWAY_HEIGHT_M);
    expect(h.joinery.every((j) => j.uniforms.uOpacity.value === 1 && j.uniforms.uDrop.value === 0)).toBe(true);
    const after = materialsIn(h);
    expect(after.size).toBe(before.size);
    for (const m of after) expect(before.has(m)).toBe(true);
  });
});

describe('anchors', () => {
  it('names rooms, stair, the two checks and the gap, and projects to CSS pixels', () => {
    const anchors = houseAnchors(LANDING_HOUSE);
    for (const id of ['stair', 'check:C4', 'check:C7', 'gap']) expect(anchors.has(id)).toBe(true);
    for (const room of LANDING_HOUSE.plan.rooms) expect(anchors.has(`room:${room.id}`)).toBe(true);

    const camera = new PerspectiveCamera(40, 2, 0.1, 100);
    camera.position.set(6, 20, 25);
    camera.lookAt(6, 0, 4.5);
    camera.updateMatrixWorld();
    const centre = projectPoint(new Vector3(6, 0, 4.5), camera, 800, 400);
    expect(centre.visible).toBe(true);
    expect(centre.x).toBeCloseTo(400, 0);
    expect(projectPoint(new Vector3(6, 0, 60), camera, 800, 400).visible).toBe(false);
  });
});
