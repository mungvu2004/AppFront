/**
 * Bảy kịch bản của màn Đọc kích thước OCR, dựng sẵn để story và test dùng
 * chung (R-70).
 *
 * Theo khuôn `wallLayerReviewScenarios.ts` (đọc trước khi viết file này, theo
 * đúng chỉ dẫn của điều phối viên) — KHÔNG theo khuôn `objectLayerReviewScenarios.ts`,
 * vì file đó cắm vào `objectLayerReviewGateway.ts` (`buildObjectLayerGraph`,
 * `gatewaySeed`…) mà T3 không được viết gateway. Bảy kịch bản dưới đây mang
 * RAW DATA đúng hình dạng đồ thị — `Dimension[]` của `src/domain/spatial/types`
 * — chứ không phải `DimensionOcrModel` đã tính sẵn. Lý do: viewmodel
 * (`DimensionRowViewModel`, `DimensionChainViewModel`, `DimensionCompareViewModel`…)
 * là KẾT QUẢ của `useDimensionOcrReview.ts`, một file lớp L2 chưa tồn tại lúc
 * màn này đóng băng. Dựng sẵn viewmodel ở đây nghĩa là đoán trước logic của
 * hook, đúng thứ R-61 cấm ("không công thức tự chế").
 */

import type { Dimension, Level } from '@/domain/spatial/types';
import { SEVEN_STATE_LABELS, type SevenState } from '@/lib/testing/sevenStateScenarios';

import {
  DIMENSION_OCR_FIXTURE_DONE,
  DIMENSION_OCR_FIXTURE_EMPTY,
  DIMENSION_OCR_FIXTURE_LEVEL,
  DIMENSION_OCR_FIXTURE_PARTIAL,
  DIMENSION_OCR_FIXTURE_REVIEWED,
  DIMENSION_OCR_FIXTURE_TOTAL,
} from './dimensionOcrFixture';
import type { DimensionOcrScreenState, DimensionReviewCounter } from './dimensionOcrTypes';

/**
 * Chuỗi giữ chỗ cho nguồn ảnh nền — KHÔNG phải một đường dẫn thật (không bắt
 * đầu bằng dấu gạch chéo hay chữ "http", nên không phạm R-65). Việc nạp ảnh
 * thật là việc của hook lớp L2; ảnh là nội dung, không phải hằng số của màn
 * này (CLAUDE.md, "loadPlan"). Cùng chuỗi mà `wallLayerReviewScenarios.ts`
 * dùng — cả hai màn QC soi chung một bản vẽ mẫu.
 */
const SAMPLE_BACKGROUND_IMAGE = 'sample-floor-plan.png';

/**
 * Tầng CHƯA hiệu chỉnh tỷ lệ — dùng riêng cho kịch bản `empty`.
 *
 * Nguyên nhân thường gặp nhất khiến OCR không đọc được chuỗi kích thước nào là
 * tầng chưa có `scaleMillimetresPerPixel`; đây là DỮ LIỆU đủ để hook lớp sau
 * dẫn người dùng sang màn hiệu chỉnh tỷ lệ thủ công (yêu cầu của kịch bản 1
 * trong đặc tả gốc), không phải một cờ tự chế thêm.
 *
 * Dựng bằng object literal tường minh, KHÔNG spread rồi xoá trường:
 * `exactOptionalPropertyTypes` đang BẬT, nên một trường tuỳ chọn phải VẮNG MẶT
 * hẳn — gán `undefined` cho nó là lỗi kiểu. `areaM2` giữ nguyên GIÁ TRỊ của
 * tầng gốc nhưng chỉ được liệt kê khi tầng gốc thật sự có, cùng lý do.
 */
const unscaledAreaM2 = DIMENSION_OCR_FIXTURE_LEVEL.areaM2;

const DIMENSION_OCR_LEVEL_UNSCALED: Level = {
  id: DIMENSION_OCR_FIXTURE_LEVEL.id,
  name: DIMENSION_OCR_FIXTURE_LEVEL.name,
  order: DIMENSION_OCR_FIXTURE_LEVEL.order,
  elevationMm: DIMENSION_OCR_FIXTURE_LEVEL.elevationMm,
  heightMm: DIMENSION_OCR_FIXTURE_LEVEL.heightMm,
  ...(unscaledAreaM2 === undefined ? {} : { areaM2: unscaledAreaM2 }),
  confidence: DIMENSION_OCR_FIXTURE_LEVEL.confidence,
  source: DIMENSION_OCR_FIXTURE_LEVEL.source,
  reviewed: DIMENSION_OCR_FIXTURE_LEVEL.reviewed,
};

