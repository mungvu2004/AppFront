/**
 * Standing a piece of furniture where the plan says, facing the way it says.
 *
 * Every piece goes through the same two steps, and the order is the point:
 *
 * 1. The **procedural** piece from the catalogue is built and placed at once.
 *    The room is complete on the first frame, whatever the network does.
 * 2. If the entry names a `modelUrl` and an asset service is available, the
 *    `.glb` is requested. When it arrives it is **normalised** — scaled uniformly
 *    to fit the declared `sizeMm`, its feet put on `y = 0`, its footprint
 *    centred — and swapped in for the procedural piece. If it never arrives, or
 *    arrives broken, nothing happens: the procedural piece was never provisional.
 *
 * The frame every piece is placed in is the catalogue's: local `+z` is the
 * front, and `facing` turns that front towards a compass point on the plan.
 * A `.glb` is assumed to follow the glTF convention of facing `+z`, which is
 * the same frame, so no per-model rotation is needed.
 *
 * Heavy pieces also get a contact shadow: a soft dark decal laid on the floor
 * under their footprint, which is the cue that tells an eye the piece is
 * standing rather than floating.
 */

import { Box3, Group, Mesh, PlaneGeometry, Vector3, type Object3D } from 'three';

import type { FurnitureId, LevelId } from '@/domain/spatial/types';

import { tagPart } from '../build/scene';

import type { AssetService } from './assets';
import { buildProceduralPiece, CATALOGUE, isCatalogueVariant } from './catalogue';
import type { SceneMaterials } from './materials';
import { furnitureCentre, furnitureSize, isFacing, type Facing, type PlanFurniture, type SceneSize } from './plan';

/* -------------------------------------------------------------------------- */
/* Types.                                                                      */
/* -------------------------------------------------------------------------- */

/** Which geometry a placed piece ended up showing. */
export type PieceSource = 'procedural' | 'model';

export interface PlacedPiece {
  /** The positioned, tagged group; add it to the storey. */
  readonly group: Group;
  /** Settles once the piece is final: `model` after a successful swap, `procedural` otherwise. */
  readonly ready: Promise<PieceSource>;
}

export interface PlacementOptions {
  /** Where `.glb` files come from. Absent: every piece stays procedural. */
  readonly assets?: AssetService;
  /** Aborts pending model downloads — wire it to the mount's dispose. */
  readonly signal?: AbortSignal;
  /** Told why a piece kept its procedural geometry. Never throws. */
  readonly onFallback?: (entry: PlanFurniture, reason: unknown) => void;
}

/* -------------------------------------------------------------------------- */
/* Constants.                                                                  */
/* -------------------------------------------------------------------------- */

/** Local `+z` rotated onto each compass point — see the file comment. */
export const FACING_TURN: Readonly<Record<Facing, number>> = {
  north: 0,
  east: Math.PI / 2,
  south: Math.PI,
  west: -Math.PI / 2,
};

/** How far past the footprint a contact shadow reaches, as a factor. */
const CONTACT_SHADOW_SPREAD = 1.35;

/** Just above the floor, so the decal draws over the slab without fighting it. */
const CONTACT_SHADOW_LIFT = 0.004;

/* -------------------------------------------------------------------------- */
/* Normalising a model.                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Scale a loaded model to fit the declared size and stand it on the floor.
 *
 * The scale is **uniform** and chosen so the model fits inside the declared
 * box on every axis: a chair modelled a little tall comes out a little narrow
 * rather than squashed. After scaling, the model is moved so its lowest point
 * is at `y = 0` and its footprint is centred on the origin — the same frame the
 * procedural piece stood in, so the swap is invisible.
 *
 * A model with no extent on an axis is left at scale 1 on that axis's account.
 */
