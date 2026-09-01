/**
 * Bảy kịch bản của màn Lớp đối tượng, dựng sẵn để story và test dùng chung (R-70).
 *
 * Theo khuôn `src/lib/testing/sevenStateScenarios.ts` và
 * `wallLayerReviewScenarios.ts` của màn QC anh em: đúng bảy kịch bản, tên nhánh
 * lấy nguyên từ `SEVEN_STATES`, nhãn tiếng Việt lấy nguyên từ
 * `SEVEN_STATE_LABELS` chứ không tự đặt một bản dịch thứ hai có thể trôi khỏi
 * bản gốc.
 *
 * Mỗi kịch bản mang **NGUYÊN LIỆU** — dòng bộ mẫu và đồ thị không gian — chứ
 * không mang viewmodel đã tính sẵn. Viewmodel là KẾT QUẢ của
 * `useObjectLayerReview`, và dựng sẵn nó ở đây nghĩa là đoán trước logic của
 * hook, đúng thứ R-61 cấm. Kèm theo mỗi kịch bản là {@link ObjectLayerReviewScenario.gatewaySeed},
 * cắm thẳng được vào `createMockObjectLayerReviewGateway` — nên test và story
 * lái màn qua CỔNG THẬT của nó chứ không giả lập một tầng dữ liệu thứ hai.
 */

import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import { SEVEN_STATE_LABELS, type SevenState } from '@/lib/testing/sevenStateScenarios';
import type { ProjectRole } from '@/types/project';

import {
  buildObjectLayerGraph,
  countsOf,
  objectsOf,
  OBJECT_LAYER_SAMPLE_GRAPH,
  OBJECT_LAYER_SAMPLE_IMAGE,
  OBJECT_LAYER_SAMPLE_LEVEL,
  OBJECT_LAYER_SEED,
  reviewCounterOf,
  type ObjectLayerGatewaySeed,
  type ObjectSeedEntry,
} from './objectLayerReviewGateway';
import type {
  ObjectLayerCounts,
  ObjectLayerScreenState,
  ObjectReviewCounter,
  ReviewObject,
} from './objectLayerTypes';

/** Vai người duyệt được sửa — sáu kịch bản đầu dùng vai này. */
export const OBJECT_LAYER_EDITOR_ROLES: readonly ProjectRole[] = ['engineer'];

/** Vai chỉ xem — kịch bản `forbidden`. */
export const OBJECT_LAYER_VIEWER_ROLES: readonly ProjectRole[] = ['viewer'];

/** Bộ mẫu đã duyệt hết — chỉ dùng cho kịch bản `success` (21/21). */
const ALL_REVIEWED_SEED: readonly ObjectSeedEntry[] = OBJECT_LAYER_SEED.map((entry) => ({
  ...entry,
  reviewed: true,
}));

/** Đồ thị của kịch bản `success`. */
const ALL_REVIEWED_GRAPH: NormalizedSpatial = buildObjectLayerGraph(ALL_REVIEWED_SEED);

/** Đồ thị của kịch bản `empty` — vẫn có tường, chỉ không đối tượng nào. */
const NO_OBJECTS_GRAPH: NormalizedSpatial = buildObjectLayerGraph([]);

/**
 * Một kịch bản: nguyên liệu cho một trong bảy trạng thái, cộng vài cờ ngoài đồ
 * thị (vai trò, thu gọn, ảnh nền, lỗi) mà đồ thị tự nó không mang.
 *
 * Mọi trường có mặt ở MỌI kịch bản: một hook đọc `scenario.error` không phải
 * đoán xem trường đó có tồn tại không.
 */
export interface ObjectLayerReviewScenario {
  readonly state: ObjectLayerScreenState;
  /** Nhãn tiếng Việt của trạng thái, nguyên từ `SEVEN_STATE_LABELS`. */
  readonly label: string;
  /** Dòng bộ mẫu của kịch bản — nguyên liệu, không phải viewmodel. */
  readonly seed: readonly ObjectSeedEntry[];
  /** Đồ thị không gian tương ứng. `null` ở kịch bản `error` và `loading`. */
  readonly graph: NormalizedSpatial | null;
  /** 21 đối tượng đọc ra từ đồ thị — rỗng ở `empty`, `loading` và `error`. */
  readonly objects: readonly ReviewObject[];
  readonly counts: ObjectLayerCounts;
  readonly reviewCounter: ObjectReviewCounter;
  /** Nguồn ảnh nền. `null` khi chưa có ảnh nào để xem. */
  readonly backgroundImageUrl: string | null;
  readonly roles: readonly ProjectRole[];
  /** `true` ở kịch bản `forbidden` — vai Người xem. */
  readonly isViewerRole: boolean;
  /** `true` ở kịch bản `collapsed`. */
  readonly isCollapsed: boolean;
  /** Non-null CHỈ ở kịch bản `error`, cùng quy ước với `SevenStateScenario.error`. */
  readonly error: unknown;
  /** Cắm thẳng vào `createMockObjectLayerReviewGateway` — R-73. */
  readonly gatewaySeed: ObjectLayerGatewaySeed;
}

