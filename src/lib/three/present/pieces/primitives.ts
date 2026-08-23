/**
 * The handful of shapes every procedural piece is made of.
 *
 * Each helper builds one mesh in the catalogue's frame — `x` across, `y` up,
 * `+z` the front — with its **base** at the `y` it is given, so a builder can
 * stack parts by height without computing centres. Everything casts and
 * receives shadows; the few parts that should not (a rug, a decal) opt out.
 */

import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Mesh,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  type Group,
  type Material,
} from 'three';

import type { SceneMaterials } from '../materials';
import type { SceneSize } from '../plan';

/** Adds a piece's primitives to `group`, standing on `y = 0`, centred on the origin. */
export type PieceBuilder = (group: Group, size: SceneSize, m: SceneMaterials) => void;

/** How bright a lamp on the plan is, in candela, and how far it reaches. */
export const LAMP_INTENSITY = 3;
export const LAMP_REACH = 4.5;

/**
 * Where a lamp's pool of light goes when the lamp is drawn rather than lit —
 * see `lighting.ts`. A `floor` pool lies flat at `height` in the piece's frame;
 * a `wall` pool stands against the wall behind the piece (local `-z`), taller
 * than it is wide. `priority` is what the lamp is worth against a downlight,
 * in the same units as a room's floor area.
 */
export interface LightPoolSpec {
  readonly surface: 'floor' | 'wall';
  readonly radius: number;
  readonly height: number;
  readonly priority: number;
}

/** The key under which a light carries its pool on `userData`. */
export const LIGHT_POOL_KEY = 'lightPool';

/** How far a lamp's glow reaches past its shade, as a factor of the shade's radius. */
const GLOW_SPREAD = 1.7;

/** A glow disc sits this far off the shade it haloes. */
const GLOW_LIFT = 0.01;

/** Where the ceiling would be, for things that hang from it or reach up to it. */
export const CEILING_HEIGHT = 2.4;

/**
 * How finely a box is divided along an edge: a vertex every third of a
 * metre or so, and never more than this many. The baked occlusion in
 * `../occlusion.ts` is stored at vertices, and a carcass with vertices only
 * at its corners would smear its floor shadow up its whole face.
 */
const BOX_SEGMENT_LENGTH = 0.4;
const BOX_SEGMENTS_MAX = 4;

/** Segments along an edge of `length`: one for anything small. */
export function boxSegments(length: number): number {
  return Math.min(BOX_SEGMENTS_MAX, Math.max(1, Math.ceil(length / BOX_SEGMENT_LENGTH)));
}

/** A box with its **base** at `y`, centred on `x` and `z`. */
export function box(w: number, h: number, d: number, material: Material, x = 0, y = 0, z = 0): Mesh {
  const mesh = new Mesh(new BoxGeometry(w, h, d, boxSegments(w), boxSegments(h), boxSegments(d)), material);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A vertical cylinder with its base at `y`; `topRadius` tapers it. */
export function cylinder(
  radius: number,
  h: number,
  material: Material,
  x = 0,
  y = 0,
  z = 0,
  topRadius = radius,
): Mesh {
  const mesh = new Mesh(new CylinderGeometry(topRadius, radius, h, 20), material);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A sphere centred at the point given, optionally squashed or stretched. */
export function sphere(
  radius: number,
  material: Material,
  x: number,
  y: number,
  z: number,
  scaleY = 1,
  scaleX = 1,
): Mesh {
  const mesh = new Mesh(new SphereGeometry(radius, 12, 8), material);
  mesh.position.set(x, y, z);
  mesh.scale.set(scaleX, scaleY, 1);
  mesh.castShadow = true;
  return mesh;
}

/** A cone standing on its base at `y`, leaning by `tiltRad` about the axis given. */
export function cone(
  radius: number,
  h: number,
  material: Material,
  x: number,
  y: number,
  z: number,
  tiltRad = 0,
  aboutRad = 0,
): Mesh {
  const mesh = new Mesh(new ConeGeometry(radius, h, 8), material);
  mesh.position.set(x, y + h / 2, z);
  mesh.rotation.set(tiltRad * Math.cos(aboutRad), 0, tiltRad * Math.sin(aboutRad));
  mesh.castShadow = true;
  return mesh;
}

/** Four legs under a top, inset from the corners. */
export function legs(group: Group, size: SceneSize, height: number, material: Material, inset: number): void {
  const leg = Math.min(0.05, size.w / 8);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      group.add(box(leg, height, leg, material, sx * (size.w / 2 - inset), 0, sz * (size.d / 2 - inset)));
    }
  }
}

