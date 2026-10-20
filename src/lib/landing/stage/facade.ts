/**
 * Façade and interior finish the photos need over present's assembled walls
 * (archviz.md findings 2–5, 8; ref-vuonhoa): stacked grey stone panels on the
 * wall faces `house.roofs.cladding` marks, timber accent panels, a slightly
 * darker slab-edge band at the top of every exterior wall, slim window frames
 * at the outer face only (the reveal stays render white), ceilings over the
 * rooms for interiors, and Pascal models recoloured into the landing palette.
 *
 * Panels are added as children of their wall *before* the stage patches the
 * walls, so they rise, cut and lift with the wall (same clamp, same uniforms).
 * Ceilings are added after, as plain unpatched meshes the stage shows or hides.
 */

import {
  BoxGeometry,
  Color,
  DoubleSide,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  type Group,
  type Material,
  type Object3D,
  type Texture,
} from 'three';

import { readPartData } from '@/lib/three/build/scene';
import { planPoint, type SceneMaterials } from '@/lib/three/present';

import type { LandingHouse } from '../types';

import { TEX_BASE } from './textures';

const MM = 1000;
/** Stone panel: thickness and how far it stands proud of the render. */
const CLAD_T = 0.04;
const BAND_H = 0.2;
const BAND_PROUD = 0.02;
/** Window frame profile depth, set back from the outer face (finding 2). */
const FRAME_DEPTH = 0.07;
const FRAME_SETBACK = 0.08;
/** Large split-face panels (2.jpg), not rubble. */
const STONE_TILE_M = 5.5;
/** Ceiling sits this far under the storey's wall top: under the upper floor's 150 mm slab, whose oak soffit must not show. */
const CEILING_DROP = 0.17;

export interface Facade {
  readonly owned: Material[];
  readonly geometries: { dispose(): void }[];
  /** Load the stone set onto every growth clone of the stone material; resolves to the textures to free. */
  loadTextures(anisotropy: number, clonesOf: ReadonlyMap<Material, readonly Material[]>): Promise<Texture[]>;
}

/** Outward unit normal (scene xz) of an exterior wall: away from its storey's footprint centre. */
function outwardOf(house: LandingHouse, wallId: string): { a: Vector3; b: Vector3; n: Vector3; t: number } | null {
  const wall = house.plan.walls.find((w) => w.id === wallId);
  if (wall === undefined) {
    return null;
  }
  const same = house.plan.walls.filter((w) => w.levelId === wall.levelId && w.thicknessMm === wall.thicknessMm);
  const xs = same.flatMap((w) => [w.start[0] ?? 0, w.end[0] ?? 0]);
  const ys = same.flatMap((w) => [w.start[1] ?? 0, w.end[1] ?? 0]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2 / MM;
  const cz = (Math.min(...ys) + Math.max(...ys)) / 2 / MM;
  const a = planPoint(wall.start);
  const b = planPoint(wall.end);
  const along = new Vector3(b.x - a.x, 0, b.z - a.z).normalize();
  const n = new Vector3(-along.z, 0, along.x);
  const mid = new Vector3((a.x + b.x) / 2 - cx, 0, (a.z + b.z) / 2 - cz);
  if (n.dot(mid) < 0) {
    n.negate();
  }
  return { a: new Vector3(a.x, 0, a.z), b: new Vector3(b.x, 0, b.z), n, t: wall.thicknessMm / MM };
}

/** A box on the outer face of `wallId` from `from` to `to` (fractions), `y0`..`y1` above its storey floor. */
function facePanel(
  house: LandingHouse,
  wallObject: Object3D,
  wallId: string,
  span: readonly [number, number],
  heights: readonly [number, number],
  proud: number,
  material: Material,
): Mesh | null {
  const o = outwardOf(house, wallId);
  const wall = house.plan.walls.find((w) => w.id === wallId);
  const level = house.plan.levels.find((l) => l.id === wall?.levelId);
  if (o === null || level === undefined) {
    return null;
  }
  const len = o.a.distanceTo(o.b) * (span[1] - span[0]);
  // Run the panel past each wall end by half the wall, so stone wraps the corner flush.
  const ext = (span[0] <= 0 ? o.t / 2 + proud : 0) + (span[1] >= 1 ? o.t / 2 + proud : 0);
  const g = new BoxGeometry(len + ext, heights[1] - heights[0], proud);
  // UVs in metres (the box's are 0..1 a face): the stone keeps its size on every panel.
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < pos.count; i += 1) {
    uv.setXY(i, pos.getX(i) + pos.getZ(i), pos.getY(i) + heights[0]);
  }
  const mesh = new Mesh(g, material);
  const t0 = span[0] - (span[0] <= 0 ? (o.t / 2 + proud) / o.a.distanceTo(o.b) : 0);
  const t1 = span[1] + (span[1] >= 1 ? (o.t / 2 + proud) / o.a.distanceTo(o.b) : 0);
  const mid = (t0 + t1) / 2;
  const p = o.a.clone().lerp(o.b, mid).addScaledVector(o.n, o.t / 2 + proud / 2);
  p.y = level.elevationMm / MM + (heights[0] + heights[1]) / 2;
  mesh.position.copy(p);
  mesh.rotation.y = Math.atan2(-(o.b.z - o.a.z), o.b.x - o.a.x);
  mesh.updateMatrix();
  wallObject.updateMatrixWorld(true);
  mesh.applyMatrix4(new Matrix4().copy(wallObject.matrixWorld).invert());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  wallObject.add(mesh);
  return mesh;
}

