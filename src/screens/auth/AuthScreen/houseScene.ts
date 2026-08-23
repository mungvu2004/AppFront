/**
 * The model on the sign-in panel: a JSON plan, put through the product's own builder.
 *
 * `houseModel.json` is a fixed drawing — walls as centrelines in millimetres,
 * openings placed along them, rooms as outlines, two storeys. It is fed to
 * `buildFloorMesh` from `src/lib/three/build`, which is the same function the
 * viewer uses: it extrudes each wall, **cuts the door and window openings out of
 * it**, and lays the floor and ceiling slabs. So the house on this screen is not
 * an illustration of the product — it is the product, run once on a small plan.
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
 *   right to: the palette is themed through CSS custom properties, so the scene
 *   reads `--bg-surface` and friends off the document at mount. A hex here would
 *   be a fourth place the palette lives, and the one that never follows a theme.
 * - **No timing literals.** The turn is paced in whole {@link AMBIENT_LOOP_MS}
 *   beats, the same token the CSS animations use, so rule B holds on both sides.
 * - **It stops when asked.** `prefers-reduced-motion` parks the model at its
 *   opening angle and never schedules a frame.
 *
 * Everything is created inside {@link mountHouseScene} and released by the
 * handle it returns; nothing is held at module scope, so a route that unmounts
 * gives back its GPU memory.
 */

import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Box3,
  Color,
  DirectionalLight,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  DoubleSide,
  Scene,
  Sphere,
  Vector3,
  WebGLRenderer,
  type Material,
} from 'three';

import type { Opening } from '@/domain/openings/types';
import type { LevelId, OpeningId, RoomId, SwingDirection, WallId } from '@/domain/spatial/types';
import { millimetres, type Millimetres } from '@/domain/units/types';
import type { Wall, WallKind } from '@/domain/walls/types';
import { AMBIENT_LOOP_MS } from '@/lib/motion';
import { buildFloorMesh } from '@/lib/three/build/floor';
import { toSceneLength } from '@/lib/three/build/scene';

import plan from './houseModel.json';

/* -------------------------------------------------------------------------- */
/* The plan, as the builders want it.                                          */
/* -------------------------------------------------------------------------- */

/** One full turn, in whole ambient beats. Thirty of them is twenty-one seconds. */
const TURN_BEATS = 30;
const TURN_PERIOD_MS = AMBIENT_LOOP_MS * TURN_BEATS;

/** How much of a turn has passed, as a fraction, at a given moment. */
const turnFraction = (elapsedMs: number): number => (elapsedMs % TURN_PERIOD_MS) / TURN_PERIOD_MS;

const FULL_TURN_RADIANS = Math.PI * 2;

/** Roof pitch is declared in the plan; the eaves sit on the top storey. */
const ROOF_RISE_MM: Millimetres = millimetres(plan.roof.riseMm);

