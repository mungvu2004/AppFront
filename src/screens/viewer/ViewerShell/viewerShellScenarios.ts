/**
 * Bảy kịch bản của VỎ CHUNG chín màn 3D, dựng sẵn để story và bài kiểm dùng
 * chung.
 *
 * Theo đúng khuôn `thicknessStandardizationScenarios.ts` và
 * `roomLabelReviewScenarios.ts`: đúng bảy kịch bản, tên nhánh lấy nguyên từ
 * `SEVEN_STATES`, nhãn tiếng Việt lấy nguyên từ `SEVEN_STATE_LABELS` chứ không
 * tự đặt một bản dịch thứ hai có thể trôi khỏi bản gốc.
 *
 * Mỗi kịch bản mang ĐỒ THỊ và một trạng thái, KHÔNG mang `ViewerShellProps` đã
 * tính sẵn. Lý do giống hệt các màn QC anh em: viewmodel là kết quả của
 * `useViewerShell.ts`, và dựng sẵn nó ở đây nghĩa là chép logic của hook vào
 * một chỗ thứ hai để hai bên trôi khỏi nhau (R-61/R-70). Nơi gọi cắm
 * `scenario.spatial` vào container thật.
 *
 * ## Ba đồ thị, bảy kịch bản
 *
 * Bảy trạng thái KHÔNG cần bảy tập dữ liệu: `success`, `forbidden`, `collapsed`
 * và `error` tả cùng một mô hình đầy đủ, khác nhau ở quyền, ở bố cục và ở việc
 * lượt đọc tên dự án có hỏng không — không phải ở dữ liệu hình học. Nên chỉ có
 * ba đồ thị: đầy đủ, một phần, và rỗng.
 */

import { SEVEN_STATE_LABELS, type SevenState } from '@/lib/testing/sevenStateScenarios';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import type { ProjectRole } from '@/types/project';

import {
  VIEWER_EMPTY_SPATIAL,
  VIEWER_FIXTURE_SPATIAL,
  VIEWER_PARTIAL_SPATIAL,
} from './viewerShellGateway';
import type { ViewerScreenState } from './viewerShellTypes';

/** Một kịch bản: trạng thái, nhãn, đồ thị và vai. */
export interface ViewerShellScenario {
  readonly state: ViewerScreenState;
  /** Tên tiếng Việt của trạng thái, cho thông điệp hỏng người đọc được. */
  readonly label: string;
  readonly spatial: NormalizedSpatial | null;
  /** Vai của người xem; chỉ `forbidden` khác mặc định. */
  readonly roles: readonly ProjectRole[];
  /** Số đo hiệu năng, khi có. */
  readonly perf: { readonly frameRate: number; readonly triangles: number } | null;
}

/** Số đo hiệu năng của bộ mẫu — đúng "58 fps" mà đặc tả in trên thanh trạng thái. */
export const FIXTURE_PERF = Object.freeze({ frameRate: 58, triangles: 51_700 });

/** Vai mặc định: kỹ sư, dùng được mọi công cụ. */
const ENGINEER: readonly ProjectRole[] = Object.freeze(['engineer']);

/** Vai Người xem: công cụ sửa bị gỡ khỏi ray. */
const VIEWER_ONLY: readonly ProjectRole[] = Object.freeze(['viewer']);

const scenario = (
  state: ViewerScreenState,
  spatial: NormalizedSpatial | null,
  roles: readonly ProjectRole[] = ENGINEER,
  perf: ViewerShellScenario['perf'] = FIXTURE_PERF,
): ViewerShellScenario => ({
  state,
  label: SEVEN_STATE_LABELS[state as SevenState],
  spatial,
  roles,
  perf,
});

/** Bảy kịch bản, theo đúng thứ tự của `SEVEN_STATES`. */
export const VIEWER_SHELL_SCENARIOS: Readonly<Record<ViewerScreenState, ViewerShellScenario>> =
  Object.freeze({
    /** Dự án chưa dựng được tầng nào. */
    empty: scenario('empty', VIEWER_EMPTY_SPATIAL, ENGINEER, null),
    /** Đang dựng mô hình; chưa có số đo hiệu năng nào để in. */
    loading: scenario('loading', null, ENGINEER, null),
    /** Đủ bốn tầng, mới có phòng của tầng dưới cùng. */
    partial: scenario('partial', VIEWER_PARTIAL_SPATIAL),
    /** Không đọc được dữ liệu; khung nhìn vẫn xem được. */
    error: scenario('error', VIEWER_FIXTURE_SPATIAL),
    /** 4 tầng · 14 phòng · 248,60 m² · 58 fps. */
    success: scenario('success', VIEWER_FIXTURE_SPATIAL),
    /** Vai Người xem. */
    forbidden: scenario('forbidden', VIEWER_FIXTURE_SPATIAL, VIEWER_ONLY),
    /** Hai ray và panel phải ẩn; khung nhìn còn nguyên. */
    collapsed: scenario('collapsed', VIEWER_FIXTURE_SPATIAL),
  });

/** Bảy trạng thái theo thứ tự, cho vòng lặp của bài kiểm và của story. */
export const VIEWER_SCREEN_STATES: readonly ViewerScreenState[] = Object.freeze([
  'empty',
  'loading',
  'partial',
  'error',
  'success',
  'forbidden',
  'collapsed',
]);
