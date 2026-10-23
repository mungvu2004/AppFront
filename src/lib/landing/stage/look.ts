/** The landing's palette over present's roles (moved out of index.ts to keep it under 400 lines). */

import { Color, Group, PointLight, type Mesh, type Object3D, type ShaderMaterial, type Vector3 } from 'three';

import { readPalette, type ScenePalette } from '@/lib/three/present';

import { LANDING_PALETTE } from '../palette';

import { inverseNeutral } from './tone';

/**
 * The landing's art direction over present's roles (R3–R5): a gallery model,
 * not the app's themed viewer. Warm off-white plaster, a light mineral
 * render outside, a soft graphite cut (not the page's text black), natural
 * oak, linen and graphite metal, and one muted sage as the only accent —
 * present's ochre cushion and orange woods read as toys.
 */
export const LANDING_LOOK: Readonly<Partial<Record<keyof ScenePalette, string>>> = {
  backdrop: LANDING_PALETTE.paper,
  plaster: '#F0F0EE',
  // Cool crisp render (archviz-r2 fix 7), not cream.
  exterior: '#E9ECEE',
  cut: '#7D7972',
  wood: '#B9A891',
  woodDark: '#6B5D50',
  fabric: '#E6E0D5',
  textile: '#B9A88E',
  ochre: '#97A391',
  stone: '#DAD6CE',
  metal: '#3A3D42',
  clay: '#B9A28C',
  foliage: '#6E7D5C',
  screen: '#141618',
};

/** present's palette roles, with the landing's look in place of the page's tokens. */
export function landingScenePalette(base: ScenePalette = readPalette(() => '')): ScenePalette {
  const out: Record<string, ScenePalette[keyof ScenePalette]> = { ...base };
  for (const [role, hex] of Object.entries(LANDING_LOOK)) {
    out[role] = base.backdrop.clone().set(hex);
  }
  return out as ScenePalette;
}

/**
 * ink's sheet is a raw ShaderMaterial (no tone-map or colour-space chunk): its colour is written as is.
 * Through the composer that is the tone curve's pre-image (linear); straight to the screen it must be
 * the sRGB-encoded paper itself, or the sheet lands lighter than the page (255,255,249 measured).
 */
export function matchSheetPaper(ink: Object3D, composed: boolean): void {
  const sheet = ink.getObjectByName('ink:sheet') as Mesh<never, ShaderMaterial> | undefined;
  const uniform = sheet?.material.uniforms['uColor'];
  if (uniform !== undefined) {
    const paper = new Color(LANDING_PALETTE.paper);
    uniform.value = composed ? inverseNeutral(paper) : paper.convertLinearToSRGB();
  }
}

/** 2700 K lamp light. */
const WARM = 0xffb46b;
/** Living room (G2) lamps, scene metres: [x, y, z, candela, reach]. Floor lamp F-G2-LAMP, then a ceiling fill. */
const LAMPS = [
  [22.9, 1.5, 20.3, 6, 6],
  [20.5, 2.2, 18, 5, 8],
] as const;

/**
 * Warm lamp light for the interior holds (jury fix 11): always in the scene, so the light count and
 * every program stay fixed; lit (intensity) only while the eye is inside the ground floor box.
 */
export function warmInterior(): {
  readonly group: Group;
  /** Lights the lamps while `eye` is inside the ground floor box; true then. */
  apply(eye: Vector3, inside: readonly number[]): boolean;
  dispose(): void;
} {
  const group = new Group();
  group.name = 'interior:lamps';
  const lights = LAMPS.map(([x, y, z, cd, reach]) => {
    const light = new PointLight(WARM, 0, reach, 2);
    light.position.set(x, y, z);
    group.add(light);
    return { light, cd };
  });
  return {
    group,
    apply(eye, [x0 = 0, z0 = 0, x1 = 0, z1 = 0, top = 0]) {
      const on = eye.x > x0 && eye.x < x1 && eye.z > z0 && eye.z < z1 && eye.y < top ? 1 : 0;
      for (const { light, cd } of lights) light.intensity = cd * on;
      return on === 1;
    },
    dispose() {
      for (const { light } of lights) light.dispose();
    },
  };
}
