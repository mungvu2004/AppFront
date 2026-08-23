/**
 * The model on the sign-in panel: a JSON plan, put through the product's own builder.
 *
 * `houseModel.json` is a fixed drawing — walls as centrelines in millimetres,
 * openings placed along them, rooms as outlines, one storey. It is fed to
 * `buildFloorMesh` from `src/lib/three/build`, which is the same function the
 * viewer uses: it extrudes each wall, **cuts the door and window openings out of
 * it**, lays the floor slabs and hangs a panel in every opening. So the
 * apartment on this screen is not an illustration of the product — it is the
 * product, run once on a small plan.
 *
 * It is shown the way an estate agent shows a flat: as an **open box**. The
 * ceilings the builder lays are taken off again, the camera is orthographic and
 * looks down at fifty-five degrees, and what is left is a cutaway — every room
 * visible at once, the partitions reading as a plan and the furniture reading
 * as a home. The furniture and the lamps are the one layer the product does not
 * generate; `houseFurniture.ts` builds them from the same JSON.
 *
 * ## Why the plan is a file here and not `SAMPLE_BUILDING`
 *
 * The fixture in `src/domain/spatial/__fixtures__` cannot draw a house: all
 * forty-eight of its walls run `(index·1000, 0) → ((index+1)·1000, 0)`, laid end
 * to end on a single straight line, and its fourteen rooms are identical
 * rectangles in one row. It exists to satisfy invariant A14 — forty-eight walls,
 * fourteen rooms, 248,60 m² — and every test that reads it counts or sums.
 * Rendering it draws a fifty-metre ruler.
 *
 * ## Three constraints this file works inside
 *
 * - **No colour literals.** `local/no-raw-color` covers `src/screens`, and it is
 *   right to: the palette is themed through CSS custom properties, so every
 *   material is resolved from a token at mount in `houseMaterials.ts`. A hex
 *   here would be a fourth place the palette lives, and the one that never
 *   follows a theme.
 * - **No timing literals.** The sway is paced in whole {@link AMBIENT_LOOP_MS}
 *   beats, the same token the CSS animations use, so rule B holds on both sides.
 * - **It stops when asked.** `prefers-reduced-motion` parks the model at its
 *   opening angle and never schedules a frame.
 *
 * It sways rather than turns. A cutaway has a front — the side the rooms open
 * towards the camera from — and a full turn would spend half its time showing
 * the closed backs of the exterior walls instead. Swinging eighteen degrees either
 * side of the best angle keeps every room in view the whole time, and lets the
 * frame be fitted to that arc rather than to the worst case of a full circle,
 * which is what makes the flat fill its frame.
 *
 * Everything is created inside {@link mountHouseScene} and released by the
 * handle it returns; nothing is held at module scope, so a route that unmounts
 * gives back its GPU memory.
 */

import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  OrthographicCamera,
  PCFSoftShadowMap,
  PlaneGeometry,
  PointLight,
  Scene,
  ShadowMaterial,
  Vector3,
  WebGLRenderer,
  type Material,
} from 'three';

import type { Opening } from '@/domain/openings/types';
import type { LevelId, OpeningId, RoomId, SwingDirection, WallId } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';
import type { Wall, WallKind } from '@/domain/walls/types';
import { AMBIENT_LOOP_MS } from '@/lib/motion';
import { buildFloorMesh, SLAB_THICKNESS_MM } from '@/lib/three/build/floor';
import { readPartData, toSceneLength } from '@/lib/three/build/scene';

import { buildFurniture } from './houseFurniture';
import { createMaterials, readPalette, type SceneMaterials } from './houseMaterials';
import plan from './houseModel.json';

/* -------------------------------------------------------------------------- */
/* The plan, as the builders want it.                                          */
/* -------------------------------------------------------------------------- */

