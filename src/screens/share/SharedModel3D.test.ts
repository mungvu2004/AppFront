import { describe, expect, it } from 'vitest';

import type { SpatialGraph } from '@/domain/spatial/types';
import { isClipped } from '@/screens/viewer/ViewerShell/viewerSectionPlane';
import type { ViewerSceneFrame } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import { buildParts } from '@/lib/three/build/buildCore';
import type { BuildableLevel } from '@/lib/three/build/floor';

import {
  ceilingCut,
  furnitureBoxes,
  orbitFrame,
  roomLabels,
  tokenOfSharedEntity,
  tokenOfSharedPart,
  zoomFrame,
} from './sharedModel3dFrame';

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

  const square = [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 3000 },
    { x: 0, y: 3000 },
  ];
  const room = (id: string, usage: string, name: string) => ({ id, levelId: 'L-1', usage, name, areaM2: 12, outline: square });
  const graph = {
    levels: [{ id: 'L-1', elevationMm: 0, heightMm: 3000 }],
    rooms: [room('R-1', 'bedroom', 'phòng 1'), room('R-2', 'livingRoom', 'phòng 2'), room('R-3', 'other', 'kho')],
    furniture: [
      { id: 'F-1', levelId: 'L-1', kind: 'bed', centre: { x: 2000, y: 1500 }, boundingBox: { min: { x: -1000, y: -800 }, max: { x: 1000, y: 800 } }, rotationDeg: 90 },
      { id: 'F-2', levelId: 'L-1', kind: 'chair', centre: { x: 0, y: 0 }, boundingBox: { min: { x: 0, y: 0 }, max: { x: 400, y: 400 } }, rotationDeg: 0, suggested: true },
      { id: 'F-3', levelId: 'L-2', kind: 'table', centre: { x: 0, y: 0 }, boundingBox: { min: { x: 0, y: 0 }, max: { x: 400, y: 400 } }, rotationDeg: 0 },
    ],
  } as unknown as SpatialGraph;

  it('[UX-11] sàn mỗi phòng tô theo công năng; phòng không rõ công năng và bộ phận khác dùng màu theo loại', () => {
    const tokenOf = tokenOfSharedEntity(graph);
    expect(tokenOf('R-1', 'floorSlab')).not.toBeNull();
    expect(tokenOf('R-1', 'floorSlab')).not.toBe(tokenOf('R-2', 'floorSlab'));
    expect(tokenOf('R-3', 'floorSlab')).toBeNull();
    expect(tokenOf('R-1', 'ceiling')).toBeNull();
  });

  it('[UX-11] nội thất thành hộp thấp: xoay theo góc, cao theo loại, bỏ đồ gợi ý và đồ tầng khác', () => {
    const boxes = furnitureBoxes(graph, 'L-1');
    expect(boxes.map((box) => box.id)).toEqual(['F-1']);
    const bed = boxes[0];
    if (bed === undefined) return;
    expect(bed.heightMm).toBe(500);
    const xs = bed.outline.map((p) => p.x);
    // Giường 2000 × 1600 xoay 90°: bề ngang trên mặt bằng còn 1600.
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(1600);
    const level = { id: 'L-1', elevationMm: 0, heightMm: 3000 } as unknown as BuildableLevel;
    const parts = buildParts({ kind: 'furniture', key: bed.id, levelId: level.id, piece: bed, level });
    expect(parts).toHaveLength(1);
    expect(parts[0]?.kind).toBe('furniture');
    const heights = Array.from(parts[0]?.position ?? []).filter((_, index) => index % 3 === 1);
    expect(Math.max(...heights)).toBeCloseTo(0.5);
    expect(Math.min(...heights)).toBeCloseTo(0);
  });

  it('[UX-11][UX-23] nhãn phòng: tên theo công năng + diện tích, ghi "(tạm)" khi chưa đặt tỷ lệ', () => {
    const [first] = roomLabels(graph, 'L-1', true);
    expect(first?.name).toBe('Phòng ngủ');
    expect(first?.area).toMatch(/m² \(tạm\)$/u);
    expect(roomLabels(graph, 'L-1', false)[0]?.area).not.toMatch(/tạm/u);
    expect(first?.at.x).toBeCloseTo(2);
    expect(first?.at.y).toBeCloseTo(0.1);
    expect(first?.at.z).toBeCloseTo(1.5);
    expect(roomLabels(graph, 'L-9', true)).toEqual([]);
  });
});