/** Cladding + slab bands onto the exterior walls; call before the walls are patched. */
export function dressFacade(house: LandingHouse, wallObjects: ReadonlyMap<string, Object3D>): Facade {
  const stone = new MeshStandardMaterial({ color: 0x8d8b86, roughness: 0.9 });
  const timber = new MeshStandardMaterial({ color: 0x8e7a66, roughness: 0.85, envMapIntensity: 0.5 });
  const band = new MeshLambertMaterial({ color: 0xe4e7e8 });
  const owned: Material[] = [stone, timber, band];
  const geometries: { dispose(): void }[] = [];
  const keep = (m: Mesh | null): void => {
    if (m !== null) {
      geometries.push(m.geometry);
    }
  };
  for (const c of house.roofs.cladding) {
    const object = wallObjects.get(c.wallId);
    const wall = house.plan.walls.find((w) => w.id === c.wallId);
    const level = house.plan.levels.find((l) => l.id === wall?.levelId);
    if (object === undefined || level === undefined) {
      continue;
    }
    const h = (wall?.heightMm ?? level.heightMm) / MM;
    keep(facePanel(house, object, c.wallId, [c.from, c.to], [0, h - BAND_H], CLAD_T, c.finish === 'stone' ? stone : timber));
  }
  for (const wall of house.plan.walls) {
    const object = wallObjects.get(wall.id);
    const level = house.plan.levels.find((l) => l.id === wall.levelId);
    if (object === undefined || level === undefined || wall.kind !== 'loadBearing') {
      continue;
    }
    const h = (wall.heightMm ?? level.heightMm) / MM;
    keep(facePanel(house, object, wall.id, [0, 1], [h - BAND_H, h], BAND_PROUD + CLAD_T, band));
  }
  return {
    owned,
    geometries,
    async loadTextures(anisotropy, clonesOf) {
      const loader = new TextureLoader();
      const [diff, nor] = await Promise.all([
        loader.loadAsync(`${TEX_BASE}stone_diff_1k.jpg`),
        loader.loadAsync(`${TEX_BASE}stone_nor_1k.jpg`),
      ]);
      diff.colorSpace = SRGBColorSpace;
      for (const t of [diff, nor]) {
        t.wrapS = RepeatWrapping;
        t.wrapT = RepeatWrapping;
        t.anisotropy = anisotropy;
        t.repeat.setScalar(1 / STONE_TILE_M);
      }
      for (const clone of [stone, ...(clonesOf.get(stone) ?? [])]) {
        if (clone instanceof MeshStandardMaterial) {
          clone.map = diff;
          clone.normalMap = nor;
          // The map's mean is dark (0xd2d0cc landed at #4A4744): a linear gain of ~2.5× that lands near the
          // reference's mid grey #7E7D79; colour factors above 1 are fine for a map multiplier.
          clone.color.setRGB(1.6, 1.59, 1.56);
          clone.normalScale.setScalar(0.85);
          clone.needsUpdate = true;
        }
      }
      return [diff, nor];
    },
  };
}

/**
 * Slim a window frame group (present's boxes span the whole reveal) to a
 * 70 mm profile near the outer face. `outward` is the wall's outward normal.
 */
export function slimFrame(frame: Object3D, outward: Vector3, wallThickness: number): void {
  frame.updateMatrixWorld(true);
  const localZ = new Vector3(0, 0, 1).applyQuaternion(frame.quaternion);
  const sign = Math.sign(localZ.dot(outward)) || 1;
  for (const child of frame.children) {
    if (!(child instanceof Mesh) || !(child.geometry instanceof BoxGeometry)) {
      continue;
    }
    const depth = child.geometry.parameters.depth;
    if (depth < wallThickness * 0.9) {
      continue; // a mullion or anything already slim
    }
    child.scale.z = FRAME_DEPTH / depth;
    child.position.z = sign * (wallThickness / 2 - FRAME_SETBACK + FRAME_DEPTH / 2);
  }
}

