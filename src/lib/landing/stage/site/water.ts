/**
 * The koi pond: stone coping, a dark basin, the water surface, koi and lotus.
 *
 * Water is one opaque physical surface (low roughness → the scene's
 * environment does the reflection, three's BRDF does the Fresnel): by the
 * distance to the outline (computed in the fragment shader from the outline's
 * corners) its body runs from a deep green edge to a near-black green middle,
 * which reads as depth. Opaque on purpose: as a transparent sheet it never
 * showed in the stage's pipeline (the basin read through, koi on the floor),
 * and it costs no blending on the iGPU. So the koi swim a hair above the
 * surface, flattened, mostly self-lit and pulled toward the water colour,
 * which reads as fish glowing just under it.
 * Ripples are a few summed cosines bent into the normal in the fragment shader
 * — no texture, no render target. Koi swim circles computed in the vertex
 * shader from `gl_InstanceID` + `uTime`, so swimming costs no CPU. Both read
 * one `uTime` that only `ambient()` moves: no ambient call, no motion.
 *
 * The water, koi and lotus hang in one group lifted by `build.water` from the
 * basin floor to the full level.
 */

import {
  type BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  MeshPhysicalMaterial,
  SphereGeometry,
  Vector2,
  type Material,
} from 'three';

import type { SiteWater } from '../../types';
import { seedOf } from '../textures';

import { M, flat, merge, offset, prism } from './geo';
import type { Num } from './shader';

export interface Pond {
  /** Coping + basin liner, for the hardscape's stone / liner meshes. */
  readonly coping: BufferGeometry;
  readonly liner: BufferGeometry;
  readonly group: Group;
  readonly water: Mesh;
  readonly koi: InstancedMesh;
  /** Scene y of the basin floor and of the full water level. */
  readonly floorY: number;
  readonly levelY: number;
  readonly materials: readonly Material[];
}

const KOI_PER_POND = 16;
/** Koi in the loose school by the deck (the rest roam the pond). */
const KOI_SCHOOL = 11;
const KOI_COLOURS = ['#F26A21', '#FFFFFF', '#E8452C', '#F2B23A'] as const;
/** Corners the edge-distance shader reads; a longer outline only uses its first ones. */
const POLY_MAX = 8;
const LOTUS_FLOWERS = 3;

const WATER_VERTEX_DECL = 'varying vec2 vSiteXZ;\n';
const WATER_FRAGMENT_DECL = `
uniform float uTime;
uniform vec2 uPoly[ ${String(POLY_MAX)} ];
uniform int uPolyN;
uniform vec3 uShallow;
uniform vec3 uDeep;
float pondEdge( vec2 p ) {
  float d = 1e9;
  for ( int i = 0; i < ${String(POLY_MAX)}; i++ ) {
    if ( i >= uPolyN ) break;
    vec2 a = uPoly[ i ];
    vec2 e = uPoly[ i + 1 < uPolyN ? i + 1 : 0 ] - a;
    vec2 w = p - a;
    d = min( d, length( w - e * clamp( dot( w, e ) / dot( e, e ), 0.0, 1.0 ) ) );
  }
  return d;
}
`;
const WATER_BODY = `
  #include <color_fragment>
  float pondD = pondEdge( vSiteXZ );
  diffuseColor.rgb = mix( uShallow, uDeep, smoothstep( 0.0, 1.5, pondD ) );
`;
const WATER_VERTEX = '\n  vSiteXZ = ( modelMatrix * vec4( transformed, 1.0 ) ).xz;\n';
const WATER_RIPPLE = `
  #include <normal_fragment_maps>
  float siteT = uTime;
  vec2 siteP = vSiteXZ;
  vec2 siteN = vec2(
    sin( siteP.x * 2.3 + siteT * 1.1 ) + 0.6 * sin( siteP.x * 1.1 + siteP.y * 1.9 - siteT * 0.8 ),
    sin( siteP.y * 2.7 - siteT * 0.9 ) + 0.5 * sin( -siteP.x * 1.4 + siteP.y * 3.1 + siteT * 0.6 )
  ) * 0.025;
  normal = normalize( normal + ( viewMatrix * vec4( siteN.x, 0.0, siteN.y, 0.0 ) ).xyz );
`;