const labelOf = (state: SevenState): string => SEVEN_STATE_LABELS[state];

/** Đọc số đếm ra từ chính danh sách đối tượng — không gõ tay 9, 7, 5 hay 21. */
function scenarioOf(input: {
  readonly state: ObjectLayerScreenState;
  readonly seed: readonly ObjectSeedEntry[];
  readonly graph: NormalizedSpatial | null;
  readonly backgroundImageUrl: string | null;
  readonly roles: readonly ProjectRole[];
  readonly isViewerRole: boolean;
  readonly isCollapsed: boolean;
  readonly error: unknown;
  readonly gatewaySeed: ObjectLayerGatewaySeed;
}): ObjectLayerReviewScenario {
  const objects = objectsOf(input.graph, OBJECT_LAYER_SAMPLE_LEVEL, input.seed);

  return {
    state: input.state,
    label: labelOf(input.state),
    seed: input.seed,
    graph: input.graph,
    objects,
    counts: countsOf(objects),
    reviewCounter: reviewCounterOf(objects),
    backgroundImageUrl: input.backgroundImageUrl,
    roles: input.roles,
    isViewerRole: input.isViewerRole,
    isCollapsed: input.isCollapsed,
    error: input.error,
    gatewaySeed: input.gatewaySeed,
  };
}

/** 1. Rỗng — AI không nhận ra đối tượng nào ở tầng này. */
export const OBJECT_LAYER_SCENARIO_EMPTY: ObjectLayerReviewScenario = scenarioOf({
  state: 'empty',
  seed: [],
  graph: NO_OBJECTS_GRAPH,
  backgroundImageUrl: OBJECT_LAYER_SAMPLE_IMAGE,
  roles: OBJECT_LAYER_EDITOR_ROLES,
  isViewerRole: false,
  isCollapsed: false,
  error: null,
  gatewaySeed: { graph: NO_OBJECTS_GRAPH, seed: [] },
});

/** 2. Đang tải — chưa có gì, kể cả ảnh nền. */
export const OBJECT_LAYER_SCENARIO_LOADING: ObjectLayerReviewScenario = scenarioOf({
  state: 'loading',
  seed: OBJECT_LAYER_SEED,
  graph: null,
  backgroundImageUrl: null,
  roles: OBJECT_LAYER_EDITOR_ROLES,
  isViewerRole: false,
  isCollapsed: false,
  error: null,
  gatewaySeed: { graph: null, seed: [], withoutImage: true },
});

/** 3. Một phần — trạng thái CHÍNH của màn: 9/21 đã duyệt, 5 mục dưới ngưỡng. */
export const OBJECT_LAYER_SCENARIO_PARTIAL: ObjectLayerReviewScenario = scenarioOf({
  state: 'partial',
  seed: OBJECT_LAYER_SEED,
  graph: OBJECT_LAYER_SAMPLE_GRAPH,
  backgroundImageUrl: OBJECT_LAYER_SAMPLE_IMAGE,
  roles: OBJECT_LAYER_EDITOR_ROLES,
  isViewerRole: false,
  isCollapsed: false,
  error: null,
  gatewaySeed: {},
});

/**
 * 3b. Một phần, nhánh thứ hai — nhận diện nội thất lỗi trong khi cửa vẫn xong.
 *
 * KHÔNG phải kịch bản `error`: lớp nội thất hiện một hàng cần chú ý và màn vẫn
 * duyệt được, đúng câu "không chặn cả màn" của đặc tả. Không nằm trong bảy kịch
 * bản (bảy trạng thái là bảy, không tám) — nó là biến thể của `partial`.
 */
