/**
 * Poché: the cut walls of the ground plan filled solid graphite (or a fine 45°
 * hatch), the way an architect's plan reads — heavy cut mass, openings left
 * open, corners and T-junctions exactly as the joint solver welds them.
 *
 * Each wall's welded outline is clipped to the solid stretches between its
 * openings (a Sutherland–Hodgman clip against two planes across the wall), so
 * a door is a true break in the fill, not a pale patch painted over it.
 */

import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, LessDepth, Mesh, ShaderMaterial, ShapeUtils, Vector2 } from 'three';

import type { PresentationPlan } from '@/lib/three/present';

import { dot, groundWalls, openingSpan, sub, wallFrame, wallPolygons, type P2, type WallFrame } from './geometry';
import { GRAPHITE } from './lines';

/** 0 = solid fill, 1 = 45° hatch at HATCH_PITCH_M (wired, not yet compared on screen). */
export const POCHE_HATCH = 0;
const HATCH_PITCH_M = 0.15;

const VERTEX = /* glsl */ `
  varying vec2 vXZ;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vXZ = world.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uHatch;
  uniform float uPitch;
  varying vec2 vXZ;
  void main() {
    float v = (vXZ.x + vXZ.y) / (uPitch * 1.41421356);
    float g = abs(fract(v + 0.5) - 0.5) / max(fwidth(v), 1e-5);
    float line = 1.0 - smoothstep(0.5, 1.5, g);
    gl_FragColor = vec4(uColor, mix(1.0, line, uHatch) * uOpacity);
  }
`;

/** Keep the part of `poly` where `dot(p - w.a, w.dir)` is ≥ s0 (sign 1) or ≤ s0 (sign −1). */
function clip(poly: readonly P2[], w: WallFrame, s0: number, sign: number): P2[] {
  const side = (p: P2): number => sign * (dot(sub(p, w.a), w.dir) - s0);
  const out: P2[] = [];
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length] as P2;
    const da = side(a);
    const db = side(b);
    if (da >= 0) {
      out.push(a);
    }
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  });
  return out;
}

/** Solid wall pieces (openings removed), as polygons on the floor plane. */
export function pocheShapes(plan: PresentationPlan): P2[][] {
  const walls = groundWalls(plan);
  const polys = wallPolygons(walls);
  const out: P2[][] = [];
  walls.forEach((wall, index) => {
    const w = wallFrame(wall);
    const spans = plan.openings
      .filter((o) => o.wallId === wall.id)
      .map((o) => openingSpan(o, w))
      .sort((x, y) => x[0] - y[0]);
    let piece = polys[index] as P2[];
    for (const [s0, s1] of spans) {
      const before = clip(piece, w, s0, -1);
      if (before.length >= 3) {
        out.push(before);
      }
      piece = clip(piece, w, s1, 1);
    }
    if (piece.length >= 3) {
      out.push(piece);
    }
  });
  return out;
}

export interface Poche {
  readonly mesh: Mesh<BufferGeometry, ShaderMaterial>;
  setOpacity(opacity: number): void;
}

export function createPoche(plan: PresentationPlan): Poche {
  const positions: number[] = [];
  for (const poly of pocheShapes(plan)) {
    const contour = poly.map((p) => new Vector2(p[0], p[1]));
    for (const tri of ShapeUtils.triangulateShape(contour, [])) {
      for (const k of tri) {
        const p = poly[k] as P2;
        positions.push(p[0], 0, p[1]);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const material = new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(GRAPHITE) },
      uOpacity: { value: 0 },
      uHatch: { value: POCHE_HATCH },
      uPitch: { value: HATCH_PITCH_M },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    // Depth-write with a strict test: where welded outlines overlap at a junction the second
    // triangle fails, so overlaps never darken; the offset keeps the ink lines on top.
    depthFunc: LessDepth,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  material.side = DoubleSide; // the welded outlines wind either way
  const mesh = new Mesh(geometry, material);
  mesh.name = 'ink:poche';
  mesh.renderOrder = -0.5; // under the line work on the same plane
  mesh.frustumCulled = false;
  return {
    mesh,
    setOpacity(opacity) {
      material.uniforms['uOpacity']!.value = opacity;
      mesh.visible = opacity > 1e-3;
    },
  };
}