interface PlanWall {
  readonly id: string;
  readonly levelId: string;
  readonly kind: string;
  readonly thicknessMm: number;
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
function toDomainWall(wall: PlanWall, elevationMm: number, heightMm: number): Wall {
  return {
    id: wall.id as WallId,
    kind: wall.kind as WallKind,
    centreline: {
      start: { x: millimetres(wall.start[0] ?? 0), y: millimetres(wall.start[1] ?? 0) },
      end: { x: millimetres(wall.end[0] ?? 0), y: millimetres(wall.end[1] ?? 0) },
    },
    thicknessMm: millimetres(wall.thicknessMm),
    baseElevationMm: millimetres(elevationMm),
    topElevationMm: millimetres(elevationMm + heightMm),
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

/** Every storey of the plan, built and merged into one group. */
function buildHouse(): Group {
  const house = new Group();
  const openings = plan.openings.map(toDomainOpening);

  for (const level of plan.levels) {
    const walls = plan.walls
      .filter((wall) => wall.levelId === level.id)
      .map((wall) => toDomainWall(wall, level.elevationMm, level.heightMm));

    const rooms = plan.rooms
      .filter((room) => room.levelId === level.id)
      .map((room) => ({
        id: room.id as RoomId,
        outline: room.outline.map(([x, y]) => ({ x: millimetres(x ?? 0), y: millimetres(y ?? 0) })),
      }));

    house.add(
      buildFloorMesh({
        level: {
          id: level.id as LevelId,
          elevationMm: millimetres(level.elevationMm),
          heightMm: millimetres(level.heightMm),
        },
        walls,
        rooms,
        openings,
      }),
    );
  }

  house.add(buildRoof());

  return house;
}

/**
 * A gable roof, written out as triangles.
 *
 * `src/lib/three/build` has no roof builder — the product reads plans, and a
 * plan does not describe one — so this is the single piece of geometry on the
 * screen that is authored rather than derived. Two slopes and two gable ends,
 * eighteen vertices, no indexing: at this size an index buffer costs more to
 * read than it saves.
 */
function buildRoof(): Mesh {
  const eaveY = toSceneLength(
    millimetres(
      plan.levels.reduce((highest, level) => Math.max(highest, level.elevationMm + level.heightMm), 0),
    ),
  );
  const ridgeY = eaveY + toSceneLength(ROOF_RISE_MM);
  const spanX = toSceneLength(millimetres(plan.footprint.widthMm));
  const spanZ = toSceneLength(millimetres(plan.footprint.depthMm));
  const ridgeZ = spanZ / 2;

  const eaveFrontLeft = [0, eaveY, 0];
  const eaveFrontRight = [spanX, eaveY, 0];
  const eaveBackLeft = [0, eaveY, spanZ];
  const eaveBackRight = [spanX, eaveY, spanZ];
  const ridgeLeft = [0, ridgeY, ridgeZ];
  const ridgeRight = [spanX, ridgeY, ridgeZ];

  const triangles = [
    // Front slope.
    eaveFrontLeft, eaveFrontRight, ridgeRight,
    eaveFrontLeft, ridgeRight, ridgeLeft,
    // Back slope.
    ridgeLeft, ridgeRight, eaveBackRight,
    ridgeLeft, eaveBackRight, eaveBackLeft,
    // Gable ends.
    eaveFrontLeft, ridgeLeft, eaveBackLeft,
    eaveFrontRight, eaveBackRight, ridgeRight,
  ].flat();

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(triangles), 3));
  geometry.computeVertexNormals();

  return new Mesh(geometry);
}

/* -------------------------------------------------------------------------- */
/* Palette.                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A design token, resolved to a colour the renderer understands.
 *
 * Read off the document rather than written down, so the model follows the theme
 * the rest of the screen is painted in and `local/no-raw-color` has nothing to
 * complain about.
 */
function tokenColour(name: string, fallback: Color): Color {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  if (raw === '') {
    return fallback;
  }

  try {
    return new Color(raw);
  } catch {
    return fallback;
  }
}

/* -------------------------------------------------------------------------- */
/* Mounting.                                                                   */
/* -------------------------------------------------------------------------- */

/** What the caller keeps so it can give the GPU memory back. */
export interface HouseSceneHandle {
  readonly dispose: () => void;
}

const CAMERA_FIELD_OF_VIEW = 34;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 200;

/** Air left around the model once it is framed, as a fraction of its radius. */
const FRAMING_MARGIN = 1.02;

/** How far above the model the camera sits, as a fraction of its distance. */
const CAMERA_PITCH = 0.42;

/** Angle the model rests at when motion is switched off — three-quarter view. */
const RESTING_TURN = 0.08;

/**
 * Light levels, and why they are not equal.
 *
 * A first pass lit this almost entirely with ambient, and every wall came back
 * the same flat white: with no direction there is nothing to tell one face from
 * another, so a house reads as a paper cut-out. The key light does the shaping;
 * ambient only lifts the shadow side far enough to stay on a pale panel; the
 * fill keeps the away side from going to mud.
 */
/**
 * Below this angle two faces are treated as one surface and no line is drawn
 * between them, which keeps the extruder's own tessellation off the drawing.
 */
const EDGE_ANGLE_DEG = 18;

const AMBIENT_INTENSITY = 0.85;
const KEY_LIGHT_INTENSITY = 2.6;
const FILL_LIGHT_INTENSITY = 0.7;

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
  const surface = tokenColour('--bg-surface', new Color(1, 1, 1));
  const roofColour = tokenColour('--text-muted', new Color(0.6, 0.59, 0.57));
  const outline = tokenColour('--text-secondary', new Color(0.42, 0.41, 0.38));