/**
 * Glass outside vs inside (archviz-r2 fix 8): from the street a dark band reflecting the sky, as the
 * photos have it; from inside nearly clear. The stage writes one or the other onto every glass clone.
 */
export const GLASS_LOOK = {
  // A pane is a double-sided box (two layers): 0.33 each covers ~55 %, the photo's dark band.
  exterior: { color: 0x1f2a30, opacity: 0.33, roughness: 0.03, envMapIntensity: 0.6 },
  interior: { color: 0xe8eef0, opacity: 0.08, roughness: 0.04, envMapIntensity: 1.6 },
} as const;

/** Put one of `GLASS_LOOK`'s looks on a glass material (no recompile: colour and scalars only). */
export function setGlassLook(m: Material, look: (typeof GLASS_LOOK)[keyof typeof GLASS_LOOK]): void {
  if (m instanceof MeshStandardMaterial) {
    m.color.setHex(look.color);
    m.opacity = look.opacity;
    m.roughness = look.roughness;
    m.envMapIntensity = look.envMapIntensity;
  }
}

/** The stage's glass: a physical pane (specular 1), starting in the interior look. */
export function createStageGlass(): MeshPhysicalMaterial {
  const glass = new MeshPhysicalMaterial({
    metalness: 0,
    ior: 1.5,
    specularIntensity: 1,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
  });
  setGlassLook(glass, GLASS_LOOK.interior);
  return glass;
}

/** Window frames: dark anodised metal, matte-satin; doors keep present's painted frame. */
export function createFrameMetal(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: 0x3d4044, roughness: 0.42, metalness: 0.35, vertexColors: true });
}

/** Frame groups sit, untagged, at their opening's centre: repaint those of windows. */
export function metalWindowFrames(storey: Group, house: LandingHouse, paint: Material, metal: Material): void {
  const centres: [number, number, string][] = [];
  for (const o of house.plan.openings) {
    const wall = house.plan.walls.find((w) => w.id === o.wallId);
    if (o.kind !== 'window' || wall === undefined) {
      continue;
    }
    const a = planPoint(wall.start);
    const b = planPoint(wall.end);
    centres.push([a.x + (b.x - a.x) * o.relativePosition, a.z + (b.z - a.z) * o.relativePosition, wall.id]);
  }
  for (const child of storey.children) {
    const { x, z } = child.position;
    const hit = readPartData(child) === null ? centres.find(([cx, cz]) => Math.hypot(cx - x, cz - z) < 0.1) : undefined;
    if (hit === undefined) {
      continue;
    }
    const side = outwardOf(house, hit[2]);
    if (side !== null) {
      slimFrame(child, side.n, side.t);
    }
    child.traverse((mesh) => {
      if (mesh instanceof Mesh && mesh.material === paint) {
        mesh.material = metal;
      }
    });
  }
}

export { outwardOf };

/** One ceiling per room at its storey's wall top, plain render white, no shadow cast. */
export function buildCeilings(house: LandingHouse, storeys: ReadonlyMap<string, Group>): { meshes: Mesh[]; material: Material } {
  const material = new MeshLambertMaterial({ color: 0xf1eee8 });
  const meshes: Mesh[] = [];
  for (const room of house.plan.rooms) {
    const level = house.plan.levels.find((l) => l.id === room.levelId);
    const storey = storeys.get(room.levelId);
    if (level === undefined || storey === undefined || room.outline.length < 3) {
      continue;
    }
    const shape = new Shape(room.outline.map((p) => planPoint(p)).map((v) => new Vector2(v.x, v.z)));
    const g = new ShapeGeometry(shape);
    g.rotateX(Math.PI / 2);
    const mesh = new Mesh(g, material);
    mesh.position.y = (level.elevationMm + level.heightMm) / MM - CEILING_DROP;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.visible = false;
    mesh.name = `ceiling:${room.id}`;
    storey.add(mesh);
    meshes.push(mesh);
  }
  return { meshes, material };
}

/** Glazed openings at least this wide get a warm back-plane (the reference's lit interiors, 0.jpg). */
const GLOW_MIN_W_MM = 1400;
const GLOW_INSET_M = 0.3;

