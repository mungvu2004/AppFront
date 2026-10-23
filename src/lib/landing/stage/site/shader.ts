/**
 * The site's shader changes, all on materials the site owns.
 *
 * Hardscape reuses the house's growth patch text (patch.ts: world-y clamp;
 * its paper→material mix runs after lighting here) so a boundary wall rises exactly like a house wall.
 * On top of that, three small extras the house never needs:
 * - `twoScale`: the map sampled at two unrelated scales plus a very low
 *   value-noise macro tint (lush darker / dry olive patches), so a 2 m lawn
 *   tile shows no grid and the lawn is never one flat green (no extra texture);
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

import { FRAGMENT_DECL, FRAGMENT_PBR_MIX, VERTEX_CLAMP, VERTEX_DECL, type GrowthUniforms } from '../patch';

export interface Num {
  value: number;
}

export interface SiteShaderOptions {
  readonly growth: GrowthUniforms;
  readonly twoScale?: boolean;
}

/** Value noise in [0, 1] (bilinear hash lattice; no texture). */
export const SITE_NOISE = `
float siteHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float siteNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( siteHash( i ), siteHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( siteHash( i + vec2( 0.0, 1.0 ) ), siteHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
`;

/**
 * Two unrelated scales of the map, then macro variation from value noise
 * (≈ 12 m and 4 m patches, uv = 1 per 2 m tile): darker lush patches and paler
 * dry olive ones, so the lawn is never one flat green.
 */
export const TWO_SCALE_MAP = `
#ifdef USE_MAP
  vec4 siteA = texture2D( map, vMapUv );
  vec4 siteB = texture2D( map, vMapUv * 0.37 + vec2( 0.43, 0.71 ) );
  vec4 siteC = mix( siteA, siteB, 0.3 );
  float siteL = dot( siteC.rgb, vec3( 0.33 ) );
  siteC.rgb = mix( vec3( siteL ), siteC.rgb, 0.38 ) * mix( 0.8, 1.2, smoothstep( 0.05, 0.3, siteL ) );
  float siteM = siteNoise( vMapUv * 0.17 ) * 0.65 + siteNoise( vMapUv * 0.53 + 7.3 ) * 0.35;
  siteC.rgb *= mix( 0.74, 1.12, siteM );
  siteC.rgb = mix( siteC.rgb, siteC.rgb * vec3( 1.12, 1.02, 0.78 ), smoothstep( 0.55, 0.85, siteM ) * 0.6 );
  diffuseColor *= siteC;
#endif
`;

/** The lit result hands over from flat paper to the lit material with `uMat`. */
export const SITE_PAPER_MIX = `
  outgoingLight = mix( uPaper, outgoingLight, uMat );
  diffuseColor.a *= uOpacity;
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
      fragment = SITE_NOISE + fragment.replace('#include <map_fragment>', TWO_SCALE_MAP);
    }
    // Paper → material after lighting (jury fix 12): mixed into the albedo, lit paper read as khaki mud.
    fragment = fragment.replace('#include <opaque_fragment>', `${SITE_PAPER_MIX}#include <opaque_fragment>`);
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

/**
 * Foliage extras (cheap, no texture): leaf-mass clumps from a sine lattice in the
 * model's own space (so each hedge or crown breaks into lumps), and light that
 * wraps round the crown plus a soft rim where leaves are seen edge-on against
 * the sky (light through thin leaves). Two ALU-only lines.
 */
export const LEAF_VERTEX = `
  vLeafP = position;
`;
export const LEAF_DECL = 'varying vec3 vLeafP;\n';
export const LEAF_CLUMPS = `
  float leafK = sin( vLeafP.x * 5.1 ) * sin( vLeafP.y * 4.3 + 1.7 ) * sin( vLeafP.z * 5.7 + 0.6 );
  diffuseColor.rgb *= 0.8 + 0.2 * ( leafK * 0.5 + 0.5 );
`;
export const LEAF_WRAP = `
  float leafRim = 1.0 - saturate( dot( geometryNormal, geometryViewDir ) );
  reflectedLight.indirectDiffuse += diffuseColor.rgb * ( 0.05 + 0.12 * leafRim * leafRim );
`;

/** Plants: grow from the foot with `grow` (state.build.planting); `leaf` adds the foliage extras. */
export function patchGrow<T extends Material>(material: T, grow: Num, leaf = false): T {
  material.userData = { ...material.userData, grow };
  material.onBeforeCompile = (shader) => {
    injectGrow(shader, grow);
    if (leaf) {
      shader.vertexShader = LEAF_DECL + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>${LEAF_VERTEX}`);
      shader.fragmentShader = `${LEAF_DECL}${shader.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>${LEAF_CLUMPS}`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>${LEAF_WRAP}`)}`;
    }
  };
  material.customProgramCacheKey = () => `landing-site-grow${leaf ? '-leaf' : ''}`;
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