  const wallMaterial = new MeshStandardMaterial({ color: surface, roughness: 1, metalness: 0 });
  // `DoubleSide` because the roof is a surface, not a solid: its two slopes and
  // two gable ends are single triangles, and the near slope was being culled —
  // you could see through it into the far one.
  const roofMaterial = new MeshStandardMaterial({
    color: roofColour,
    roughness: 1,
    metalness: 0,
    side: DoubleSide,
  });

  const house = buildHouse();
  const roof = house.children.at(-1);

  /**
   * Solid faces read the light; the lines read the drawing.
   *
   * Without them every wall meets every other wall in the same white and the
   * house turns to mush at this size — the shape is only legible where a shadow
   * happens to fall. Outlining each mesh is what makes the openings show as
   * openings rather than as faint smudges, and it is the same way the product
   * draws a plan.
   */
  const edgeMaterial = new LineBasicMaterial({ color: outline });
  const outlined: LineSegments[] = [];

  house.traverse((object) => {
    if (object instanceof Mesh) {
      object.material = object === roof ? roofMaterial : wallMaterial;
      outlined.push(new LineSegments(new EdgesGeometry(object.geometry, EDGE_ANGLE_DEG), edgeMaterial));
    }
  });

  for (const lines of outlined) {
    house.add(lines);
  }

  // Turn about the middle of the plan rather than the corner the drawing starts at.
  const bounds = new Box3().setFromObject(house);
  const centre = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  house.position.set(-centre.x, -centre.y, -centre.z);

  const pivot = new Group();
  pivot.add(house);

  const scene = new Scene();
  scene.add(pivot);
  scene.add(new AmbientLight(surface, AMBIENT_INTENSITY));

  const key = new DirectionalLight(surface, KEY_LIGHT_INTENSITY);
  key.position.set(size.x, size.y * 2.2, size.z * 1.6);
  scene.add(key);

  const fill = new DirectionalLight(surface, FILL_LIGHT_INTENSITY);
  fill.position.set(-size.x, size.y * 0.6, -size.z);
  scene.add(fill);

  const radius = bounds.getBoundingSphere(new Sphere()).radius;
  const camera = new PerspectiveCamera(CAMERA_FIELD_OF_VIEW, 1, CAMERA_NEAR, CAMERA_FAR);

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearAlpha(0);

  const resize = (): void => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (width === 0 || height === 0) {
      return;
    }

    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;

    // Frame from the bounding sphere so the house fits whatever shape the panel
    // is, and re-frame on resize: a wide short canvas is limited by its height,
    // a narrow tall one by its width, and only the aspect can say which.
    const halfFovY = (CAMERA_FIELD_OF_VIEW * Math.PI) / 360;
    const halfFovX = Math.atan(Math.tan(halfFovY) * camera.aspect);
    const distance = (radius / Math.sin(Math.min(halfFovY, halfFovX))) * FRAMING_MARGIN;

    camera.position.set(0, distance * CAMERA_PITCH, distance);
    camera.lookAt(0, 0, 0);
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
    pivot.rotation.y = turnFraction(nowMs - startedAt) * FULL_TURN_RADIANS;
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
        if (object instanceof Mesh || object instanceof LineSegments) {
          object.geometry.dispose();

          const material: Material | Material[] = object.material;
          const list = Array.isArray(material) ? material : [material];

          for (const entry of list) {
            entry.dispose();
          }
        }
      });

      renderer.dispose();
    },
  };
}
