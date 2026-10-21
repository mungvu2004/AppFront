// jsdom: present draws its floor textures on a canvas element (null context in jsdom is fine).
import { Mesh, PerspectiveCamera, Vector3, type Material } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { buildStair, LANDING_HOUSE } from '@/lib/landing/house';
import { readPalette } from '@/lib/three/present';

import type { LandingState } from '../../types';
import { houseAnchors, projectPoint } from '../anchors';
import { applyBuild } from '../build';
import { buildStageHouse, CUTAWAY_HEIGHT_M } from '../house';

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
    compliance: { bathDoor: 0, stair: 0, passMarks: 0 },
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

  it('maps every wall id to its object: T1 walls stay, every storey above lifts', () => {
    for (const w of LANDING_HOUSE.plan.walls) expect(h.walls.get(w.id)?.upper).toBe(w.levelId !== 'T1');
    expect(h.upper).not.toBeNull();
    expect(h.furniture.size).toBe(LANDING_HOUSE.plan.furniture.length);
    expect(h.walls.get('W1')?.heightM).toBeGreaterThan(2);
  });

  it('turns the ceiling on with the camera inside, dark glass and window glow only for exterior shots', () => {
    const outside = { ...state(1, { upperLiftM: 0, roof: 1, roofLiftM: 0, ceiling: 0 }) } as LandingState;
    applyBuild(h, outside, new Vector3(-6, 1.7, -13));
    expect(h.glows.length).toBeGreaterThan(5);
    expect(h.glows.every((g) => g.visible)).toBe(true);
    expect(h.ceilings.some((c) => c.visible)).toBe(false);
    const glass = h.clonesOf.get(h.materials.glass)?.[0] as Material & { opacity: number };
    expect(glass.opacity).toBeGreaterThan(0.3);
    applyBuild(h, outside, new Vector3(12.5, 1.45, 16.3));
    expect(h.ceilings.every((c) => c.visible)).toBe(true);
    expect(h.glows.some((g) => g.visible)).toBe(false);
    expect(glass.opacity).toBeLessThan(0.1);
  });

  it('drops the furniture on far exterior shots only, and reports each flip once', () => {
    const roofed = { upperLiftM: 0, roof: 1, roofLiftM: 0, ceiling: 0 };
    const outside = state(1, roofed);
    const far = new Vector3(-13, 33, 107);
    const pieces = [...h.furniture.values()].map((f) => f.object);
    applyBuild(h, outside, new Vector3(-6, 1.7, -13));
    expect(pieces.every((o) => o.visible)).toBe(true);
    expect(applyBuild(h, outside, far)).toBe(true);
    expect(pieces.some((o) => o.visible)).toBe(false);
    expect(applyBuild(h, outside, far)).toBe(false);
    expect(applyBuild(h, state(1, { ...roofed, cutaway: 1 }), far)).toBe(true);
    // In the cutaway every standing piece is back; pieces hung above the cut (pendants, hood, wall art) are not.
    const furniture = [...h.furniture.values()];
    const hung = furniture.filter((f) => f.baseY - f.floorY > CUTAWAY_HEIGHT_M + 0.15);
    expect(hung.map((f) => f.id).sort()).toEqual(['F-G3-PEND1', 'F-G3-PEND2', 'F-G4-HOOD', 'F-P1-ART']);
    expect(furniture.every((f) => f.object.visible === !hung.includes(f))).toBe(true);
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
    const v1 = h.walls.get('V1');
    expect(v1?.uniforms.uRiseY.value).toBeCloseTo((v1?.baseY ?? 0) + 4 + 0.5 * (v1?.heightM ?? 0));
    expect(h.stacked[0]?.position.y).toBe(2);
    applyBuild(h, state(1, { cutaway: 1 }));
    expect(w1?.uniforms.uRiseY.value).toBeCloseTo((w1?.baseY ?? 0) + CUTAWAY_HEIGHT_M);
    expect(h.joinery.every((j) => j.uniforms.uOpacity.value === 1 && j.uniforms.uDrop.value === 0)).toBe(true);
    const after = materialsIn(h);
    expect(after.size).toBe(before.size);
    for (const m of after) expect(before.has(m)).toBe(true);
  });
});

describe('build fixes', () => {
  const h = build();

  it('stands upper furniture on its own floor, cuts joinery with the walls, fades the failed door', () => {
    const upperPiece = LANDING_HOUSE.plan.furniture.find((f) => f.levelId === 'T2' && f.liftMm === undefined);
    expect(h.furniture.get(upperPiece?.id ?? '')?.baseY).toBeGreaterThan(2.9);
    const failedDoor = LANDING_HOUSE.checks.find((c) => !c.pass && LANDING_HOUSE.plan.openings.some((o) => o.id === c.targetId && o.kind === 'door'));
    expect(h.failedDoorId).toBe(failedDoor?.targetId);
    const leaf = h.joinery.find((j) => j.id === failedDoor?.targetId);
    applyBuild(h, { ...state(1, { cutaway: 1 }), compliance: { bathDoor: 1, stair: 0, passMarks: 0 } } as LandingState);
    expect(leaf?.object.visible).toBe(false);
    const frame = h.joinery.find((j) => !j.upper && j.id !== failedDoor?.targetId);
    // 2 cm under the walls' cut, so the clamped frame top never z-fights with the wall cap.
    expect(frame?.uniforms.uRiseY.value).toBeCloseTo(CUTAWAY_HEIGHT_M - 0.02);
  });
});

describe('anchors', () => {
  it('names rooms, stair, the two checks and the gap, and projects to CSS pixels', () => {
    const anchors = houseAnchors(LANDING_HOUSE);
    const failing = LANDING_HOUSE.checks.filter((c) => !c.pass).map((c) => `check:${c.id}`);
    expect(failing.length).toBeGreaterThan(0);
    for (const id of ['stair', ...failing, 'gap']) expect(anchors.has(id)).toBe(true);
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
