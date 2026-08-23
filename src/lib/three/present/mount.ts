/**
 * A plan on a canvas: the one function in `present/` that touches a renderer.
 *
 * Everything before this point — reading the palette, building and dressing the
 * storeys, placing the furniture, hanging the lights, fitting the frame — is
 * arithmetic that runs anywhere. This file is the thin shell that puts it on
 * screen: a WebGL renderer with shadows and filmic tone mapping, a long-lens
 * perspective camera on the rig, a studio environment for the materials to
 * reflect, a ground that catches the flat's drop shadow, and a loop that sways
 * the model or parks it when the visitor has asked for no motion.
 *
 * Three decisions here are about not doing work:
 *
 * - **The shadow map is drawn once.** It is the camera that sways, on an orbit
 *   about the house, not the house under a fixed sun: the lights and their
 *   shadows never move, so the map drawn for the first frame is right for
 *   every other. It is redrawn only when the picture changes — a model
 *   arriving. (On screen the two are the same motion; the director's numbers
 *   describe the model's heading, and the orbit is its negative.)
 * - **Frames are drawn on demand.** `frameLoop.ts` draws only when the sway
 *   has moved the rim of the model by a pixel, at most thirty times a second,
 *   and not at all while the tab is hidden, the canvas is off screen or the
 *   window has lost focus.
 * - **Pixels are capped.** A high-density display gets one and a half device
 *   pixels per CSS pixel, not three; at this canvas size the difference is
 *   invisible and the cost is more than double.
 *
 * Everything is created inside {@link mountPresentation} and released by the
 * handle it returns; nothing is held at module scope, so a route that unmounts
 * gives back its GPU memory — the context included — and aborts any model
 * still downloading.
 */