export function fitToSize(model: Object3D, size: SceneSize): Object3D {
  const bounds = new Box3().setFromObject(model, true);
  const extent = bounds.getSize(new Vector3());

  const ratios = [
    [size.w, extent.x],
    [size.h, extent.y],
    [size.d, extent.z],
  ]
    .filter(([, measured]) => (measured ?? 0) > 0)
    .map(([wanted, measured]) => (wanted ?? 0) / (measured ?? 1));

  const scale = ratios.length === 0 ? 1 : Math.min(...ratios);
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);

  const scaled = new Box3().setFromObject(model, true);
  const centre = scaled.getCenter(new Vector3());
  model.position.sub(new Vector3(centre.x, scaled.min.y, centre.z));
  model.updateMatrixWorld(true);

  return model;
}

/** Every mesh in a loaded model throws and catches shadows like the catalogue's do. */
function enableShadows(model: Object3D): void {
  model.traverse((object) => {
    if (object instanceof Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
}

function disposeGeometry(root: Object3D): void {
  root.traverse((object) => {
    if (object instanceof Mesh) {
      object.geometry.dispose();
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Contact shadow.                                                             */
/* -------------------------------------------------------------------------- */

/** The decal under a heavy piece, sized from its footprint. */
export function contactShadowFor(size: SceneSize, materials: SceneMaterials): Mesh | null {
  if (materials.contactShadow === null) {
    return null;
  }

  const decal = new Mesh(
    new PlaneGeometry(size.w * CONTACT_SHADOW_SPREAD, size.d * CONTACT_SHADOW_SPREAD),
    materials.contactShadow,
  );
  decal.rotation.x = -Math.PI / 2;
  decal.position.y = CONTACT_SHADOW_LIFT;
  decal.renderOrder = 1;
  decal.receiveShadow = false;
  decal.castShadow = false;
  return decal;
}

/* -------------------------------------------------------------------------- */
/* Placement.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Build one plan entry, stand it where the plan says, and start its upgrade.
 *
 * @throws RangeError when the variant is unknown or the facing is not a
 * compass point — a typo in the plan should fail the mount, not leave a silent
 * gap in a room.
 */
export function placeFurniture(
  entry: PlanFurniture,
  levelId: LevelId,
  materials: SceneMaterials,
  options: PlacementOptions = {},
): PlacedPiece {
  if (!isCatalogueVariant(entry.variant)) {
    throw new RangeError(`Furniture ${entry.id} has unknown variant "${entry.variant}".`);
  }
  if (!isFacing(entry.facing)) {
    throw new RangeError(`Furniture ${entry.id} faces "${entry.facing}", which is not a compass point.`);
  }

  const size = furnitureSize(entry);
  const centre = furnitureCentre(entry);
  const group = new Group();

  const procedural = buildProceduralPiece(entry.variant, size, materials);
  procedural.name = 'procedural';
  group.add(procedural);

  if (CATALOGUE[entry.variant]?.contactShadow === true) {
    const decal = contactShadowFor(size, materials);
    if (decal !== null) {
      decal.name = 'contactShadow';
      group.add(decal);
    }
  }

  group.position.set(centre.x, 0, centre.z);
  group.rotation.y = FACING_TURN[entry.facing];
  tagPart(group, { kind: 'furniture', entityId: entry.id as FurnitureId, levelId });

  const ready = upgradeToModel(entry, size, group, procedural, options);

  return { group, ready };
}

/** Request the `.glb`, and swap it in if and when it arrives whole. */
async function upgradeToModel(
  entry: PlanFurniture,
  size: SceneSize,
  group: Group,
  procedural: Object3D,
  options: PlacementOptions,
): Promise<PieceSource> {
  const url = entry.modelUrl;

  if (url === undefined || options.assets === undefined) {
    return 'procedural';
  }

  try {
    const model = await options.assets.load(url, options.signal);

    // The mount may have been torn down while the bytes were in flight.
    if (options.signal?.aborted === true) {
      disposeGeometry(model);
      return 'procedural';
    }

    fitToSize(model, size);
    enableShadows(model);
    model.name = 'model';

    group.remove(procedural);
    disposeGeometry(procedural);
    group.add(model);

    return 'model';
  } catch (reason: unknown) {
    options.onFallback?.(entry, reason);
    return 'procedural';
  }
}
