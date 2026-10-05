/**
 * Số đo của một tầng có tỉ lệ tạm (`scaleStatus: 'unresolved'`, N16) — A15: chữ hiện
 * lên màn quyết định ở đây, không ở view. Tỉ lệ tạm là máy chủ đoán; số đo theo nó
 * chưa tin được, nên màn thay chuỗi đo bằng câu cố định và hiện dải nhắc hiệu chỉnh.
 */

export type ScaleStatus = 'unresolved' | undefined;

export interface ProvisionalScaleNoticeView {
  readonly level: 'attention';
  readonly message: string;
}

export const PROVISIONAL_MEASURE_TEXT = 'Chưa có — tỉ lệ tạm';

const PROVISIONAL_SCALE_MESSAGE = 'Tỉ lệ tạm — số đo chưa tin được, hãy hiệu chỉnh tỉ lệ.';

export function measureTextOf(formatted: string, scaleStatus: ScaleStatus): string {
  return scaleStatus === 'unresolved' ? PROVISIONAL_MEASURE_TEXT : formatted;
}

export function provisionalScaleNoticeOf(scaleStatus: ScaleStatus): ProvisionalScaleNoticeView | null {
  return scaleStatus === 'unresolved' ? { level: 'attention', message: PROVISIONAL_SCALE_MESSAGE } : null;
}
