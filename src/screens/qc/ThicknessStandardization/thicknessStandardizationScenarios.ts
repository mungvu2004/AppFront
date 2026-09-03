/**
 * Bảy kịch bản của màn "Chuẩn hoá độ dày tường", dựng sẵn để story (T8) và bài
 * kiểm dùng chung.
 *
 * Theo đúng khuôn `roomLabelReviewScenarios.ts` của màn QC anh em: đúng bảy
 * kịch bản, tên nhánh lấy nguyên từ `SEVEN_STATES`, nhãn tiếng Việt lấy nguyên
 * từ `SEVEN_STATE_LABELS` chứ không tự đặt một bản dịch thứ hai có thể trôi
 * khỏi bản gốc.
 *
 * Mỗi kịch bản mang RAW DATA đúng hình dạng đồ thị — `Wall[]`/`Level[]` của
 * `src/domain/spatial/types` — chứ KHÔNG phải `ThicknessStandardizationProps`
 * đã tính sẵn (bins, groupRows, segmentRows, summary...). Lý do giống hệt màn
 * tường/phòng anh em: viewmodel là kết quả của `useThicknessStandardization.ts`
 * (T5), và dựng sẵn nó ở đây nghĩa là chép lại logic của hook vào một chỗ thứ
 * hai để hai bên trôi khỏi nhau (R-61/R-70). Nơi gọi (bài kiểm/story) cắm
 * `scenario.walls`/`scenario.levels` vào hook thật hoặc một cổng giả, đúng
 * cách `roomLabelReviewScenarios.ts` cắm `scenario.rooms`/`scenario.walls`
 * vào `normalizeSpatial(...)`.
 *
 * ## Hai kịch bản dùng lại `alreadyStandardized(...)`, không phải hai tập dữ liệu tự chế
 *
 * `'empty'` ("độ dày đã chuẩn hết, không cần làm gì") và `'success'` ("kèm
 * dòng kết quả và nút hoàn tác; nếu mọi đoạn đều trong dung sai thì tóm tắt
 * chuyển sang mức đã duyệt") đều tả cùng MỘT sự thật dữ liệu: không đoạn nào
 * còn lệch quá dung sai. Khác nhau ở `state` (và do đó ở UI — `'success'` có
 * dòng kết quả + nút hoàn tác, `'empty'` thì không), không phải ở dữ liệu.
 * {@link alreadyStandardized} gọi THẲNG `standardizeThickness` thật
 * (`src/lib/geometry/standardize.ts`, đúng R-61) để đưa `thicknessMm` của cả
 * 48 đoạn về giá trị chuẩn của nhóm nó rơi vào — cột bê tông cốt thép giữ
 * nguyên vì không có giá trị số để quy về (X2, xem `thicknessTypes.ts`).
 */

import type { Level, Wall } from '@/domain/spatial/types';
import { standardizeThickness } from '@/lib/geometry/standardize';
import { SEVEN_STATE_LABELS, type SevenState } from '@/lib/testing/sevenStateScenarios';

import { THICKNESS_FIXTURE_LEVELS, THICKNESS_FIXTURE_WALLS } from './thicknessFixture';
import {
  DEFAULT_THICKNESS_THRESHOLDS,
  DEFAULT_TOLERANCE_MM,
  type ThicknessScreenState,
  type ThicknessThresholds,
} from './thicknessTypes';

/* -------------------------------------------------------------------------- */
/* Không tường nào — kịch bản chưa có số đo.                                   */
/* -------------------------------------------------------------------------- */

const NO_WALLS: readonly Wall[] = [];

/**
 * Đưa `thicknessMm` của mỗi đoạn về đúng giá trị chuẩn của nhóm nó rơi vào,
 * qua `standardizeThickness` thật — xem "Hai kịch bản dùng lại..." ở đầu file.
 */
function alreadyStandardized(walls: readonly Wall[]): readonly Wall[] {
  return walls.map((source) => {
    const { standardized } = standardizeThickness(source.thicknessMm);
    return typeof standardized === 'number' ? { ...source, thicknessMm: standardized } : source;
  });
}

/** Bốn nhóm đều đã chuẩn — dùng chung cho `'empty'` và `'success'`. */
const STANDARDIZED_WALLS = alreadyStandardized(THICKNESS_FIXTURE_WALLS);

/**
 * "Chỉ chọn hai nhóm" — mới có số đo cho nhóm 110 và 220, hai nhóm 330/cột bê
 * tông cốt thép của bộ mẫu CHƯA nằm trong tập này. Lọc bằng
 * `standardizeThickness` thật (R-61), không tự khai lại ngưỡng.
 */
