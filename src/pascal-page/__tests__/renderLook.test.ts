// @vitest-environment node
/**
 * Dáng render ấm (`../renderLook`): đè chủ đề `night` + SSGI tại chỗ, giữ `appearance`/tên,
 * gọi lần hai không đổi gì. Đối tượng ở đây là bản giả cùng hình với của Pascal.
 */
import { describe, expect, it } from 'vitest';

import { RENDER_LOOK_PALETTE } from '@/lib/pascal/scenePalette';

import { applyRenderLook } from '../renderLook';

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
const ssgiLike = () => ({ enabled: true, sliceCount: 1, stepCount: 4, radius: 1, aoIntensity: 1.5 });

describe('applyRenderLook', () => {
  it('đặt màu/đèn/phơi sáng/SSGI, giữ các trường khác', () => {
    const theme = nightLike();
    const ssgi = ssgiLike();
    applyRenderLook(theme, ssgi);
    expect(theme).toMatchObject({ id: 'night', name: 'Night', appearance: 'dark' });
    expect(theme.background).toBe(RENDER_LOOK_PALETTE.background);
    expect(theme.backgroundSky).toBe(RENDER_LOOK_PALETTE.sky);
    expect(theme.ambient).toEqual({ color: RENDER_LOOK_PALETTE.ambient, intensity: 0.5 });
    expect(theme.lights).toHaveLength(2);
    expect(theme.lights[0]).toMatchObject({ color: RENDER_LOOK_PALETTE.key, castShadow: true });
    expect(theme.toneMappingExposure).toBe(0.86);
    expect(theme.clayTints.wall).toBe(RENDER_LOOK_PALETTE.clayWall);
    expect(ssgi).toEqual({ enabled: true, sliceCount: 2, stepCount: 6, radius: 2, aoIntensity: 1.5 });
  });

  it('gọi lần hai: không đổi gì', () => {
    const theme = nightLike();
    const ssgi = ssgiLike();
    applyRenderLook(theme, ssgi);
    const once = structuredClone({ theme, ssgi });
    applyRenderLook(theme, ssgi);
    expect({ theme, ssgi }).toEqual(once);
  });
});
