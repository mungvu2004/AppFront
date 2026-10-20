/**
 * The post chain: render → contact AO → SMAA + tone mapping, nothing else.
 *
 * Tone mapping happens exactly once. With the composer the renderer draws
 * linear HDR into a half-float buffer (three skips its own tone mapping when
 * the target is not the screen) and `ToneMappingEffect` maps it in the last
 * pass; without the composer (lite) the renderer maps it itself — the same
 * Neutral curve at the same exposure, so a tier change does not shift the picture.
 *
 * AO is contact AO: a small world radius and a short falloff, so a sofa sits
 * on the floor and a wall meets the slab, with no halo around the house. No
 * bloom — nothing in a daylight gallery shot should glow (Prompt 4).
 *
 * Needs a live renderer; exercised in the browser only (untested by design).
 */

import { N8AOPostPass } from 'n8ao';
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
} from 'postprocessing';
import { Color, HalfFloatType, type PerspectiveCamera, type Scene, type WebGLRenderer } from 'three';

import type { QualitySettings } from './quality';

/** Contact AO, in metres: about a skirting's height. */
export const AO_RADIUS_M = 0.35;
const AO_FALLOFF = 0.5;
const AO_INTENSITY = 1.6;
const AO_COLOUR = new Color(0x2a2724);

export interface PostChain {
  readonly composer: EffectComposer;
  configure(settings: QualitySettings): void;
  dispose(): void;
}

export function createPost(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera): PostChain {
  const composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType, multisampling: 0 });
  composer.addPass(new RenderPass(scene, camera));
  // Sized for real by `composer.setSize` on the first resize.
  const ao = new N8AOPostPass(scene, camera, 1, 1);
  ao.configuration.aoRadius = AO_RADIUS_M;
  ao.configuration.distanceFalloff = AO_FALLOFF;
  ao.configuration.intensity = AO_INTENSITY;
  ao.configuration.color = AO_COLOUR;
  ao.configuration.gammaCorrection = false;
  composer.addPass(ao);
  composer.addPass(
    new EffectPass(
      camera,
      new SMAAEffect({ preset: SMAAPreset.MEDIUM }),
      new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    ),
  );

  return {
    composer,
    configure(settings) {
      ao.enabled = settings.ao;
      ao.configuration.halfRes = settings.aoHalfRes;
      ao.setQualityMode(settings.aoHalfRes ? 'Low' : 'Medium');
    },
    dispose() {
      composer.dispose();
    },
  };
}