/**
 * Door fronts across a carcass: a fine dark groove between every door and a
 * short bar handle on each. What turns a box into a cupboard.
 */
export function doorFronts(
  group: Group,
  m: SceneMaterials,
  w: number,
  h: number,
  frontZ: number,
  baseY: number,
  doorWidth: number,
  handleY: number,
): void {
  const doors = Math.max(1, Math.round(w / doorWidth));
  const each = w / doors;

  for (let index = 1; index < doors; index += 1) {
    group.add(box(0.004, h - 0.02, 0.006, m.cut, -w / 2 + each * index, baseY + 0.01, frontZ));
  }
  for (let index = 0; index < doors; index += 1) {
    const x = -w / 2 + each * (index + 0.5);
    group.add(box(0.012, Math.min(0.16, h * 0.3), 0.012, m.metal, x + each * 0.3, handleY, frontZ + 0.012));
  }
}

/**
 * The halo a lit shade has: an additive disc of the lamp's colour, lying
 * flat over the shade so that from above it reads as bloom without a
 * post-process. `vertical` stands it up facing `+z`, for a wall light. `null`
 * where no canvas could draw the disc.
 */
export function glow(m: SceneMaterials, radius: number, x: number, y: number, z: number, vertical = false): Mesh | null {
  if (m.lightPool === null) {
    return null;
  }

  const halo = new Mesh(new PlaneGeometry(radius * 2, radius * 2), m.lightPool);
  halo.position.set(x, y, z);
  if (!vertical) {
    halo.rotation.x = -Math.PI / 2;
  }
  halo.renderOrder = 1;
  halo.castShadow = false;
  halo.receiveShadow = false;
  return halo;
}

/** Add `mesh` to `group` unless there was none to add. */
function addIfDrawn(group: Group, mesh: Mesh | null): void {
  if (mesh !== null) {
    group.add(mesh);
  }
}

/**
 * A pole standing at `baseY`, a shade on top of it, the light the shade
 * gives and the halo over it. Drawn rather than lit, it pools on the surface
 * it stands on.
 */
export function lampOn(
  group: Group,
  m: SceneMaterials,
  baseY: number,
  poleHeight: number,
  shadeRadius: number,
  shadeHeight: number,
  priority: number,
): void {
  group.add(cylinder(0.015, poleHeight, m.metal, 0, baseY));
  group.add(cylinder(shadeRadius, shadeHeight, m.lampShade, 0, baseY + poleHeight, 0, shadeRadius * 0.8));
  addIfDrawn(group, glow(m, shadeRadius * GLOW_SPREAD, 0, baseY + poleHeight + shadeHeight + GLOW_LIFT, 0));
  group.add(
    pointLight(m, 0, baseY + poleHeight + shadeHeight / 2, 0, LAMP_INTENSITY, {
      surface: 'floor',
      radius: poleHeight * 0.9 + shadeRadius,
      height: baseY,
      priority,
    }),
  );
}

/** The warm point source every lamp carries, and where its pool goes if it is drawn instead. */
export function pointLight(
  m: SceneMaterials,
  x: number,
  y: number,
  z: number,
  intensity: number,
  pool: LightPoolSpec,
): PointLight {
  const light = new PointLight(m.lampShade.color, intensity, LAMP_REACH, 2);
  light.position.set(x, y, z);
  light.userData[LIGHT_POOL_KEY] = pool;
  return light;
}