const PARTIAL_TWO_GROUPS_WALLS: readonly Wall[] = THICKNESS_FIXTURE_WALLS.filter((source) => {
  const { standardized } = standardizeThickness(source.thicknessMm);
  return standardized === 110 || standardized === 220;
});

/** "Mới có số đo của một số tầng" — chỉ hai trong ba tầng của bộ mẫu đã có dữ liệu. */
const LOADED_LEVEL_IDS = new Set([THICKNESS_FIXTURE_LEVELS[0]?.id, THICKNESS_FIXTURE_LEVELS[1]?.id]);
const PARTIAL_TWO_FLOORS_WALLS: readonly Wall[] = THICKNESS_FIXTURE_WALLS.filter((source) =>
  LOADED_LEVEL_IDS.has(source.levelId),
);
const PARTIAL_TWO_FLOORS_LEVELS: readonly Level[] = THICKNESS_FIXTURE_LEVELS.slice(0, 2);

/* -------------------------------------------------------------------------- */
/* Một kịch bản.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Nguyên liệu đồ thị cho một trong bảy trạng thái, cộng vài cờ ngoài đồ thị
 * (dung sai, ngưỡng, vai trò, thu gọn, lỗi) mà đồ thị tự nó không mang.
 *
 * Mọi trường có mặt ở MỌI kịch bản (đúng tinh thần `SevenStateScenario`): một
 * nơi gọi đọc `scenario.error` không phải đoán xem trường đó có tồn tại
 * không.
 */
export interface ThicknessStandardizationScenario {
  readonly state: ThicknessScreenState;
  /** Nhãn tiếng Việt của trạng thái, nguyên từ `SEVEN_STATE_LABELS`. */
  readonly label: string;
  readonly levels: readonly Level[];
  readonly walls: readonly Wall[];
  readonly toleranceMm: number;
  readonly thresholds: ThicknessThresholds;
  /** `true` ở kịch bản `forbidden` — vai Người xem. */
  readonly isViewerRole: boolean;
  /** `true` ở kịch bản `collapsed`. */
  readonly isCollapsed: boolean;
  /** Non-null CHỈ ở kịch bản `error`, cùng quy ước với `SevenStateScenario.error`. */
  readonly error: unknown;
}

const labelOf = (state: SevenState): string => SEVEN_STATE_LABELS[state];

/**
 * 1. Rỗng — độ dày đã chuẩn hết, không đoạn nào cần làm gì.
 *
 * `STANDARDIZED_WALLS` — xem "Hai kịch bản dùng lại..." ở đầu file.
 */
export const THICKNESS_SCENARIO_EMPTY: ThicknessStandardizationScenario = {
  state: 'empty',
  label: labelOf('empty'),
  levels: THICKNESS_FIXTURE_LEVELS,
  walls: STANDARDIZED_WALLS,
  toleranceMm: DEFAULT_TOLERANCE_MM,
  thresholds: DEFAULT_THICKNESS_THRESHOLDS,
  isViewerRole: false,
  isCollapsed: false,
  error: null,
};

/** 1b. Biến thể rỗng — chưa có số đo nào (đồ thị chưa có tường). */
export const THICKNESS_SCENARIO_EMPTY_NO_MEASUREMENTS: ThicknessStandardizationScenario = {
  state: 'empty',
  label: labelOf('empty'),
  levels: THICKNESS_FIXTURE_LEVELS,
  walls: NO_WALLS,
  toleranceMm: DEFAULT_TOLERANCE_MM,
  thresholds: DEFAULT_THICKNESS_THRESHOLDS,
  isViewerRole: false,
  isCollapsed: false,
  error: null,
};

/** 2. Đang tải — chưa có số đo nào tới; biểu đồ vẽ khung xương đúng `HISTOGRAM_HEIGHT_PX`. */
export const THICKNESS_SCENARIO_LOADING: ThicknessStandardizationScenario = {
  state: 'loading',
  label: labelOf('loading'),
  levels: THICKNESS_FIXTURE_LEVELS,
  walls: NO_WALLS,
  toleranceMm: DEFAULT_TOLERANCE_MM,
  thresholds: DEFAULT_THICKNESS_THRESHOLDS,
  isViewerRole: false,
  isCollapsed: false,
  error: null,
};

/**
 * 3. Một phần — TRẠNG THÁI CHÍNH của màn. "Chỉ chọn hai nhóm": mới có số đo
 * cho nhóm 110 và 220, nhóm 330 và cột bê tông cốt thép còn trống.
 */