/** Each koi circles its instance origin; radius and speed from its id. */
const KOI_VERTEX = `
  #include <begin_vertex>
  #ifdef USE_INSTANCING
    float koiI = float( gl_InstanceID );
  #else
    float koiI = 0.0;
  #endif
  float koiR = 0.5 + mod( koiI, 3.0 ) * 0.35;
  float koiS = ( 0.18 + mod( koiI, 4.0 ) * 0.05 ) * ( mod( koiI, 2.0 ) * 2.0 - 1.0 );
  float koiA = uTime * koiS + koiI * 2.4;
  vec2 koiO = vec2( cos( koiA ), sin( koiA ) );
  vec2 koiT = vec2( -koiO.y, koiO.x ) * sign( koiS );
  float koiW = sin( uTime * 3.0 + koiI + transformed.x * 9.0 ) * 0.025 * ( 1.0 - smoothstep( -0.2, 0.0, transformed.x ) );
  transformed = vec3(
    koiT.x * transformed.x + koiO.x * ( transformed.z + koiW ) + koiO.x * koiR,
    transformed.y,
    koiT.y * transformed.x + koiO.y * ( transformed.z + koiW ) + koiO.y * koiR
  );
`;

function koiGeometry(): BufferGeometry {
  // A 0.42 m body along +x (head at +x), flattened, with a small tail fin.
  const body = new SphereGeometry(1, 10, 6);
  body.scale(0.27, 0.055, 0.08);
  const tail = new CylinderGeometry(0, 0.07, 0.12, 4, 1);
  tail.rotateZ(Math.PI / 2);
  tail.scale(1, 0.25, 1);
  tail.translate(-0.25, 0, 0);
  return merge([body, tail]);
}

