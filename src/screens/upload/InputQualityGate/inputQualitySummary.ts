/**
 * Một nguồn trạng thái cho đầu màn và chân khung kết quả (NGUYEN-TAC-BO-CUC §1):
 * chip, câu đếm chỉ số, tiêu đề khung phải, nhãn hai nút và câu đồng ý dưới
 * nút chính đều sinh từ đây, nên không chỗ nào nói khác chỗ nào.
 *
 * Thuần: chỉ đếm `metrics[].level` mà hook đã gửi — màn không tự đặt ngưỡng.
 * Ảnh kém/cần chú ý là CẢNH BÁO, không chặn: bấm nút chính chính là đồng ý.
 */

import type { InputQualityGateModel } from './types';

export type QualitySummaryKind = 'loading' | 'error' | 'noDrawing' | 'unmeasured' | 'warning' | 'pass';

export interface QualitySummary {
  readonly kind: QualitySummaryKind;
  readonly chipVariant: 'neutral' | 'attention' | 'violation';
  readonly chipText: string;
  /** Câu có số cạnh chip; `null` khi không có số nào đúng để nói. */
  readonly sentence: string | null;
  readonly sideTitle: string;
  readonly primaryLabel: string;
  readonly secondaryLabel: string;
  /** Câu đồng ý ngay dưới nút chính — chỉ khi ảnh có chỉ số kém/cần chú ý. */
  readonly consent: string | null;
}

type SummaryInput = Pick<InputQualityGateModel, 'status' | 'metrics' | 'noDrawingNotice' | 'footer'>;

export function summarizeQualityGate(model: SummaryInput): QualitySummary {
  const fallback = {
    primaryLabel: model.footer.primaryLabel,
    secondaryLabel: model.footer.secondaryLabel,
    consent: null,
  };

  if (model.status === 'loading') {
    return { ...fallback, kind: 'loading', chipVariant: 'neutral', chipText: 'Đang đọc kết quả', sentence: null, sideTitle: 'Kết quả đo' };
  }
  if (model.status === 'error') {
    return { ...fallback, kind: 'error', chipVariant: 'violation', chipText: 'Không đọc được kết quả', sentence: 'Chưa đo được chỉ số nào', sideTitle: 'Chưa đo được' };
  }
  if (model.noDrawingNotice !== null) {
    return { ...fallback, kind: 'noDrawing', chipVariant: 'neutral', chipText: 'Chưa có bản vẽ', sentence: null, sideTitle: 'Chưa đo được' };
  }

  const total = model.metrics.length;
  if (total === 0) {
    return { ...fallback, kind: 'unmeasured', chipVariant: 'neutral', chipText: 'Chưa đo xong', sentence: null, sideTitle: 'Kết quả đo' };
  }

  const poor = model.metrics.filter((metric) => metric.level === 'poor').length;
  const attention = model.metrics.filter((metric) => metric.level === 'attention').length;

  if (poor + attention === 0) {
    return {
      kind: 'pass',
      chipVariant: 'neutral',
      chipText: 'Ảnh đạt',
      sentence: `${total}/${total} chỉ số tốt`,
      sideTitle: 'Kết quả đo',
      primaryLabel: 'Bắt đầu xử lý',
      secondaryLabel: 'Tải ảnh khác',
      consent: null,
    };
  }

  const parts = [poor > 0 ? `${poor} chỉ số kém` : null, attention > 0 ? `${attention} cần chú ý` : null];

  return {
    kind: 'warning',
    chipVariant: 'attention',
    chipText: 'Ảnh mờ, vẫn xử lý được',
    sentence: parts.filter((part) => part !== null).join(', '),
    sideTitle: 'AI sẽ đọc kém ở đâu',
    primaryLabel: 'Vẫn xử lý',
    secondaryLabel: 'Tải ảnh nét hơn',
    // ponytail: thời gian xử lý ước tính chưa có từ BE nên không in "khoảng N phút".
    consent: 'Vẫn xử lý: có thể phải vẽ tay tường bị sót.',
  };
}
