import { describe, expect, it } from 'vitest';

import type { ViewerSceneFrame } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import { orbitFrame, zoomFrame } from './sharedModel3dFrame';

const frame = { azimuthRad: 0, polarRad: 1, distanceM: 10 } as ViewerSceneFrame;

describe('[U17] camera cảnh 3D trang chia sẻ', () => {
  it('kéo ngang xoay hướng, kéo dọc đổi góc chúc nhưng không lật qua đỉnh hay xuống dưới sàn', () => {
    expect(orbitFrame(frame, 100, 0).azimuthRad).toBeCloseTo(-0.8);
    expect(orbitFrame(frame, 0, 1000).polarRad).toBe(0.2);
    expect(orbitFrame(frame, 0, -1000).polarRad).toBe(1.45);
  });

  it('phóng/thu kẹp trong 0,2–5 lần khoảng cách đầu', () => {
    expect(zoomFrame(frame, 2, 10).distanceM).toBe(5);
    expect(zoomFrame(frame, 100, 10).distanceM).toBe(2);
    expect(zoomFrame(frame, 0.01, 10).distanceM).toBe(50);
  });
});
