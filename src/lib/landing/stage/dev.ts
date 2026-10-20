/** The stage's DEV-only window hooks (profiling, review shots); installed by index.ts under `import.meta.env.DEV`. */

import { Texture, type Material, type Mesh, type Object3D, type WebGLRenderer } from 'three';

import type { Vec3 } from '../types';

import type { Quality, QualitySettings } from './quality';

export interface StageInfo {
  quality: Quality;
  render: { calls: number; triangles: number; points: number; lines: number; frame: number };
  memory: { geometries: number; textures: number };
  /** Estimated GPU memory, MB: every texture the scene's materials and environment hold, the shadow map, the drawing buffer. */
  gpuMB: { textures: number; shadow: number; screen: number; total: number };
  programs: number;
}

declare global {
  interface Window {
    /** DEV only: the last frame's draw calls/triangles (all passes), GPU memory, program count. */
    __landingStageInfo?: () => StageInfo;
    /** DEV only: override single settings of the live tier (pass profiling); `null` clears. */
    __landingStageTune?: (patch: Partial<QualitySettings> | null, q?: Quality) => void;
    /** DEV only: hold the camera at a fixed view for review shots; `null` gives it back to the timeline. */
    __landingStageView?: (view: { position: Vec3; target: Vec3; fov?: number } | null) => void;
    /** DEV only: the live renderer and scene, for one-feature-off perf probes. */
    __landingStageRaw?: { renderer: WebGLRenderer; scene: Object3D };
  }
}

const MB = 1024 * 1024;

/** Bytes of one texture on the GPU: RGBA8 (half-float ×2), a full mip chain ×4/3, a cube ×6. */
function textureBytes(t: Texture): number {
  const img = (t.image ?? {}) as { width?: number; height?: number; length?: number };
  const faces = Array.isArray(t.image) ? 6 : 1;
  const first = (Array.isArray(t.image) ? t.image[0] : img) as { width?: number; height?: number } | undefined;
  const px = (first?.width ?? 0) * (first?.height ?? 0) * faces;
  const bpp = t.type === 1016 /* HalfFloatType */ ? 8 : t.type === 1015 /* FloatType */ ? 16 : 4;
  return px * bpp * (t.generateMipmaps ? 4 / 3 : 1);
}

/** GPU memory estimate for the scene (the numbers renderer.info.memory only counts). */
export function gpuMemory(renderer: WebGLRenderer, scene: Object3D & { environment?: Texture | null }): StageInfo['gpuMB'] {
  const seen = new Set<Texture>();
  if (scene.environment) seen.add(scene.environment);
  scene.traverse((o) => {
    const m = (o as Mesh).material as Material | Material[] | undefined;
    for (const mat of Array.isArray(m) ? m : m === undefined ? [] : [m]) {
      for (const v of Object.values(mat)) {
        if (v instanceof Texture) seen.add(v);
      }
    }
  });
  // Clones share one GPU upload (same source): count each image once.
  const sources = new Map<unknown, number>();
  for (const t of seen) sources.set(t.source, textureBytes(t));
  const textures = [...sources.values()].reduce((a, b) => a + b, 0) / MB;
  let shadow = 0;
  scene.traverse((o) => {
    const map = (o as { shadow?: { map?: { width: number; height: number } | null } }).shadow?.map;
    if (map) shadow += (map.width * map.height * 8) / MB; // depth texture + colour
  });
  const canvas = renderer.domElement;
  const screen = (canvas.width * canvas.height * 4 * (4 + 1 + 1)) / MB; // 4× MSAA colour, resolve, depth
  return { textures: Math.round(textures), shadow: Math.round(shadow), screen: Math.round(screen), total: Math.round(textures + shadow + screen) };
}

/**
 * Installs the three DEV hooks; returns their removal. A stage re-made on a fresh canvas (context loss) may
 * already own them, so removal only deletes hooks that are still this stage's.
 */
export function installStageDev(
  renderer: WebGLRenderer,
  scene: Object3D & { environment?: Texture | null },
  quality: () => Quality,
  hooks: { view: NonNullable<Window['__landingStageView']>; tune: NonNullable<Window['__landingStageTune']> },
): () => void {
  const info = (): StageInfo => {
    const { render, memory, programs } = renderer.info;
    return { quality: quality(), render: { ...render }, memory: { ...memory }, gpuMB: gpuMemory(renderer, scene), programs: programs?.length ?? 0 };
  };
  window.__landingStageInfo = info;
  window.__landingStageView = hooks.view;
  window.__landingStageTune = hooks.tune;
  window.__landingStageRaw = { renderer, scene };
  return () => {
    if (window.__landingStageInfo === info) {
      delete window.__landingStageInfo;
      delete window.__landingStageTune;
      delete window.__landingStageView;
      delete window.__landingStageRaw;
    }
  };
}
