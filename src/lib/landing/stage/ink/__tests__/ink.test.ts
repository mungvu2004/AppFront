// @vitest-environment node
import { Vector3, type InterleavedBufferAttribute, type LineSegments, type Object3D, PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';

import { LANDING_HOUSE } from '@/lib/landing/house';
import type { LandingState } from '@/lib/landing/types';

import { createInk } from '../index';

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
    build: { wallRise: {}, floors: 0, joinery: 0, furniture: {}, material: 0, stair: 0, upper: 0, upperLiftM: 0, cutaway: 0 },
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
    for (const id of ['axis:A', 'axis:3', 'dim:12000', 'dim:9000', 'dim:5000', 'det:F1', 'gap', 'check:C4', 'check:C7']) {
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