/**
 * Một kịch bản: nguyên liệu đồ thị cho một trong bảy trạng thái, cộng vài cờ
 * ngoài đồ thị (vai trò, thu gọn, ảnh nền, lỗi) mà đồ thị tự nó không mang.
 *
 * Mọi trường có mặt ở MỌI kịch bản (đúng tinh thần `SevenStateScenario`): một
 * hook đọc `scenario.error` không phải đoán xem trường đó có tồn tại không.
 */
export interface DimensionOcrReviewScenario {
  readonly state: DimensionOcrScreenState;
  /** Nhãn tiếng Việt của trạng thái, nguyên từ `SEVEN_STATE_LABELS`. */
  readonly label: string;
  /** Chuỗi kích thước của kịch bản — nguyên liệu, không phải viewmodel. */
  readonly dimensions: readonly Dimension[];
  /** Tầng của kịch bản — CHƯA hiệu chỉnh tỷ lệ chỉ ở kịch bản `empty`. */
  readonly level: Level;
  readonly reviewCounter: DimensionReviewCounter;
  /** Nguồn ảnh nền — xem {@link SAMPLE_BACKGROUND_IMAGE}. `null` khi chưa có ảnh nào để xem. */
  readonly backgroundImageUrl: string | null;
  /** `true` ở kịch bản `forbidden` — vai Người xem. */
  readonly isViewerRole: boolean;
  /** `true` ở kịch bản `collapsed`. */
  readonly isCollapsed: boolean;
  /** Non-null CHỈ ở kịch bản `error`, cùng quy ước với `SevenStateScenario.error`. */
  readonly error: unknown;
}

const labelOf = (state: SevenState): string => SEVEN_STATE_LABELS[state];

/**
 * 1. Rỗng — OCR không đọc được chuỗi kích thước nào. Tầng CHƯA hiệu chỉnh tỷ
 * lệ (xem {@link DIMENSION_OCR_LEVEL_UNSCALED}) để view dẫn người dùng sang
 * hiệu chỉnh tỷ lệ thủ công — nguyên nhân thường gặp nhất của trạng thái này.
 */
export const DIMENSION_OCR_REVIEW_SCENARIO_EMPTY: DimensionOcrReviewScenario = {
  state: 'empty',
  label: labelOf('empty'),
  dimensions: DIMENSION_OCR_FIXTURE_EMPTY,
  level: DIMENSION_OCR_LEVEL_UNSCALED,
  reviewCounter: { reviewed: 0, total: 0 },
  backgroundImageUrl: SAMPLE_BACKGROUND_IMAGE,
  isViewerRole: false,
  isCollapsed: false,
  error: null,
};

/** 2. Đang tải — chưa có dữ liệu, kể cả ảnh nền. */
export const DIMENSION_OCR_REVIEW_SCENARIO_LOADING: DimensionOcrReviewScenario = {
  state: 'loading',
  label: labelOf('loading'),
  dimensions: [],
  level: DIMENSION_OCR_FIXTURE_LEVEL,
  reviewCounter: { reviewed: 0, total: 0 },
  backgroundImageUrl: null,
  isViewerRole: false,
  isCollapsed: false,
  error: null,
};

/**
 * 3. Một phần — TRẠNG THÁI CHÍNH của màn. 18/34 đã duyệt (khớp
 * `DIMENSION_OCR_FIXTURE_REVIEWED` và `DIMENSION_OCR_FIXTURE_TOTAL`); chín chuỗi
 * kích thước trong bộ mẫu nằm dưới ngưỡng độ tin cậy, nên bộ lọc
 * "chỉ hiện mục cần xem" (`lowConfidence`) chắc chắn có cái để lọc.
 */
export const DIMENSION_OCR_REVIEW_SCENARIO_PARTIAL: DimensionOcrReviewScenario = {
  state: 'partial',
  label: labelOf('partial'),
  dimensions: DIMENSION_OCR_FIXTURE_PARTIAL,
  level: DIMENSION_OCR_FIXTURE_LEVEL,
  reviewCounter: { reviewed: DIMENSION_OCR_FIXTURE_REVIEWED, total: DIMENSION_OCR_FIXTURE_TOTAL },
  backgroundImageUrl: SAMPLE_BACKGROUND_IMAGE,
  isViewerRole: false,
  isCollapsed: false,
  error: null,
};

