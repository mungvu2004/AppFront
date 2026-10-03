import { describe, expect, it } from 'vitest';

import { normalizeSpatial } from '@/domain/spatial/normalize';

import { VIEWER_FIXTURE_GRAPH } from './viewerShellFixture';
import { VIEWER_PARTIAL_SPATIAL, VIEWER_FIXTURE_SPATIAL, resolveViewerSpatial } from './viewerShellGateway';

/** Thứ cổng nạp kho đưa vào kho ở mock: đủ tầng, chưa có tường nào (B-V8-04). */
const LEVELS_ONLY = normalizeSpatial({ ...VIEWER_FIXTURE_GRAPH, openings: [], rooms: [], walls: [] });

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

  it('mock + kho có tầng mà 0 tường (cổng nạp bốn tầng chưa có hình) → nhà mẫu, không cảnh rỗng (B-V8-04)', () => {
    expect(resolveViewerSpatial(LEVELS_ONLY, true)).toBe(VIEWER_FIXTURE_SPATIAL);
  });

  it('nối máy chủ thật → kho 0 tường vẫn là kho ấy, không bịa nhà', () => {
    expect(resolveViewerSpatial(LEVELS_ONLY, false)).toBe(LEVELS_ONLY);
  });
});
