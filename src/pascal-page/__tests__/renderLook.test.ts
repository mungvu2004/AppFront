// @vitest-environment node
/**
 * Dáng render ấm (`../renderLook`): đè chủ đề `night` + SSGI tại chỗ, giữ `appearance`/tên,
 * gọi lần hai không đổi gì. Đối tượng ở đây là bản giả cùng hình với của Pascal.
 */
import { describe, expect, it } from 'vitest';

import { RENDER_LOOK_PALETTE } from '@/lib/pascal/scenePalette';

import { applyRenderLook, RENDER_LOOK_TIERS } from '../renderLook';

const nightLike = () => ({
  id: 'night',
  name: 'Night',
  appearance: 'dark' as const,
  background: 'x',
  backgroundSky: 'x',
  ground: 'x',
  ambient: { color: 'x', intensity: 0 },
  hemi: { sky: 'x', ground: 'x', intensity: 0 },
  lights: [{ position: [0, 0, 0] as [number, number, number], color: 'x', intensity: 0, castShadow: true }],
  toneMappingExposure: 1,
  clayTints: { wall: 'x' },
});
const ssgiLike = () => ({ enabled: true, sliceCount: 1, stepCount: 4, radius: 1, aoIntensity: 1.5, giIntensity: 0 });

describe('applyRenderLook', () => {
  it('có WebGPU: ánh sáng nền thấp, đèn chính ấm mạnh, phơi sáng 1, SSGI có GI; giữ các trường khác', () => {
    const theme = nightLike();
    const ssgi = ssgiLike();
    applyRenderLook(theme, ssgi, true);
    expect(theme).toMatchObject({ id: 'night', name: 'Night', appearance: 'dark' });
    expect(theme.background).toBe(RENDER_LOOK_PALETTE.background);
    expect(theme.backgroundSky).toBe(RENDER_LOOK_PALETTE.sky);
    expect(theme.ambient).toEqual({ color: RENDER_LOOK_PALETTE.ambient, intensity: 0.2 });
    expect(theme.hemi.intensity).toBe(0.2);
    expect(theme.lights).toHaveLength(2);
    expect(theme.lights[0]).toMatchObject({ color: RENDER_LOOK_PALETTE.key, intensity: 2.3, castShadow: true });
    expect(theme.toneMappingExposure).toBe(1);
    expect(theme.clayTints.wall).toBe(RENDER_LOOK_PALETTE.clayWall);
    expect(ssgi).toEqual({ enabled: true, sliceCount: 2, stepCount: 8, radius: 2, aoIntensity: 1.5, giIntensity: 0.6 });
  });

  it('không WebGPU (không hậu kỳ, không GI/AO bù): ánh sáng nền cao hơn bậc WebGPU', () => {
    const theme = nightLike();
    applyRenderLook(theme, ssgiLike(), false);
    expect(theme.ambient.intensity).toBe(RENDER_LOOK_TIERS.low.ambient);
    expect(theme.ambient.intensity).toBeGreaterThan(RENDER_LOOK_TIERS.high.ambient);
    expect(theme.hemi.intensity).toBeGreaterThan(RENDER_LOOK_TIERS.high.hemi);
    expect(theme.lights[0]!.intensity).toBe(RENDER_LOOK_TIERS.low.key);
  });

  it('mặc định theo navigator.gpu', () => {
    const theme = nightLike();
    applyRenderLook(theme, ssgiLike());
    const tier = typeof navigator !== 'undefined' && 'gpu' in navigator ? 'high' : 'low';
    expect(theme.ambient.intensity).toBe(RENDER_LOOK_TIERS[tier].ambient);
  });

  it('phông xám trung tính sáng hơn bản nâu tối cũ, tường sáng vẫn nổi trên nền', () => {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const { background, sky, ground, clayWall } = RENDER_LOOK_PALETTE;
    for (const c of [background, sky, ground]) {
      expect(lum(c)).toBeGreaterThan(51.4 + 40); // 51.4 = độ sáng của nền nâu tối cũ
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
      expect(Math.max(r!, g!, b!) - Math.min(r!, g!, b!)).toBeLessThanOrEqual(6); // trung tính
    }
    expect(lum(ground)).toBeLessThan(lum(background));
    expect(lum(clayWall) - lum(background)).toBeGreaterThan(70);
  });

  it('gọi lần hai: không đổi gì', () => {
    const theme = nightLike();
    const ssgi = ssgiLike();
    applyRenderLook(theme, ssgi, true);
    const once = structuredClone({ theme, ssgi });
    applyRenderLook(theme, ssgi, true);
    expect({ theme, ssgi }).toEqual(once);
  });
});
