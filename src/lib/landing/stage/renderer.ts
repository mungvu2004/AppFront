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
  BackSide,
  Color,
  DirectionalLight,
  EquirectangularReflectionMapping,
  Float32BufferAttribute,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  NoToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShadowMaterial,
  SphereGeometry,
  SRGBColorSpace,
  WebGLRenderer,
  type Object3D,
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
/** Middle of the villa's footprint (GF x 4–28, z 9–23; plan origin at scene origin). */
export const HOUSE_CENTRE = { x: 16, z: 16 } as const;
/** The shadow catcher: wide enough that its edge never enters a frame. */
const CATCHER_SIZE = 80;
/** Just under the ground slab's top, so walls meet their shadow with no gap. */
const CATCHER_Y = -0.001;
/** How dark a full sun shadow is on the paper (warm graphite, not black). */
const CATCHER_OPACITY = 0.42;
const CATCHER_COLOUR = 0x2a2620;
/** Same exposure for every frame of the journey (Prompt 4). */
export const EXPOSURE = 1;
/** Sun from front-left, ~32° up (the street side is -z); near-white, so the render reads cool white, not cream (archviz-r2 fix 7). */
const SUN_INTENSITY = 3;
const SUN_COLOUR = 0xfff2e2;
const SUN_OFFSET = { x: -20, y: 18, z: -22 } as const;
/** Half-extent of the shadow camera: the villa, its roofs and their cast shadow (house + 18 m). */
const SHADOW_HALF = 18;
const SHADOW_RADIUS = 3;
const HEMI_INTENSITY = 0.36;
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
  /** A cool gradient-sky PMREM for glass and water (the studio HDRI reflects warm/brown in them). */
  readonly sky: Texture;
  /** Put `sky` on every transparent standard material under `root` (glass, water). */
  skyOn(root: Object3D): void;
  dispose(): void;
}

/**
 * The shadow catcher's material. No depth write: it is drawn first of the transparents (renderOrder -4),
 * and writing depth at y = 0 hid every transparent surface under or behind it (the pond water, glass).
 */
export function catcherMaterial(): ShadowMaterial {
  return new ShadowMaterial({ color: CATCHER_COLOUR, opacity: CATCHER_OPACITY, depthWrite: false });
}

/** A blue-to-pale sky over a grey-green ground, as a PMREM: what glass and water should reflect. */
function skyEnvironment(renderer: WebGLRenderer): WebGLRenderTarget {
  const g = new SphereGeometry(10, 24, 12);
  const pos = g.getAttribute('position');
  const zenith = new Color(0x7fa6cc);
  const horizon = new Color(0xe3ebf0);
  const below = new Color(0x6f7469);
  const c = new Color();
  const colours: number[] = [];
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i) / 10;
    if (y >= 0) c.lerpColors(horizon, zenith, Math.pow(y, 0.6));
    else c.lerpColors(horizon, below, Math.min(1, -y * 4));
    colours.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new Float32BufferAttribute(colours, 3));
  const dome = new Mesh(g, new MeshBasicMaterial({ vertexColors: true, side: BackSide }));
  const sky = new Scene();
  sky.add(dome);
  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromScene(sky, 0.02);
  pmrem.dispose();
  g.dispose();
  dome.material.dispose();
  return target;
}

export function createStageRenderer(canvas: HTMLCanvasElement): StageRenderer {
  // MSAA on the screen buffer: the composer-less tiers' only anti-aliasing (the composer draws into its own target).
  const context = canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance' });
  if (context === null) {
    throw new NoWebGL2Error();
  }
  const renderer = new WebGLRenderer({ canvas, context, antialias: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMappingExposure = EXPOSURE;
  renderer.shadowMap.type = PCFShadowMap;
  // Sun and shadow camera never move: the stage asks for a redraw only when the build changes.
  renderer.shadowMap.autoUpdate = false;
  // Pre-image of the paper under the tone curve: on screen it is Paper Ivory.
  const paperRaw = new Color(LANDING_PALETTE.paper);
  const paper = inverseNeutral(paperRaw.clone());
  renderer.setClearColor(paper, 1);

  const scene = new Scene();
  scene.background = paper;
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 200);

  const sun = new DirectionalLight(SUN_COLOUR, SUN_INTENSITY);
  sun.position.set(HOUSE_CENTRE.x + SUN_OFFSET.x, SUN_OFFSET.y, HOUSE_CENTRE.z + SUN_OFFSET.z);
  sun.target.position.set(HOUSE_CENTRE.x, 0, HOUSE_CENTRE.z);
  sun.castShadow = true;
  const shadowCamera = sun.shadow.camera;
  shadowCamera.left = -SHADOW_HALF;
  shadowCamera.right = SHADOW_HALF;
  shadowCamera.top = SHADOW_HALF;
  shadowCamera.bottom = -SHADOW_HALF;
  shadowCamera.near = 1;
  shadowCamera.far = 90;
  sun.shadow.radius = SHADOW_RADIUS;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  scene.add(new HemisphereLight(0xdde8f2, 0xb9b8a8, HEMI_INTENSITY));

  const ground = new Mesh(
    new PlaneGeometry(CATCHER_SIZE, CATCHER_SIZE),
    catcherMaterial(),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(HOUSE_CENTRE.x, CATCHER_Y, HOUSE_CENTRE.z);
  ground.receiveShadow = true;
  ground.renderOrder = -4;
  scene.add(ground);

  const skyTarget = skyEnvironment(renderer);
  const skyOn = (root: Object3D): void => {
    root.traverse((o) => {
      const m = (o as Mesh).material;
      for (const mat of Array.isArray(m) ? m : m === undefined ? [] : [m]) {
        if (mat instanceof MeshStandardMaterial && mat.transparent && mat.envMap !== skyTarget.texture) {
          mat.envMap = skyTarget.texture;
          mat.needsUpdate = true;
        }
      }
    });
  };
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
    sky: skyTarget.texture,
    skyOn,
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
      // A Color background is a clear, which the renderer's tone mapping never touches: only the
      // composer's tone pass needs the pre-image. Without it the paper is written as itself.
      scene.background = settings.composer ? paper : paperRaw;
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
      skyTarget.dispose();
      hdr?.dispose();
      sun.shadow.dispose();
      ground.geometry.dispose();
      ground.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

/**
 * three r186's module-level DFG LUT (DFGLUTData.js), read back from the first PBR material's uniforms.
 * Each renderer that uploads it adds a `dispose` listener that is never removed, so the LUT holds every
 * renderer, its canvas and the page around it. Disposing it (after renderer.dispose) drops those listeners;
 * the next renderer simply uploads it again. Call before the materials are freed.
 */
export function dfgLut(renderer: WebGLRenderer, scene: Object3D): Texture | null {
  let lut: Texture | null = null;
  scene.traverse((node) => {
    const material = (node as { material?: unknown }).material;
    for (const m of Array.isArray(material) ? material : [material]) {
      if (lut === null && m !== undefined && m !== null && typeof m === 'object') {
        const uniforms = (renderer.properties.get(m) as { uniforms?: { dfgLUT?: { value?: Texture | null } } }).uniforms;
        lut = uniforms?.dfgLUT?.value ?? null;
      }
    }
  });
  return lut;
}
