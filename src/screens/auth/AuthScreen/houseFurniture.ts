/**
 * The furniture in the apartment on `/login`, built from boxes.
 *
 * `src/lib/three/build` turns a plan into walls and slabs and stops there — a
 * sofa is not arithmetic on a centreline, so the product has no builder for one.
 * This file is the scenery layer that sits on top: every piece is a handful of
 * primitives in its own frame, sized from the plan's `sizeMm` and placed by its
 * `centreMm` and `facing`, and tagged `furniture` through `tagPart` like
 * everything else on screen so nothing here is a stranger to the scene graph.
 *
 * The frame is fixed so a plan can be read without opening this file: local
 * `x` is the width, local `y` is up from the floor, and local `+z` is the
 * **front** of the piece — the side a person uses. `facing` turns that front
 * towards a compass point on the plan, north being `+y` on the drawing.
 *
 * No colour is decided here; each piece asks for a material by name from
 * {@link SceneMaterials}.
 */

import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  PointLight,
  SphereGeometry,
  type Material,
} from 'three';

import type { FurnitureId, LevelId } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';
import { tagPart, toSceneLength } from '@/lib/three/build/scene';

import type { SceneMaterials } from './houseMaterials';

/* -------------------------------------------------------------------------- */
/* Plan shape.                                                                 */
/* -------------------------------------------------------------------------- */

/** Where the front of a piece points on the plan; north is `+y` on the drawing. */
export type Facing = 'north' | 'east' | 'south' | 'west';

/** One furniture entry, as `houseModel.json` writes it. */
export interface PlanFurniture {
  readonly id: string;
  readonly variant: string;
  readonly centreMm: readonly number[];
  /** Width × depth × height. */
  readonly sizeMm: readonly number[];
  readonly facing: string;
}

/** Size in scene units, width × depth × height. */
interface Size {
  readonly w: number;
  readonly d: number;
  readonly h: number;
}

/** Local `+z` rotated onto each compass point — see the file comment. */
const FACING_TURN: Readonly<Record<Facing, number>> = {
  north: 0,
  east: Math.PI / 2,
  south: Math.PI,
  west: -Math.PI / 2,
};

/** How bright a lamp on the plan is, in candela, and how far it reaches. */
const LAMP_INTENSITY = 2.4;
const LAMP_REACH = 4;

/* -------------------------------------------------------------------------- */
/* Primitives.                                                                 */
/* -------------------------------------------------------------------------- */

