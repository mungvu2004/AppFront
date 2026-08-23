/**
 * The procedural furniture catalogue: every piece a plan may name, built from
 * primitives.
 *
 * `../build` turns a plan into walls and slabs and stops there — a sofa is not
 * arithmetic on a centreline. This is the other half: each variant is a handful
 * of boxes, cylinders and spheres in its own frame, sized from the plan's
 * `sizeMm`. It is also the **fallback** for the whole furniture system: a piece
 * that names a `.glb` is built from here first and swapped out only when the
 * model arrives, so a missing, slow or broken asset never leaves a gap in a room.
 *
 * The frame is fixed so a plan can be read without opening this file: local `x`
 * is the width, local `y` is up from the floor, and local `+z` is the **front**
 * of the piece — the side a person uses. `placement.ts` turns that front towards
 * a compass point. Wall-hung pieces (a picture, a mirror, a sconce) hang
 * against local `-z` and are raised off the floor by the plan's `liftMm`.
 *
 * No colour is decided here; each piece asks for a material by role from
 * {@link SceneMaterials}. Each variant also says whether it is heavy enough to
 * earn a contact shadow — a bed darkens the floor around it, a pendant does not.
 * The builders themselves live in `pieces/`, grouped by room.
 */

import { Group } from 'three';

import type { SceneMaterials } from './materials';
import { basin, mirror, shower, wc } from './pieces/bathroom';
import { artwork, floorLamp, pendant, rug, sconce, tableLamp, vase } from './pieces/decor';
import { bamboo, plant, planter, shrub } from './pieces/greenery';
import { baseRun, fridge, hob, hood, sink, upperRun } from './pieces/kitchen';
import type { PieceBuilder } from './pieces/primitives';
import { bed, bench, chair, lounger, sofa, stool } from './pieces/seating';
import { cabinet, nightstand, shelves, sideTable, table, tv, wardrobe } from './pieces/storage';
import type { SceneSize } from './plan';

export {
  box,
  cylinder,
  LAMP_INTENSITY,
  LAMP_REACH,
  LIGHT_POOL_KEY,
  type LightPoolSpec,
  type PieceBuilder,
} from './pieces/primitives';

/** One catalogue entry. */
export interface CatalogueEntry {
  readonly build: PieceBuilder;
  /** Heavy enough to darken the floor around it. */
  readonly contactShadow: boolean;
}

const heavy = (build: PieceBuilder): CatalogueEntry => ({ build, contactShadow: true });
const light = (build: PieceBuilder): CatalogueEntry => ({ build, contactShadow: false });

/** Every variant a plan may name. Adding a piece is adding a line here. */
export const CATALOGUE: Readonly<Record<string, CatalogueEntry>> = {
  // Seating and beds.
  sofa: heavy(sofa),
  armchair: heavy(sofa),
  chair: light(chair),
  bench: light(bench),
  stool: light(stool),
  lounger: heavy(lounger),
  bed: heavy(bed),
  // Tables and storage.
  table: heavy(table),
  sideTable: light(sideTable),
  nightstand: heavy(nightstand),
  cabinet: heavy(cabinet),
  wardrobe: heavy(wardrobe),
  shelves: heavy(shelves),
  tv: heavy(tv),
  // Kitchen.
  baseRun: heavy(baseRun),
  upperRun: light(upperRun),
  hood: light(hood),
  hob: light(hob),
  sink: light(sink),
  fridge: heavy(fridge),
  // Bathroom.
  wc: light(wc),
  basin: heavy(basin),
  mirror: light(mirror),
  shower: light(shower),
  // Decoration and lamps.
  rug: light(rug),
  artwork: light(artwork),
  vase: light(vase),
  floorLamp: light(floorLamp),
  tableLamp: light(tableLamp),
  pendant: light(pendant),
  sconce: light(sconce),
  // Plants.
  plant: light(plant),
  bamboo: light(bamboo),
  shrub: light(shrub),
  planter: heavy(planter),
};

/** Every variant name, for a plan validator or a picker. */
export const CATALOGUE_VARIANTS: readonly string[] = Object.keys(CATALOGUE);

/** Variants that carry their own light source — a lamp on the plan. */
export const LAMP_VARIANTS: readonly string[] = ['floorLamp', 'tableLamp', 'pendant', 'sconce'];

/** Own keys only: `"constructor"` is in every object and in no catalogue. */
export function isCatalogueVariant(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(CATALOGUE, value);
}

/**
 * Build one variant's primitives into a fresh group.
 *
 * @throws RangeError when the variant is not in the catalogue — a typo in the
 * plan should fail the mount, not leave a silent gap in a room.
 */
export function buildProceduralPiece(variant: string, size: SceneSize, materials: SceneMaterials): Group {
  const entry = isCatalogueVariant(variant) ? CATALOGUE[variant] : undefined;

  if (entry === undefined) {
    throw new RangeError(`Furniture variant "${variant}" is not in the catalogue.`);
  }

  const group = new Group();
  entry.build(group, size, materials);
  return group;
}