/** One full sway, out and back, in whole ambient beats. Thirty of them is twenty-one seconds. */
const SWAY_BEATS = 30;
const SWAY_PERIOD_MS = AMBIENT_LOOP_MS * SWAY_BEATS;

/** How much of a sway has passed, as a fraction, at a given moment. */
const swayFraction = (elapsedMs: number): number => (elapsedMs % SWAY_PERIOD_MS) / SWAY_PERIOD_MS;

const FULL_TURN_RADIANS = Math.PI * 2;

/** Angle the model rests at, as a fraction of a turn — balcony to the front-left. */
const RESTING_TURN = 0.05;

/** How far either side of rest the sway reaches, as a fraction of a turn. */
const SWAY_TURN = 0.05;

/** The model's heading at a moment in the sway, in radians. */
const headingAt = (elapsedMs: number): number =>
  (RESTING_TURN + SWAY_TURN * Math.sin(swayFraction(elapsedMs) * FULL_TURN_RADIANS)) *
  FULL_TURN_RADIANS;

interface PlanWall {
  readonly id: string;
  readonly levelId: string;
  readonly kind: string;
  readonly thicknessMm: number;
  /** A wall lower than its storey — a balustrade. Absent means storey height. */
  readonly heightMm?: number;
  readonly start: readonly number[];
  readonly end: readonly number[];
}

/**
 * A JSON wall as `@/domain/walls` describes one.
 *
 * `baseElevationMm` and `topElevationMm` are absolute heights rather than a
 * height above the storey, which is why the level has to be looked up here
 * rather than left to the builder.
 */
function toDomainWall(wall: PlanWall, elevationMm: number, storeyHeightMm: number): Wall {
  return {
    id: wall.id as WallId,
    kind: wall.kind as WallKind,
    centreline: {
      start: { x: millimetres(wall.start[0] ?? 0), y: millimetres(wall.start[1] ?? 0) },
      end: { x: millimetres(wall.end[0] ?? 0), y: millimetres(wall.end[1] ?? 0) },
    },
    thicknessMm: millimetres(wall.thicknessMm),
    baseElevationMm: millimetres(elevationMm),
    topElevationMm: millimetres(elevationMm + (wall.heightMm ?? storeyHeightMm)),
  };
}

interface PlanOpening {
  readonly id: string;
  readonly wallId: string;
  readonly kind: string;
  readonly relativePosition: number;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly sillHeightMm: number;
  readonly swing: string;
}

function toDomainOpening(opening: PlanOpening): Opening {
  return {
    id: opening.id as OpeningId,
    wallId: opening.wallId as WallId,
    kind: opening.kind as Opening['kind'],
    relativePosition: opening.relativePosition,
    widthMm: millimetres(opening.widthMm),
    heightMm: millimetres(opening.heightMm),
    sillHeightMm: millimetres(opening.sillHeightMm),
    swing: opening.swing as SwingDirection,
  } as Opening;
}

/** What a room's slab is finished in; decides which drawn texture it gets. */
type Finish = 'wood' | 'tile' | 'decking';

interface PlanRoom {
  readonly id: string;
  readonly levelId: string;
  readonly finish: string;
  readonly outline: readonly (readonly number[])[];
}

/** The middle of a room outline, where its ceiling light hangs. */
function roomCentre(room: PlanRoom): { readonly x: number; readonly z: number } {
  const count = Math.max(1, room.outline.length);
  const sum = room.outline.reduce(
    (total, [x, y]) => ({ x: total.x + (x ?? 0), y: total.y + (y ?? 0) }),
    { x: 0, y: 0 },
  );

  return {
    x: toSceneLength(millimetres(sum.x / count)),
    z: toSceneLength(millimetres(sum.y / count)),
  };
}

/* -------------------------------------------------------------------------- */
/* Dressing the built storey.                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Hand every built part its material, and take the ceilings away.
 *
 * The builder tags each mesh with what it stands for, so this never has to
 * guess from geometry: a wall is painted plaster on its faces and dark on its
 * cut top and reveals (the extruder's two material groups); a slab gets the
 * finish its room declares; a pane is glass and a leaf is timber. A ceiling is
 * the one part an open-box view has no use for, and it is removed rather than
 * hidden so it costs nothing on every frame after.
 */
