/**
 * A plan on a canvas: the one function in `present/` that touches a renderer.
 *
 * Everything before this point — reading the palette, building and dressing the
 * storeys, placing the furniture, hanging the lights, fitting the frame — is
 * arithmetic that runs anywhere. This file is the thin shell that puts it on
 * screen: a WebGL renderer with shadows and filmic tone mapping, an
 * orthographic camera on the rig, a studio environment for the materials to
 * reflect, a ground that catches the flat's drop shadow, and a loop that sways
 * the model or parks it when the visitor has asked for no motion.
 *
 * Everything is created inside {@link mountPresentation} and released by the
 * handle it returns; nothing is held at module scope, so a route that unmounts
 * gives back its GPU memory — and aborts any model still downloading.
 */

import {
  ACESFilmicToneMapping,
  Box3,
  Group,
  Mesh,
  OrthographicCamera,
  PCFSoftShadowMap,
  PlaneGeometry,
  Scene,
  ShadowMaterial,
  Vector3,
  WebGLRenderer,
} from 'three';

import { SLAB_THICKNESS_MM } from '../build/plan';
import { toSceneLength } from '../build/scene';

import { assembleHouse, type AssembledHouse } from './assemble';
import type { AssetService } from './assets';
import {
  applyFrustum,
  cameraPosition,
  fitFrustum,
  headingAt,
  resolveRig,
  restingHeading,
  swayExtents,
  type CameraRig,
} from './director';
import { applyRoomEnvironment } from './environment';
import { createLighting } from './lighting';
import { createMaterials, disposeMaterials } from './materials';
import { readPalette, type TokenReader } from './palette';
import type { PlanFurniture, PresentationPlan } from './plan';

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
  readonly report: Pick<AssembledHouse, 'refusals' | 'unknownFinishes'>;
}

/* -------------------------------------------------------------------------- */
/* Constants.                                                                  */
/* -------------------------------------------------------------------------- */

const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 100;

/** How far back the orthographic camera sits. Only has to clear the model. */
const CAMERA_DISTANCE = 40;

const TONE_MAPPING_EXPOSURE = 1;

/** How dark the flat's drop shadow is on the backdrop. */
const GROUND_SHADOW_OPACITY = 0.45;

/** A hair under the slab's underside, so the two planes never fight for the pixel. */
const GROUND_DROP = 0.01;

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

  const pivot = new Group();
  pivot.add(house);

  // The backdrop catches the flat's shadow and nothing else: a `ShadowMaterial`
  // is invisible except where a shadow falls, so the clear colour shows through.
  const groundMaterial = new ShadowMaterial({ opacity: GROUND_SHADOW_OPACITY });
  const ground = new Mesh(new PlaneGeometry(CAMERA_DISTANCE * 2, CAMERA_DISTANCE * 2), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -centre.y - toSceneLength(SLAB_THICKNESS_MM) - GROUND_DROP;
  ground.receiveShadow = true;

  const scene = new Scene();
  scene.add(pivot);
  scene.add(ground);

  const lighting = createLighting(palette, size);
  for (const light of lighting.lights) {
    scene.add(light);
  }

  const camera = new OrthographicCamera(-1, 1, 1, -1, CAMERA_NEAR, CAMERA_FAR);
  camera.position.copy(cameraPosition(rig, CAMERA_DISTANCE));
  camera.lookAt(0, 0, 0);

  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setClearColor(palette.backdrop, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;

  const environment = applyRoomEnvironment(renderer, scene);
  const extents = swayExtents(bounds, centre, rig);

  const resize = (): void => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (width === 0 || height === 0) {
      return;
    }

    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    applyFrustum(camera, fitFrustum(extents, width / height, rig));
  };

  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  const stillness = globalThis.matchMedia('(prefers-reduced-motion: reduce)');
  let frame: number | null = null;
  let startedAt: number | null = null;

  const draw = (nowMs: number): void => {
    startedAt ??= nowMs;
    pivot.rotation.y = headingAt(rig, nowMs - startedAt);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(draw);
  };

  const parked = (): void => {
    pivot.rotation.y = restingHeading(rig);
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

  // A model arriving while parked has to be drawn once, or it is never seen.
  const settled = Promise.all(assembled.pieces.map((piece) => piece.ready)).then(() => {
    if (frame === null && !aborter.signal.aborted) {
      parked();
    }
  });

  return {
    settled,
    report: { refusals: assembled.refusals, unknownFinishes: assembled.unknownFinishes },
    dispose: () => {
      aborter.abort();

      if (frame !== null) {
        cancelAnimationFrame(frame);
      }

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
    },
  };
}
