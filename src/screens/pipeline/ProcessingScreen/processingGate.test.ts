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
