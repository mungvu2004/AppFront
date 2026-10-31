import { describe, expect, it } from 'vitest';

import type { SpatialGraph } from '@/domain/spatial/types';
import { isClipped } from '@/screens/viewer/ViewerShell/viewerSectionPlane';
import type { ViewerSceneFrame } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import { ceilingCut, orbitFrame, tokenOfSharedPart, zoomFrame } from './sharedModel3dFrame';

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

  it('[UX-11] cắt bỏ trần tầng đang xem, giữ sàn; sàn và cửa khác màu tường', () => {
    const graph = { levels: [{ id: 'L-1', elevationMm: 3000, heightMm: 3000 }] } as unknown as SpatialGraph;
    const plane = ceilingCut(graph, 'L-1');
    expect(plane).not.toBeNull();
    if (plane === null) return;
    expect(isClipped(plane, 0, 6.1, 0)).toBe(true);
    expect(isClipped(plane, 0, 3.0, 0)).toBe(false);
    expect(ceilingCut(graph, 'L-9')).toBeNull();
    expect(tokenOfSharedPart('floorSlab')).not.toBe(tokenOfSharedPart('wall'));
    expect(tokenOfSharedPart('opening')).not.toBe(tokenOfSharedPart('wall'));
  });
});
