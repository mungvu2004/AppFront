/**
 * Từ vựng của màn đo — kiểu dùng chung cho hook, view, danh sách, story và test.
 *
 * File này là HỢP ĐỒNG. Điều phối viên sở hữu nó; không worker nào được sửa.
 * Bốn worker lớp viết đọc cùng một hình dạng ở đây nên chúng ghép được vào nhau
 * mà không cần chờ nhau.
 *
 * Ba điều file này KHÔNG làm, và cố ý không làm:
 * 1. Không tính toán. Mọi con số tới đây đã do `src/domain/measure` tính (R-61).
 * 2. Không định dạng. Mọi chuỗi số ở đây đã do `src/lib/format` định dạng (A15).
 * 3. Không quy đổi đơn vị. Màn chỉ chọn đơn vị rồi đưa cho tầng định dạng.
 */

import type { MeasurementKind, MeasurePoint } from '@/domain/measure/measure';
import type { Millimetres } from '@/domain/units/types';
import type { LengthDisplayUnit } from '@/lib/format/measure';

/* -------------------------------------------------------------------------- */
/* Chế độ đo.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Bốn chế độ trên viên thuốc nổi, theo đúng thứ tự chúng hiện ra.
 *
 * Ánh xạ sang `src/domain/measure`:
 *   pointToPoint  → measureDistance
 *   perpendicular → measurePointToPlane   (bổ sung bởi việc logic LG-1)
 *   height        → measureHeight
 *   floorArea     → measurePolygonArea
 */
export type MeasureMode = 'pointToPoint' | 'perpendicular' | 'height' | 'floorArea';

export const MEASURE_MODES = [
  'pointToPoint',
  'perpendicular',
  'height',
  'floorArea',
] as const satisfies readonly MeasureMode[];

/** Nhãn tiếng Việt, viết thường kiểu câu (A6). */
export const MEASURE_MODE_LABELS: Readonly<Record<MeasureMode, string>> = {
  pointToPoint: 'điểm đến điểm',
  perpendicular: 'vuông góc với bề mặt',
  height: 'chiều cao',
  floorArea: 'diện tích mặt sàn',
};

/* -------------------------------------------------------------------------- */
/* Bắt điểm.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Ba loại bắt điểm mà `src/domain/units/snap.ts` thật sự dò được.
 *
 * Đặc tả gốc kể năm loại; "Cạnh" và "Bề mặt" không tồn tại trong domain và
 * quyết định ngày 07-09-2026 là giao ba loại có thật thay vì tự chế hai loại
 * còn lại trong màn (R-61, R-69). Ánh xạ sang `AnchorKind`:
 *   vertex           → 'wallVertex'
 *   midpoint         → 'midpoint'
 *   axisIntersection → 'intersection'
 */
export type SnapKind = 'vertex' | 'midpoint' | 'axisIntersection';

export const SNAP_KINDS = [
  'vertex',
  'midpoint',
  'axisIntersection',
] as const satisfies readonly SnapKind[];

/** Nhãn tiếng Việt của chip bắt điểm (A6). */
export const SNAP_KIND_LABELS: Readonly<Record<SnapKind, string>> = {
  vertex: 'đỉnh',
  midpoint: 'trung điểm',
  axisIntersection: 'giao trục',
};

/**
 * Con trỏ đang bắt vào cái gì, ngay lúc này.
 *
 * `kind` là `null` khi con trỏ ở trên bề mặt trống. Chip vẫn phải hiện và vẫn
 * phải gọi tên tình trạng đó — đặc tả cấm để người dùng đoán.
 */
export interface SnapIndicator {
  readonly kind: SnapKind | null;
  /** Nhãn đã sẵn sàng để in ra; view không tự ghép chuỗi. */
  readonly label: string;
}

/* -------------------------------------------------------------------------- */
/* Toạ độ màn hình.                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Một điểm trong khung nhìn, tính bằng pixel.
 *
 * Vì sao kiểu này tồn tại: phép đo sống trong không gian thế giới (milimet, ba
 * trục), còn overlay vẽ bằng pixel. Phép chiếu world → NDC → pixel cần camera,
 * và camera là thứ view thuần không được biết. Nên hook chiếu mỗi khung hình
 * rồi đưa xuống kết quả đã chiếu; view chỉ nối các điểm lại.
 */
