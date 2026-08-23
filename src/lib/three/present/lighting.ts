/**
 * The lights of a cutaway, and why there are four kinds.
 *
 * - The **hemisphere** is the sky: cool-white from above, backdrop-dark from
 *   below, so floors are lit and undersides are not. It and the ambient stand
 *   in for the studio environment the matte surfaces no longer sample (see
 *   `materials.ts`): together they are what keeps a wall facing away from the
 *   sun from going grey. The look is still evening — the room's own lamps do
 *   the work of making it somewhere.
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
 * ## The light budget
 *
 * Every real light is paid for by every pixel of every frame: a standard
 * material loops over all of them, so nineteen lights cost a fragment about
 * three times what six do. A cutaway is seen from above, and from above a
 * light *is* its pool — so past a budget, the lights that matter least are
 * drawn rather than lit: the light is taken out and a warm disc is laid on
 * the surface it would have lit, added over the finish there. A downlight is
 * worth the floor it lights, so the big rooms keep theirs; a bedside lamp is
 * worth a couple of square metres and is the first to be drawn. See
 * {@link budgetLights}.
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
  Mesh,
  PlaneGeometry,
  PointLight,
  SpotLight,
  type Group,
  type Light,
  type Object3D,
  type Vector3,
} from 'three';

import { signedAreaMm2 } from '@/domain/rooms/area';
import { millimetres } from '@/domain/units/types';

import { insideOutline } from './dressing';
import type { SceneMaterials } from './materials';
import type { ScenePalette } from './palette';
import { LIGHT_POOL_KEY, type LightPoolSpec } from './pieces/primitives';
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

/**
 * Tuned together against a measured frame: mean luminance ≈ 138/255, bright
 * pixels ≈ 17 %, red-to-blue ≈ 1,24 over the model. Move one and re-measure.
 */
const HEMISPHERE_INTENSITY = 0.4;
const KEY_LIGHT_INTENSITY = 1.4;
const FILL_LIGHT_INTENSITY = 0.3;
const AMBIENT_INTENSITY = 0.65;
/** How far the ambient leans from the plaster white towards the lamp colour. */
const AMBIENT_WARMTH = 0.35;

/**
 * Resolution of the sun's shadow map; the cut edges are only as sharp as this.
 * A thousand texels over a twenty-metre box is two centimetres a texel — about
 * one screen pixel at the sign-in panel's size — for four megabytes of GPU
 * memory rather than the sixteen the next step up costs.
 */
export const SHADOW_MAP_SIZE = 1024;

/** Acne versus peter-panning — see the file comment. */
const SHADOW_BIAS = -0.00025;
const SHADOW_NORMAL_BIAS = 0.025;

/** The downlights: candela, reach, the cone's half-angle and how soft its edge is. */
export const CEILING_LIGHT_INTENSITY = 18;
export const CEILING_LIGHT_REACH = 6;
export const CEILING_LIGHT_ANGLE_RAD = 0.62;
const CEILING_LIGHT_PENUMBRA = 0.55;

/**
 * How many of the plan's lights stay real. Eight is where an integrated GPU
 * draws the sway well inside a frame at the canvas size the sign-in panel uses.
 */
export const DEFAULT_LIGHT_BUDGET = 8;

/** A drawn pool sits this far off its surface, so the decal never fights the finish for a pixel. */
const POOL_LIFT = 0.004;

/** A wall pool is this much taller than it is wide: a sconce throws up and down, not sideways. */
const WALL_POOL_STRETCH = 1.8;

const SQUARE_MILLIMETRES_PER_SQUARE_METRE = 1_000_000;

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
  const ambient = new AmbientLight(palette.plaster.clone().lerp(palette.lamp, AMBIENT_WARMTH), AMBIENT_INTENSITY);

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

/**
 * A warm downlight at `point`, `height` up, aimed at the floor beneath it.
 *
 * Its pool, should it be drawn instead, is the disc its cone cuts on the
 * floor, and it is worth the area of the room it lights.
 */
function downlight(palette: ScenePalette, point: ScenePoint, height: number, floor: number, area: number): SpotLight {
  const light = new SpotLight(
    palette.lamp,
    CEILING_LIGHT_INTENSITY,
    CEILING_LIGHT_REACH,
    CEILING_LIGHT_ANGLE_RAD,
    CEILING_LIGHT_PENUMBRA,
    2,
  );
  light.position.set(point.x, height, point.z);
  light.target.position.set(point.x, floor, point.z);

  const pool: LightPoolSpec = {
    surface: 'floor',
    radius: (height - floor) * Math.tan(CEILING_LIGHT_ANGLE_RAD),
    height: floor,
    priority: area,
  };
  light.userData[LIGHT_POOL_KEY] = pool;
  return light;
}

