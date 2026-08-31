/**
 * Bảy kịch bản của màn Duyệt lớp tường, dựng sẵn để story và test dùng chung.
 *
 * Theo khuôn của `src/lib/testing/sevenStateScenarios.ts` (đọc trước khi viết
 * file này, theo đúng chỉ dẫn của điều phối viên): đúng bảy kịch bản, tên
 * nhánh lấy nguyên từ `SEVEN_STATES`, nhãn tiếng Việt lấy nguyên từ
 * `SEVEN_STATE_LABELS` chứ không tự đặt một bản dịch thứ hai có thể trôi khỏi
 * bản gốc.
 *
 * Khác với `createSevenStateScenarios` (vốn dựng cho một danh sách generic
 * `{id, label}`), bảy kịch bản dưới đây mang RAW DATA đúng hình dạng đồ thị —
 * `Wall[]` của `src/domain/spatial/types` — chứ không phải `WallLayerViewProps`
 * đã tính sẵn. Lý do: viewmodel (`WallRowViewModel`, `WallInspectorViewModel`…)
 * là kết quả của `useWallLayerReview.ts`, một file lớp L2 chưa tồn tại lúc màn
 * này đóng băng. Dựng sẵn viewmodel ở đây nghĩa là đoán trước logic của hook,
 * đúng thứ R-61 cấm ("không công thức tự chế"). Mỗi kịch bản ở đây là NGUYÊN
 * LIỆU: hook lớp sau gọi `toWallLayerViewProps(scenario)` (tên tự đặt) để ra
 * `WallLayerViewProps`, và test/story cắm thẳng kịch bản vào hook thật thay vì
 * giả lập một cổng dữ liệu.
 */

import type { Wall } from '@/domain/spatial/types';
import { SEVEN_STATE_LABELS, type SevenState } from '@/lib/testing/sevenStateScenarios';

import {
  WALL_LAYER_FIXTURE_LEVEL,
  WALL_LAYER_FIXTURE_REVIEWED,
  WALL_LAYER_FIXTURE_TOTAL,
  WALL_LAYER_FIXTURE_WALLS,
} from './wallLayerReviewFixture';
import type { WallLayerScreenState, WallReviewCounter } from './types';

/**
 * Chuỗi giữ chỗ cho nguồn ảnh nền — KHÔNG phải một đường dẫn thật (không bắt
 * đầu bằng `/` hay `http`, nên không phạm R-65: "Không có chuỗi bắt đầu bằng
 * `/` hay `http` trong `src/screens/**`"). Việc nạp ảnh thật là việc của hook
 * lớp L2, đúng khuôn `loadPlan`/`houseModel.json?url` đã ghi ở CLAUDE.md —
 * ảnh là nội dung, không phải hằng số của màn này.
 */
const SAMPLE_BACKGROUND_IMAGE = 'sample-floor-plan.png';

/** Toàn bộ 48 tường, nhưng ĐÃ DUYỆT HẾT — chỉ dùng cho kịch bản `success`. */
function allReviewed(walls: readonly Wall[]): readonly Wall[] {
  return walls.map((current) => ({ ...current, reviewed: true, source: 'human' }));
}

/**
 * Một kịch bản: nguyên liệu đồ thị cho một trong bảy trạng thái, cộng vài cờ
 * ngoài đồ thị (vai trò, thu gọn, ảnh nền, lỗi) mà đồ thị tự nó không mang.
 *
 * Mọi trường có mặt ở MỌI kịch bản (đúng tinh thần `SevenStateScenario`): một
 * hook đọc `scenario.error` không phải đoán xem trường đó có tồn tại không.
 */
