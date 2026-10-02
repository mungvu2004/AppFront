import { describe, expect, it } from 'vitest';

import { VIEWER_PARTIAL_SPATIAL, VIEWER_FIXTURE_SPATIAL, resolveViewerSpatial } from './viewerShellGateway';

describe('resolveViewerSpatial — route tách tầng và route đo dùng cùng luật nhà mẫu với /3d', () => {
  it('mock + kho rỗng → nhà mẫu (không còn khung nhìn rỗng 300×150)', () => {
    expect(resolveViewerSpatial(null, true)).toBe(VIEWER_FIXTURE_SPATIAL);
  });

  it('kho có đồ thị → đúng đồ thị trong kho, kể cả ở chế độ mock', () => {
    expect(resolveViewerSpatial(VIEWER_PARTIAL_SPATIAL, true)).toBe(VIEWER_PARTIAL_SPATIAL);
  });

  it('nối máy chủ thật → kho rỗng vẫn là kho rỗng', () => {
    expect(resolveViewerSpatial(null, false)).toBeNull();
  });
});
