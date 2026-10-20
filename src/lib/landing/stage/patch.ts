/**
 * The one shader change the landing stage makes: growth by height clamp.
 *
 * A wall that "rises" is not scaled: every vertex keeps its x/z and has its
 * world-space y clamped to `uRiseY`, so the wall is always a closed solid with
 * a flat top and its openings appear as the clamp passes them (CONTRACT). The
 * same clamp grows furniture from its floor and the stair from the slab.
 *
 * The clamp works in world space (`modelMatrix`, then back with its inverse —
 * WebGL2 has `inverse()`), so a piece nested in a moved group, or the lifted
 * upper storey, clamps against the same scene height the stage computes.
 *
 * `uMat` mixes the drawn look (flat paper albedo, matte) to the full material;
 * `uOpacity` fades joinery in and only matters on a clone made `transparent`
 * at build time — flipping `transparent` later would recompile the program.
 * `uDrop` lowers the vertex by that many metres (joinery's drop-in).
 *
 * Every clone shares the same `onBeforeCompile` source, so three compiles one
 * program per base shader and only the uniform values differ per object.
 */

import {
  Color,
  MeshDepthMaterial,
  RGBADepthPacking,
  type Material,
  type WebGLProgramParametersWithUniforms,
} from 'three';

import { LANDING_PALETTE } from '../palette';

export interface GrowthUniforms {
  readonly uRiseY: { value: number };
  readonly uMat: { value: number };
  readonly uOpacity: { value: number };
  readonly uDrop: { value: number };
  readonly uPaper: { value: Color };
}

export interface GrowthOptions {
  /** World y the object stands on; the clamp starts here (rise = 0 → flat at baseY). */
  readonly baseY: number;
  /** Uniforms to share — every material of one object reads the same set. */
  readonly uniforms?: GrowthUniforms;
  /** Make the clone blend, so `uOpacity` can fade it. Decided once, here. */
  readonly fade?: boolean;
}

/** Above any wall: the clamp's "not clamped" value. */
export const NO_CLAMP_Y = 1e4;

export function createGrowthUniforms(baseY: number): GrowthUniforms {
  return {
    uRiseY: { value: baseY },
    uMat: { value: 0 },
    uOpacity: { value: 1 },
    uDrop: { value: 0 },
    uPaper: { value: new Color(LANDING_PALETTE.paper) },
  };
}

export const VERTEX_DECL = 'uniform float uRiseY;\nuniform float uDrop;\n';
export const VERTEX_CLAMP = `
  vec4 growthWorld = modelMatrix * vec4( transformed, 1.0 );
  growthWorld.y = min( growthWorld.y, uRiseY ) - uDrop;
  transformed = ( inverse( modelMatrix ) * growthWorld ).xyz;
`;
export const FRAGMENT_DECL = 'uniform float uMat;\nuniform float uOpacity;\nuniform vec3 uPaper;\n';
export const FRAGMENT_MIX = `
  diffuseColor.rgb = mix( uPaper, diffuseColor.rgb, uMat );
  diffuseColor.a *= uOpacity;
`;
/** Drawn surfaces are matte: no sheen, no metal, until uMat brings them back. */
export const FRAGMENT_PBR_MIX = `
  roughnessFactor = mix( 0.95, roughnessFactor, uMat );
  metalnessFactor *= uMat;
`;

function injectVertex(shader: WebGLProgramParametersWithUniforms, uniforms: GrowthUniforms): void {
  shader.uniforms.uRiseY = uniforms.uRiseY;
  shader.uniforms.uDrop = uniforms.uDrop;
  shader.vertexShader =
    VERTEX_DECL + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>${VERTEX_CLAMP}`);
}

function injectFragment(shader: WebGLProgramParametersWithUniforms, uniforms: GrowthUniforms): void {
  shader.uniforms.uMat = uniforms.uMat;
  shader.uniforms.uOpacity = uniforms.uOpacity;
  shader.uniforms.uPaper = uniforms.uPaper;
  let fragment = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>${FRAGMENT_MIX}`);
  if (fragment.includes('#include <metalnessmap_fragment>')) {
    fragment = fragment.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>${FRAGMENT_PBR_MIX}`);
  }
  shader.fragmentShader = FRAGMENT_DECL + fragment;
}

/**
 * A growth-patched clone of `material`. The clone carries its uniforms in
 * `userData.growth`; the original is untouched (it may be shared by the house).
 */
export function patchGrowth<T extends Material>(material: T, options: GrowthOptions): T {
  const uniforms = options.uniforms ?? createGrowthUniforms(options.baseY);
  const clone = material.clone() as T;
  clone.userData = { ...clone.userData, growth: uniforms };
  if (options.fade === true) {
    clone.transparent = true;
  }
  clone.onBeforeCompile = (shader) => {
    injectVertex(shader, uniforms);
    injectFragment(shader, uniforms);
  };
  // Same key for every clone of one base shader: one program, many uniform sets.
  clone.customProgramCacheKey = () => 'landing-growth';
  return clone;
}

/** The shadow-pass twin: same clamp, so a half-risen wall casts a half-risen shadow. */
export function growthDepthMaterial(uniforms: GrowthUniforms): MeshDepthMaterial {
  const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  depth.userData = { growth: uniforms };
  depth.onBeforeCompile = (shader) => {
    injectVertex(shader, uniforms);
  };
  depth.customProgramCacheKey = () => 'landing-growth-depth';
  return depth;
}

/** The uniforms a patched clone reads, or null for an unpatched material. */
export function growthOf(material: Material): GrowthUniforms | null {
  const growth = (material.userData as { growth?: GrowthUniforms }).growth;
  return growth ?? null;
}
