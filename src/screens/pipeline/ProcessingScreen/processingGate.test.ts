import { describe, expect, it } from 'vitest';

import { SAMPLE_SUMMARY, scenarioFor } from './ProcessingScreen.stories';
import { deriveProcessingGate } from './processingGate';
import { proposedScaleNoteOf } from './useProcessingScreen';

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

  it('UX-02: không đọc được số nhưng tỷ lệ máy lấy từ ghi chú TL 1:50: không đòi "Đặt tỷ lệ", nói nguồn', () => {
    const gate = deriveProcessingGate({
      ...scenarioFor('success'),
      summary: {
        ...SAMPLE_SUMMARY,
        metricLabels: noDimension.metricLabels,
        scaleSourceNote: 'Tỷ lệ lấy từ ghi chú TL 1:50 trên bản vẽ',
        reviewReasons: ['scaleUnresolved'],
      },
    });
    expect(gate.kind).toBe('needs-review');
    expect(gate.scaleNote).toBe('Tỷ lệ lấy từ ghi chú TL 1:50 trên bản vẽ');
    expect(gate.scaleValue).toBe('Cần kiểm');
    expect(gate.warnStepIds).toEqual([]);
  });
});

describe('proposedScaleNoteOf (UX-02)', () => {
  it('ghi chú TL 1:N khi mọi tầng máy đề xuất cùng một N; khác thì nói ước lượng; còn tầng chưa có tỷ lệ thì null', () => {
    expect(proposedScaleNoteOf([{ scaleProposed: true, scaleNoteRatio: 50 }])).toBe(
      'Tỷ lệ lấy từ ghi chú TL 1:50 trên bản vẽ',
    );
    expect(proposedScaleNoteOf([{ scaleProposed: true }, { hasScale: true }])).toBe(
      'Máy ước lượng tỷ lệ, cần kiểm ở bước Tỷ lệ',
    );
    expect(proposedScaleNoteOf([{ scaleProposed: true, scaleNoteRatio: 50 }, { hasScale: false }])).toBeNull();
    expect(proposedScaleNoteOf([{ hasScale: true }])).toBeNull();
  });
});

describe('deriveProcessingGate — xem 3D (UX-30)', () => {
  it('AI xong: có "Xem mô hình 3D" cạnh nút chính; đang chạy thì không', () => {
    let opened = false;
    const summary = { ...SAMPLE_SUMMARY, onOpenViewer3d: () => { opened = true; } };
    const gate = deriveProcessingGate({ ...scenarioFor('success'), summary });
    expect(gate.viewerAction?.label).toBe('Xem mô hình 3D');
    gate.viewerAction?.onClick();
    expect(opened).toBe(true);
    expect(deriveProcessingGate({ ...scenarioFor('partial'), summary }).viewerAction).toBeUndefined();
  });
});
