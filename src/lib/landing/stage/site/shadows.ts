/**
 * Contact shadows without a pass: soft dark blobs lying on the ground under
 * trees, shrubs, boulders, stone seats and the car, and long soft strips along
 * the foot of every boundary wall (the lawn darkens where it meets the wall).
 * One shared 64 px radial texture, one InstancedMesh per growth channel
 * (planting / site), depthWrite off — two draws and a few hundred quads.
 */

import {
  DataTexture,
  InstancedMesh,
  LinearFilter,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  RGBAFormat,
  Vector3,
} from 'three';

import type { LandingSite } from '../../types';

import { M } from './geo';

/** Sits above lawn, beds and mulch discs (≤ +2.5 cm), under path slabs' tops. */
const LIFT_M = 0.032;
const SIZE = 64;

export interface Blob {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Full extents on the ground (m) and the turn about +y. */
  readonly w: number;
  readonly d: number;
  readonly turn: number;
}

/** Every channel = (1 − r²)² (alphaMap reads green): a soft falloff with no visible edge. */
export function blobTexture(): DataTexture {
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let j = 0; j < SIZE; j += 1) {
    for (let i = 0; i < SIZE; i += 1) {
      const u = ((i + 0.5) / SIZE) * 2 - 1;
      const v = ((j + 0.5) / SIZE) * 2 - 1;
      const k = Math.max(0, 1 - (u * u + v * v));
      data.fill(Math.round(255 * k * k), (j * SIZE + i) * 4, (j * SIZE + i) * 4 + 4);
    }
  }
  const t = new DataTexture(data, SIZE, SIZE, RGBAFormat);
  t.magFilter = LinearFilter;
  t.minFilter = LinearFilter;
  t.needsUpdate = true;
  return t;
}

/** The blobs, split by the channel that shows them. */
export function blobsOf(site: LandingSite): { planting: Blob[]; site: Blob[] } {
  const planting = site.plants.map((p) => {
    const r = M(p.canopyMm) * (p.slug === 'tree' ? 1.1 : 1.35);
    return { x: M(p.at[0]), y: M(p.baseMm) + LIFT_M, z: M(p.at[1]), w: r, d: r, turn: 0 };
  });
  const turnOf = { north: 0, east: Math.PI / 2, south: Math.PI, west: -Math.PI / 2 } as const;
  const items = site.items
    .filter((i) => i.kind !== 'path-light' && i.slug !== 'parking-spot')
    .map((i) => {
      const k = i.kind === 'model' ? 1.15 : 1.7;
      return { x: M(i.at[0]), y: M(i.baseMm) + LIFT_M, z: M(i.at[1]), w: M(i.sizeMm[0]) * k, d: M(i.sizeMm[1]) * k, turn: turnOf[i.facing] };
    });
  const walls = site.walls.map((w) => {
    const dx = w.end[0] - w.start[0];
    const dz = w.end[1] - w.start[1];
    return {
      x: M((w.start[0] + w.end[0]) / 2),
      y: M(w.baseMm) + LIFT_M,
      z: M((w.start[1] + w.end[1]) / 2),
      w: M(Math.hypot(dx, dz)) + 0.6,
      d: M(w.thicknessMm) + 1.4,
      turn: -Math.atan2(dz, dx),
    };
  });
  return { planting, site: [...items, ...walls] };
}

/** One instanced quad per blob; `opacity` is the channel's strength. */
export function blobMesh(blobs: readonly Blob[], map: DataTexture, opacity: number, name: string): InstancedMesh {
  const geometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const material = new MeshBasicMaterial({ color: '#000000', alphaMap: map, transparent: true, opacity, depthWrite: false });
  const mesh = new InstancedMesh(geometry, material, Math.max(1, blobs.length));
  mesh.count = blobs.length;
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  blobs.forEach((b, i) => {
    mesh.setMatrixAt(i, m.compose(new Vector3(b.x, b.y, b.z), q.setFromAxisAngle(up, b.turn), new Vector3(b.w, 1, b.d)));
  });
  mesh.computeBoundingSphere();
  mesh.name = name;
  mesh.renderOrder = 1;
  mesh.userData.strength = opacity;
  return mesh;
}
