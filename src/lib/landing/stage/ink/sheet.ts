/**
 * The paper the plan is drawn on, and the two soft shadows that give it depth:
 * one under the sheet, one under the drawing plane when it floats (scene 02).
 *
 * The grain is shader noise rather than a canvas texture so it costs no upload
 * and builds headless in tests; it is kept to a few percent of value, matte,
 * so the sheet reads as paper and never as a pattern.
 */

import { Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from 'three';

import { inverseNeutral } from '../tone';

import { PAPER } from './lines';

/** Wide enough that the sheet's edge never enters the frame in scenes 01–04. */
export const SHEET_MARGIN_M = 40;

const GRAIN_VERTEX = /* glsl */ `
  uniform float uLift;
  varying vec2 vUv;
  varying vec2 vPos;
  void main() {
    vUv = uv;
    vec2 e = abs(uv - 0.5) * 2.0;
    float edge = smoothstep(0.86, 1.0, max(e.x, e.y));
    vec3 p = position;
    p.z += uLift * edge * edge;
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const GRAIN_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec2 vPos;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    // Fibres finer than a pixel fade out instead of aliasing into moiré bands at distance.
    float fine = 1.0 - smoothstep(0.25, 0.8, fwidth(vPos.x * 90.0));
    float grain = 0.5 + (noise(vPos * 90.0) - 0.5) * 0.6 * fine + (noise(vPos * 23.0) - 0.5) * 0.4;
    vec2 e = abs(vUv - 0.5) * 2.0;
    float rim = smoothstep(0.9, 1.0, max(e.x, e.y));
    vec3 color = uColor * (0.975 + 0.035 * grain) * (1.0 - 0.03 * rim);
    gl_FragColor = vec4(color, uOpacity);
  }
`;

const SHADOW_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const SHADOW_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uSoft;
  uniform vec2 uSize;
  varying vec2 vUv;
  void main() {
    vec2 d = (0.5 - abs(vUv - 0.5)) * uSize;
    float a = smoothstep(0.0, uSoft, min(d.x, d.y));
    gl_FragColor = vec4(0.08, 0.09, 0.11, a * uOpacity);
  }
`;

/** A flat, softly edged dark rectangle; `uSoft` is the blur width in metres. */
export function softShadow(name: string, width: number, depth: number, soft: number): Mesh<PlaneGeometry, ShaderMaterial> {
  const material = new ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uSoft: { value: soft }, uSize: { value: new Vector2(width, depth) } },
    vertexShader: SHADOW_VERTEX,
    fragmentShader: SHADOW_FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new Mesh(new PlaneGeometry(width, depth), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.name = name;
  return mesh;
}

export interface Sheet {
  readonly paper: Mesh<PlaneGeometry, ShaderMaterial>;
  readonly shadow: Mesh<PlaneGeometry, ShaderMaterial>;
  set(opacity: number, liftM: number): void;
}

/** A sheet covering `[minX, minZ, maxX, maxZ]` plus the margin, lying at y = 0. */
export function createSheet(bounds: readonly [number, number, number, number]): Sheet {
  const [minX, minZ, maxX, maxZ] = bounds;
  const width = maxX - minX + SHEET_MARGIN_M * 2;
  const depth = maxZ - minZ + SHEET_MARGIN_M * 2;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  const material = new ShaderMaterial({
    uniforms: { uColor: { value: inverseNeutral(new Color(PAPER)) }, uOpacity: { value: 0 }, uLift: { value: 0 } },
    vertexShader: GRAIN_VERTEX,
    fragmentShader: GRAIN_FRAGMENT,
    transparent: true,
    side: DoubleSide,
    // The bottom layer: nothing tests against it, so the ink 10 mm above never depth-fights it at distance.
    depthWrite: false,
  });
  const paper = new Mesh(new PlaneGeometry(width, depth, 24, 18), material);
  paper.name = 'ink:sheet';
  paper.rotation.x = -Math.PI / 2;
  paper.position.set(cx, 0, cz);
  paper.renderOrder = -2;

  const shadow = softShadow('ink:sheetShadow', width + 0.5, depth + 0.5, 0.45);
  shadow.position.set(cx + 0.06, -0.004, cz + 0.08);
  shadow.renderOrder = -3;

  return {
    paper,
    shadow,
    set(opacity, liftM) {
      material.uniforms['uOpacity']!.value = opacity;
      // A very slight curl at the rim; the drawing's lift raises it a touch more.
      material.uniforms['uLift']!.value = (0.012 + Math.min(liftM, 0.3) * 0.08) * opacity;
      paper.visible = opacity > 1e-3;
      shadow.material.uniforms['uOpacity']!.value = 0.22 * opacity;
      shadow.visible = paper.visible;
    },
  };
}