/**
 * A warm plane 0.3 m inside every large window of an exterior wall, facing out: behind the dark exterior
 * glass it reads as a lived-in, lit room from the street. The stage shows them only for exterior shots.
 */
export function buildGlows(house: LandingHouse, storeys: ReadonlyMap<string, Group>): { meshes: Mesh[]; material: Material } {
  // Near-opaque and a little over white: behind 55 % dark glass it still lands as a warm lit room.
  const material = new MeshBasicMaterial({ color: new Color(0xf6d9ae).multiplyScalar(1.25), transparent: true, opacity: 0.75, depthWrite: false });
  const meshes: Mesh[] = [];
  for (const o of house.plan.openings) {
    const wall = house.plan.walls.find((w) => w.id === o.wallId);
    const level = house.plan.levels.find((l) => l.id === wall?.levelId);
    const storey = storeys.get(level?.id ?? '');
    const side = wall?.kind === 'loadBearing' ? outwardOf(house, o.wallId) : null;
    if (o.kind !== 'window' || o.widthMm < GLOW_MIN_W_MM || side === null || level === undefined || storey === undefined) {
      continue;
    }
    const mesh = new Mesh(new PlaneGeometry(o.widthMm / MM, o.heightMm / MM), material);
    mesh.position.copy(side.a.clone().lerp(side.b, o.relativePosition)).addScaledVector(side.n, -side.t / 2 - GLOW_INSET_M);
    mesh.position.y = (level.elevationMm + o.sillHeightMm + o.heightMm / 2) / MM;
    mesh.rotation.y = Math.atan2(side.n.x, side.n.z);
    mesh.visible = false;
    mesh.name = `glow:${o.id}`;
    storey.add(mesh);
    meshes.push(mesh);
  }
  return { meshes, material };
}

/** Palette role for one Pascal mesh, from its material slot name and the piece's slug. */
export function roleFor(slug: string, slot: string): keyof SceneMaterials | null {
  const s = slot.replace(/^slot_/, '').toLowerCase();
  if (/foliage|leaf|leaves|coconut/.test(s)) return 'foliage';
  if (/trunk/.test(s)) return 'woodDark';
  if (/soil/.test(s)) return 'woodDark';
  if (/pot/.test(s)) return 'clay';
  if (slug.includes('carpet')) return 'textile';
  if (s === 'shade') return 'lampShade';
  if (/screen|window|keysblack|grill|wheel/.test(s)) return 'screen';
  if (/legs|frame|fixture|rim|handle/.test(s)) return 'metal';
  if (/toilet|tub|sink|basin|buttons/.test(s)) return 'porcelain';
  if (/top|headrest|shelf|base/.test(s)) return 'wood';
  if (/pillow|cushion/.test(s) && /sofa|chair/.test(slug)) return 'accent';
  if (/pillow|cushion|seat|mattress|blanket|arms/.test(s)) return s === 'arms' ? 'wood' : 'fabric';
  if (/body|material|color/.test(s)) {
    if (/sofa|bed|chair|carpet/.test(slug)) return slug.includes('carpet') ? 'textile' : 'linen';
    // A piano / TV body is lacquer, not steel: as 'metal' (0.8 metal, env 1.6) it was a black mirror (CONTRACT-V3).
    if (slug.includes('piano')) return 'woodDark';
    if (slug.includes('television')) return 'screen';
    if (/fridge|stove|hood|washing|tesla/.test(slug)) return 'metal';
    if (/bathtub|toilet|sink|shower/.test(slug)) return 'porcelain';
    return 'wood';
  }
  return null;
}

const SLUG = /\/pascal\/items\/([^/]+)\//;

/** Swap a loaded `.glb`'s clay materials for the palette's (call before the stage re-patches the piece). */
export function recolourModel(group: Object3D, modelUrl: string | undefined, materials: SceneMaterials): void {
  const slug = SLUG.exec(modelUrl ?? '')?.[1] ?? '';
  const model = group.getObjectByName('model');
  if (model === undefined) {
    return;
  }
  model.traverse((child) => {
    if (!(child instanceof Mesh) || Array.isArray(child.material)) {
      return;
    }
    const role = roleFor(slug, (child.material as Material).name);
    const next = role === null ? null : (materials[role] as unknown);
    if (next instanceof MeshStandardMaterial || next instanceof MeshLambertMaterial) {
      child.material = next;
    }
  });
}

/** Render white for the wall-top cut while no cutaway is on (finding 3); the cut colour only at a section. */
export function cutColour(out: Color, render: Color, cut: Color, cutaway: number): Color {
  return out.lerpColors(render, cut, Math.min(1, cutaway * 4));
}
