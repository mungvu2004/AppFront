/**
 * Số đo của một tầng có tỷ lệ tạm (`scaleStatus: 'unresolved'`, N16) — A15: chữ hiện
 * lên màn quyết định ở đây, không ở view. Tỷ lệ tạm là máy chủ đoán; số đo theo nó
 * chưa tin được, nên màn thay chuỗi đo bằng câu cố định và hiện dải nhắc hiệu chỉnh.
 */

export type ScaleStatus = 'unresolved' | undefined;

/**
 * Nguồn của tỷ lệ tạm (N16 `scaleSource`, chỉ đi cùng `scaleStatus`): `pipeline` = máy đo được,
 * cần người kiểm (vàng); `project_default` = máy không đo được, đang dùng mặc định dự án
 * (thường 1 mm/px) nên mọi kích thước và mô hình 3D sai hẳn (đỏ, UX-R1 K12).
 */
export type ScaleSource = 'pipeline' | 'project_default';

/** Tầng chưa có tỷ lệ thật: chặn mọi thao tác dựa vào số đo cho tới khi đặt tỷ lệ. */
export function isScaleMissing(source: ScaleSource | undefined): boolean {
  return source === 'project_default';
}

export interface ProvisionalScaleNoticeView {
  /** `violation` (đỏ) khi tầng không đo được tỷ lệ; `attention` khi tỷ lệ máy đo cần kiểm. */
  readonly level: 'attention' | 'violation';
  readonly message: string;
}

export const PROVISIONAL_MEASURE_TEXT = 'Chưa có — tỷ lệ tạm';

const PROVISIONAL_SCALE_MESSAGE = 'Tỷ lệ tạm — số đo chưa tin được, hãy hiệu chỉnh tỷ lệ.';

export const MISSING_SCALE_MESSAGE =
  'Máy không đo được tỷ lệ tầng này nên kích thước và mô hình 3D đang sai. Đặt tỷ lệ trước khi duyệt tiếp.';

/** Trung vị độ dày tường dưới mức này thì gần như chắc tỷ lệ sai (tường thật mỏng nhất ~100 mm). */
export const IMPLAUSIBLE_MEDIAN_THICKNESS_MM = 50;

/** Khung bản vẽ (cạnh dài của khối tường) dưới mức này thì gần như chắc tỷ lệ sai: căn hộ không gọn hơn 3 m. */
export const TINY_FOOTPRINT_MM = 3000;

/**
 * Tỷ lệ máy đo mà hình ra vô lý (Codex P1): trung vị độ dày tường < 50 mm, hoặc khung bản vẽ
 * < 3 m. Coi như chưa có tỷ lệ. Không có tường / không biết khung thì không đoán.
 */
export function isMeasuredScaleImplausible(thicknessesMm: readonly number[], frameMm: number | undefined): boolean {
  const sorted = [...thicknessesMm].sort((first, second) => first - second);
  const median = sorted[Math.floor(sorted.length / 2)];
  const thin = median !== undefined && median < IMPLAUSIBLE_MEDIAN_THICKNESS_MM;
  return thin || (frameMm !== undefined && frameMm < TINY_FOOTPRINT_MM);
}

/**
 * Câu thay nút đổi độ dày hàng loạt khi tầng chưa có tỷ lệ thật (UX-R1 K09): máy không đo được
 * tỷ lệ, hoặc trung vị độ dày dưới 50 mm. Ép tường về 100 mm lúc đó chỉ che lỗi, và tường đã ép
 * vẫn sai sau khi đặt tỷ lệ. `null` = không khoá.
 */
export function thicknessLockTextOf(thicknessesMm: readonly number[], scaleSource?: ScaleSource): string | null {
  const sorted = [...thicknessesMm].sort((first, second) => first - second);

  if (!isScaleMissing(scaleSource) && !isMeasuredScaleImplausible(sorted, undefined)) {
    return null;
  }

  const low = sorted[0];
  const high = sorted[sorted.length - 1];

  if (low === undefined || high === undefined) {
    return 'Độ dày tường đang sai vì chưa có tỷ lệ. Đặt tỷ lệ trước.';
  }

  const [lowMm, highMm] = [Math.round(low), Math.round(high)];
  const range = lowMm === highMm ? `${String(lowMm)} mm` : `${String(lowMm)}–${String(highMm)} mm`;

  return `Tường đo ra ${range} vì chưa có tỷ lệ. Đặt tỷ lệ trước.`;
}

export function measureTextOf(formatted: string, scaleStatus: ScaleStatus): string {
  return scaleStatus === 'unresolved' ? PROVISIONAL_MEASURE_TEXT : formatted;
}

export function provisionalScaleNoticeOf(
  scaleStatus: ScaleStatus,
  scaleSource?: ScaleSource,
): ProvisionalScaleNoticeView | null {
  if (scaleStatus !== 'unresolved') {
    return null;
  }

  return isScaleMissing(scaleSource)
    ? { level: 'violation', message: MISSING_SCALE_MESSAGE }
    : { level: 'attention', message: PROVISIONAL_SCALE_MESSAGE };
}

/** Chip cảnh báo của màn 3D: một tầng thì gọi tên, nhiều tầng thì đếm; không tầng nào thì `null`. */
export function provisionalFloorsMessageOf(floorNames: readonly string[]): string | null {
  const [first] = floorNames;

  if (first === undefined) return null;

  const subject = floorNames.length === 1 ? first : `${floorNames.length} tầng`;

  return `${subject} chưa hiệu chỉnh tỷ lệ — kích thước 3D có thể sai`;
}

/** Câu nêu tên đủ mọi tầng: `ch-01, ch-02` (≤ 8 tên), dài hơn thì 8 tên đầu và "… và N tầng khác". */
function floorListOf(floorNames: readonly string[]): string {
  const shown = floorNames.slice(0, 8).join(', ');
  const rest = floorNames.length - 8;

  return rest > 0 ? `${shown} và ${rest} tầng khác` : shown;
}

/**
 * Dải cảnh báo 3D (UX-R1 K44): tầng không đo được tỷ lệ nói "sai", tầng máy đo nói "có thể sai";
 * nêu tên từng tầng. `null` khi không tầng nào.
 */
export function scaleFloorsMessageOf(missing: readonly string[], provisional: readonly string[]): string | null {
  const parts = [
    missing.length === 0 ? null : `${missing.length} tầng không đo được tỷ lệ, kích thước 3D sai: ${floorListOf(missing)}`,
    provisional.length === 0
      ? null
      : `${provisional.length} tầng chưa hiệu chỉnh tỷ lệ, kích thước 3D có thể sai: ${floorListOf(provisional)}`,
  ].filter((part): part is string => part !== null);

  return parts.length === 0 ? null : `${parts.join('. ')}.`;
}
