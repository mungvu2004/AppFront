// @vitest-environment node
import { MeshLambertMaterial, MeshStandardMaterial, type WebGLProgramParametersWithUniforms } from 'three';
import { describe, expect, it } from 'vitest';

import { FRAGMENT_MIX, FRAGMENT_PBR_MIX, VERTEX_CLAMP, growthDepthMaterial, growthOf, patchGrowth } from '../patch';

const shader = (): WebGLProgramParametersWithUniforms =>
  ({
    uniforms: {},
    vertexShader: 'void main() {\n#include <begin_vertex>\n}',
    fragmentShader: 'void main() {\n#include <color_fragment>\n#include <metalnessmap_fragment>\n}',
  }) as unknown as WebGLProgramParametersWithUniforms;

describe('patchGrowth', () => {
  it('clones, injects the clamp and the drawn→PBR mix, and wires shared uniforms', () => {
    const original = new MeshStandardMaterial();
    const patched = patchGrowth(original, { baseY: 0.5 });
    expect(patched).not.toBe(original);
    expect(original.onBeforeCompile).not.toBe(patched.onBeforeCompile);

    const s = shader();
    patched.onBeforeCompile(s, undefined as never);
    expect(s.vertexShader).toContain(VERTEX_CLAMP);
    expect(s.vertexShader).toContain('uniform float uRiseY;');
    expect(s.fragmentShader).toContain(FRAGMENT_MIX);
    expect(s.fragmentShader).toContain(FRAGMENT_PBR_MIX);

    const uniforms = growthOf(patched);
    expect(uniforms?.uRiseY.value).toBe(0.5);
    expect(s.uniforms.uRiseY).toBe(uniforms?.uRiseY);
    expect(s.uniforms.uMat).toBe(uniforms?.uMat);
    expect(s.uniforms.uOpacity).toBe(uniforms?.uOpacity);
    expect(patched.customProgramCacheKey()).toBe(patchGrowth(new MeshStandardMaterial(), { baseY: 2 }).customProgramCacheKey());
  });

  it('skips the roughness mix on a Lambert shader and makes fading clones transparent', () => {
    const patched = patchGrowth(new MeshLambertMaterial(), { baseY: 0, fade: true });
    const s = shader();
    s.fragmentShader = 'void main() {\n#include <color_fragment>\n}';
    patched.onBeforeCompile(s, undefined as never);
    expect(s.fragmentShader).not.toContain('roughnessFactor');
    expect(patched.transparent).toBe(true);
    expect(growthOf(new MeshLambertMaterial())).toBeNull();
  });

  it('gives the shadow pass the same clamp on the same uniforms', () => {
    const patched = patchGrowth(new MeshStandardMaterial(), { baseY: 1 });
    const uniforms = growthOf(patched);
    if (uniforms === null) throw new Error('unpatched');
    const depth = growthDepthMaterial(uniforms);
    const s = shader();
    depth.onBeforeCompile(s, undefined as never);
    expect(s.vertexShader).toContain(VERTEX_CLAMP);
    expect(s.uniforms.uRiseY).toBe(uniforms.uRiseY);
  });
});