function dressStorey(
  storey: Group,
  materials: SceneMaterials,
  walls: readonly PlanWall[],
  openings: readonly PlanOpening[],
  rooms: readonly PlanRoom[],
): void {
  const wallKinds = new Map(walls.map((wall) => [wall.id, wall.kind]));
  const openingById = new Map(openings.map((opening) => [opening.id, opening]));
  const finishes = new Map(rooms.map((room) => [room.id, room.finish as Finish]));

  const floorFor: Readonly<Record<Finish, Material>> = {
    wood: materials.woodFloor,
    tile: materials.tileFloor,
    decking: materials.decking,
  };

  const ceilings: Mesh[] = [];

  storey.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    const part = readPartData(object);
    object.castShadow = true;
    object.receiveShadow = true;

    switch (part?.kind) {
      case 'wall': {
        const isRailing = wallKinds.get(part.entityId) === 'railing';
        object.material = isRailing ? materials.glass : [materials.plaster, materials.cut];
        object.castShadow = !isRailing;
        break;
      }
      case 'floorSlab': {
        const finish = finishes.get(part.entityId) ?? 'tile';
        object.material = [floorFor[finish], materials.cut];
        break;
      }
      case 'opening': {
        const opening = openingById.get(part.entityId);
        const isGlazed = opening?.kind === 'window' || opening?.swing === 'sliding';
        object.material = isGlazed ? materials.glass : materials.woodDark;
        object.castShadow = !isGlazed;
        break;
      }
      case 'ceiling':
        ceilings.push(object);
        break;
      default:
        break;
    }
  });

  for (const ceiling of ceilings) {
    ceiling.removeFromParent();
    ceiling.geometry.dispose();
  }
}

/** Where the ceiling lights hang, and how bright they are. */
const CEILING_LIGHT_INTENSITY = 3.2;
const CEILING_LIGHT_REACH = 5;

/**
 * The storey, built, dressed, furnished and lit — everything that turns.
 *
 * Exported for the test beside this file, which runs the plan through the real
 * builder and checks that no opening was refused and no variant was unknown:
 * the two mistakes a plan edit can make that a renderer would show as a gap.
 */
export function buildHouse(materials: SceneMaterials): Group {
  const house = new Group();
  const openings = plan.openings.map(toDomainOpening);

  for (const level of plan.levels) {
    const levelId = level.id as LevelId;
    const planWalls = plan.walls.filter((wall) => wall.levelId === level.id);
    const planRooms = plan.rooms.filter((room) => room.levelId === level.id);

    const storey = buildFloorMesh({
      level: {
        id: levelId,
        elevationMm: millimetres(level.elevationMm),
        heightMm: millimetres(level.heightMm),
      },
      walls: planWalls.map((wall) => toDomainWall(wall, level.elevationMm, level.heightMm)),
      rooms: planRooms.map((room) => ({
        id: room.id as RoomId,
        outline: room.outline.map(([x, y]) => ({ x: millimetres(x ?? 0), y: millimetres(y ?? 0) })),
      })),
      openings,
    });

    dressStorey(storey, materials, planWalls, plan.openings, planRooms);
    house.add(storey);

    for (const entry of plan.furniture) {
      house.add(buildFurniture(entry, levelId, materials));
    }

    const lightHeight = toSceneLength(millimetres(level.elevationMm + plan.ceilingLights.heightMm));

    for (const room of planRooms) {
      if (!plan.ceilingLights.roomIds.includes(room.id)) {
        continue;
      }

      const centre = roomCentre(room);
      const light = new PointLight(
        materials.lampShade.color,
        CEILING_LIGHT_INTENSITY,
        CEILING_LIGHT_REACH,
        2,
      );
      light.position.set(centre.x, lightHeight, centre.z);
      house.add(light);
    }
  }

  return house;
}

