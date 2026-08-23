/**
 * The lights of a cutaway, and why there are four kinds.
 *
 * - The **hemisphere** is the sky: cool-white from above, backdrop-dark from
 *   below, so floors are lit and undersides are not.
 * - The **key** is the sun, and the only light that casts a shadow. It is what
 *   gives each wall a crisp cut-out on the floor and the whole flat a drop
 *   shadow on the backdrop. It stands high and slightly to the side, so the
 *   shadow is short and the top edges of the walls — the dark section cut a
 *   cutaway is read by — stay sharp rather than smeared across the floor.
 * - The **fill** is warm and comes from the far side so the shadowed faces are
 *   not black. **Ambient** only lifts the darkest corners.
 * - The **ceiling lights** are the plan's: one warm point source per room it
 *   names, hung at the height it gives. Pendants and lamps bring their own.
 *
 * Shadow bias is the one number here that is tuned rather than chosen. Too
 * little and every surface stripes with its own shadow (acne); too much and a
 * shadow detaches from the thing casting it (peter-panning) — which, on a wall
 * top, reads as a soft edge. The pair below keeps the cut edges sharp at the
 * resolution the map has.
 */

import {
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  PointLight,
  type Group,
  type Vector3,
} from 'three';

import type { ScenePalette } from './palette';
import { heightAbove, roomCentre, type PlanCeilingLights, type PlanLevel, type PlanRoom } from './plan';

/* -------------------------------------------------------------------------- */
/* Levels.                                                                     */
/* -------------------------------------------------------------------------- */

const HEMISPHERE_INTENSITY = 0.5;
const KEY_LIGHT_INTENSITY = 2.8;
const FILL_LIGHT_INTENSITY = 0.55;
const AMBIENT_INTENSITY = 0.18;

/** Resolution of the sun's shadow map; the cut edges are only as sharp as this. */
export const SHADOW_MAP_SIZE = 2048;

/** Acne versus peter-panning — see the file comment. */
const SHADOW_BIAS = -0.00025;
const SHADOW_NORMAL_BIAS = 0.025;

/** Where the ceiling lights hang, and how bright they are. */
export const CEILING_LIGHT_INTENSITY = 3.2;
export const CEILING_LIGHT_REACH = 5;

/* -------------------------------------------------------------------------- */
/* Construction.                                                               */
/* -------------------------------------------------------------------------- */

/** The fixed lights of a scene, and the one that casts the shadow. */
export interface SceneLighting {
  readonly lights: readonly (AmbientLight | DirectionalLight | HemisphereLight)[];
  readonly key: DirectionalLight;
}

/**
 * The sky, the sun and the fill, sized to a model of `size`.
 *
 * The sun's shadow camera is an orthographic box around the model: wide enough
 * to cover its plan diagonal, deep enough to reach past it, and no bigger —
 * every metre of map spent outside the model is resolution taken from its
 * edges.
 */
export function createLighting(palette: ScenePalette, size: Vector3): SceneLighting {
  const hemisphere = new HemisphereLight(palette.plaster, palette.backdrop, HEMISPHERE_INTENSITY);
  const ambient = new AmbientLight(palette.lamp, AMBIENT_INTENSITY);

  const key = new DirectionalLight(palette.plaster, KEY_LIGHT_INTENSITY);
  key.position.set(size.x * 0.5, size.y * 6, size.z * 0.7);
  key.castShadow = true;
  key.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  key.shadow.bias = SHADOW_BIAS;
  key.shadow.normalBias = SHADOW_NORMAL_BIAS;

  const reach = Math.hypot(size.x, size.z) * 0.6;
  key.shadow.camera.left = -reach;
  key.shadow.camera.right = reach;
  key.shadow.camera.top = reach;
  key.shadow.camera.bottom = -reach;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = reach * 4;

  const fill = new DirectionalLight(palette.lamp, FILL_LIGHT_INTENSITY);
  fill.position.set(-size.x, size.y * 1.5, -size.z);

  return { lights: [hemisphere, ambient, key, fill], key };
}

/** One warm point light per room the plan names, at the plan's height. */
export function addCeilingLights(
  house: Group,
  palette: ScenePalette,
  level: PlanLevel,
  rooms: readonly PlanRoom[],
  ceilingLights: PlanCeilingLights,
): readonly PointLight[] {
  const added: PointLight[] = [];
  const height = heightAbove(level, ceilingLights.heightMm);

  for (const room of rooms) {
    if (!ceilingLights.roomIds.includes(room.id)) {
      continue;
    }

    const centre = roomCentre(room);
    const light = new PointLight(palette.lamp, CEILING_LIGHT_INTENSITY, CEILING_LIGHT_REACH, 2);
    light.position.set(centre.x, height, centre.z);
    house.add(light);
    added.push(light);
  }

  return added;
}