export const OBJECT_LAYER_SCENARIO_FURNITURE_BRANCH: ObjectLayerReviewScenario = scenarioOf({
  state: 'partial',
  seed: ALL_REVIEWED_SEED,
  graph: ALL_REVIEWED_GRAPH,
  backgroundImageUrl: OBJECT_LAYER_SAMPLE_IMAGE,
  roles: OBJECT_LAYER_EDITOR_ROLES,
  isViewerRole: false,
  isCollapsed: false,
  error: null,
  gatewaySeed: { graph: ALL_REVIEWED_GRAPH, seed: ALL_REVIEWED_SEED, failFurnitureBranch: true },
});

/**
 * 4. Lỗi — lớp đối tượng hỏng, ẢNH NỀN vẫn xem được.
 *
 * Đây là bẫy mà màn QC anh em đã sập một lần: gộp hai lượt đọc làm một khiến
 * "lớp dữ liệu hỏng" xoá luôn ảnh gốc, tức đúng cái màn trắng mà A11 tồn tại để
 * chặn. Cổng giả vì thế có hai cờ hỏng riêng.
 */
export const OBJECT_LAYER_SCENARIO_ERROR: ObjectLayerReviewScenario = scenarioOf({
  state: 'error',
  seed: OBJECT_LAYER_SEED,
  graph: null,
  backgroundImageUrl: OBJECT_LAYER_SAMPLE_IMAGE,
  roles: OBJECT_LAYER_EDITOR_ROLES,
  isViewerRole: false,
  isCollapsed: false,
  error: new Error('network: fetch failed'),
  gatewaySeed: { failReadObjectLayer: true },
});

/** 5. Xong — 21/21 đối tượng đã duyệt. */
export const OBJECT_LAYER_SCENARIO_SUCCESS: ObjectLayerReviewScenario = scenarioOf({
  state: 'success',
  seed: ALL_REVIEWED_SEED,
  graph: ALL_REVIEWED_GRAPH,
  backgroundImageUrl: OBJECT_LAYER_SAMPLE_IMAGE,
  roles: OBJECT_LAYER_EDITOR_ROLES,
  isViewerRole: false,
  isCollapsed: false,
  error: null,
  gatewaySeed: { graph: ALL_REVIEWED_GRAPH, seed: ALL_REVIEWED_SEED },
});

/** 6. Không có quyền — vai Người xem: canvas chỉ xem, panel ẩn nút sửa. */
export const OBJECT_LAYER_SCENARIO_FORBIDDEN: ObjectLayerReviewScenario = scenarioOf({
  state: 'forbidden',
  seed: OBJECT_LAYER_SEED,
  graph: OBJECT_LAYER_SAMPLE_GRAPH,
  backgroundImageUrl: OBJECT_LAYER_SAMPLE_IMAGE,
  roles: OBJECT_LAYER_VIEWER_ROLES,
  isViewerRole: true,
  isCollapsed: false,
  error: null,
  gatewaySeed: {},
});

/** 7. Thu gọn — ẩn cả hai panel, chỉ còn canvas toàn khung. */
export const OBJECT_LAYER_SCENARIO_COLLAPSED: ObjectLayerReviewScenario = scenarioOf({
  state: 'collapsed',
  seed: OBJECT_LAYER_SEED,
  graph: OBJECT_LAYER_SAMPLE_GRAPH,
  backgroundImageUrl: OBJECT_LAYER_SAMPLE_IMAGE,
  roles: OBJECT_LAYER_EDITOR_ROLES,
  isViewerRole: false,
  isCollapsed: true,
  error: null,
  gatewaySeed: {},
});

/** Bảy kịch bản, đúng thứ tự `SEVEN_STATES`. */
export const OBJECT_LAYER_REVIEW_SCENARIOS: readonly ObjectLayerReviewScenario[] = [
  OBJECT_LAYER_SCENARIO_EMPTY,
  OBJECT_LAYER_SCENARIO_LOADING,
  OBJECT_LAYER_SCENARIO_PARTIAL,
  OBJECT_LAYER_SCENARIO_ERROR,
  OBJECT_LAYER_SCENARIO_SUCCESS,
  OBJECT_LAYER_SCENARIO_FORBIDDEN,
  OBJECT_LAYER_SCENARIO_COLLAPSED,
];

/** Kịch bản của một trạng thái — story và test tra theo tên nhánh. */
export const objectLayerScenarioFor = (state: ObjectLayerScreenState): ObjectLayerReviewScenario =>
  OBJECT_LAYER_REVIEW_SCENARIOS.find((scenario) => scenario.state === state) ??
  OBJECT_LAYER_SCENARIO_PARTIAL;
