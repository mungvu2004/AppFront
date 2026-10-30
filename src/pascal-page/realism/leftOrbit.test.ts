import { describe, expect, it, vi } from 'vitest';

import { orbitAngles, orbitBy, wantsBoxSelect } from './leftOrbit';

describe('leftOrbit (UX41 U20)', () => {
  it('chỉ quét chọn khi giữ Shift/Ctrl/Cmd', () => {
    expect(wantsBoxSelect({ shiftKey: false, ctrlKey: false, metaKey: false })).toBe(false);
    expect(wantsBoxSelect({ shiftKey: true, ctrlKey: false, metaKey: false })).toBe(true);
    expect(wantsBoxSelect({ shiftKey: false, ctrlKey: true, metaKey: false })).toBe(true);
    expect(wantsBoxSelect({ shiftKey: false, ctrlKey: false, metaKey: true })).toBe(true);
  });

  it('kéo hết chiều cao khung = một vòng; kéo phải giảm phương vị như camera-controls', () => {
    const [azimuth, polar] = orbitAngles(500, -250, 500);
    expect(azimuth).toBeCloseTo(-2 * Math.PI);
    expect(polar).toBeCloseTo(Math.PI);
    expect(orbitAngles(10, 0, 0)[0]).toBeCloseTo(-20 * Math.PI);
  });

  it('gọi rotate có chuyển tiếp; không có controls thì bỏ qua', () => {
    const controls = { rotate: vi.fn() };
    orbitBy(controls, 100, 0, 1000);
    expect(controls.rotate).toHaveBeenCalledWith(expect.closeTo(-Math.PI / 5), expect.closeTo(0), true);
    expect(() => orbitBy(undefined, 1, 1, 1)).not.toThrow();
    expect(() => orbitBy({}, 1, 1, 1)).not.toThrow();
  });
});
