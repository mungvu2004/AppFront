import { describe, expect, it } from 'vitest';

import { summarizeQualityGate } from './inputQualitySummary';
import type { InputQualityGateModel, QualityLevel } from './types';

const footer = { primaryLabel: 'Tiếp tục xử lý', secondaryLabel: 'Tải bản vẽ khác' } as InputQualityGateModel['footer'];

function input(status: InputQualityGateModel['status'], levels: QualityLevel[], noDrawingNotice: string | null = null) {
  const metrics = levels.map((level) => ({ level })) as unknown as InputQualityGateModel['metrics'];
  return { status, metrics, noDrawingNotice, footer };
}

describe('summarizeQualityGate', () => {
  it('ảnh có chỉ số kém: cảnh báo không chặn, đếm đúng, câu đồng ý dưới nút', () => {
    const summary = summarizeQualityGate(input('ready', ['poor', 'good', 'attention', 'poor']));

    expect(summary.kind).toBe('warning');
    expect(summary.chipText).toBe('Ảnh mờ, vẫn xử lý được');
    expect(summary.sentence).toBe('2 chỉ số kém, 1 cần chú ý');
    expect(summary.primaryLabel).toBe('Xử lý dù ảnh mờ');
    expect(summary.secondaryLabel).toBe('Tải ảnh nét hơn');
    expect(summary.consent).toMatch(/^Bấm là chấp nhận/u);
  });

  it('chỉ có mức cần chú ý thì không nói "chỉ số kém"', () => {
    expect(summarizeQualityGate(input('ready', ['attention', 'good'])).sentence).toBe('1 cần chú ý');
  });

  it('mọi chỉ số tốt: ảnh đạt, không câu đồng ý', () => {
    const summary = summarizeQualityGate(input('empty', ['good', 'good', 'good', 'good']));

    expect(summary.chipText).toBe('Ảnh đạt');
    expect(summary.sentence).toBe('4/4 chỉ số tốt');
    expect(summary.primaryLabel).toBe('Bắt đầu xử lý');
    expect(summary.consent).toBeNull();
  });

  it('đang đọc, lỗi, chưa có bản vẽ, chưa đo: giữ nhãn nút của hook, không bịa số', () => {
    expect(summarizeQualityGate(input('loading', [])).primaryLabel).toBe('Tiếp tục xử lý');
    expect(summarizeQualityGate(input('error', [])).chipText).toBe('Không đọc được kết quả');
    expect(summarizeQualityGate(input('empty', [], 'Chưa có')).kind).toBe('noDrawing');
    expect(summarizeQualityGate(input('partial', [])).sentence).toBeNull();
  });
});