export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/* -------------------------------------------------------------------------- */
/* Một phép đo đã ghim.                                                        */
/* -------------------------------------------------------------------------- */

export type PinnedMeasurementId = `MS-${string}`;

/**
 * Một hàng trong danh sách "Phép đo".
 *
 * `valueLabel` đã định dạng xong bằng `formatLength`/`formatArea` theo `unit`
 * đang chọn. View in thẳng chuỗi này ra, không đụng vào con số.
 */
export interface PinnedMeasurement {
  readonly id: PinnedMeasurementId;
  /** Tên tự sinh, ví dụ "Phép đo 3". */
  readonly name: string;
  readonly mode: MeasureMode;
  /** Giá trị ĐÃ ĐỊNH DẠNG, ví dụ "3.450 mm" hoặc "3,45 m" (A15, P-01). */
  readonly valueLabel: string;
  /** Giá trị thô, chỉ để so sánh và sắp xếp. Không bao giờ in thẳng. */
  readonly rawValueMm: Millimetres;
  /**
   * Cùng giá trị ấy, đã đổi sang đơn vị đang chọn — nhưng vẫn là SỐ.
   *
   * `valueLabel` là chuỗi nên chạy số không được: không có gì để nội suy giữa
   * "3.450 mm" và "3,45 m". Ba trường dưới đây là cái duy nhất cho phép nhãn
   * chạy số lúc đổi đơn vị, mà view vẫn không phải quy đổi hay tự chọn số chữ
   * số thập phân — hook đã quyết cả hai bằng `src/lib/format`.
   */
  readonly displayValue: number;
  /** 0 cho mm, 1 cho cm, 2 cho m. Hook lấy từ tầng định dạng, view không đoán. */
  readonly displayFractionDigits: number;
  /** Hậu tố đơn vị đã sẵn sàng để nối: "mm" · "cm" · "m". */
  readonly unitSuffix: string;
  readonly points: readonly MeasurePoint[];
  /**
   * `points` đã chiếu sang pixel khung nhìn. `null` khi phép đo nằm ngoài khung
   * nhìn và không có gì để vẽ.
   */
  readonly screenPoints: readonly ScreenPoint[] | null;
  readonly visible: boolean;
  /**
   * Hình học mà phép đo này tham chiếu đã bị xoá.
   *
   * Đây là trạng thái "Một phần" thứ hai của A11: số đo còn đó nhưng không còn
   * neo vào đâu. Hàng hiện chấm cần chú ý kèm `staleReason`.
   */
  readonly stale: boolean;
  readonly staleReason: string | null;
}

/* -------------------------------------------------------------------------- */
/* Phép đo đang lấy dở.                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Phần đang vẽ, chưa ghim.
 *
 * `valueLabel` cập nhật liên tục theo con trỏ. View in nó bằng CHỮ ĐỀU và
 * TUYỆT ĐỐI không chạy số — đây là nguyên tắc riêng của màn này.
 */
export interface DraftMeasurement {
  readonly mode: MeasureMode;
  readonly points: readonly MeasurePoint[];
  /** `null` khi mới đặt một điểm và chưa có gì để đọc. */
  readonly valueLabel: string | null;
  /** `points` đã chiếu sang pixel khung nhìn — xem {@link ScreenPoint}. */
  readonly screenPoints: readonly ScreenPoint[];
  /** Vị trí con trỏ trong khung nhìn, để nhãn bám theo. */
  readonly cursorPx: ScreenPoint | null;
  readonly snap: SnapIndicator;
}

/* -------------------------------------------------------------------------- */
/* Đơn vị.                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Ba đơn vị của Select ở đầu mục.
 *
 * Bí danh thẳng của kiểu tầng định dạng, nên hai bên không lệch nhau được: màn
 * không thể chào một đơn vị mà `formatLength` không in nổi. Trước khi việc logic
 * bổ sung `'cm'` về, chỗ này là một union viết tay cộng một dòng khẳng định giữ
 * chỗ; nay `'cm'` đã có thật nên bí danh làm đúng việc đó mà không cần dòng nào.
 */