/** A box with its **base** at `y`, centred on `x` and `z`. */
function box(
  w: number,
  h: number,
  d: number,
  material: Material,
  x = 0,
  y = 0,
  z = 0,
): Mesh {
  const mesh = new Mesh(new BoxGeometry(w, h, d), material);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A vertical cylinder with its base at `y`. */
function cylinder(
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

function sphere(radius: number, material: Material, x: number, y: number, z: number): Mesh {
  const mesh = new Mesh(new SphereGeometry(radius, 14, 10), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

/** Four legs under a top, inset from the corners. */
function legs(group: Group, size: Size, height: number, material: Material, inset: number): void {
  const leg = Math.min(0.05, size.w / 8);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      group.add(box(leg, height, leg, material, sx * (size.w / 2 - inset), 0, sz * (size.d / 2 - inset)));
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Pieces.                                                                     */
/* -------------------------------------------------------------------------- */

type Builder = (group: Group, size: Size, m: SceneMaterials) => void;

const buildSofa: Builder = (group, { w, d, h }, m) => {
  const seatHeight = h * 0.5;
  const armWidth = Math.min(0.18, w * 0.12);
  const backDepth = d * 0.25;

  group.add(box(w, seatHeight, d, m.fabric));
  group.add(box(w, h, backDepth, m.fabric, 0, 0, -d / 2 + backDepth / 2));
  group.add(box(armWidth, h * 0.75, d, m.fabric, -w / 2 + armWidth / 2));
  group.add(box(armWidth, h * 0.75, d, m.fabric, w / 2 - armWidth / 2));

  const cushions = Math.max(1, Math.round((w - armWidth * 2) / 0.75));
  const cushionWidth = (w - armWidth * 2) / cushions;

  for (let index = 0; index < cushions; index += 1) {
    const x = -w / 2 + armWidth + cushionWidth * (index + 0.5);
    group.add(box(cushionWidth - 0.03, 0.1, d - backDepth - 0.05, m.textile, x, seatHeight, backDepth / 2));
  }
};

const buildTable: Builder = (group, size, m) => {
  group.add(box(size.w, 0.04, size.d, m.wood, 0, size.h - 0.04));
  legs(group, size, size.h - 0.04, m.woodDark, 0.06);
};

const buildNightstand: Builder = (group, { w, d, h }, m) => {
  group.add(box(w, h, d, m.wood));
  group.add(box(w * 0.8, 0.015, 0.015, m.woodDark, 0, h * 0.55, d / 2));
};

const buildChair: Builder = (group, size, m) => {
  const seatHeight = size.h * 0.5;
  group.add(box(size.w, 0.04, size.d, m.wood, 0, seatHeight));
  group.add(box(size.w, size.h - seatHeight, 0.04, m.wood, 0, seatHeight, -size.d / 2 + 0.02));
  legs(group, size, seatHeight, m.woodDark, 0.03);
};

const buildLounger: Builder = (group, { w, d, h }, m) => {
  const seatHeight = h * 0.4;
  group.add(box(w, 0.08, d, m.textile, 0, seatHeight - 0.08));
  group.add(box(w, h - seatHeight, 0.08, m.textile, 0, seatHeight - 0.08, -d / 2 + 0.04));
  group.add(box(w - 0.06, seatHeight - 0.08, d - 0.1, m.wood));
};

const buildBed: Builder = (group, { w, d, h }, m) => {
  const frameHeight = h * 0.45;
  group.add(box(w + 0.1, frameHeight, d + 0.1, m.woodDark, 0, 0, 0.05));
  group.add(box(w, h - frameHeight, d, m.linen, 0, frameHeight));
  group.add(box(w + 0.1, h + 0.5, 0.08, m.wood, 0, 0, -d / 2 - 0.04));

  // Pillows at the head, a throw across the foot.
  for (const sx of [-1, 1]) {
    group.add(box(w * 0.38, 0.1, d * 0.2, m.fabric, sx * w * 0.24, h, -d / 2 + d * 0.14));
  }
  group.add(box(w + 0.02, 0.05, d * 0.5, m.textile, 0, h - 0.02, d * 0.25));
};

const buildWardrobe: Builder = (group, { w, d, h }, m) => {
  group.add(box(w, h, d, m.woodDark));
  group.add(box(w / 2 - 0.015, h - 0.04, 0.01, m.wood, -w / 4, 0.02, d / 2));
  group.add(box(w / 2 - 0.015, h - 0.04, 0.01, m.wood, w / 4, 0.02, d / 2));
};

const buildBaseRun: Builder = (group, { w, d, h }, m) => {
  group.add(box(w, h - 0.04, d - 0.02, m.wood, 0, 0, -0.01));
  group.add(box(w, 0.04, d + 0.02, m.stone, 0, h - 0.04, 0.01));
};

const buildUpperRun: Builder = (group, { w, d, h }, m) => {
  group.add(box(w, h, d, m.wood, 0, 1.5));
};

const buildHob: Builder = (group, { w, d }, m) => {
  group.add(box(w, 0.015, d, m.screen, 0, 0.9));
};

const buildSink: Builder = (group, { w, d }, m) => {
  group.add(box(w, 0.02, d, m.metal, 0, 0.9));
  group.add(cylinder(0.012, 0.3, m.metal, 0, 0.9, -d / 2 + 0.05));
};

const buildFridge: Builder = (group, { w, d, h }, m) => {
  group.add(box(w, h, d, m.metal));
  group.add(box(0.02, h * 0.3, 0.03, m.screen, w * 0.35, h * 0.55, d / 2));
};

const buildWc: Builder = (group, { w, d, h }, m) => {
  group.add(box(w, h * 0.5, d * 0.6, m.porcelain, 0, 0, d * 0.15));
  group.add(box(w, h, d * 0.3, m.porcelain, 0, 0, -d / 2 + d * 0.15));
};

const buildBasin: Builder = (group, { w, d, h }, m) => {
  group.add(box(w, h - 0.05, d, m.wood));
  group.add(box(w + 0.02, 0.05, d + 0.02, m.porcelain, 0, h - 0.05));
  group.add(box(w * 0.45, 0.08, d * 0.6, m.porcelain, 0, h));
  group.add(cylinder(0.012, 0.2, m.metal, 0, h, -d / 2 + 0.06));
};

/** Tray, with glass on the front and on the left: the other two sides are wall. */
const buildShower: Builder = (group, { w, d, h }, m) => {
  group.add(box(w, 0.03, d, m.porcelain));
  group.add(box(w, h, 0.012, m.glass, 0, 0.03, d / 2));
  group.add(box(0.012, h, d, m.glass, -w / 2, 0.03, 0));
  group.add(cylinder(0.015, h - 0.1, m.metal, w / 2 - 0.08, 0.03, -d / 2 + 0.08));
  group.add(box(0.18, 0.02, 0.18, m.metal, w / 2 - 0.16, h - 0.1, -d / 2 + 0.16));
};

/** A low cabinet with the screen standing on it, facing the room. */
const buildTv: Builder = (group, { w, d, h }, m) => {
  const cabinetHeight = 0.42;
  group.add(box(w, cabinetHeight, d, m.wood));
  group.add(box(w * 0.7, (h - cabinetHeight) * 0.65, 0.03, m.screen, 0, cabinetHeight + 0.08, -d / 2 + 0.1));
};

/** Pale on purpose: a rug the colour of the boards under it is not there. */
const buildRug: Builder = (group, { w, d }, m) => {
  group.add(box(w, 0.012, d, m.fabric));
};

/** A pot with three heads of foliage; taller plants get a stem. */
const buildPlant: Builder = (group, { w, h }, m) => {
  const potHeight = Math.min(0.4, h * 0.3);
  const potRadius = w * 0.4;
  const canopy = w * 0.5;

  group.add(cylinder(potRadius * 0.8, potHeight, m.clay, 0, 0, 0, potRadius));
  group.add(cylinder(0.025, h - potHeight - canopy * 0.6, m.woodDark, 0, potHeight));

  const crown = h - canopy * 0.6;
  group.add(sphere(canopy, m.foliage, 0, crown, 0));
  group.add(sphere(canopy * 0.7, m.foliage, canopy * 0.6, crown - canopy * 0.3, canopy * 0.2));
  group.add(sphere(canopy * 0.7, m.foliage, -canopy * 0.5, crown - canopy * 0.2, -canopy * 0.4));
};

/** A pole standing at `baseY`, a shade on top of it, and the light the shade gives. */
function lampOn(
  group: Group,
  m: SceneMaterials,
  baseY: number,
  poleHeight: number,
  shadeRadius: number,
  shadeHeight: number,
): void {
  group.add(cylinder(0.015, poleHeight, m.metal, 0, baseY));
  group.add(cylinder(shadeRadius, shadeHeight, m.lampShade, 0, baseY + poleHeight, 0, shadeRadius * 0.8));

  const light = new PointLight(m.lampShade.color, LAMP_INTENSITY, LAMP_REACH, 2);
  light.position.set(0, baseY + poleHeight + shadeHeight / 2, 0);
  group.add(light);
}

const buildFloorLamp: Builder = (group, { w, h }, m) => {
  group.add(cylinder(w * 0.5, 0.02, m.metal));
  lampOn(group, m, 0, h - 0.28, w * 0.45, 0.28);
};

/**
 * Sits on whatever is under it — a nightstand, a balcony table — so the plan
 * gives it the *total* height and the lamp itself starts a little over half way up.
 */
const buildTableLamp: Builder = (group, { w, h }, m) => {
  lampOn(group, m, h * 0.55, h * 0.2, w * 0.6, h * 0.25);
};

/** Hung from where the ceiling would be, over the dining table. */
const buildPendant: Builder = (group, { w, h }, m) => {
  const shadeHeight = 0.22;
  const cordTop = 2.4;
  group.add(cylinder(0.005, cordTop - h, m.metal, 0, h));
  group.add(cylinder(w * 0.6, shadeHeight, m.lampShade, 0, h - shadeHeight, 0, w * 0.2));

  const light = new PointLight(m.lampShade.color, LAMP_INTENSITY * 1.5, LAMP_REACH, 2);
  light.position.set(0, h - shadeHeight - 0.05, 0);
  group.add(light);
};

const BUILDERS: Readonly<Record<string, Builder>> = {
  sofa: buildSofa,
  table: buildTable,
  nightstand: buildNightstand,
  chair: buildChair,
  lounger: buildLounger,
  bed: buildBed,
  wardrobe: buildWardrobe,
  baseRun: buildBaseRun,
  upperRun: buildUpperRun,
  hob: buildHob,
  sink: buildSink,
  fridge: buildFridge,
  wc: buildWc,
  basin: buildBasin,
  shower: buildShower,
  tv: buildTv,
  rug: buildRug,
  plant: buildPlant,
  floorLamp: buildFloorLamp,
  tableLamp: buildTableLamp,
  pendant: buildPendant,
};

/* -------------------------------------------------------------------------- */
/* Placement.                                                                  */
/* -------------------------------------------------------------------------- */

function isFacing(value: string): value is Facing {
  return value in FACING_TURN;
}

/**
 * Build one plan entry and stand it on the floor where the plan says.
 *
 * @throws RangeError when the variant is not one this file knows how to build —
 * a typo in the plan should fail the mount, not leave a silent gap in a room.
 */
export function buildFurniture(
  entry: PlanFurniture,
  levelId: LevelId,
  materials: SceneMaterials,
): Group {
  const build = BUILDERS[entry.variant];

  if (build === undefined) {
    throw new RangeError(`Furniture ${entry.id} has unknown variant "${entry.variant}".`);
  }
  if (!isFacing(entry.facing)) {
    throw new RangeError(`Furniture ${entry.id} faces "${entry.facing}", which is not a compass point.`);
  }

  const size: Size = {
    w: toSceneLength(millimetres(entry.sizeMm[0] ?? 0)),
    d: toSceneLength(millimetres(entry.sizeMm[1] ?? 0)),
    h: toSceneLength(millimetres(entry.sizeMm[2] ?? 0)),
  };

  const group = new Group();
  build(group, size, materials);

  group.position.set(
    toSceneLength(millimetres(entry.centreMm[0] ?? 0)),
    0,
    toSceneLength(millimetres(entry.centreMm[1] ?? 0)),
  );
  group.rotation.y = FACING_TURN[entry.facing];

  return tagPart(group, { kind: 'furniture', entityId: entry.id as FurnitureId, levelId });
}
