/** R-1: màn Xử lý đếm "đối tượng" như màn Xuất — có cả đồ đạc. */
import { describe, expect, it } from 'vitest';

import type { FloorLayerDocument } from '@/api/schemas/spatialLayer';

import { toExtractionSummary } from './processingGateway';

const item = (confidence: number) => ({ reviewed: false, confidence, outline: [] });

describe('toExtractionSummary (R-1)', () => {
  it('đếm đồ đạc và tính cả đồ đạc vào "tin cậy thấp"', () => {
    const document = {
      dimensions: [],
      level: { scaleMillimetresPerPixel: 10 },
      layer: {
        walls: [item(0.9), item(0.5)],
        openings: [item(0.9)],
        furniture: [item(0.4), item(0.95)],
        rooms: [],
      },
    } as unknown as FloorLayerDocument;

    const summary = toExtractionSummary(document, 0.75);

    expect(summary.furnitureCount).toBe(2);
    expect(summary.lowConfidenceCount).toBe(2);
  });

  it('máy không đo được tỷ lệ (scaleSource project_default) thì cờ scaleMissing — chip "Chưa có tỷ lệ"', () => {
    const base = {
      dimensions: [],
      level: { scaleMillimetresPerPixel: 1 },
      layer: { walls: [], openings: [], furniture: [], rooms: [] },
      scaleStatus: 'unresolved',
    };

    expect(toExtractionSummary({ ...base, scaleSource: 'project_default' } as unknown as FloorLayerDocument, null).scaleMissing).toBe(true);
    expect(toExtractionSummary({ ...base, scaleSource: 'pipeline' } as unknown as FloorLayerDocument, null).scaleMissing).toBeUndefined();
  });
});