export function buildPond(w: SiteWater, time: Num): Pond {
  const levelY = M(w.waterLevelMm);
  const floorY = levelY - M(w.depthMm);
  const copingTop = M(w.copingTopMm);
  const outer = offset(w.outline, w.copingMm);
  const coping = prism(outer, copingTop - 0.15, copingTop, [w.outline]);
  const liner = merge([prism(offset(w.outline, 20), floorY, copingTop - 0.15, [w.outline]), flat(w.outline, floorY)]);

  const waterMat = new MeshPhysicalMaterial({
    color: '#1E3A31',
    roughness: 0.04,
    metalness: 0,
    // The paper-warm environment reflected at full strength turned the pond to chocolate (jury fix 10):
    // a weak reflection, tinted the sky's blue-grey, over a deep-green body.
    envMapIntensity: 0.35,
    specularIntensity: 0.6,
    specularColor: new Color('#9FB1B8'),
  });
  const corners = w.outline.slice(0, POLY_MAX).map((p) => new Vector2(M(p[0]), M(p[1])));
  const poly = { value: [...corners, ...Array.from({ length: POLY_MAX - corners.length }, () => new Vector2())] };
  const shallow = { value: new Color('#1E3A31') };
  const deep = { value: new Color('#0F211C') };
  waterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.uniforms.uPoly = poly;
    shader.uniforms.uPolyN = { value: corners.length };
    shader.uniforms.uShallow = shallow;
    shader.uniforms.uDeep = deep;
    shader.vertexShader = WATER_VERTEX_DECL + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>${WATER_VERTEX}`);
    shader.fragmentShader =
      WATER_VERTEX_DECL +
      WATER_FRAGMENT_DECL +
      shader.fragmentShader.replace('#include <normal_fragment_maps>', WATER_RIPPLE).replace('#include <color_fragment>', WATER_BODY);
  };
  waterMat.customProgramCacheKey = () => 'landing-site-water';
  const water = new Mesh(flat(w.outline, 0), waterMat);
  water.name = `site:${w.id}:water`;
  water.receiveShadow = true;

  // Pulled toward the camera in depth: at grazing angles the flat bodies z-fought the surface into open rings.
  const koiMat = new MeshLambertMaterial({ color: '#FFFFFF', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });
  koiMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader.replace('#include <begin_vertex>', KOI_VERTEX)}`;
    // 85 % self-lit, 15 % shaded, a fifth of the water's colour over it: bright fish just under the surface.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      'outgoingLight = mix( diffuseColor.rgb * 0.85 + outgoingLight * 0.15, vec3( 0.03, 0.06, 0.045 ), 0.22 );\n#include <opaque_fragment>',
    );
  };
  koiMat.customProgramCacheKey = () => 'landing-site-koi';
  const koi = new InstancedMesh(koiGeometry(), koiMat, KOI_PER_POND);
  koi.name = `site:${w.id}:koi`;
  const xs = w.outline.map((p) => p[0]);
  const ys = w.outline.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs) + 1800, Math.max(...xs) - 1800, Math.min(...ys) + 1500, Math.max(...ys) - 1500];
  // The school: east of the stepping slabs, 1.6–2.3 m off the deck-side edge.
  const school = [x0 + (x1 - x0) * 0.62, x1, y0 + 100, y0 + 800] as const;
  const m = new Matrix4();
  const c = new Color();
  for (let i = 0; i < KOI_PER_POND; i += 1) {
    const s = seedOf(`${w.id}-koi-${String(i)}`);
    const t = seedOf(`${w.id}-koi-y-${String(i)}`);
    const [a0, a1, b0, b1] = i < KOI_SCHOOL ? school : [x0, x1, y0, y1];
    const k = 1 + 0.35 * seedOf(`${w.id}-koi-s-${String(i)}`);
    m.makeScale(k, 0.2, k).setPosition(M(a0 + (a1 - a0) * s), 0.012 + 0.002 * t, M(b0 + (b1 - b0) * t));
    koi.setMatrixAt(i, m);
    koi.setColorAt(i, c.set(KOI_COLOURS[i % KOI_COLOURS.length] ?? '#E2793A'));
  }
  koi.frustumCulled = false; // the shader moves them off their instance origins

  const group = new Group();
  group.name = `site:${w.id}`;
  group.userData.records = [w.id];
  group.add(water, koi);
  const materials: Material[] = [waterMat, koiMat];

  if (w.lotus !== undefined && w.lotus.length > 0) {
    const padGeo = new CylinderGeometry(1, 1, 0.02, 12, 1);
    const padMat = new MeshLambertMaterial({ color: '#4E6A3A', side: DoubleSide });
    const pads = new InstancedMesh(padGeo, padMat, w.lotus.length);
    pads.name = `site:${w.id}:lotus`;
    w.lotus.forEach((l, i) => {
      const r = M(l.radiusMm);
      m.makeScale(r, 1, r).setPosition(M(l.at[0]), 0.012, M(l.at[1]));
      pads.setMatrixAt(i, m);
    });
    // A few pink flowers (six-petal cones) on the first pads.
    const flowerMat = new MeshLambertMaterial({ color: '#E7A3B5', side: DoubleSide });
    const flowers = new InstancedMesh(new ConeGeometry(0.09, 0.08, 6, 1, true).rotateX(Math.PI), flowerMat, Math.min(LOTUS_FLOWERS, w.lotus.length));
    flowers.name = `site:${w.id}:lotus-flowers`;
    w.lotus.slice(0, LOTUS_FLOWERS).forEach((l, i) => {
      m.makeTranslation(M(l.at[0] + l.radiusMm * 0.3), 0.06, M(l.at[1] - l.radiusMm * 0.2));
      flowers.setMatrixAt(i, m);
    });
    group.add(pads, flowers);
    materials.push(padMat, flowerMat);
  }
  return { coping, liner, group, water, koi, floorY, levelY, materials };
}
