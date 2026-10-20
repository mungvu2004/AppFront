/**
 * The WebGL side of the stage: renderer, camera, daylight, environment, ground.
 *
 * One dominant sun from front-left-high (the camera side: the journey looks
 * at the house from -z) casts every shadow; its shadow camera
 * is fitted to the 12 × 9 m house and the ground its shadow falls on, so the
 * map's texels go where the picture is. The HDRI (light only — the studio
 * photo shows a room) and a weak hemisphere fill the shadow side; they are
 * kept low so a shadow reads as a shadow, not as a slightly greyer wall.
 *
 * The ground is not a lit plane: it is the background colour, with a
 * shadow catcher just under the slab top that darkens it only where the sun
 * is blocked. So the paper stays exactly Paper Ivory on screen (the
 * background is written as the tone curve's pre-image, see `tone.ts`) and
 * the house still stands on it with a soft cast shadow and contact AO.
 *
 * Needs a live WebGL2 context; exercised in the browser only (untested by design).
 */

import {
  Color,
  DirectionalLight,
  EquirectangularReflectionMapping,
  HemisphereLight,
  Mesh,
  NeutralToneMapping,
  NoToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  WebGLRenderer,
  type Texture,
  type WebGLRenderTarget,
} from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

import { createStudioScene, disposeStudioScene } from '@/lib/three/present';

import { LANDING_PALETTE } from '../palette';

import type { QualitySettings } from './quality';
import { inverseNeutral } from './tone';

/** Thrown when the browser cannot give a WebGL2 context; the screen shows its static fallback. */
export class NoWebGL2Error extends Error {
  constructor() {
    super('WebGL2 is not available');
    this.name = 'NoWebGL2Error';
  }
}

export const HDRI_URL = '/landing/hdri/studio_1k.hdr';
/** Middle of the 12 × 9 m footprint (plan origin at scene origin). */
export const HOUSE_CENTRE = { x: 6, z: 4.5 } as const;
/** The shadow catcher: wide enough that its edge never enters a frame. */
const CATCHER_SIZE = 80;
/** Just under the ground slab's top, so walls meet their shadow with no gap. */
const CATCHER_Y = -0.001;
/** How dark a full sun shadow is on the paper (warm graphite, not black). */
const CATCHER_OPACITY = 0.42;
const CATCHER_COLOUR = 0x2a2620;
/** Same exposure for every frame of the journey (Prompt 4). */
export const EXPOSURE = 1;
const SUN_INTENSITY = 2.6;
const SUN_OFFSET = { x: -8, y: 12, z: -10 } as const;
/** Half-extent of the shadow camera: covers the house and its cast shadow, no more. */
const SHADOW_HALF = 10;
const SHADOW_RADIUS = 5;
const HEMI_INTENSITY = 0.5;
const ENV_INTENSITY = 0.55;
const FOV = 35;

export interface StageRenderer {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly sun: DirectionalLight;
  /** Darkens the background ground where the sun is blocked (lit tiers only). */
  readonly ground: Mesh<PlaneGeometry, ShadowMaterial>;
  configure(settings: QualitySettings): void;
  /** HDRI → PMREM, falling back to present's studio box. Resolves either way. */
  loadEnvironment(): Promise<void>;
  dispose(): void;
}

export function createStageRenderer(canvas: HTMLCanvasElement): StageRenderer {
  const context = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance' });
  if (context === null) {
    throw new NoWebGL2Error();
  }
  const renderer = new WebGLRenderer({ canvas, context, antialias: false });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMappingExposure = EXPOSURE;
  renderer.shadowMap.type = PCFShadowMap;
  // Pre-image of the paper under the tone curve: on screen it is Paper Ivory.
  const paper = inverseNeutral(new Color(LANDING_PALETTE.paper));
  renderer.setClearColor(paper, 1);

  const scene = new Scene();
  scene.background = paper;
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 200);

  const sun = new DirectionalLight(0xfffaf3, SUN_INTENSITY);
  sun.position.set(HOUSE_CENTRE.x + SUN_OFFSET.x, SUN_OFFSET.y, HOUSE_CENTRE.z + SUN_OFFSET.z);
  sun.target.position.set(HOUSE_CENTRE.x, 0, HOUSE_CENTRE.z);
  sun.castShadow = true;
  const shadowCamera = sun.shadow.camera;
  shadowCamera.left = -SHADOW_HALF;
  shadowCamera.right = SHADOW_HALF;
  shadowCamera.top = SHADOW_HALF;
  shadowCamera.bottom = -SHADOW_HALF;
  shadowCamera.near = 1;
  shadowCamera.far = 45;
  sun.shadow.radius = SHADOW_RADIUS;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.015;
  scene.add(sun, sun.target);
  scene.add(new HemisphereLight(0xf4f4f2, 0xdcd8d0, HEMI_INTENSITY));

  const ground = new Mesh(
    new PlaneGeometry(CATCHER_SIZE, CATCHER_SIZE),
    new ShadowMaterial({ color: CATCHER_COLOUR, opacity: CATCHER_OPACITY }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(HOUSE_CENTRE.x, CATCHER_Y, HOUSE_CENTRE.z);
  ground.receiveShadow = true;
  ground.renderOrder = -4;
  scene.add(ground);

  let envTarget: WebGLRenderTarget | null = null;
  let hdr: Texture | null = null;
  let disposed = false;

  const setEnvironment = (make: (pmrem: PMREMGenerator) => WebGLRenderTarget): void => {
    const pmrem = new PMREMGenerator(renderer);
    envTarget?.dispose();
    envTarget = make(pmrem);
    pmrem.dispose();
    scene.environment = envTarget.texture;
    scene.environmentIntensity = ENV_INTENSITY;
  };

  return {
    renderer,
    scene,
    camera,
    sun,
    ground,
    configure(settings) {
      renderer.shadowMap.enabled = settings.shadows;
      sun.castShadow = settings.shadows;
      if (sun.shadow.mapSize.x !== settings.shadowMapSize) {
        sun.shadow.mapSize.set(settings.shadowMapSize, settings.shadowMapSize);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
      // Tone map once: in the composer's last pass, or here when there is no composer.
      renderer.toneMapping = settings.composer ? NoToneMapping : NeutralToneMapping;
      ground.visible = settings.shadows;
    },
    async loadEnvironment() {
      try {
        const texture = await new HDRLoader().loadAsync(HDRI_URL);
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.mapping = EquirectangularReflectionMapping;
        hdr = texture;
        setEnvironment((pmrem) => pmrem.fromEquirectangular(texture));
      } catch {
        if (disposed) {
          return;
        }
        const studio = createStudioScene();
        setEnvironment((pmrem) => pmrem.fromScene(studio, 0.04));
        disposeStudioScene(studio);
      }
    },
    dispose() {
      disposed = true;
      envTarget?.dispose();
      hdr?.dispose();
      sun.shadow.dispose();
      ground.geometry.dispose();
      ground.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
