/**
 * The lights of a cutaway, and why there are four kinds.
 *
 * - The **hemisphere** is the sky: cool-white from above, backdrop-dark from
 *   below, so floors are lit and undersides are not. It is kept low: the look
 *   is evening, and the room's own lamps are supposed to do the work.
 * - The **key** is the sun, and the only light that casts a shadow. It is what
 *   gives each wall a crisp cut-out on the floor and the whole flat a drop
 *   shadow on the backdrop. It stands high and slightly to the side, so the
 *   shadow is short and the top edges of the walls — the dark section cut a
 *   cutaway is read by — stay sharp rather than smeared across the floor.
 * - The **fill** is warm and comes from the far side so the shadowed faces are
 *   not black. **Ambient** only lifts the darkest corners.
 * - The **downlights** are the plan's: a warm spot per room it names, and at
 *   any extra point it lists, hung at the height it gives and aimed straight
 *   down. A spot rather than a point source because a spot makes a *pool* — a
 *   bright floor under the light and a falloff towards the walls — which is
 *   the single cue that most separates a rendered evening from a lit diagram.
 *   Pendants and lamps bring their own point sources.
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
  SpotLight,
  type Group,
  type Vector3,
} from 'three';

import type { ScenePalette } from './palette';
import {
  heightAbove,
  planPoint,
  roomCentre,
  type PlanCeilingLights,
  type PlanLevel,
  type PlanRoom,
  type ScenePoint,
} from './plan';

/* -------------------------------------------------------------------------- */
/* Levels.                                                                     */
/* -------------------------------------------------------------------------- */

const HEMISPHERE_INTENSITY = 0.13;
const KEY_LIGHT_INTENSITY = 1.1;
const FILL_LIGHT_INTENSITY = 0.3;
const AMBIENT_INTENSITY = 0.08;

/** Resolution of the sun's shadow map; the cut edges are only as sharp as this. */
export const SHADOW_MAP_SIZE = 2048;

/** Acne versus peter-panning — see the file comment. */
const SHADOW_BIAS = -0.00025;
const SHADOW_NORMAL_BIAS = 0.025;

/** The downlights: candela, reach, the cone's half-angle and how soft its edge is. */
export const CEILING_LIGHT_INTENSITY = 18;
export const CEILING_LIGHT_REACH = 6;
export const CEILING_LIGHT_ANGLE_RAD = 0.62;
const CEILING_LIGHT_PENUMBRA = 0.55;

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

/** A warm downlight at `point`, `height` up, aimed at the floor beneath it. */
function downlight(palette: ScenePalette, point: ScenePoint, height: number): SpotLight {
  const light = new SpotLight(
    palette.lamp,
    CEILING_LIGHT_INTENSITY,
    CEILING_LIGHT_REACH,
    CEILING_LIGHT_ANGLE_RAD,
    CEILING_LIGHT_PENUMBRA,
    2,
  );
  light.position.set(point.x, height, point.z);
  light.target.position.set(point.x, 0, point.z);
  return light;
}

/**
 * One warm downlight per room the plan names and per extra point it lists, at
 * the plan's height. Each spot's target is added beside it — a spot aims at
 * its target's world position, and a target outside the graph never moves.
 */
export function addCeilingLights(
  house: Group,
  palette: ScenePalette,
  level: PlanLevel,
  rooms: readonly PlanRoom[],
  ceilingLights: PlanCeilingLights,
): readonly SpotLight[] {
  const height = heightAbove(level, ceilingLights.heightMm);
  const points: ScenePoint[] = [
    ...rooms.filter((room) => ceilingLights.roomIds.includes(room.id)).map(roomCentre),
    ...(ceilingLights.positionsMm ?? []).map(planPoint),
  ];

  const added: SpotLight[] = [];
  for (const point of points) {
    const light = downlight(palette, point, height);
    house.add(light);
    house.add(light.target);
    added.push(light);
  }

  return added;
}
