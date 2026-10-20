/**
 * The site's shader changes, all on materials the site owns.
 *
 * Hardscape reuses the house's growth patch text (patch.ts: world-y clamp +
 * paper→material mix) so a boundary wall rises exactly like a house wall.
 * On top of that, three small extras the house never needs:
 * - `twoScale`: the map sampled at two unrelated scales plus a very low
 *   frequency macro read of itself, so a 2 m lawn tile shows no grid from the
 *   high camera (no extra texture); contrast and saturation are pulled in so
 *   the lawn reads even and fine, as a mown estate lawn;
 * - `grow` (instanced plants): each instance scales up from its own foot,
 *   staggered by a hash of `gl_InstanceID`, so 40 hedges cost one uniform.
 * Water and koi have their own patches in water.ts.
 *
 * Each variant has its own program cache key: the base patch's key
 * ('landing-growth') would make three reuse a program without our extras.
 */

import {
  MeshDepthMaterial,
  RGBADepthPacking,
  type Material,
  type WebGLProgramParametersWithUniforms,
} from 'three';

import { FRAGMENT_DECL, FRAGMENT_MIX, FRAGMENT_PBR_MIX, VERTEX_CLAMP, VERTEX_DECL, type GrowthUniforms } from '../patch';

export interface Num {
  value: number;
}

export interface SiteShaderOptions {
  readonly growth: GrowthUniforms;
  readonly twoScale?: boolean;
}

/** Two unrelated scales + a macro brightness patch, all from the one map. */
export const TWO_SCALE_MAP = `
#ifdef USE_MAP
  vec4 siteA = texture2D( map, vMapUv );
  vec4 siteB = texture2D( map, vMapUv * 0.37 + vec2( 0.43, 0.71 ) );
  float siteM = dot( texture2D( map, vMapUv * 0.041 + vec2( 0.11, 0.29 ) ).rgb, vec3( 0.3, 0.6, 0.1 ) );
  vec4 siteC = mix( siteA, siteB, 0.45 );
  siteC.rgb = mix( vec3( dot( siteC.rgb, vec3( 0.33 ) ) ), siteC.rgb, 0.75 );
  siteC.rgb *= mix( 0.93, 1.06, smoothstep( 0.18, 0.42, siteM ) );
  diffuseColor *= siteC;
#endif
`;

/** Patch an owned material in place: clamp + paper mix, plus the asked extras. */
export function patchSite<T extends Material>(material: T, options: SiteShaderOptions): T {
  const { growth, twoScale = false } = options;
  material.userData = { ...material.userData, growth };
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uRiseY = growth.uRiseY;
    shader.uniforms.uDrop = growth.uDrop;
    shader.uniforms.uMat = growth.uMat;
    shader.uniforms.uOpacity = growth.uOpacity;
    shader.uniforms.uPaper = growth.uPaper;
    shader.vertexShader = VERTEX_DECL + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>${VERTEX_CLAMP}`);
    let fragment = shader.fragmentShader;
    if (twoScale) {
      fragment = fragment.replace('#include <map_fragment>', TWO_SCALE_MAP);
    }
    fragment = fragment.replace('#include <color_fragment>', `#include <color_fragment>${FRAGMENT_MIX}`);
    fragment = fragment.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>${FRAGMENT_PBR_MIX}`);
    shader.fragmentShader = FRAGMENT_DECL + fragment;
  };
  material.customProgramCacheKey = () => `landing-site${twoScale ? '-2s' : ''}`;
  return material;
}

export const GROW_DECL = 'uniform float uGrow;\n';
/** Scale about the instance's own origin (its foot), late instances start later. */
export const GROW_VERTEX = `
  #ifdef USE_INSTANCING
    float siteH = fract( sin( float( gl_InstanceID ) * 12.9898 ) * 43758.5453 );
  #else
    float siteH = 0.0;
  #endif
  float siteG = clamp( uGrow * 1.6 - siteH * 0.6, 0.0, 1.0 );
  transformed *= siteG * siteG * ( 3.0 - 2.0 * siteG );
`;

function injectGrow(shader: WebGLProgramParametersWithUniforms, grow: Num): void {
  shader.uniforms.uGrow = grow;
  shader.vertexShader = GROW_DECL + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>${GROW_VERTEX}`);
}

/** Plants: grow from the foot with `grow` (state.build.planting). */
export function patchGrow<T extends Material>(material: T, grow: Num): T {
  material.userData = { ...material.userData, grow };
  material.onBeforeCompile = (shader) => {
    injectGrow(shader, grow);
  };
  material.customProgramCacheKey = () => 'landing-site-grow';
  return material;
}

/** The shadow twin of a growing plant: a seedling casts a seedling's shadow. */
export function growDepthMaterial(grow: Num): MeshDepthMaterial {
  const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  depth.onBeforeCompile = (shader) => {
    injectGrow(shader, grow);
  };
  depth.customProgramCacheKey = () => 'landing-site-grow-depth';
  return depth;
}
