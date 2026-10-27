import { describe, expect, it } from 'vitest';

import { buildScaleCheck, inferredDpi, mmPerPxAt } from './scaleCheck';

describe('scaleCheck', () => {
  it('suy DPI từ cạnh ngắn ảnh trên khổ A3 và tính mm/px theo tỷ lệ in', () => {
    expect(inferredDpi(837)).toBeCloseTo(71.58, 1);
    expect(mmPerPxAt(50, 300)).toBeCloseTo(4.233, 3);
    expect(mmPerPxAt(100, 150)).toBeCloseTo(16.933, 3);
  });

  it('chưa có tỷ lệ: chip trung tính, không bịa số', () => {
    const check = buildScaleCheck({ mmPerPx: null, source: null, shortEdgePx: 837, knownDimension: null });
    expect(check.status.label).toBe('Chưa đặt tỷ lệ');
    expect(check.densityValue).toBeNull();
    expect(check.knownCheck).toBeNull();
    expect(check.knownCheckMissing).toBeNull();
    // Bảng đối chiếu chỉ cần cạnh ảnh, nên vẫn có.
    expect(check.table?.rows[0]?.cells).toEqual(['4,2', '8,5', '17,7']);
  });

  it('tỷ lệ vừa đo: số mm/px, ≈ 1:N ở DPI ảnh, câu bảo bấm Áp dụng', () => {
    const check = buildScaleCheck({ mmPerPx: 24.878, source: 'proposed', shortEdgePx: 837, knownDimension: null });
    expect(check.densityValue).toBe('24,878');
    expect(check.ratioLine).toBe('≈ 1:70');
    expect(check.status.sentence).toBe('Đo được tỷ lệ ≈ 1:70, bấm Áp dụng để dùng.');
    expect(check.knownCheckMissing).not.toBeNull();
  });

  it('kiểm chéo khớp trong 2 px và lệch ngoài 2 px', () => {
    const ok = buildScaleCheck({
      mmPerPx: 24.878,
      source: 'stored',
      shortEdgePx: 837,
      knownDimension: { realLength: 4000, pixelLength: 162 },
    });
    expect(ok.knownCheck?.tone).toBe('verified');
    expect(ok.knownCheck?.title).toBe('Đo ra 4.030 mm, bản vẽ ghi 4.000');
    expect(ok.status.label).toBe('Đã đặt');

    const off = buildScaleCheck({
      mmPerPx: 17.887,
      source: 'stored',
      shortEdgePx: 837,
      knownDimension: { realLength: 4000, pixelLength: 162 },
    });
    expect(off.knownCheck?.tone).toBe('attention');
    expect(off.knownCheck?.title).toBe('Đo ra 2.898 mm, bản vẽ ghi 4.000');
    expect(off.status.label).toBe('Đã đặt, lệch kích thước');
  });

  it('[K17] biết cỡ căn: số to là cỡ căn thật, mm/px và 1:N lùi xuống dòng chi tiết', () => {
    const check = buildScaleCheck({
      mmPerPx: 24.878,
      source: 'provisional',
      shortEdgePx: 837,
      knownDimension: null,
      planSizeMm: { widthMm: 9100, heightMm: 7410 },
    });
    expect(check.headline).toBe('≈ 9,1 × 7,4 m');
    expect(check.detailLine).toBe('24,878 mm/px · ≈ 1:70 nếu ảnh là khổ A3');
    expect(check.title).toBe('Cỡ căn theo tỷ lệ tạm');
    expect(check.status.sentence).toBe('Đang tạm dùng tỷ lệ cho căn ≈ 9,1 × 7,4 m. Đo 2 điểm để xác nhận.');
  });

  it('chưa biết cỡ căn: số to vẫn là 1:N, không dòng chi tiết', () => {
    const check = buildScaleCheck({ mmPerPx: 24.878, source: 'stored', shortEdgePx: 837, knownDimension: null });
    expect(check.headline).toBe('≈ 1:70');
    expect(check.detailLine).toBeNull();
  });

  it('không có cạnh ảnh: không DPI, không bảng', () => {
    const check = buildScaleCheck({ mmPerPx: 12, source: 'stored', shortEdgePx: null, knownDimension: null });
    expect(check.ratioLine).toBeNull();
    expect(check.dpiNote).toBeNull();
    expect(check.table).toBeNull();
    expect(check.status.sentence).toBe('Đang dùng tỷ lệ 12 mm/px.');
  });
});
