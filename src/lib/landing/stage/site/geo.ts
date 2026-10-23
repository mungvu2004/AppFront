/**
 * Plan-mm → scene-metre geometry helpers for the site: flat polygons, prisms,
 * oriented boxes, a miter offset, and one merge so each material is one mesh.
 *
 * Plan (x, y) mm → scene (x, z) m; elevations are mm above the FFL → scene y.
 * Shapes are built as (x, −y) and turned −90° about x, which lands them at
 * (x, 0, y) facing up; their UVs are then plan metres, so a texture's repeat
 * is 1 / tile size everywhere.
 */

import { BoxGeometry, BufferGeometry, ExtrudeGeometry, Shape, ShapeGeometry, ShapeUtils, Vector2 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { PlanPt, Polygon } from '../../types';

export const M = (mm: number): number => mm / 1000;

/**
 * Holes must wind against the outline: ExtrudeGeometry only fixes a hole's
 * winding when it reverses the outline, so a same-wound hole gets inside-out
 * walls (a pond liner you see the back of).
 */
function shapeOf(outline: Polygon, holes: readonly Polygon[] = []): Shape {
  const pts = (poly: Polygon): Vector2[] => poly.map((p) => new Vector2(M(p[0]), -M(p[1])));
  const outer = pts(outline);
  const shape = new Shape(outer);
  for (const h of holes) {
    const hole = pts(h);
    shape.holes.push(new Shape(ShapeUtils.isClockWise(hole) === ShapeUtils.isClockWise(outer) ? hole.reverse() : hole));
  }
  return shape;
}

/** A flat polygon facing up at scene height `y` (m). */
export function flat(outline: Polygon, y: number, holes?: readonly Polygon[]): BufferGeometry {
  const g = new ShapeGeometry(shapeOf(outline, holes));
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/** A vertical prism over `outline` from `bottom` to `top` (m). */
export function prism(outline: Polygon, bottom: number, top: number, holes?: readonly Polygon[]): BufferGeometry {
  const g = new ExtrudeGeometry(shapeOf(outline, holes), { depth: Math.max(0.001, top - bottom), bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bottom, 0);
  return g;
}

/**
 * A box whose length runs from `a` to `b` (plan mm) between `s0` and `s1` mm
 * along it, `widthMm` across, from `bottom` to `top` m.
 */
export function beam(a: PlanPt, b: PlanPt, s0: number, s1: number, widthMm: number, bottom: number, top: number): BufferGeometry {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / len;
  const dy = (b[1] - a[1]) / len;
  const mid = (s0 + s1) / 2;
  const g = new BoxGeometry(M(s1 - s0), top - bottom, M(widthMm));
  g.rotateY(Math.atan2(-dy, dx));
  g.translate(M(a[0] + dx * mid), (bottom + top) / 2, M(a[1] + dy * mid));
  return g;
}

/** An axis-aligned box centred on plan `at`, sizes in mm, from `bottom` m up `heightM`. */
export function block(at: PlanPt, wMm: number, dMm: number, bottom: number, heightM: number): BufferGeometry {
  const g = new BoxGeometry(M(wMm), heightM, M(dMm));
  g.translate(M(at[0]), bottom + heightM / 2, M(at[1]));
  return g;
}

/** Signed area > 0 ⇔ counter-clockwise in plan. */
function area(poly: Polygon): number {
  let s = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const p = poly[i] ?? [0, 0];
    const q = poly[(i + 1) % poly.length] ?? [0, 0];
    s += p[0] * q[1] - q[0] * p[1];
  }
  return s / 2;
}

/**
 * Grow a polygon outward by `d` mm with mitred corners.
 * ponytail: miter only, fine for the convex-ish pond; a deep concave notch would need clipping.
 */
export function offset(poly: Polygon, d: number): Polygon {
  const sign = area(poly) > 0 ? -1 : 1;
  const n = poly.length;
  return poly.map((p, i) => {
    const prev = poly[(i - 1 + n) % n] ?? p;
    const next = poly[(i + 1) % n] ?? p;
    const e1 = [p[0] - prev[0], p[1] - prev[1]];
    const e2 = [next[0] - p[0], next[1] - p[1]];
    const l1 = Math.hypot(e1[0] ?? 0, e1[1] ?? 0);
    const l2 = Math.hypot(e2[0] ?? 0, e2[1] ?? 0);
    // Outward normals of the two edges (right-hand for a CCW polygon, flipped by `sign`).
    const n1 = [((e1[1] ?? 0) / l1) * -sign, (-(e1[0] ?? 0) / l1) * -sign];
    const n2 = [((e2[1] ?? 0) / l2) * -sign, (-(e2[0] ?? 0) / l2) * -sign];
    const mx = (n1[0] ?? 0) + (n2[0] ?? 0);
    const my = (n1[1] ?? 0) + (n2[1] ?? 0);
    const ml = Math.hypot(mx, my);
    const cos = (mx / ml) * (n1[0] ?? 0) + (my / ml) * (n1[1] ?? 0);
    const k = d / Math.max(0.3, cos);
    return [p[0] + (mx / ml) * k, p[1] + (my / ml) * k] as const;
  });
}

/** One geometry per material: position / normal / uv only, non-indexed; the parts are disposed. */
export function merge(parts: readonly BufferGeometry[]): BufferGeometry {
  if (parts.length === 0) {
    return new BufferGeometry();
  }
  const ready = parts.map((g) => {
    const flatG = g.index === null ? g : g.toNonIndexed();
    for (const name of Object.keys(flatG.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') {
        flatG.deleteAttribute(name);
      }
    }
    return flatG;
  });
  const out = mergeGeometries(ready, false);
  for (const g of new Set([...parts, ...ready])) {
    g.dispose();
  }
  if (out === null) {
    throw new Error('site: geometries could not be merged');
  }
  out.computeBoundingSphere();
  return out;
}