/** A room's floor area in square metres — what its downlight is worth. */
export function roomArea(room: PlanRoom): number {
  const outline = room.outline.map((corner) => ({
    x: millimetres(corner[0] ?? 0),
    y: millimetres(corner[1] ?? 0),
  }));
  return Math.abs(signedAreaMm2(outline)) / SQUARE_MILLIMETRES_PER_SQUARE_METRE;
}

/** The area of the room a plan point falls in, or nothing when it is outside every room. */
function areaAround(pointMm: readonly number[], rooms: readonly PlanRoom[]): number {
  const point = { x: pointMm[0] ?? 0, y: pointMm[1] ?? 0 };
  const room = rooms.find((candidate) => insideOutline(point, candidate.outline));
  return room === undefined ? 0 : roomArea(room);
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
  const floor = heightAbove(level, 0);
  const points: { readonly point: ScenePoint; readonly area: number }[] = [
    ...rooms
      .filter((room) => ceilingLights.roomIds.includes(room.id))
      .map((room) => ({ point: roomCentre(room), area: roomArea(room) })),
    ...(ceilingLights.positionsMm ?? []).map((pointMm) => ({
      point: planPoint(pointMm),
      area: areaAround(pointMm, rooms),
    })),
  ];

  const added: SpotLight[] = [];
  for (const { point, area } of points) {
    const light = downlight(palette, point, height, floor, area);
    house.add(light);
    house.add(light.target);
    added.push(light);
  }

  return added;
}

/* -------------------------------------------------------------------------- */
/* The budget.                                                                 */
/* -------------------------------------------------------------------------- */

/** What `budgetLights` did. */
export interface LightBudgetReport {
  /** The lights that stayed real, most valuable first. */
  readonly kept: readonly Light[];
  /** The lights taken out, and the pool drawn for each. `null` where no canvas could draw one. */
  readonly drawn: readonly { readonly light: Light; readonly pool: Mesh | null }[];
}

/** The pool a light carries, if it was made by this package. */
export function lightPoolOf(light: Object3D): LightPoolSpec | null {
  const spec: unknown = light.userData[LIGHT_POOL_KEY];
  return typeof spec === 'object' && spec !== null ? (spec as LightPoolSpec) : null;
}

/** The disc of light a drawn lamp leaves on its surface, in the lamp's own frame. */
export function lightPoolFor(light: Light, spec: LightPoolSpec, materials: SceneMaterials): Mesh | null {
  if (materials.lightPool === null) {
    return null;
  }

  const size = spec.radius * 2;
  const pool = new Mesh(
    new PlaneGeometry(size, spec.surface === 'wall' ? size * WALL_POOL_STRETCH : size),
    materials.lightPool,
  );
  pool.name = 'lightPool';
  pool.castShadow = false;
  pool.receiveShadow = false;
  pool.renderOrder = 1;

  if (spec.surface === 'wall') {
    // Against the wall behind the piece, facing into the room.
    pool.position.set(light.position.x, spec.height, -POOL_LIFT);
  } else {
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(light.position.x, spec.height + POOL_LIFT, light.position.z);
  }

  return pool;
}

/**
 * Keep the `budget` most valuable lights under `house` real, and draw the rest.
 *
 * A light is worth what its pool says — a downlight, the area of its room; a
 * lamp, a few square metres — and ties go to the light added first. A drawn
 * light is removed from the graph, along with a spot's target, and its pool
 * is added to the same parent so that a lifted or turned piece carries its
 * pool with it. Lights with no pool spec (none of this package's) are left
 * alone and not counted.
 */
export function budgetLights(house: Object3D, materials: SceneMaterials, budget = DEFAULT_LIGHT_BUDGET): LightBudgetReport {
  const candidates: { readonly light: Light; readonly spec: LightPoolSpec; readonly order: number }[] = [];

  house.traverse((object) => {
    if (!(object instanceof SpotLight) && !(object instanceof PointLight)) {
      return;
    }
    const spec = lightPoolOf(object);
    if (spec !== null) {
      candidates.push({ light: object, spec, order: candidates.length });
    }
  });

  candidates.sort((left, right) => right.spec.priority - left.spec.priority || left.order - right.order);

  const kept = candidates.slice(0, Math.max(0, budget)).map((candidate) => candidate.light);
  const drawn = candidates.slice(Math.max(0, budget)).map(({ light, spec }) => {
    const parent = light.parent;
    const pool = lightPoolFor(light, spec, materials);

    if (light instanceof SpotLight) {
      light.target.removeFromParent();
    }
    light.removeFromParent();
    if (pool !== null && parent !== null) {
      parent.add(pool);
    }

    return { light, pool };
  });

  return { kept, drawn };
}
