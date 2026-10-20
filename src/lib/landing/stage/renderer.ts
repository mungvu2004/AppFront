/**
 * The WebGL side of the stage: renderer, camera, daylight, environment, sheet.
 *
 * One dominant sun from front-left-high casts every shadow; its shadow camera
 * is fitted to the 12 × 9 m house and the sheet around it, nothing more, so
 * the map's texels go where the picture is. A hemisphere light and the HDRI's
 * reflections fill the shadow side. The background is the paper, never the
 * HDRI: the studio photo contains a visible room and is for light only.
 *
 * Needs a live WebGL2 context; exercised in the browser only (untested by design).
 */

import {
  AgXToneMapping,
  Color,
  DirectionalLight,
  EquirectangularReflectionMapping,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  NoToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type Texture,
  type WebGLRenderTarget,
} from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

import { createStudioScene, disposeStudioScene } from '@/lib/three/present';

import { LANDING_PALETTE } from '../palette';

import type { QualitySettings } from './quality';

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
/** The sheet the drawing sits on, a little larger than the house. */
const SHEET_SIZE = { x: 20, z: 15 } as const;
/** Just under the ground slab's underside (150 mm), so the two never fight. */
const SHEET_Y = -0.16;
/** Same exposure for every frame of the journey (Prompt 4). */
export const EXPOSURE = 1;
const SUN_INTENSITY = 2.6;
const SUN_OFFSET = { x: -9, y: 16, z: 11 } as const;
/** Half-extent of the shadow camera: covers house + sheet from the sun's lean. */
const SHADOW_HALF = 12;
const SHADOW_RADIUS = 4;
const HEMI_INTENSITY = 0.9;
const ENV_INTENSITY = 0.55;
const FOV = 35;

export interface StageRenderer {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly sun: DirectionalLight;
  readonly sheet: Mesh<PlaneGeometry, MeshStandardMaterial>;
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
  const paper = new Color(LANDING_PALETTE.paper);
  renderer.setClearColor(paper, 1);

  const scene = new Scene();
  scene.background = paper;
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 200);

  const sun = new DirectionalLight(0xfff6ea, SUN_INTENSITY);
  sun.position.set(HOUSE_CENTRE.x + SUN_OFFSET.x, SUN_OFFSET.y, HOUSE_CENTRE.z + SUN_OFFSET.z);
  sun.target.position.set(HOUSE_CENTRE.x, 0, HOUSE_CENTRE.z);
  sun.castShadow = true;
  const shadowCamera = sun.shadow.camera;
  shadowCamera.left = -SHADOW_HALF;
  shadowCamera.right = SHADOW_HALF;
  shadowCamera.top = SHADOW_HALF;
  shadowCamera.bottom = -SHADOW_HALF;
  shadowCamera.near = 1;
  shadowCamera.far = 50;
  sun.shadow.radius = SHADOW_RADIUS;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  scene.add(new HemisphereLight(0xf7f3ec, 0xd9d2c4, HEMI_INTENSITY));

  const sheet = new Mesh(
    new PlaneGeometry(SHEET_SIZE.x, SHEET_SIZE.z),
    new MeshStandardMaterial({ color: paper, roughness: 1, metalness: 0, transparent: true }),
  );
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.set(HOUSE_CENTRE.x, SHEET_Y, HOUSE_CENTRE.z);
  sheet.receiveShadow = true;
  scene.add(sheet);

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
    sheet,
    configure(settings) {
      renderer.shadowMap.enabled = settings.shadows;
      sun.castShadow = settings.shadows;
      if (sun.shadow.mapSize.x !== settings.shadowMapSize) {
        sun.shadow.mapSize.set(settings.shadowMapSize, settings.shadowMapSize);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
      // Tone map once: in the composer's last pass, or here when there is no composer.
      renderer.toneMapping = settings.composer ? NoToneMapping : AgXToneMapping;
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
      sheet.geometry.dispose();
      sheet.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