import {
  ACESFilmicToneMapping,
  BasicShadowMap,
  Box3,
  Group,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShadowMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';

import { SLAB_THICKNESS_MM } from '../build/plan';
import { toSceneLength } from '../build/scene';

import { assembleHouse, type AssembledHouse } from './assemble';
import type { AssetService } from './assets';
import {
  applyFieldOfView,
  cameraPosition,
  fitFieldOfView,
  frameAim,
  headingAt,
  headingStep,
  resolveRig,
  restingHeading,
  rimRadius,
  swayExtents,
  type CameraRig,
} from './director';
import { applyRoomEnvironment } from './environment';
import { createFrameLoop } from './frameLoop';
import { createLighting } from './lighting';
import { createMaterials, disposeMaterials } from './materials';
import { readPalette, type TokenReader } from './palette';
import type { PlanFurniture, PresentationPlan } from './plan';
import { watchPresence } from './presence';

/* -------------------------------------------------------------------------- */
/* Options and handle.                                                         */
/* -------------------------------------------------------------------------- */

export interface PresentationOptions {
  /** Camera numbers to override; the defaults are the tuned ones. */
  readonly rig?: Partial<CameraRig>;
  /** Where `.glb` files come from. Absent: every piece stays procedural. */
  readonly assets?: AssetService;
  /** Told about each piece that kept its procedural geometry, and why. */
  readonly onFallback?: (entry: PlanFurniture, reason: unknown) => void;
  /** Where token values come from; the document by default. */
  readonly readToken?: TokenReader;
}

/** What the caller keeps so it can give the GPU memory back. */
export interface PresentationHandle {
  readonly dispose: () => void;
  /** Settles once every piece is final — useful to a screenshot or a test. */
  readonly settled: Promise<void>;
  /** Openings the builder refused and rooms with an unknown finish, for a log. */
  readonly report: Pick<AssembledHouse, 'refusals' | 'unknownFinishes' | 'lights'>;
}

/* -------------------------------------------------------------------------- */
/* Constants.                                                                  */
/* -------------------------------------------------------------------------- */

const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 100;

/**
 * How far back the camera sits. With a perspective camera this is the lens:
 * forty metres from a flat twelve across is a long lens — enough convergence
 * that the far walls read as farther, not so much that the plan distorts.
 */
const CAMERA_DISTANCE = 40;

/** A touch under one: the lamps should read as the bright things in the frame. */
const TONE_MAPPING_EXPOSURE = 0.86;

/** How dark the flat's drop shadow is on the backdrop. */
const GROUND_SHADOW_OPACITY = 0.45;

/** A hair under the slab's underside, so the two planes never fight for the pixel. */
const GROUND_DROP = 0.01;

/**
 * How far past the model's footprint the ground reaches, in scene units. The
 * ground exists only to catch the drop shadow, which falls a wall's height
 * times the sun's lean beyond the walls; every pixel of ground past that is a
 * pixel of shadow-map lookups for nothing. Nothing under the lights moves, so
 * the ground can be a rectangle fitted to the footprint rather than a square
 * fitted to its turning circle.
 */
const GROUND_MARGIN = 2.5;

/** The most device pixels drawn per CSS pixel. */
export const MAX_PIXEL_RATIO = 1.5;

/** How far the rim of the model has to move on screen before a frame is worth drawing. */
const REDRAW_THRESHOLD_PX = 1;

/* -------------------------------------------------------------------------- */
/* Mounting.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Build the scene for `plan`, start the sway, and hand back the way to stop it.
 *
 * @param canvas The element to draw into. It is measured, not resized by this.
 *
 * @example
 * const handle = mountPresentation(canvasRef.current, plan, { assets });
 * return () => { handle.dispose(); };
 */
export function mountPresentation(
  canvas: HTMLCanvasElement,
  plan: PresentationPlan,
  options: PresentationOptions = {},
): PresentationHandle {
  const rig = resolveRig(options.rig);
  const palette = readPalette(options.readToken);
  const materials = createMaterials(palette);
  const aborter = new AbortController();

  const assembled = assembleHouse(plan, palette, materials, {
    signal: aborter.signal,
    ...(options.assets === undefined ? {} : { assets: options.assets }),
    ...(options.onFallback === undefined ? {} : { onFallback: options.onFallback }),
  });
  const { house } = assembled;

  // Turn about the middle of the plan rather than the corner the drawing starts at.
  const bounds = new Box3().setFromObject(house);
  const centre = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  house.position.set(-centre.x, -centre.y, -centre.z);

  const scene = new Scene();
  scene.add(house);

  const lighting = createLighting(palette, size);
  for (const light of lighting.lights) {
    scene.add(light);
  }
  scene.add(lighting.key.target);

  // The backdrop catches the flat's shadow and nothing else: a `ShadowMaterial`
  // is invisible except where a shadow falls, so the clear colour shows through.
  // It is no bigger than the shadow can be.
  const groundMaterial = new ShadowMaterial({ opacity: GROUND_SHADOW_OPACITY });
  const ground = new Mesh(
    new PlaneGeometry(size.x + GROUND_MARGIN * 2, size.z + GROUND_MARGIN * 2),
    groundMaterial,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -centre.y - toSceneLength(SLAB_THICKNESS_MM) - GROUND_DROP;
  ground.receiveShadow = true;
  scene.add(ground);

  // Aimed a little below the model's centre so the near half, which looms
  // larger in perspective, does not push the far half off the top of the frame.
  // The camera sits on an orbit about the model's axis; turning the orbit by
  // the negative of the model's heading shows the same picture as turning the
  // model, with nothing under the lights having moved.
  const aim = frameAim(bounds, centre, rig, CAMERA_DISTANCE);
  const camera = new PerspectiveCamera(1, 1, CAMERA_NEAR, CAMERA_FAR);
  camera.position.copy(cameraPosition(rig, CAMERA_DISTANCE)).add(aim);
  camera.lookAt(aim);
  const orbit = new Group();
  orbit.add(camera);
  scene.add(orbit);

  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setClearColor(palette.backdrop, 1);
  renderer.shadowMap.enabled = true;
  // One tap per pixel. The map is dense enough — a centimetre a texel — that
  // a filtered edge would be softer than the cut it is drawing, and the nine
  // taps of a soft map are a tenth of the frame on an integrated GPU.
  renderer.shadowMap.type = BasicShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;

  const environment = applyRoomEnvironment(renderer, scene);
  const extents = swayExtents(bounds, centre, rig, CAMERA_DISTANCE, aim);
  const rim = rimRadius(bounds, centre);

  const loop = createFrameLoop({
    headingAt: (elapsedMs) => headingAt(rig, elapsedMs),
    restingHeading: restingHeading(rig),
    minStep: () =>
      headingStep(rim, renderer.getDrawingBufferSize(new Vector2()).y, camera.fov, CAMERA_DISTANCE, REDRAW_THRESHOLD_PX),
    render: (heading) => {
      orbit.rotation.y = -heading;
      renderer.render(scene, camera);
    },
  });

  const resize = (): void => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (width === 0 || height === 0) {
      return;
    }

    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.setSize(width, height, false);
    applyFieldOfView(camera, fitFieldOfView(extents, width / height, rig, CAMERA_DISTANCE), width / height);
    loop.invalidate();
  };

  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  const stillness = globalThis.matchMedia('(prefers-reduced-motion: reduce)');
  const applyMotionSetting = (): void => {
    loop.setGate('motion', !stillness.matches);
  };
  applyMotionSetting();
  stillness.addEventListener('change', applyMotionSetting);

  const presence = watchPresence(canvas, (gate, open) => {
    loop.setGate(gate, open);
  });
  // The first frame is owed whatever the gates and the canvas size say.
  loop.invalidate();

  // A model arriving changes the picture and its shadows: both are redrawn once.
  const settled = Promise.all(assembled.pieces.map((piece) => piece.ready)).then(() => {
    if (!aborter.signal.aborted) {
      renderer.shadowMap.needsUpdate = true;
      loop.invalidate();
    }
  });

  return {
    settled,
    report: { refusals: assembled.refusals, unknownFinishes: assembled.unknownFinishes, lights: assembled.lights },
    dispose: () => {
      aborter.abort();
      loop.dispose();
      presence.dispose();
      stillness.removeEventListener('change', applyMotionSetting);
      observer.disconnect();
      environment.dispose();

      scene.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
        }
      });

      disposeMaterials(materials);
      groundMaterial.dispose();
      lighting.key.shadow.dispose();
      renderer.dispose();
      // `dispose` releases what three tracks; the context itself — and the few
      // textures and programs every renderer makes for its own use — go only
      // when the context does. The canvas is never drawn into again.
      renderer.forceContextLoss();
    },
  };
}
