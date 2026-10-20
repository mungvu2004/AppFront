/** Pieces of the roof group (roof.ts): the clip shader for lower roofs, canopies, column rows, soffit downlights. */

import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  DataTexture,
  Euler,
  InstancedMesh,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Quaternion,
  Vector3,
  Vector4,
  type Material,
} from 'three';

import type { Canopy, ColumnRow } from '../types';

const MM = 1000;

export interface Rect {
  readonly x0: number;
  readonly z0: number;
  readonly x1: number;
  readonly z1: number;
}

export const rectOf = (poly: readonly (readonly [number, number])[]): Rect => {
  const xs = poly.map((p) => p[0] / MM);
  const zs = poly.map((p) => p[1] / MM);
  return { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs) };
};

/** Subdivisions per face edge: enough for the upturn to curve, few enough to stay ~1k tris a roof. */
const SUBDIV = 8;

/** Plan polygons the hip function is linear on: [x, z] loops, counter-clockwise from above. */
export function hipFaces(r: Rect): [number, number][][] {
  const h = Math.min(r.x1 - r.x0, r.z1 - r.z0) / 2;
  if (r.x1 - r.x0 >= r.z1 - r.z0) {
    const zc = (r.z0 + r.z1) / 2;
    const a: [number, number] = [r.x0 + h, zc];
    const b: [number, number] = [r.x1 - h, zc];
    return [
      [[r.x0, r.z0], a, b, [r.x1, r.z0]],
      [[r.x1, r.z1], b, a, [r.x0, r.z1]],
      [[r.x0, r.z1], a, [r.x0, r.z0]],
      [[r.x1, r.z0], b, [r.x1, r.z1]],
    ];
  }
  const xc = (r.x0 + r.x1) / 2;
  const a: [number, number] = [xc, r.z0 + h];
  const b: [number, number] = [xc, r.z1 - h];
  return [
    [[r.x1, r.z0], a, b, [r.x1, r.z1]],
    [[r.x0, r.z1], b, a, [r.x0, r.z0]],
    [[r.x0, r.z0], a, [r.x1, r.z0]],
    [[r.x1, r.z1], b, [r.x0, r.z1]],
  ];
}

/** Subdivided triangles of a convex plan polygon (fan into triangles, each split SUBDIV²). */
export function planTriangles(poly: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  const p0 = poly[0] ?? [0, 0];
  for (let i = 1; i + 1 < poly.length; i += 1) {
    const p1 = poly[i] ?? p0;
    const p2 = poly[i + 1] ?? p0;
    const at = (u: number, v: number): [number, number] => [
      p0[0] + (p1[0] - p0[0]) * u + (p2[0] - p0[0]) * v,
      p0[1] + (p1[1] - p0[1]) * u + (p2[1] - p0[1]) * v,
    ];
    const n = SUBDIV;
    for (let a = 0; a < n; a += 1) {
      for (let b = 0; a + b < n; b += 1) {
        out.push(at(a / n, b / n), at((a + 1) / n, b / n), at(a / n, (b + 1) / n));
        if (a + b + 1 < n) {
          out.push(at((a + 1) / n, b / n), at((a + 1) / n, (b + 1) / n), at(a / n, (b + 1) / n));
        }
      }
    }
  }
  return out;
}

/** Discard fragments inside `uClip` (x0, z0, x1, z1 in the roof group's frame): the storey above passes through. */
export function clipped<T extends Material>(m: T, clip: Rect | null): T {
  if (clip === null) {
    return m;
  }
  const c = m.clone();
  const u = { value: new Vector4(clip.x0, clip.z0, clip.x1, clip.z1) };
  c.onBeforeCompile = (shader) => {
    shader.uniforms.uClip = u;
    shader.vertexShader = 'varying vec2 vRoofXZ;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoofXZ = position.xz;');
    shader.fragmentShader =
      'uniform vec4 uClip;\nvarying vec2 vRoofXZ;\n' +
      shader.fragmentShader.replace(
        'void main() {',
        'void main() {\nif (vRoofXZ.x > uClip.x && vRoofXZ.x < uClip.z && vRoofXZ.y > uClip.y && vRoofXZ.y < uClip.w) discard;',
      );
  };
  c.customProgramCacheKey = () => 'landing-roof-clip';
  return c;
}

export function columns(row: ColumnRow, timber: Material, steel: Material, add: (m: Mesh) => void): void {
  for (let i = 0; i < row.count; i += 1) {
    const t = row.count === 1 ? 0.5 : i / (row.count - 1);
    const x = (row.start[0] + (row.end[0] - row.start[0]) * t) / MM;
    const z = (row.start[1] + (row.end[1] - row.start[1]) * t) / MM;
    const h = (row.topMm - row.baseMm) / MM;
    const s = row.sizeMm / MM;
    const g = row.material === 'timber' ? new CylinderGeometry(s / 2, s / 2, h, 20) : new BoxGeometry(s, h, s);
    const m = new Mesh(g, row.material === 'timber' ? timber : steel);
    m.position.set(x, row.baseMm / MM + h / 2, z);
    add(m);
  }
}

