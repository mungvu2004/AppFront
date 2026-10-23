/**
 * The villa's roofs as the reference photos have them (ref-vuonhoa): one low
 * hip per storey in flat charcoal tiles, a deep overhang with a timber soffit,
 * a thin charcoal fascia over a bright soffit with warm downlights
 * (roofParts.soffitLights), ridge and hip caps, the eave kicking up only in the
 * last metre or so of each corner; the glass pergola on slim steel posts, the
 * carport's metal roof, the veranda's timber columns.
 *
 * A hip is exact: over its eave rectangle the tiled surface stands at
 * `eave + tan(pitch) · (distance to the nearest eave edge)`, which is a hip
 * roof by definition, so the faces are built as the four plan polygons that
 * function is linear on (triangle hips, trapezoid flanks), subdivided only so
 * the corner upturn can bend them. A lower roof runs on under the storey
 * above it: its fragments inside that storey's wall rectangle are discarded
 * (no CSG, the clip is a uniform rectangle per material). The group lands from above as `build.roof` reaches 1 and lifts by
 * `build.roofLiftM`; canopies and columns land with it but never lift (they
 * stand on the ground). Needs no GL to build; textures arrive late.
 */

import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Material,
  type Texture,
} from 'three';

import type { HipRoof, LandingHouse, LandingState } from '../types';

import { canopy, clipped, columns, hipFaces, planTriangles, poolTexture, rectOf, soffitLights, type Rect } from './roofParts';
import { TEX_BASE, tintFor } from './textures';

const MM = 1000;
/** Corner upturn falls off over this share of the short side, from each eave corner. */
const UPTURN_REACH = 0.14;
/** Roof tile texture covers this many metres (the source's 1.5 m read as pebble-size slates). */
const TILE_M = 3.2;
const CAP_W = 0.22;
const CAP_H = 0.07;
const FASCIA_PROUD = 0.02;
/** The fascia shows this much; the soffit rises from its foot to the wall line. */
const FASCIA_H = 0.12;
/** How far above its place the roof starts landing. */
const LAND_M = 2.5;
const SHOWN = 0.001;
/** Flat charcoal until the tile map lands; then a tint that brings the map (mean ~0.47) to the same charcoal. */
const TILE_FLAT = 0x5a5f65;
const TILE_TINT = 0xa2abb6;
/** Teak soffit: flat warm brown; with oak's (orange) map, a tint that lands near it. */
const TEAK = 0xa07c5c;
/** Oak's map mean (.329, .217, .126) is saturated orange: tint to a weathered, desaturated teak. */
const TEAK_TINT = tintFor('#8E7A66', [0.329, 0.217, 0.126]);

export interface StageRoofs {
  readonly group: Group;
  /** `inside`: the eye is in the house; the soffit light washes (seen through the glass as floating chevrons) hide. */
  apply(s: LandingState, inside?: boolean): void;
  /** Load the tile and stone-free maps (oak soffit comes from the house's set); resolves either way. */
  loadTextures(anisotropy: number): Promise<void>;
  dispose(): void;
}

/** The tiled surface height of `roof` over plan point (x, z), scene metres; exported for the tests. */
export function hipHeight(roof: HipRoof, x: number, z: number): number {
  const r = rectOf(roof.eave);
  const slope = Math.tan((roof.pitchDeg * Math.PI) / 180);
  const d = Math.max(0, Math.min(x - r.x0, r.x1 - x, z - r.z0, r.z1 - z));
  const short = Math.min(r.x1 - r.x0, r.z1 - r.z0);
  const reach = short * UPTURN_REACH;
  let corner = Infinity;
  for (const cx of [r.x0, r.x1]) {
    for (const cz of [r.z0, r.z1]) {
      corner = Math.min(corner, Math.hypot(x - cx, z - cz));
    }
  }
  const w = Math.max(0, 1 - corner / reach);
  return roof.eaveMm / MM + d * slope + (roof.cornerUpturnMm / MM) * w * w;
}

