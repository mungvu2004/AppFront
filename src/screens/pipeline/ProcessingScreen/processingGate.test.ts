import { describe, expect, it } from 'vitest';

import { SAMPLE_SUMMARY, scenarioFor } from './ProcessingScreen.stories';
import { deriveProcessingGate } from './processingGate';

const noDimension = {
  ...SAMPLE_SUMMARY,
  metricLabels: ['81 tường', '95 đối tượng', '0 chuỗi kích thước', '2 phòng', '73,90 m²'],
  noDimensionSentence: 'Không đọc được số kích thước nào.',
};

describe('deriveProcessingGate — tỷ lệ', () => {
  it('không đọc được kích thước và chưa đặt tỷ lệ: đòi "Đặt tỷ lệ"', () => {
    const gate = deriveProcessingGate({ ...scenarioFor('success'), summary: noDimension });
    expect(gate.kind).toBe('needs-scale');
    expect(gate.action?.label).toBe('Đặt tỷ lệ');
    // Tên + màu chung của `SCALE_STATE_VIEWS.missing`, không phải "Sai tỷ lệ" / "chưa kiểm".
    expect(gate.chipLabel).toBe('Xong · chưa có tỷ lệ');
    expect(gate.chipVariant).toBe('violation');
  });

  it('chưa có tỷ lệ: "Sang Duyệt tầng" mở bước Tỷ lệ, không nhảy sang Tường (U28)', () => {
    let opened = '';
    const summary = {
      ...noDimension,
      onCalibrateScale: () => { opened = 'scale'; },
      onReviewWalls: () => { opened = 'walls'; },
    };
    const gate = deriveProcessingGate({ ...scenarioFor('success'), summary });
    gate.secondaryAction?.onClick();
    expect(opened).toBe('scale');
  });

  it('không đọc được kích thước nhưng tầng đã có tỷ lệ đặt tay: sẵn sàng', () => {
    const gate = deriveProcessingGate({
      ...scenarioFor('success'),
      summary: { ...noDimension, scaleKnown: true },
    });
    expect(gate.kind).toBe('ready');
    expect(gate.isScaleOk).toBe(true);
    expect(gate.warnStepIds).toEqual([]);
  });
});