/* -------------------------------------------------------------------------- */
/* Mounting.                                                                   */
/* -------------------------------------------------------------------------- */

/** What the caller keeps so it can give the GPU memory back. */
export interface HouseSceneHandle {
  readonly dispose: () => void;
}

const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 100;

/** How far back the orthographic camera sits. Only has to clear the model. */
const CAMERA_DISTANCE = 40;

/** The angle the camera looks down at — the axonometric tilt of a 3D floor plan. */
const CAMERA_ELEVATION_RAD = (55 * Math.PI) / 180;

/** Air left around the model once it is framed, as a fraction of its extent. */
const FRAMING_MARGIN = 1.03;

/** How many headings across the sway are tried when fitting the frame. */
const FRAMING_SAMPLES = 24;

/**
 * The half-width and half-height the model needs on screen over the whole sway.
 *
 * Every corner of the bounding box is swung through each sampled heading and
 * projected onto the camera's right and up axes; the largest reach either way
 * is what the frustum has to cover. Sampling the arc rather than bounding it by
 * a sphere is the difference between a flat that fills its frame and one that
 * floats in the middle of it.
 */
function swayExtents(
  bounds: Box3,
  centre: Vector3,
): { readonly halfWidth: number; readonly halfHeight: number } {
  const vertical = new Vector3(0, 1, 0);
  const screenUp = new Vector3(0, Math.cos(CAMERA_ELEVATION_RAD), -Math.sin(CAMERA_ELEVATION_RAD));
  const corner = new Vector3();
  let halfWidth = 0;
  let halfHeight = 0;

  for (let sample = 0; sample <= FRAMING_SAMPLES; sample += 1) {
    const heading =
      (RESTING_TURN + SWAY_TURN * Math.sin((sample / FRAMING_SAMPLES) * FULL_TURN_RADIANS)) *
      FULL_TURN_RADIANS;

    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          corner.set(x, y, z).sub(centre).applyAxisAngle(vertical, heading);
          halfWidth = Math.max(halfWidth, Math.abs(corner.x));
          halfHeight = Math.max(halfHeight, Math.abs(corner.dot(screenUp)));
        }
      }
    }
  }

  return { halfWidth, halfHeight };
}

/**
 * Light levels, and why there are four sources.
 *
 * The hemisphere is the sky: cool-white from above, backdrop-dark from below,
 * so floors are lit and undersides are not. The key is the sun, and the only
 * light that casts a shadow — it is what gives each wall a cut-out edge on the
 * floor and the whole flat a drop shadow on the backdrop. The fill is warm and
 * comes from the far side so the shadowed faces are not black. Ambient only
 * lifts the darkest corners. Then the lamps in the plan do the rest: each
 * pendant, floor lamp and ceiling light is a warm point source of its own.
 */
const HEMISPHERE_INTENSITY = 0.75;
const KEY_LIGHT_INTENSITY = 2.8;
const FILL_LIGHT_INTENSITY = 0.6;
const AMBIENT_INTENSITY = 0.2;
const SHADOW_MAP_SIZE = 2048;
const TONE_MAPPING_EXPOSURE = 1.05;

/**
 * Builds the scene, starts the turn, and hands back the way to stop it.
 *
 * @param canvas The element to draw into. It is measured, not resized by this.
 * @returns A handle whose `dispose` cancels the loop and frees every buffer.
 *
 * @example
 * const handle = mountHouseScene(canvasRef.current);
 * return () => { handle.dispose(); };
 */
