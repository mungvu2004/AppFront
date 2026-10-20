// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { createFrameGovernor, QUALITY, qualityForRenderer } from '../quality';

describe('createFrameGovernor', () => {
  it('steps down only after sustained slow frames, then cools down', () => {
    const g = createFrameGovernor('full', { sustainMs: 1000, cooldownMs: 3000 });
    let t = 0;
    const run = (ms: number, frame: number): (string | null)[] => {
      const out: (string | null)[] = [];
      for (const end = t + ms; t < end; t += 16) out.push(g.sample(frame, t));
      return out;
    };
    expect(run(900, 30).every((x) => x === null)).toBe(true);
    expect(run(400, 30)).toContain('balanced');
    expect(g.quality).toBe('balanced');
    // Still slow, but inside the cooldown: no second step yet.
    expect(run(2000, 30).every((x) => x === null)).toBe(true);
    expect(run(2000, 30)).toContain('lite');
    expect(run(5000, 40).every((x) => x === null)).toBe(true); // lite is the floor
  });

  it('ignores a spike and never climbs back up', () => {
    const g = createFrameGovernor('balanced', { sustainMs: 1000 });
    let t = 0;
    for (let i = 0; i < 10; i += 1, t += 16) g.sample(80, t);
    for (let i = 0; i < 200; i += 1, t += 16) expect(g.sample(8, t)).toBeNull();
    expect(g.quality).toBe('balanced');
  });

  it('hysteresis: frames between recover and budget keep counting', () => {
    const g = createFrameGovernor('full', { sustainMs: 500, smoothing: 1 });
    expect(g.sample(30, 0)).toBeNull();
    expect(g.sample(20, 300)).toBeNull(); // under budget, over recover: still counting
    expect(g.sample(30, 600)).toBe('balanced');
  });

  it('lite has no composer, no shadows and DPR 1', () => {
    expect(QUALITY.lite).toMatchObject({ composer: false, shadows: false, ao: false, maxDpr: 1 });
    expect(QUALITY.balanced.maxDpr).toBeLessThanOrEqual(1.5);
  });
});

describe('qualityForRenderer', () => {
  it('starts integrated GPUs on balanced, discrete and Apple on full, software on lite', () => {
    expect(qualityForRenderer('ANGLE (Intel, Intel(R) UHD Graphics (0x00009A60) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('balanced');
    expect(qualityForRenderer('ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11)')).toBe('balanced');
    expect(qualityForRenderer('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)')).toBe('full');
    expect(qualityForRenderer('Apple M2')).toBe('full');
    expect(qualityForRenderer('')).toBe('full');
    expect(qualityForRenderer('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))')).toBe('lite');
  });
});
