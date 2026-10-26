/**
 * FIX-P0-15: cổng Xử lý đọc N16 `readiness`. Lỗi gốc: có chuỗi kích thước mà `scaleStatus: unresolved`
 * (tỷ lệ tạm) vẫn ra 'ready' — "Sẵn sàng duyệt tầng".
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FloorLayerDocument } from '@/api/schemas/spatialLayer';

import { ProcessingFloorChips } from './ProcessingFloorChips';
import { SAMPLE_SUMMARY, scenarioFor } from './ProcessingScreen.stories';
import { CALIBRATE_LABEL, deriveProcessingGate, GO_REVIEW_LABEL, REVIEW_REASON_SENTENCE } from './processingGate';
import { toExtractionSummary } from './processingGateway';
import type { ProcessingReviewReason } from './types';

afterEach(cleanup);

/** Tầng có 1 chuỗi kích thước; `extra` thêm `scaleStatus`/`readiness`. */
const documentWith = (extra: Record<string, unknown>) =>
  ({
    dimensions: [{}],
    level: { scaleMillimetresPerPixel: 10 },
    layer: { walls: [], openings: [], furniture: [], rooms: [] },
    ...extra,
  }) as unknown as FloorLayerDocument;

const gateWith = (reviewReasons: readonly ProcessingReviewReason[]) => {
  const onCalibrateScale = vi.fn();
  const onReviewWalls = vi.fn();
  const gate = deriveProcessingGate({
    ...scenarioFor('success'),
    summary: { ...SAMPLE_SUMMARY, reviewReasons, onCalibrateScale, onReviewWalls },
  });
  return { gate, onCalibrateScale, onReviewWalls };
};

describe('toExtractionSummary — readiness', () => {
  it('BE chưa trả readiness, tỷ lệ tạm: suy needsReview/scaleUnresolved từ scaleStatus', () => {
    const summary = toExtractionSummary(documentWith({ scaleStatus: 'unresolved' }), 0.75);
    expect(summary.readiness).toEqual({ state: 'needsReview', reasons: ['scaleUnresolved'] });
  });

  it('readiness của BE thắng scaleStatus', () => {
    const readiness = { state: 'ready', reasons: [] };
    const summary = toExtractionSummary(documentWith({ readiness, scaleStatus: 'unresolved' }), 0.75);
    expect(summary.readiness).toEqual(readiness);
  });

  it('tỷ lệ đã đặt, BE không trả readiness: không có readiness', () => {
    expect(toExtractionSummary(documentWith({}), 0.75).readiness).toBeUndefined();
  });
});

describe('deriveProcessingGate — readiness', () => {
  it('★ có kích thước + tỷ lệ tạm: không ra "ready", nút chính là Đặt tỷ lệ', () => {
    const { gate, onCalibrateScale, onReviewWalls } = gateWith(['scaleUnresolved']);

    expect(gate.kind).not.toBe('ready');
    expect(gate.kind).toBe('needs-review');
    expect(gate.isScaleOk).toBe(false);
    expect(gate.action?.label).toBe(CALIBRATE_LABEL);
    gate.action?.onClick();
    expect(onCalibrateScale).toHaveBeenCalledOnce();
    // Duyệt tầng vẫn là lối mềm, không chặn cứng.
    expect(gate.secondaryAction?.label).toBe(GO_REVIEW_LABEL);
    gate.secondaryAction?.onClick();
    expect(onReviewWalls).toHaveBeenCalledOnce();
  });

  it('readiness ready (không còn lý do): ra "ready"', () => {
    expect(gateWith([]).gate.kind).toBe('ready');
  });

  it.each([
    ['scaleUnresolved', 'scale'],
    ['criticalIssues', 'review'],
    ['fallbackWallModel', 'review'],
    ['fallbackObjectModel', 'review'],
    ['fallbackTextModel', 'review'],
  ] as const)('%s: đúng câu và đúng đích nút (%s)', (reason, target) => {
    const { gate, onCalibrateScale, onReviewWalls } = gateWith([reason]);

    expect(gate.reviewRows).toEqual([{ reason, sentence: REVIEW_REASON_SENTENCE[reason], target }]);
    gate.action?.onClick();
    expect(onCalibrateScale).toHaveBeenCalledTimes(target === 'scale' ? 1 : 0);
    expect(onReviewWalls).toHaveBeenCalledTimes(target === 'review' ? 1 : 0);
    expect(gate.action?.label).toBe(target === 'scale' ? CALIBRATE_LABEL : GO_REVIEW_LABEL);
  });

  it('nhiều lý do: mỗi lý do một dòng, tiêu đề đếm đúng', () => {
    const { gate } = gateWith(['scaleUnresolved', 'criticalIssues']);
    expect(gate.reviewRows?.map((row) => row.target)).toEqual(['scale', 'review']);
    expect(gate.title).toBe('Còn 2 việc cần xem lại');
  });
});

describe('ProcessingFloorChips — "Cần xem lại"', () => {
  it('chip tầng hiện nhãn khi có reviewLabel', () => {
    render(
      <ProcessingFloorChips
        floors={[
          {
            id: 'L-1',
            label: 'Tầng 1',
            status: 'done',
            statusLabel: 'đã xong',
            isActive: true,
            reviewLabel: 'Cần xem lại',
          },
        ]}
      />,
    );
    expect(screen.getByText('Cần xem lại')).toBeTruthy();
  });
});
