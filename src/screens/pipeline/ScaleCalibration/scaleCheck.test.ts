import { describe, expect, it } from 'vitest';

import {
  buildScaleCheck,
  inferredDpi,
  isPlanSizeImplausible,
  mmPerPxAt,
  mmPerPxFromFlatArea,
  outlinesAreaM2,
  parseFlatAreaM2,
} from './scaleCheck';

describe('scaleCheck', () => {
  it('U11: suy mm/px từ diện tích căn — diện tích theo bình phương tỷ lệ', () => {
    expect(parseFlatAreaM2('68,94')).toBe(68.94);
    expect(parseFlatAreaM2('68.94 m²')).toBe(68.94);
    expect(parseFlatAreaM2('abc')).toBeNull();
    expect(parseFlatAreaM2('0')).toBeNull();
    // Hình vuông 10 000 × 10 000 mm = 100 m² ở 10 mm/px; căn thật 25 m² → cạnh nửa → 5 mm/px.
    const square = [{ x: 0, y: 0 }, { x: 10_000, y: 0 }, { x: 10_000, y: 10_000 }, { x: 0, y: 10_000 }];
    expect(outlinesAreaM2([square])).toBeCloseTo(100, 6);
    expect(mmPerPxFromFlatArea(25, 10, outlinesAreaM2([square]))).toBeCloseTo(5, 6);
    expect(mmPerPxFromFlatArea(25, 10, 0)).toBeNull();
  });

  it('suy DPI từ cạnh ngắn ảnh trên khổ A3 và tính mm/px theo tỷ lệ in', () => {
    expect(inferredDpi(837)).toBeCloseTo(71.58, 1);
    expect(mmPerPxAt(50, 300)).toBeCloseTo(4.233, 3);
    expect(mmPerPxAt(100, 150)).toBeCloseTo(16.933, 3);
  });

  it('chưa có tỷ lệ: chip đỏ tên chung "Chưa có tỷ lệ", không bịa số', () => {
    const check = buildScaleCheck({ mmPerPx: null, source: null, shortEdgePx: 837, knownDimension: null });
    expect(check.status.label).toBe('Chưa có tỷ lệ');
    expect(check.status.tone).toBe('violation');
    expect(check.densityValue).toBeNull();
    expect(check.knownCheck).toBeNull();
    expect(check.knownCheckMissing).toBeNull();
    // Bảng đối chiếu chỉ cần cạnh ảnh, nên vẫn có.
    expect(check.table?.rows[0]?.cells).toEqual(['4,2', '8,5', '17,7']);
  });

  it('tỷ lệ vừa đo: số mm/px, ≈ 1:N ở DPI ảnh, câu chỉ nói tình hình', () => {
    const check = buildScaleCheck({ mmPerPx: 24.878, source: 'proposed', shortEdgePx: 837, knownDimension: null });
    expect(check.densityValue).toBe('24,878');
    expect(check.ratioLine).toBe('≈ 1:70');
    expect(check.status.sentence).toBe('Đo được tỷ lệ ≈ 1:70.');
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
    expect(ok.status.label).toBe('Đã xác nhận');

    const off = buildScaleCheck({
      mmPerPx: 17.887,
      source: 'stored',
      shortEdgePx: 837,
      knownDimension: { realLength: 4000, pixelLength: 162 },
    });
    expect(off.knownCheck?.tone).toBe('attention');
    expect(off.knownCheck?.title).toBe('Đo ra 2.898 mm, bản vẽ ghi 4.000');
    expect(off.status.label).toBe('Đã xác nhận, lệch kích thước');
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
    expect(check.detailLine).toBe('24,878 mm/px');
    expect(check.title).toBe('Cỡ căn theo tỷ lệ máy đo');
    expect(check.status.label).toBe('Tỷ lệ cần kiểm');
    expect(check.status.sentence).toBe('Đang tạm dùng tỷ lệ cho căn ≈ 9,1 × 7,4 m.');
  });

  it('[UX-R2 K27/K50] tầng máy không đo được: nhãn đỏ "Chưa có tỷ lệ", cỡ căn ghi "chắc chắn sai"', () => {
    const check = buildScaleCheck({
      mmPerPx: 1,
      source: 'missing',
      shortEdgePx: 837,
      knownDimension: null,
      planSizeMm: { widthMm: 600, heightMm: 500 },
    });
    expect(check.status.tone).toBe('violation');
    expect(check.status.label).toBe('Chưa có tỷ lệ');
    expect(check.headline).toBe('≈ 0,6 × 0,5 m (chắc chắn sai)');
    expect(check.detailLine).toBe('1 mm/px');
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

  it('UX41 U34: căn 91 × 86 m hay 0,7 m là vô lý, căn 10 × 9 m thì không', () => {
    expect(isPlanSizeImplausible({ widthMm: 91_000, heightMm: 85_900 }, 3000, 40_000)).toBe(true);
    expect(isPlanSizeImplausible({ widthMm: 700, heightMm: 600 }, 3000, 40_000)).toBe(true);
    expect(isPlanSizeImplausible({ widthMm: 10_100, heightMm: 9_400 }, 3000, 40_000)).toBe(false);
  });
});