export interface WallLayerReviewScenario {
  readonly state: WallLayerScreenState;
  /** Nhãn tiếng Việt của trạng thái, nguyên từ `SEVEN_STATE_LABELS`. */
  readonly label: string;
  readonly walls: readonly Wall[];
  readonly reviewCounter: WallReviewCounter;
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

/** 1. Rỗng — AI không dò ra tường nào ở tầng này. */
export const WALL_LAYER_REVIEW_SCENARIO_EMPTY: WallLayerReviewScenario = {
  state: 'empty',
  label: labelOf('empty'),
  walls: [],
  reviewCounter: { reviewed: 0, total: 0 },
  backgroundImageUrl: SAMPLE_BACKGROUND_IMAGE,
  isViewerRole: false,
  isCollapsed: false,
  error: null,
};

/** 2. Đang tải — chưa có dữ liệu, kể cả ảnh nền. */
export const WALL_LAYER_REVIEW_SCENARIO_LOADING: WallLayerReviewScenario = {
  state: 'loading',
  label: labelOf('loading'),
  walls: [],
  reviewCounter: { reviewed: 0, total: 0 },
  backgroundImageUrl: null,
  isViewerRole: false,
  isCollapsed: false,
  error: null,
};

/**
 * 3. Một phần — TRẠNG THÁI CHÍNH của màn. 12/48 đã duyệt (khớp
 * `WALL_LAYER_FIXTURE_REVIEWED`/`WALL_LAYER_FIXTURE_TOTAL`); sáu tường trong bộ
 * mẫu nằm dưới ngưỡng "cần chú ý" (băng `needsReview`, dưới 0,70 — xem
 * `wallLayerReviewFixture.ts`), nên panel chắc chắn có chip "cần chú ý" và
 * canvas chắc chắn có gạch chéo.
 */
export const WALL_LAYER_REVIEW_SCENARIO_PARTIAL: WallLayerReviewScenario = {
  state: 'partial',
  label: labelOf('partial'),
  walls: WALL_LAYER_FIXTURE_WALLS,
  reviewCounter: { reviewed: WALL_LAYER_FIXTURE_REVIEWED, total: WALL_LAYER_FIXTURE_TOTAL },
  backgroundImageUrl: SAMPLE_BACKGROUND_IMAGE,
  isViewerRole: false,
  isCollapsed: false,
  error: null,
};

/**
 * 4. Lỗi — lớp dữ liệu tường hỏng (`walls` rỗng), nhưng `total` vẫn giữ số đã
 * biết trước khi lớp hỏng (48) và ẢNH GỐC vẫn xem được — đây là điều khoản bắt
 * buộc của kịch bản này: canvas không được trắng dù danh sách trắng.
 */
export const WALL_LAYER_REVIEW_SCENARIO_ERROR: WallLayerReviewScenario = {
  state: 'error',
  label: labelOf('error'),
  walls: [],
  reviewCounter: { reviewed: 0, total: WALL_LAYER_FIXTURE_TOTAL },
  backgroundImageUrl: SAMPLE_BACKGROUND_IMAGE,
  isViewerRole: false,
  isCollapsed: false,
  error: new Error('wall-layer: không tải được lớp tường ở tầng ' + WALL_LAYER_FIXTURE_LEVEL.id),
};

/** 5. Xong — 48/48 đã duyệt. */
export const WALL_LAYER_REVIEW_SCENARIO_SUCCESS: WallLayerReviewScenario = {
  state: 'success',
  label: labelOf('success'),
  walls: allReviewed(WALL_LAYER_FIXTURE_WALLS),
  reviewCounter: { reviewed: WALL_LAYER_FIXTURE_TOTAL, total: WALL_LAYER_FIXTURE_TOTAL },
  backgroundImageUrl: SAMPLE_BACKGROUND_IMAGE,
  isViewerRole: false,
  isCollapsed: false,
  error: null,
};

/** 6. Không có quyền — vai Người xem, chỉ xem; dữ liệu như `partial`. */
export const WALL_LAYER_REVIEW_SCENARIO_FORBIDDEN: WallLayerReviewScenario = {
  state: 'forbidden',
  label: labelOf('forbidden'),
  walls: WALL_LAYER_FIXTURE_WALLS,
  reviewCounter: { reviewed: WALL_LAYER_FIXTURE_REVIEWED, total: WALL_LAYER_FIXTURE_TOTAL },
  backgroundImageUrl: SAMPLE_BACKGROUND_IMAGE,
  isViewerRole: true,
  isCollapsed: false,
  error: null,
};

/** 7. Thu gọn — ẩn hai panel; dữ liệu như `partial`, chỉ khác cờ thu gọn. */
export const WALL_LAYER_REVIEW_SCENARIO_COLLAPSED: WallLayerReviewScenario = {
  state: 'collapsed',
  label: labelOf('collapsed'),
  walls: WALL_LAYER_FIXTURE_WALLS,
  reviewCounter: { reviewed: WALL_LAYER_FIXTURE_REVIEWED, total: WALL_LAYER_FIXTURE_TOTAL },
  backgroundImageUrl: SAMPLE_BACKGROUND_IMAGE,
  isViewerRole: false,
  isCollapsed: true,
  error: null,
};

/** Bảy kịch bản, đúng thứ tự `SEVEN_STATES` — cho `expectSevenStates` và cho story. */
export const WALL_LAYER_REVIEW_SCENARIOS: readonly WallLayerReviewScenario[] = [
  WALL_LAYER_REVIEW_SCENARIO_EMPTY,
  WALL_LAYER_REVIEW_SCENARIO_LOADING,
  WALL_LAYER_REVIEW_SCENARIO_PARTIAL,
  WALL_LAYER_REVIEW_SCENARIO_ERROR,
  WALL_LAYER_REVIEW_SCENARIO_SUCCESS,
  WALL_LAYER_REVIEW_SCENARIO_FORBIDDEN,
  WALL_LAYER_REVIEW_SCENARIO_COLLAPSED,
];