export function mountHouseScene(canvas: HTMLCanvasElement): HouseSceneHandle {
  const palette = readPalette();
  const materials = createMaterials(palette);

  const house = buildHouse(materials);

  // Turn about the middle of the plan rather than the corner the drawing starts at.
  const bounds = new Box3().setFromObject(house);
  const centre = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  house.position.set(-centre.x, -centre.y, -centre.z);

  const pivot = new Group();
  pivot.add(house);

  // The backdrop catches the flat's shadow and nothing else: a `ShadowMaterial`
  // is invisible except where a shadow falls, so the clear colour shows through.
  const groundMaterial = new ShadowMaterial({ opacity: 0.45 });
  const ground = new Mesh(new PlaneGeometry(CAMERA_DISTANCE * 2, CAMERA_DISTANCE * 2), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  // A hair under the slab's underside, so the two planes never fight for the pixel.
  ground.position.y = -centre.y - toSceneLength(SLAB_THICKNESS_MM) - 0.01;
  ground.receiveShadow = true;

  const scene = new Scene();
  scene.add(pivot);
  scene.add(ground);
  scene.add(new HemisphereLight(palette.plaster, palette.backdrop, HEMISPHERE_INTENSITY));
  scene.add(new AmbientLight(palette.lamp, AMBIENT_INTENSITY));

  const key = new DirectionalLight(palette.plaster, KEY_LIGHT_INTENSITY);
  key.position.set(size.x * 0.5, size.y * 6, size.z * 0.7);
  key.castShadow = true;
  key.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;

  const reach = Math.hypot(size.x, size.z) * 0.6;
  key.shadow.camera.left = -reach;
  key.shadow.camera.right = reach;
  key.shadow.camera.top = reach;
  key.shadow.camera.bottom = -reach;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = reach * 4;
  scene.add(key);

  const fill = new DirectionalLight(palette.lamp, FILL_LIGHT_INTENSITY);
  fill.position.set(-size.x, size.y * 1.5, -size.z);
  scene.add(fill);

  const camera = new OrthographicCamera(-1, 1, 1, -1, CAMERA_NEAR, CAMERA_FAR);
  camera.position.set(
    0,
    CAMERA_DISTANCE * Math.sin(CAMERA_ELEVATION_RAD),
    CAMERA_DISTANCE * Math.cos(CAMERA_ELEVATION_RAD),
  );
  camera.lookAt(0, 0, 0);

  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setClearColor(palette.backdrop, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;

  const { halfWidth: halfWidthNeeded, halfHeight: halfHeightNeeded } = swayExtents(bounds, centre);

  const resize = (): void => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (width === 0 || height === 0) {
      return;
    }

    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2));
    renderer.setSize(width, height, false);

    const aspect = width / height;
    const widthLimited = halfWidthNeeded / halfHeightNeeded > aspect;
    const halfWidth = widthLimited ? halfWidthNeeded * FRAMING_MARGIN : halfHeightNeeded * FRAMING_MARGIN * aspect;
    const halfHeight = halfWidth / aspect;

    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
  };

  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  const stillness = globalThis.matchMedia('(prefers-reduced-motion: reduce)');
  let frame: number | null = null;
  let startedAt: number | null = null;

  const draw = (nowMs: number): void => {
    startedAt ??= nowMs;
    pivot.rotation.y = headingAt(nowMs - startedAt);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(draw);
  };

  const parked = (): void => {
    pivot.rotation.y = RESTING_TURN * FULL_TURN_RADIANS;
    renderer.render(scene, camera);
  };

  const applyMotionSetting = (): void => {
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }

    if (stillness.matches) {
      parked();

      return;
    }

    startedAt = null;
    frame = requestAnimationFrame(draw);
  };

  applyMotionSetting();
  stillness.addEventListener('change', applyMotionSetting);

  return {
    dispose: () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }

      stillness.removeEventListener('change', applyMotionSetting);
      observer.disconnect();

      scene.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
        }
      });

      for (const material of materials.all) {
        material.map?.dispose();
        material.dispose();
      }
      groundMaterial.dispose();
      key.shadow.dispose();
      renderer.dispose();
    },
  };
}