export type MeasureUnit = LengthDisplayUnit;

export const MEASURE_UNITS = ['mm', 'cm', 'm'] as const satisfies readonly MeasureUnit[];

export const MEASURE_UNIT_LABELS: Readonly<Record<MeasureUnit, string>> = {
  mm: 'mm',
  cm: 'cm',
  m: 'm',
};

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái (A11, R-63).                                                 */
/* -------------------------------------------------------------------------- */

export type MeasurementScreenState =
  | 'empty'
  | 'measuring'
  | 'partial'
  | 'error'
  | 'ready'
  | 'forbidden'
  | 'collapsed';

/* -------------------------------------------------------------------------- */
/* Props của view thuần.                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Tất cả những gì `MeasurementTool.tsx` được biết.
 *
 * Không có store, không có mạng, không có `src/domain` trong view (R-60). Hook
 * dựng đủ vật này rồi truyền vào.
 */
export interface MeasurementToolProps {
  readonly state: MeasurementScreenState;

  /* Viên thuốc chế độ, nổi trên canvas. */
  readonly mode: MeasureMode;
  readonly onModeChange: (mode: MeasureMode) => void;

  /* Chip bắt điểm. Luôn hiện khi công cụ đang bật. */
  readonly snap: SnapIndicator;

  /* Phần đang đo. `null` khi chưa đặt điểm nào. */
  readonly draft: DraftMeasurement | null;

  /* Danh sách đã ghim, ở panel phải. */
  readonly measurements: readonly PinnedMeasurement[];
  /** Tổng số phép đo, ĐÃ ĐỊNH DẠNG sẵn cho đầu mục (A15). */
  readonly countLabel: string;
  readonly highlightedId: PinnedMeasurementId | null;
  readonly onHighlight: (id: PinnedMeasurementId | null) => void;
  readonly onToggleVisibility: (id: PinnedMeasurementId) => void;
  readonly onDelete: (id: PinnedMeasurementId) => void;

  /* Đơn vị. Đổi đơn vị là chỗ DUY NHẤT được chạy số. */
  readonly unit: MeasureUnit;
  readonly onUnitChange: (unit: MeasureUnit) => void;
  /**
   * Bật đúng một nhịp khi đơn vị vừa đổi, để nhãn chạy số sang giá trị mới.
   * Mọi lúc khác là `false`, và giá trị đang đo không bao giờ chạy số.
   */
  readonly unitJustChanged: boolean;

  /* Không có quyền: vẫn đo được, không ghim được (trạng thái 6). */
  readonly canPin: boolean;
  /** Câu giải thích vì sao không ghim được. `null` khi ghim được. */
  readonly pinBlockedCaption: string | null;

  /* Thu gọn: danh sách thành chip đếm (trạng thái 7). */
  readonly collapsed: boolean;
  readonly onToggleCollapsed: () => void;

  /* Trạng thái lỗi (trạng thái 4): không bắt được bề mặt. */
  readonly errorMessage: string | null;
  readonly onRetry: () => void;
}

/* -------------------------------------------------------------------------- */
/* Cổng dữ liệu.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Cửa duy nhất ra tầng ngoài, để test dựng được màn mà không cần mạng.
 *
 * Khuôn mẫu chép từ `explodedViewGateway.ts`.
 */
export interface MeasurementToolGateway {
  readonly listMeasurements: (projectId: string) => Promise<readonly PinnedMeasurement[]>;
  readonly saveMeasurement: (
    projectId: string,
    measurement: PinnedMeasurement,
  ) => Promise<PinnedMeasurement>;
  readonly deleteMeasurement: (projectId: string, id: PinnedMeasurementId) => Promise<void>;
}

/** Kiểu phép đo của domain, tái xuất để worker khác không phải nhớ đường dẫn. */
export type { MeasurementKind, MeasurePoint };