function hipSurface(roof: HipRoof, r: Rect): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const cos = Math.cos((roof.pitchDeg * Math.PI) / 180);
  hipFaces(r).forEach((face, i) => {
    const alongX = i < 2 === r.x1 - r.x0 >= r.z1 - r.z0;
    for (const [x, z] of planTriangles(face)) {
      pos.push(x, hipHeight(roof, x, z), z);
      const d = Math.min(x - r.x0, r.x1 - x, z - r.z0, r.z1 - z);
      uv.push((alongX ? x : z) / TILE_M, d / cos / TILE_M);
    }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** The fascia band down from the eave edge, and the soffit ring back to the walls (timber, UV in metres). */
function eaveBand(roof: HipRoof, r: Rect, inner: Rect): { fascia: BufferGeometry; soffit: BufferGeometry } {
  const t = roof.thicknessMm / MM;
  const loop: [number, number][] = [];
  const steps = 24;
  const corners: [number, number][] = [
    [r.x0, r.z0],
    [r.x1, r.z0],
    [r.x1, r.z1],
    [r.x0, r.z1],
  ];
  corners.forEach((c, i) => {
    const n = corners[(i + 1) % 4] ?? c;
    for (let s = 0; s < steps; s += 1) {
      loop.push([c[0] + ((n[0] - c[0]) * s) / steps, c[1] + ((n[1] - c[1]) * s) / steps]);
    }
  });
  const fp: number[] = [];
  const sp: number[] = [];
  const su: number[] = [];
  const cx = (inner.x0 + inner.x1) / 2;
  const cz = (inner.z0 + inner.z1) / 2;
  const toInner = ([x, z]: [number, number]): [number, number] => [
    Math.min(Math.max(x, inner.x0), inner.x1),
    Math.min(Math.max(z, inner.z0), inner.z1),
  ];
  for (let i = 0; i < loop.length; i += 1) {
    const a = loop[i] ?? [0, 0];
    const b = loop[(i + 1) % loop.length] ?? a;
    const ya = hipHeight(roof, a[0], a[1]);
    const yb = hipHeight(roof, b[0], b[1]);
    const out = (p: [number, number]): [number, number] => {
      const dx = p[0] < cx ? -FASCIA_PROUD : FASCIA_PROUD;
      const dz = p[1] < cz ? -FASCIA_PROUD : FASCIA_PROUD;
      return [p[0] + (Math.abs(p[0] - r.x0) < 1e-6 || Math.abs(p[0] - r.x1) < 1e-6 ? dx : 0), p[1] + (Math.abs(p[1] - r.z0) < 1e-6 || Math.abs(p[1] - r.z1) < 1e-6 ? dz : 0)];
    };
    const oa = out(a);
    const ob = out(b);
    fp.push(oa[0], ya + 0.01, oa[1], ob[0], yb + 0.01, ob[1], oa[0], ya - FASCIA_H, oa[1]);
    fp.push(ob[0], yb + 0.01, ob[1], ob[0], yb - FASCIA_H, ob[1], oa[0], ya - FASCIA_H, oa[1]);
    const ia = toInner(a);
    const ib = toInner(b);
    const yIn = roof.eaveMm / MM - t;
    sp.push(a[0], ya - FASCIA_H, a[1], ia[0], yIn, ia[1], b[0], yb - FASCIA_H, b[1]);
    sp.push(b[0], yb - FASCIA_H, b[1], ia[0], yIn, ia[1], ib[0], yIn, ib[1]);
    for (const p of [a, ia, b, b, ia, ib]) {
      su.push(p[0] / 1.7, p[1] / 1.7);
    }
  }
  const fascia = new BufferGeometry();
  fascia.setAttribute('position', new Float32BufferAttribute(fp, 3));
  fascia.computeVertexNormals();
  const soffit = new BufferGeometry();
  soffit.setAttribute('position', new Float32BufferAttribute(sp, 3));
  soffit.setAttribute('uv', new Float32BufferAttribute(su, 2));
  soffit.computeVertexNormals();
  return { fascia, soffit };
}

/** Ridge + four hip caps as short boxes laid along the surface. */
function caps(roof: HipRoof, r: Rect, add: (g: BufferGeometry) => void): void {
  const h = Math.min(r.x1 - r.x0, r.z1 - r.z0) / 2;
  const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
  const a: [number, number] = alongX ? [r.x0 + h, (r.z0 + r.z1) / 2] : [(r.x0 + r.x1) / 2, r.z0 + h];
  const b: [number, number] = alongX ? [r.x1 - h, (r.z0 + r.z1) / 2] : [(r.x0 + r.x1) / 2, r.z1 - h];
  const lines: [[number, number], [number, number]][] = [
    [a, b],
    [[r.x0, r.z0], a],
    [[alongX ? r.x0 : r.x1, alongX ? r.z1 : r.z0], alongX ? a : a],
    [[r.x1, r.z1], b],
    [[alongX ? r.x1 : r.x0, alongX ? r.z0 : r.z1], b],
  ];
  const p = new Vector3();
  const q = new Vector3();
  for (const [s, e] of lines) {
    const n = 4;
    for (let i = 0; i < n; i += 1) {
      const x0 = s[0] + ((e[0] - s[0]) * i) / n;
      const z0 = s[1] + ((e[1] - s[1]) * i) / n;
      const x1 = s[0] + ((e[0] - s[0]) * (i + 1)) / n;
      const z1 = s[1] + ((e[1] - s[1]) * (i + 1)) / n;
      p.set(x0, hipHeight(roof, x0, z0) + CAP_H / 2, z0);
      q.set(x1, hipHeight(roof, x1, z1) + CAP_H / 2, z1);
      const len = p.distanceTo(q);
      if (len < 1e-3) {
        continue;
      }
      const g = new BoxGeometry(CAP_W, CAP_H, len + 0.02);
      const m = new Mesh(g);
      m.position.copy(p).add(q).multiplyScalar(0.5);
      m.lookAt(q);
      m.updateMatrix();
      g.applyMatrix4(m.matrix);
      add(g);
    }
  }
}

export function buildRoofs(house: LandingHouse): StageRoofs {
  const group = new Group();
  group.name = 'roofs';
  const hips = new Group();
  const ground = new Group();
  group.add(hips, ground);
  // Cool charcoal tile with a sky sheen, clearly lighter than the soffits (jury fix 4: 0x4a4d50 matte read as asphalt).
  const tiles = new MeshStandardMaterial({ color: TILE_FLAT, roughness: 0.7, metalness: 0, envMapIntensity: 0.5 });
  // A pale fascia: each tier's edge reads as its own line between the tiles and the timber soffit.
  // A shade under the render white (CONTRACT-V3 §4): the edge reads as a form, not a hard white CG line.
  const fasciaMat = new MeshStandardMaterial({ color: 0xc4c7c7, roughness: 0.9, metalness: 0, envMapIntensity: 0.5, side: DoubleSide });
  const timber = new MeshStandardMaterial({ color: TEAK, roughness: 0.82, envMapIntensity: 0.5, side: DoubleSide });
  const look = { timber };
  const capMat = new MeshStandardMaterial({ color: 0x3a3c3f, roughness: 0.5, metalness: 0.1 });
  const steel = new MeshStandardMaterial({ color: 0x3d4044, roughness: 0.42, metalness: 0.35 });
  const glass = new MeshPhysicalMaterial({
    color: 0xe6eef0,
    roughness: 0.05,
    transparent: true,
    opacity: 0.28,
    envMapIntensity: 1.6,
    side: DoubleSide,
    depthWrite: false,
  });
  const disc = new MeshBasicMaterial({ color: new Color(0xffe2b0).multiplyScalar(1.6) });
  const wash = poolTexture();
  const pool = new MeshBasicMaterial({ map: wash, color: 0xffd7a0, opacity: 0.08, transparent: true, blending: AdditiveBlending, depthWrite: false });
  const hipLevels = new Map<number, Group>();
  const owned: Material[] = [tiles, fasciaMat, capMat, steel, glass, timber, disc, pool];
  const geometries: BufferGeometry[] = [];
  const levels = new Map(house.plan.levels.map((l) => [l.id, l]));
  const sorted = [...house.plan.levels].sort((a, b) => a.elevationMm - b.elevationMm);
  // The wall rectangle a hip bears on: its eave inset by the overhang.
  const wallsOf = (roof: HipRoof): Rect => {
    const r = rectOf(roof.eave);
    const o = roof.overhangMm / MM;
    return { x0: r.x0 + o, z0: r.z0 + o, x1: r.x1 - o, z1: r.z1 - o };
  };

  for (const roof of house.roofs.hips) {
    const level = levels.get(roof.levelId);
    const above = level === undefined ? undefined : sorted[sorted.indexOf(level) + 1];
    const upperRoof = above === undefined ? undefined : house.roofs.hips.find((h) => h.levelId === above.id);
    const clip = upperRoof === undefined ? null : wallsOf(upperRoof);
    const r = rectOf(roof.eave);
    // The gate cap has no walls under it: its soffit closes to the centre line (a full underside, no hole).
    const w = wallsOf(roof);
    const inner = roof.levelId === 'site' ? { x0: (w.x0 + w.x1) / 2, x1: (w.x0 + w.x1) / 2, z0: (w.z0 + w.z1) / 2, z1: (w.z0 + w.z1) / 2 } : w;
    const mats = [clipped(tiles, clip), clipped(fasciaMat, clip), clipped(look.timber, clip), clipped(capMat, clip)];
    for (const m of mats) {
      if (!owned.includes(m)) {
        owned.push(m);
      }
    }
    const surface = hipSurface(roof, r);
    const { fascia, soffit } = eaveBand(roof, r, inner);
    // One group per storey: RF1 lifts roofLiftM, RF2 + 1 × upperLiftM, RF3 + 2 × (it rides its storey).
    const k = Math.max(0, sorted.findIndex((l) => l.id === roof.levelId));
    let target = ground;
    if (roof.levelId !== 'site') {
      target = hipLevels.get(k) ?? new Group();
      target.userData.liftK = k;
      hipLevels.set(k, target);
      hips.add(target);
    }
    const parts: [BufferGeometry, Material][] = [
      [surface, mats[0] ?? tiles],
      [fascia, mats[1] ?? fasciaMat],
      [soffit, mats[2] ?? look.timber],
    ];
    caps(roof, r, (g) => parts.push([g, mats[3] ?? capMat]));
    const t = roof.thicknessMm / MM;
    const o = roof.overhangMm / MM;
    for (const light of roof.levelId === 'site' ? [] : soffitLights(inner, clip, (u) => roof.eaveMm / MM - t + (u / o) * (t - FASCIA_H), disc, pool)) {
      geometries.push(light.geometry);
      target.add(light);
    }
    for (const [g, m] of parts) {
      geometries.push(g);
      const mesh = new Mesh(g, m);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = roof.id;
      target.add(mesh);
    }
  }
  const addGround = (m: Mesh): void => {
    geometries.push(m.geometry);
    m.castShadow = m.material !== glass;
    m.receiveShadow = true;
    ground.add(m);
  };
  for (const c of house.roofs.canopies) {
    canopy(c, glass, steel, look.timber, addGround);
  }
  for (const row of house.roofs.columns) {
    columns(row, look.timber, steel, addGround);
  }

  const textures: Texture[] = [];
  return {
    group,
    apply(s, inside = false) {
      pool.visible = !inside;
      const amount = s.build.roof;
      group.visible = amount > SHOWN;
      const land = (1 - amount) * (1 - amount) * LAND_M;
      ground.position.y = land;
      hips.position.y = land + s.build.roofLiftM;
      for (const [k, level] of hipLevels) {
        level.position.y = k * s.build.upperLiftM;
      }
      // Lifted clear away (interiors): hidden, so its shadow leaves with it.
      hips.visible = s.build.roofLiftM < 5.5;
    },
    async loadTextures(anisotropy) {
      const loader = new TextureLoader();
      try {
        const [diff, nor, oak] = await Promise.all([
          loader.loadAsync(`${TEX_BASE}roof_diff_1k.jpg`),
          loader.loadAsync(`${TEX_BASE}roof_nor_1k.jpg`),
          loader.loadAsync(`${TEX_BASE}oak_diff_1k.jpg`),
        ]);
        diff.colorSpace = oak.colorSpace = SRGBColorSpace;
        for (const t of [diff, nor, oak]) {
          t.wrapS = RepeatWrapping;
          t.wrapT = RepeatWrapping;
          t.anisotropy = anisotropy;
          textures.push(t);
        }
        for (const m of owned) {
          if (m instanceof MeshPhysicalMaterial || !(m instanceof MeshStandardMaterial)) {
            continue;
          }
          if (m.color.getHex() === TILE_FLAT) {
            m.map = diff;
            m.normalMap = nor;
            m.color.set(TILE_TINT);
            m.needsUpdate = true;
          } else if (m.color.getHex() === TEAK) {
            m.map = oak;
            m.color.copy(TEAK_TINT);
            m.needsUpdate = true;
          }
        }
      } catch {
        // keep the flat charcoal
      }
    },
    dispose() {
      for (const g of geometries) {
        g.dispose();
      }
      for (const m of owned) {
        m.dispose();
      }
      for (const t of textures) {
        t.dispose();
      }
      wash.dispose();
    },
  };
}
