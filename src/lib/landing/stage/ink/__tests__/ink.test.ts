// @vitest-environment node
import { Vector3, type InterleavedBufferAttribute, type LineSegments, type Object3D, PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';

import { LANDING_HOUSE } from '@/lib/landing/house';
import type { LandingState } from '@/lib/landing/types';

import { along, wallFrame, type P2 } from '../geometry';
import { createInk } from '../index';
import { pocheShapes } from '../poche';
import { siteInk } from '../site';
import { stairPlan } from '../stairPlan';
import { furnitureSymbols, pieceSymbol } from '../symbols';

const camera = new PerspectiveCamera();

/** Every control at zero: nothing on screen. */
function zeroState(): LandingState {
  return {
    p: 0,
    scene: 0,
    sceneLocal: 0,
    camera: { position: [0, 10, 0], target: [0, 0, 0], fovDeg: 35, rollDeg: 0 },
    paper: { opacity: 0, ink: 0, junkInk: 0, axes: 0, dims: 0, liftM: 0 },
    detect: { walls: 0, rooms: 0, openings: 0, furniture: 0, labels: 0, explodeM: 0 },
    review: { highlight: 0, close: 0 },
    build: {
      wallRise: {},
      floors: 0,
      joinery: 0,
      furniture: {},
      material: 0,
      stair: 0,
      upper: 0,
      upperLiftM: 0,
      cutaway: 0,
      roof: 0,
      roofLiftM: 0,
      ceiling: 0,
      site: 0,
      planting: 0,
      water: 0,
    },
    compliance: { bathDoor: 0, stair: 0, passMarks: 0 },
    exports: 0,
    semantic: 0,
    labels: {},
  };
}

function fullState(close: number): LandingState {
  const zero = zeroState();
  return {
    ...zero,
    paper: { opacity: 1, ink: 1, junkInk: 1, axes: 1, dims: 1, liftM: 0.1 },
    detect: { walls: 1, rooms: 1, openings: 1, furniture: 1, labels: 1, explodeM: 0.2 },
    review: { highlight: 1, close },
    compliance: { bathDoor: 1, stair: 1, passMarks: 1 },
    semantic: 1,
  };
}

const find = (root: Object3D, name: string): Object3D => {
  const node = root.getObjectByName(name);
  if (!node) throw new Error(`no ${name}`);
  return node;
};

/** Segment endpoints of a LineSegments2, as [a, b] pairs. */
function segments(node: Object3D): [Vector3, Vector3][] {
  const geometry = (node as LineSegments).geometry;
  const start = geometry.attributes['instanceStart'] as InterleavedBufferAttribute;
  const end = geometry.attributes['instanceEnd'] as InterleavedBufferAttribute;
  return Array.from({ length: start.count }, (_, i) => [
    new Vector3(start.getX(i), start.getY(i), start.getZ(i)),
    new Vector3(end.getX(i), end.getY(i), end.getZ(i)),
  ]);
}

function centrelineDistance(p: Vector3): number {
  return Math.min(
    ...LANDING_HOUSE.plan.walls.map((wall) => {
      const a = new Vector3((wall.start[0] ?? 0) / 1000, 0, (wall.start[1] ?? 0) / 1000);
      const b = new Vector3((wall.end[0] ?? 0) / 1000, 0, (wall.end[1] ?? 0) / 1000);
      const ab = b.clone().sub(a);
      const t = Math.min(1, Math.max(0, p.clone().setY(0).sub(a).dot(ab) / ab.lengthSq()));
      return a.addScaledVector(ab, t).distanceTo(p.clone().setY(0));
    }),
  );
}

function ids(root: Object3D): string[] {
  const out: string[] = [];
  root.traverse((node) => {
    const holder = node as Object3D & { geometry?: { uuid: string }; material?: { uuid: string } };
    out.push(node.uuid, holder.geometry?.uuid ?? '', holder.material?.uuid ?? '');
  });
  return out;
}

describe('createInk', () => {
  it('publishes the anchors the stage labels', () => {
    const ink = createInk(LANDING_HOUSE);
    const house = LANDING_HOUSE;
    const ids = [
      ...house.axes.map((axis) => `axis:${axis.id}`),
      ...house.detections.filter((d) => d.labelled).map((d) => `det:${d.furnitureId}`),
      ...house.checks.filter((c) => !c.pass).map((c) => `check:${c.id}`),
      'gap',
    ];
    expect(ids.length).toBeGreaterThan(house.axes.length + 2);
    for (const id of ids) {
      expect(ink.anchors.has(id), id).toBe(true);
    }
    ink.dispose();
  });

  it('draws wall outlines on the real wall faces', () => {
    const ink = createInk(LANDING_HOUSE);
    const segs = segments(find(ink.group, 'ink:walls'));
    expect(segs.length).toBeGreaterThan(0);
    for (const [a, b] of segs) {
      expect(centrelineDistance(a)).toBeLessThan(0.25);
      expect(centrelineDistance(b)).toBeLessThan(0.25);
    }
    ink.dispose();
  });

  it('allocates nothing on apply and keeps anchors as the same vectors', () => {
    const ink = createInk(LANDING_HOUSE);
    const before = ids(ink.group);
    const anchor = ink.anchors.get('gap');
    ink.apply(fullState(0.4), camera);
    ink.apply(fullState(0.6), camera);
    expect(ids(ink.group)).toEqual(before);
    expect(ink.anchors.get('gap')).toBe(anchor);
    expect(anchor?.y).toBeGreaterThan(0.1);
    ink.dispose();
  });

  it('closes the gap by moving the endpoint along the wall', () => {
    const ink = createInk(LANDING_HOUSE);
    const gap = find(ink.group, 'detect:gap');
    const gapSpan = (): number => {
      const segs = segments(gap);
      // Segment 0 runs from the moving endpoint; segment 2 starts at the fixed one.
      return (segs[0] as [Vector3, Vector3])[0].distanceTo((segs[2] as [Vector3, Vector3])[0]);
    };
    ink.apply(fullState(0), camera);
    const open = gapSpan();
    ink.apply(fullState(0.5), camera);
    expect(gapSpan()).toBeCloseTo(open / 2, 5);
    ink.apply(fullState(1), camera);
    expect(open).toBeGreaterThan(0.3);
    expect(gapSpan()).toBeLessThan(1e-6);
    ink.dispose();
  });

  it('shows nothing at a zero state', () => {
    const ink = createInk(LANDING_HOUSE);
    ink.apply(fullState(1), camera);
    ink.apply(zeroState(), camera);
    ink.group.traverse((node) => {
      const material = (node as { material?: { opacity: number; uniforms?: Record<string, { value: unknown }> } })
        .material;
      if (!material || !node.visible) return;
      const opacity = material.uniforms?.['uOpacity']?.value ?? material.opacity;
      expect(opacity, node.name).toBe(0);
    });
    ink.setResolution(800, 600);
    ink.dispose();
    expect(ink.anchors.size).toBe(0);
  });
});

describe('plan drawing', () => {
  it('fills walls solid but leaves every opening open', () => {
    const shapes = pocheShapes(LANDING_HOUSE.plan);
    expect(shapes.length).toBeGreaterThan(11);
    for (const opening of LANDING_HOUSE.plan.openings) {
      const wall = LANDING_HOUSE.plan.walls.find((w) => w.id === opening.wallId);
      if (!wall || wall.levelId !== 'T1') continue;
      const w = wallFrame(wall);
      const c = along(w, opening.relativePosition * w.len);
      const inside = shapes.some((poly) => {
        let hit = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const a = poly[i] as P2;
          const b = poly[j] as P2;
          if (a[1] > c[1] !== b[1] > c[1] && c[0] < ((b[0] - a[0]) * (c[1] - a[1])) / (b[1] - a[1]) + a[0]) hit = !hit;
        }
        return hit;
      });
      expect(inside, opening.id).toBe(false);
    }
  });

  it('draws one symbol per ground piece, inside its footprint', () => {
    const ground = LANDING_HOUSE.plan.furniture.filter((f) => f.levelId === 'T1');
    const symbols = furnitureSymbols(LANDING_HOUSE.plan);
    expect(symbols).toHaveLength(ground.length);
    for (const item of ground) {
      const r = Math.hypot(item.sizeMm[0] ?? 0, item.sizeMm[1] ?? 0) / 2000 + 0.01;
      for (const p of pieceSymbol(item).flat()) {
        expect(Math.hypot(p[0] - (item.centreMm[0] ?? 0) / 1000, p[1] - (item.centreMm[1] ?? 0) / 1000), item.id).toBeLessThan(r);
      }
    }
  });

  it('draws every riser of the U-stair, the second flight beside the first', () => {
    const spec = LANDING_HOUSE.stair;
    const plan = stairPlan(spec);
    expect(plan.risers).toHaveLength(spec.risers);
    const first = plan.risers[0] as (typeof plan.risers)[number];
    const last = plan.risers[spec.risers - 1] as (typeof plan.risers)[number];
    const mid = (r: typeof first): P2 => [(r.a[0] + r.b[0]) / 2, (r.a[1] + r.b[1]) / 2];
    if (spec.landing) {
      // Back on the line of the foot, one width + gap over.
      expect(Math.abs(mid(last)[1] - mid(first)[1])).toBeLessThan(1e-6);
      expect(Math.hypot(mid(last)[0] - mid(first)[0], mid(last)[1] - mid(first)[1])).toBeCloseTo((spec.widthMm + spec.landing.gapMm) / 1000, 6);
    }
  });

  it('inks the site: boundary walls cut as poché, gates open, eaves dashed', () => {
    const site = siteInk(LANDING_HOUSE);
    expect(site.poche.length).toBeGreaterThan(LANDING_HOUSE.site.walls.length);
    expect(site.walls.length).toBeGreaterThan(8);
    expect(site.overhead.length).toBeGreaterThan(LANDING_HOUSE.roofs.hips.length * 8);
    expect(site.fine.length).toBeGreaterThan(LANDING_HOUSE.site.plants.length);
    // Nothing of the site leaves the plot — beyond a tree canopy reaching over the
    // boundary wall, as a real one does (a metre at most).
    const xs = LANDING_HOUSE.site.plot.map((p) => p[0] / 1000);
    const zs = LANDING_HOUSE.site.plot.map((p) => p[1] / 1000);
    const reach = 1;
    for (const p of [...site.fine, ...site.walls].flat()) {
      expect(p[0]).toBeGreaterThan(Math.min(...xs) - reach);
      expect(p[0]).toBeLessThan(Math.max(...xs) + reach);
      expect(p[1]).toBeGreaterThan(Math.min(...zs) - reach);
      expect(p[1]).toBeLessThan(Math.max(...zs) + reach);
    }
  });

  it('opens on complete walls and draws furniture only with ink', () => {
    const ink = createInk(LANDING_HOUSE);
    const zero = zeroState();
    ink.apply({ ...zero, paper: { ...zero.paper, opacity: 1 } }, camera);
    expect(find(ink.group, 'ink:walls').visible).toBe(true);
    expect(find(ink.group, 'ink:poche').visible).toBe(true);
    expect(find(ink.group, 'ink:furniture').visible).toBe(false);
    ink.apply({ ...zero, paper: { ...zero.paper, opacity: 1, ink: 1 } }, camera);
    expect(find(ink.group, 'ink:furniture').visible).toBe(true);
    ink.dispose();
  });
});