export const THICKNESS_SCENARIO_PARTIAL: ThicknessStandardizationScenario = {
  state: 'partial',
  label: labelOf('partial'),
  levels: THICKNESS_FIXTURE_LEVELS,
  walls: PARTIAL_TWO_GROUPS_WALLS,
  toleranceMm: DEFAULT_TOLERANCE_MM,
  thresholds: DEFAULT_THICKNESS_THRESHOLDS,
  isViewerRole: false,
  isCollapsed: false,
  error: null,
};

/** 3b. Biến thể một phần — mới có số đo của hai trong ba tầng. */
export const THICKNESS_SCENARIO_PARTIAL_BY_FLOOR: ThicknessStandardizationScenario = {
  state: 'partial',
  label: labelOf('partial'),
  levels: PARTIAL_TWO_FLOORS_LEVELS,
  walls: PARTIAL_TWO_FLOORS_WALLS,
  toleranceMm: DEFAULT_TOLERANCE_MM,
  thresholds: DEFAULT_THICKNESS_THRESHOLDS,
  isViewerRole: false,
  isCollapsed: false,
  error: null,
};

/** 4. Lỗi — lớp số đo hỏng. */
export const THICKNESS_SCENARIO_ERROR: ThicknessStandardizationScenario = {
  state: 'error',
  label: labelOf('error'),
  levels: THICKNESS_FIXTURE_LEVELS,
  walls: NO_WALLS,
  toleranceMm: DEFAULT_TOLERANCE_MM,
  thresholds: DEFAULT_THICKNESS_THRESHOLDS,
  isViewerRole: false,
  isCollapsed: false,
  error: new Error('Không tải được số đo độ dày tường.'),
};

/**
 * 5. Xong — vừa áp xong, mọi đoạn đều trong dung sai (`STANDARDIZED_WALLS`,
 * xem "Hai kịch bản dùng lại..." ở đầu file); tóm tắt chuyển sang mức đã
 * duyệt, kèm dòng kết quả và nút hoàn tác (do hook/view dựng từ `state`).
 */
export const THICKNESS_SCENARIO_SUCCESS: ThicknessStandardizationScenario = {
  state: 'success',
  label: labelOf('success'),
  levels: THICKNESS_FIXTURE_LEVELS,
  walls: STANDARDIZED_WALLS,
  toleranceMm: DEFAULT_TOLERANCE_MM,
  thresholds: DEFAULT_THICKNESS_THRESHOLDS,
  isViewerRole: false,
  isCollapsed: false,
  error: null,
};

/** 6. Không có quyền — vai Người xem, chỉ xem; dữ liệu như bộ mẫu đầy đủ. */
export const THICKNESS_SCENARIO_FORBIDDEN: ThicknessStandardizationScenario = {
  state: 'forbidden',
  label: labelOf('forbidden'),
  levels: THICKNESS_FIXTURE_LEVELS,
  walls: THICKNESS_FIXTURE_WALLS,
  toleranceMm: DEFAULT_TOLERANCE_MM,
  thresholds: DEFAULT_THICKNESS_THRESHOLDS,
  isViewerRole: true,
  isCollapsed: false,
  error: null,
};

/** 7. Thu gọn — ẩn canvas xem trước; dữ liệu như bộ mẫu đầy đủ. */
export const THICKNESS_SCENARIO_COLLAPSED: ThicknessStandardizationScenario = {
  state: 'collapsed',
  label: labelOf('collapsed'),
  levels: THICKNESS_FIXTURE_LEVELS,
  walls: THICKNESS_FIXTURE_WALLS,
  toleranceMm: DEFAULT_TOLERANCE_MM,
  thresholds: DEFAULT_THICKNESS_THRESHOLDS,
  isViewerRole: false,
  isCollapsed: true,
  error: null,
};

/** Bảy kịch bản, đúng thứ tự `SEVEN_STATES` — cho `expectSevenStates` và cho story. */
export const THICKNESS_STANDARDIZATION_SCENARIOS: readonly ThicknessStandardizationScenario[] = [
  THICKNESS_SCENARIO_EMPTY,
  THICKNESS_SCENARIO_LOADING,
  THICKNESS_SCENARIO_PARTIAL,
  THICKNESS_SCENARIO_ERROR,
  THICKNESS_SCENARIO_SUCCESS,
  THICKNESS_SCENARIO_FORBIDDEN,
  THICKNESS_SCENARIO_COLLAPSED,
];