export function canopy(c: Canopy, glass: Material, steel: Material, timber: Material, add: (m: Mesh) => void): void {
  const r = rectOf(c.outline);
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const top = c.topMm / MM;
  const t = c.thicknessMm / MM;
  const slab = (mat: Material, h: number, y: number): void => {
    const m = new Mesh(new BoxGeometry(w, h, d), mat);
    m.position.set((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2);
    add(m);
  };
  if (c.kind === 'glass') {
    slab(glass, 0.024, top - 0.012);
    // Perimeter frame and slim beams under the pane.
    const beam = (bw: number, bd: number, x: number, z: number): void => {
      const m = new Mesh(new BoxGeometry(bw, t, bd), steel);
      m.position.set(x, top - 0.024 - t / 2, z);
      add(m);
    };
    beam(w, 0.08, (r.x0 + r.x1) / 2, r.z0 + 0.04);
    beam(w, 0.08, (r.x0 + r.x1) / 2, r.z1 - 0.04);
    const span = c.beamAxis === 'y' ? w : d;
    const n = Math.max(1, Math.round(span / (c.beamSpacingMm / MM)));
    for (let i = 0; i <= n; i += 1) {
      const at = (span * i) / n;
      if (c.beamAxis === 'y') {
        beam(0.06, d, r.x0 + Math.min(Math.max(at, 0.03), w - 0.03), (r.z0 + r.z1) / 2);
      } else {
        beam(w, 0.06, (r.x0 + r.x1) / 2, r.z0 + Math.min(Math.max(at, 0.03), d - 0.03));
      }
    }
  } else {
    slab(steel, t * 0.6, top - t * 0.3);
    slab(timber, 0.02, top - t * 0.6 - 0.01);
  }
}

/** Downlights: one every this many metres of soffit, this far out from the wall line. */
const LIGHT_STEP_M = 1.2;
const LIGHT_OUT_M = 0.45;
/** The wash each throws on the wall under it (additive), and how far it stands off the wall line (past the cladding). */
const POOL_W = 0.9;
const POOL_H = 1.6;
const POOL_OFF_M = 0.18;

/** A 64 px radial falloff (white centre to black) for the additive pools: a DataTexture, so it builds without a DOM. */
export function poolTexture(): DataTexture {
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      // Brightest just under the light (top of the quad), fading down and to the sides.
      const dx = (x + 0.5) / n - 0.5;
      const dy = ((y + 0.5) / n - 0.85) * 0.6;
      const v = Math.max(0, 1 - Math.hypot(dx, dy) * 2.2);
      const i = (y * n + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.round(255 * v * v);
      data[i + 3] = 255;
    }
  }
  const t = new DataTexture(data, n, n);
  t.needsUpdate = true;
  return t;
}

/**
 * Soffit downlights over a hip's walls (the reference's evening signature, 0.jpg): warm discs in the
 * soffit and a baked wash on the wall below each, two instanced draws a roof and no real lights.
 * `soffitY(u)` is the soffit's height `u` metres out from the wall line; points inside `clip` skip.
 */
export function soffitLights(
  walls: Rect,
  clip: Rect | null,
  soffitY: (u: number) => number,
  disc: Material,
  pool: Material,
): Mesh[] {
  const spots: { x: number; z: number; nx: number; nz: number }[] = [];
  const sides: [number, number, number, number, number, number][] = [
    [walls.x0, walls.z0, walls.x1, walls.z0, 0, -1],
    [walls.x1, walls.z0, walls.x1, walls.z1, 1, 0],
    [walls.x1, walls.z1, walls.x0, walls.z1, 0, 1],
    [walls.x0, walls.z1, walls.x0, walls.z0, -1, 0],
  ];
  for (const [ax, az, bx, bz, nx, nz] of sides) {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.floor(len / LIGHT_STEP_M));
    for (let i = 0; i < n; i += 1) {
      const t = (i + 0.5) / n;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const inside = clip !== null && x > clip.x0 && x < clip.x1 && z > clip.z0 && z < clip.z1;
      if (!inside) spots.push({ x, z, nx, nz });
    }
  }
  const discs = new InstancedMesh(new CircleGeometry(0.035, 12), disc, spots.length);
  const pools = new InstancedMesh(new PlaneGeometry(POOL_W, POOL_H), pool, spots.length);
  const m = new Matrix4();
  const q = new Quaternion();
  const one = new Vector3(1, 1, 1);
  const p = new Vector3();
  const down = new Euler(Math.PI / 2, 0, 0);
  const y = soffitY(LIGHT_OUT_M) - 0.004;
  spots.forEach((s, i) => {
    discs.setMatrixAt(i, m.compose(p.set(s.x + s.nx * LIGHT_OUT_M, y, s.z + s.nz * LIGHT_OUT_M), q.setFromEuler(down), one));
    const face = new Euler(0, Math.atan2(s.nx, s.nz), 0);
    pools.setMatrixAt(i, m.compose(p.set(s.x + s.nx * POOL_OFF_M, y - POOL_H / 2, s.z + s.nz * POOL_OFF_M), q.setFromEuler(face), one));
  });
  for (const mesh of [discs, pools]) {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = 'soffitLights';
  }
  pools.renderOrder = 2;
  return [discs, pools];
}
