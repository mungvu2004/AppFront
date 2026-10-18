/**
 * Số đo của một tầng có tỷ lệ tạm (`scaleStatus: 'unresolved'`, N16) — A15: chữ hiện
 * lên màn quyết định ở đây, không ở view. Tỷ lệ tạm là máy chủ đoán; số đo theo nó
 * chưa tin được, nên màn thay chuỗi đo bằng câu cố định và hiện dải nhắc hiệu chỉnh.
 */

export type ScaleStatus = 'unresolved' | undefined;

export interface ProvisionalScaleNoticeView {
  readonly level: 'attention';
  readonly message: string;
}

export const PROVISIONAL_MEASURE_TEXT = 'Chưa có — tỷ lệ tạm';

const PROVISIONAL_SCALE_MESSAGE = 'Tỷ lệ tạm — số đo chưa tin được, hãy hiệu chỉnh tỷ lệ.';

export function measureTextOf(formatted: string, scaleStatus: ScaleStatus): string {
  return scaleStatus === 'unresolved' ? PROVISIONAL_MEASURE_TEXT : formatted;
}

export function provisionalScaleNoticeOf(scaleStatus: ScaleStatus): ProvisionalScaleNoticeView | null {
  return scaleStatus === 'unresolved' ? { level: 'attention', message: PROVISIONAL_SCALE_MESSAGE } : null;
}

/** Chip cảnh báo của màn 3D: một tầng thì gọi tên, nhiều tầng thì đếm; không tầng nào thì `null`. */
export function provisionalFloorsMessageOf(floorNames: readonly string[]): string | null {
  const [first] = floorNames;

  if (first === undefined) return null;

  const subject = floorNames.length === 1 ? first : `${floorNames.length} tầng`;

  return `${subject} chưa hiệu chỉnh tỷ lệ — kích thước 3D có thể sai`;
}
