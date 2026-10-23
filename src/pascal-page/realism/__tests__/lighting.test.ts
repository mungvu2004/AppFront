import { describe, expect, it } from 'vitest';

import { ceilingCastsShadow, DAY_HDRI_URL, gradientAt, HDRI_URL, hdriAutoScale, hdriUrlFor, mixGradient, shouldLoadHdri } from '../lighting';

describe('lighting (R4)', () => {
  it('chỉ tải HDRI khi WebGPU + cờ bật + chủ đề sáng', () => {
    expect(shouldLoadHdri({ backend: 'webgpu', flag: true, appearance: 'light' })).toBe(true);
    expect(shouldLoadHdri({ backend: 'webgl', flag: true, appearance: 'light' })).toBe(false);
    expect(shouldLoadHdri({ backend: 'unknown', flag: true, appearance: 'light' })).toBe(false);
    expect(shouldLoadHdri({ backend: 'webgpu', flag: false, appearance: 'light' })).toBe(false);
    expect(shouldLoadHdri({ backend: 'webgpu', flag: true, appearance: 'dark' })).toBe(false);
  });

  it('pha gradient: hàng 0 là đỉnh trời, trọng số 0 giữ nguyên, alpha không đổi', () => {
    const data = new Float32Array(1 * 2 * 4).fill(2);
    mixGradient(data, 1, 2, 0);
    expect([...data]).toEqual(new Array(8).fill(2));
    mixGradient(data, 1, 2, 1);
    expect(data[0]).toBeCloseTo(gradientAt(0.5)[0]); // hàng trên = trời
    expect(data[4]).toBeCloseTo(gradientAt(-0.5)[0]); // hàng dưới = đất
    expect(data[3]).toBe(2);
    expect(data[7]).toBe(2);
  });

  it('F4: hdriAutoScale đưa HDRI về độ sáng trung bình của trời gradient', () => {
    const w = 4;
    const h = 32;
    const grad = new Float32Array(w * h * 4);
    mixGradient(grad, w, h, 1); // ảnh = gradient nguyên → hệ số 1
    expect(hdriAutoScale(grad, w, h)).toBeCloseTo(1, 5);
    expect(hdriAutoScale(grad.map((v) => v * 5), w, h)).toBeCloseTo(0.2, 5); // sáng gấp 5 → 1/5
    expect(hdriAutoScale(new Float32Array(w * h * 4), w, h)).toBe(1); // ảnh đen: không chia 0
  });

  it('gói 2B: Ban ngày (studio) dùng HDRI trời trưa, Nắng chiều giữ Venice', () => {
    expect(hdriUrlFor('studio')).toBe(DAY_HDRI_URL);
    expect(hdriUrlFor('sunset')).toBe(HDRI_URL);
    expect(DAY_HDRI_URL).not.toBe(HDRI_URL);
  });

  it('gói 2B: trần đổ bóng chỉ khi chủ đề sáng, mức Vừa/Cao, camera dưới trần', () => {
    const base = { appearance: 'light', tier: 'medium', cameraY: 1.6, ceilingY: 2.4 };
    expect(ceilingCastsShadow(base)).toBe(true);
    expect(ceilingCastsShadow({ ...base, tier: 'high' })).toBe(true);
    expect(ceilingCastsShadow({ ...base, tier: 'low' })).toBe(false);
    expect(ceilingCastsShadow({ ...base, appearance: 'dark' })).toBe(false);
    expect(ceilingCastsShadow({ ...base, cameraY: 12 })).toBe(false); // nhìn từ trên: nhà không tối
  });
});
