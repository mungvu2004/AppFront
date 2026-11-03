import { describe, expect, it } from 'vitest';

import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Opening, OpeningId, WallId } from '@/domain/spatial/types';
import { scaleFromRatio } from '@/domain/units/scale';
import { millimetres } from '@/domain/units/types';

import {
  WALL_LAYER_FIXTURE_BUILDING,
  WALL_LAYER_FIXTURE_LEVEL,
  WALL_LAYER_FIXTURE_WALLS,
} from '../WallLayerReview/wallLayerReviewFixture';
import { openingSymbolsOf } from './openingSymbols';

const level = WALL_LAYER_FIXTURE_LEVEL;
const scale = scaleFromRatio(level.scaleMillimetresPerPixel!);
const [first, second] = WALL_LAYER_FIXTURE_WALLS;

const opening = (id: string, wallId: WallId, kind: Opening['kind'], swing: Opening['swing']): Opening => ({
  id: id as OpeningId,
  wallId,
  kind,
  offsetMm: millimetres(1000),
  widthMm: millimetres(900),
  heightMm: millimetres(2100),
  sillHeightMm: millimetres(0),
  swing,
  confidence: 0.9,
  source: 'ai',
  reviewed: false,
});

const graph = normalizeSpatial({
  building: WALL_LAYER_FIXTURE_BUILDING,
  levels: [level],
  walls: [first!, second!],
  openings: [opening('D-0000000001', first!.id, 'door', 'left'), opening('D-0000000002', second!.id, 'window', 'fixed')],
  furniture: [],
  rooms: [],
  axes: [],
  dimensions: [],
  notes: [],
});

describe('openingSymbolsOf', () => {
  it('đặt cửa ở tâm lỗ mở trên tim tường, bằng pixel bản vẽ', () => {
    const symbols = openingSymbolsOf(graph, [first!, second!], level, scale);

    expect(symbols.map((symbol) => [symbol.id, symbol.kind])).toEqual([
      ['D-0000000001', 'door'],
      ['D-0000000002', 'window'],
    ]);
    /* W-001 chạy (0,0)→(2500,0); tâm = 1000 + 450 = 1450 mm, tỉ lệ 12 mm/px. */
    expect(symbols[0]!.transform).toMatch(/^translate\(120\.8\d* 0\) rotate\(0\)/);
    expect(symbols[0]!.symbol.hasSwingArc).toBe(true);
    expect(symbols[1]!.symbol.hasSwingArc).toBe(false);
  });

  it('chỉ vẽ ô mở trên tường đang vẽ; không đồ thị thì rỗng', () => {
    expect(openingSymbolsOf(graph, [second!], level, scale).map((symbol) => symbol.id)).toEqual(['D-0000000002']);
    expect(openingSymbolsOf(null, [first!], level, scale)).toEqual([]);
  });
});