/**
 * 4. Lỗi — lớp dữ liệu kích thước hỏng (`dimensions` rỗng), nhưng `total` vẫn
 * giữ số đã biết trước khi lớp hỏng (34) và ẢNH GỐC vẫn xem được — đây là điều
 * khoản bắt buộc của kịch bản này: canvas không được trắng dù danh sách trắng.
 */
export const DIMENSION_OCR_REVIEW_SCENARIO_ERROR: DimensionOcrReviewScenario = {
  state: 'error',
  label: labelOf('error'),
  dimensions: [],
  level: DIMENSION_OCR_FIXTURE_LEVEL,
  reviewCounter: { reviewed: 0, total: DIMENSION_OCR_FIXTURE_TOTAL },
  backgroundImageUrl: SAMPLE_BACKGROUND_IMAGE,
  isViewerRole: false,
  isCollapsed: false,
  error: new Error(`dimension-ocr: không tải được lớp kích thước ở tầng ${DIMENSION_OCR_FIXTURE_LEVEL.id}`),
};

/** 5. Xong — 34/34 chuỗi kích thước đã duyệt. */
export const DIMENSION_OCR_REVIEW_SCENARIO_SUCCESS: DimensionOcrReviewScenario = {
  state: 'success',
  label: labelOf('success'),
  dimensions: DIMENSION_OCR_FIXTURE_DONE,
  level: DIMENSION_OCR_FIXTURE_LEVEL,
  reviewCounter: { reviewed: DIMENSION_OCR_FIXTURE_TOTAL, total: DIMENSION_OCR_FIXTURE_TOTAL },
  backgroundImageUrl: SAMPLE_BACKGROUND_IMAGE,
  isViewerRole: false,
  isCollapsed: false,
  error: null,
};

/** 6. Không có quyền — vai Người xem, chỉ xem; dữ liệu như `partial`. */
export const DIMENSION_OCR_REVIEW_SCENARIO_FORBIDDEN: DimensionOcrReviewScenario = {
  state: 'forbidden',
  label: labelOf('forbidden'),
  dimensions: DIMENSION_OCR_FIXTURE_PARTIAL,
  level: DIMENSION_OCR_FIXTURE_LEVEL,
  reviewCounter: { reviewed: DIMENSION_OCR_FIXTURE_REVIEWED, total: DIMENSION_OCR_FIXTURE_TOTAL },
  backgroundImageUrl: SAMPLE_BACKGROUND_IMAGE,
  isViewerRole: true,
  isCollapsed: false,
  error: null,
};

/** 7. Thu gọn — ẩn danh sách + dải đối chiếu; dữ liệu như `partial`, chỉ khác cờ thu gọn. */
export const DIMENSION_OCR_REVIEW_SCENARIO_COLLAPSED: DimensionOcrReviewScenario = {
  state: 'collapsed',
  label: labelOf('collapsed'),
  dimensions: DIMENSION_OCR_FIXTURE_PARTIAL,
  level: DIMENSION_OCR_FIXTURE_LEVEL,
  reviewCounter: { reviewed: DIMENSION_OCR_FIXTURE_REVIEWED, total: DIMENSION_OCR_FIXTURE_TOTAL },
  backgroundImageUrl: SAMPLE_BACKGROUND_IMAGE,
  isViewerRole: false,
  isCollapsed: true,
  error: null,
};

/** Bảy kịch bản, đúng thứ tự `SEVEN_STATES` — cho `expectSevenStates` và cho story. */
export const DIMENSION_OCR_REVIEW_SCENARIOS: readonly DimensionOcrReviewScenario[] = [
  DIMENSION_OCR_REVIEW_SCENARIO_EMPTY,
  DIMENSION_OCR_REVIEW_SCENARIO_LOADING,
  DIMENSION_OCR_REVIEW_SCENARIO_PARTIAL,
  DIMENSION_OCR_REVIEW_SCENARIO_ERROR,
  DIMENSION_OCR_REVIEW_SCENARIO_SUCCESS,
  DIMENSION_OCR_REVIEW_SCENARIO_FORBIDDEN,
  DIMENSION_OCR_REVIEW_SCENARIO_COLLAPSED,
];

/** Kịch bản của một trạng thái — story và test tra theo tên nhánh. */
export const dimensionOcrScenarioFor = (state: DimensionOcrScreenState): DimensionOcrReviewScenario =>
  DIMENSION_OCR_REVIEW_SCENARIOS.find((scenario) => scenario.state === state) ??
  DIMENSION_OCR_REVIEW_SCENARIO_PARTIAL;
