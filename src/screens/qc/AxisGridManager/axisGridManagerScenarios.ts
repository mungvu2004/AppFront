/**
 * Bảy kịch bản của màn "Quản lý trục & căn tầng", dựng sẵn để story và test
 * dùng chung (R-70).
 *
 * Khác với `wallLayerReviewScenarios.ts`/`dimensionOcrReviewScenarios.ts` (nơi
 * mỗi kịch bản mang NGUYÊN LIỆU đồ thị để một hook lớp L2 sau này tính ra
 * viewmodel): đặc tả riêng của task này ("Mỗi kịch bản trả về AxisGridViewModel
 * hoàn chỉnh") đòi hình dạng khác — mỗi hằng số dưới đây LÀ một
 * `AxisGridViewModel` đầy đủ. Việc "tính" vẫn không tự chế: mọi trục đi qua
 * `detectAxes()`/`labelAxes()`, mọi độ lệch tầng đi qua `alignFloors()`, cả hai
 * đã chạy sẵn trong `axisGridFixture.ts` (R-61). File này chỉ làm hai việc domain
 * không làm hộ: định dạng số thành chữ (A15) và quy đổi milimét sang pixel bằng
 * `AXIS_GRID_FIXTURE_SCALE` (không tự viết công thức quy đổi, R-71).
 *
 * Tên nhánh lấy nguyên văn từ `SEVEN_STATES`/`SEVEN_STATE_LABELS` của
 * `src/lib/testing/sevenStateScenarios.ts`.
 */

import { axisLine, type AxisLine } from '@/domain/axes/detect';
import type { FloorAlignment, FloorAlignmentReport } from '@/domain/axes/alignFloors';
import type { LabelledAxis } from '@/domain/axes/label';
import { millimetres, type Millimetres, type Pixels } from '@/domain/units/types';
import { formatLength } from '@/lib/format/measure';
import { formatNumber, MISSING_VALUE } from '@/lib/format/number';

import {
  AXIS_GRID_FIXTURE_ALL_ALIGNED_REPORT,
  AXIS_GRID_FIXTURE_DRAWING_BOUNDS_MM,
  AXIS_GRID_FIXTURE_FLOOR1,
  AXIS_GRID_FIXTURE_FLOOR1_BOUNDS_MM,
  AXIS_GRID_FIXTURE_FLOOR2_ISSUE,
  AXIS_GRID_FIXTURE_GRID,
  AXIS_GRID_FIXTURE_LABELLED_AXES,
  AXIS_GRID_FIXTURE_ORIGIN_POINT,
  AXIS_GRID_FIXTURE_ORIGIN_POSITION,
  AXIS_GRID_FIXTURE_PENDING_REPORT,
  AXIS_GRID_FIXTURE_REPORT,
  AXIS_GRID_FIXTURE_SCALE,
  AXIS_GRID_FIXTURE_VERTICAL_LABELLED_AXES,
} from './axisGridFixture';
import type {
  AxisCanvasAxisViewModel,
  AxisCanvasGhostFloorViewModel,
  AxisCanvasOriginViewModel,
  AxisCanvasViewModel,
  AxisGridDirection,
  AxisGridPixelPoint,
  AxisGridPixelRect,
  AxisGridScreenState,
  AxisGridViewModel,
  AxisGroupViewModel,
  AxisOriginAnchorOption,
  AxisRowViewModel,
  FloorAlignRowViewModel,
  FloorAlignStatus,
  OriginPanelViewModel,
} from './axisGridTypes';

/* -------------------------------------------------------------------------- */
/* Quy đổi milimét sang pixel — LUÔN qua `AXIS_GRID_FIXTURE_SCALE` (R-71).     */
/* -------------------------------------------------------------------------- */

function toPx(valueMm: Millimetres): Pixels {
  return AXIS_GRID_FIXTURE_SCALE.millimetresToPixels(valueMm);
}

function pointPx(x: Millimetres, y: Millimetres): AxisGridPixelPoint {
  return { x: toPx(x), y: toPx(y) };
}

function pixelText(valuePx: Pixels): string {
  return `${formatNumber(valuePx)} px`;
}

const DRAWING_BOUNDS_PX: AxisGridPixelRect = {
  x: toPx(AXIS_GRID_FIXTURE_DRAWING_BOUNDS_MM.x),
  y: toPx(AXIS_GRID_FIXTURE_DRAWING_BOUNDS_MM.y),
  width: toPx(AXIS_GRID_FIXTURE_DRAWING_BOUNDS_MM.width),
  height: toPx(AXIS_GRID_FIXTURE_DRAWING_BOUNDS_MM.height),
};

const ORIGIN_CANVAS: AxisCanvasOriginViewModel = {
  pointPx: pointPx(AXIS_GRID_FIXTURE_ORIGIN_POINT.x, AXIS_GRID_FIXTURE_ORIGIN_POINT.y),
  label: '0,0',
};

/** Đường bao tầng 1, dùng làm bóng mờ đối chiếu khi canvas đang xem tầng 2. */
const GHOST_FLOOR_BELOW: AxisCanvasGhostFloorViewModel = {
  levelId: AXIS_GRID_FIXTURE_FLOOR1.levelId,
  outlinePx: [
    pointPx(AXIS_GRID_FIXTURE_FLOOR1_BOUNDS_MM.x, AXIS_GRID_FIXTURE_FLOOR1_BOUNDS_MM.y),
    pointPx(
      millimetres(AXIS_GRID_FIXTURE_FLOOR1_BOUNDS_MM.x + AXIS_GRID_FIXTURE_FLOOR1_BOUNDS_MM.width),
      AXIS_GRID_FIXTURE_FLOOR1_BOUNDS_MM.y,
    ),
    pointPx(
      millimetres(AXIS_GRID_FIXTURE_FLOOR1_BOUNDS_MM.x + AXIS_GRID_FIXTURE_FLOOR1_BOUNDS_MM.width),
      millimetres(AXIS_GRID_FIXTURE_FLOOR1_BOUNDS_MM.y + AXIS_GRID_FIXTURE_FLOOR1_BOUNDS_MM.height),
    ),
    pointPx(
      AXIS_GRID_FIXTURE_FLOOR1_BOUNDS_MM.x,
      millimetres(AXIS_GRID_FIXTURE_FLOOR1_BOUNDS_MM.y + AXIS_GRID_FIXTURE_FLOOR1_BOUNDS_MM.height),
    ),
  ],
  isVisible: true,
};

/* -------------------------------------------------------------------------- */
/* Panel trái — hàng trục và nhóm theo hướng.                                  */
/* -------------------------------------------------------------------------- */

function toAxisRow(labelled: LabelledAxis, nextCoordinateMm: Millimetres | null): AxisRowViewModel {
  const spacingMm = nextCoordinateMm === null ? null : millimetres(nextCoordinateMm - labelled.axis.coordinateMm);

  return {
    id: `${labelled.axis.direction}-${labelled.label}`,
    label: labelled.label,
    direction: labelled.axis.direction,
    spacingMm,
    spacingText: spacingMm === null ? null : formatLength(spacingMm, { unit: 'mm' }),
    isVisible: true,
    isSelected: false,
  };
}

function toAxisRows(labelledAxes: readonly LabelledAxis[]): readonly AxisRowViewModel[] {
  return labelledAxes.map((labelled, index) => {
    const next = labelledAxes[index + 1];
    return toAxisRow(labelled, next === undefined ? null : next.axis.coordinateMm);
  });
}

const AXIS_GROUP_TITLES: Readonly<Record<AxisGridDirection, string>> = {
  horizontal: 'Trục ngang',
  vertical: 'Trục dọc',
};

const AXIS_GROUP_ADD_LABELS: Readonly<Record<AxisGridDirection, string>> = {
  horizontal: 'Thêm trục ngang',
  vertical: 'Thêm trục dọc',
};

function toAxisGroup(direction: AxisGridDirection, labelledAxes: readonly LabelledAxis[]): AxisGroupViewModel {
  return {
    direction,
    title: AXIS_GROUP_TITLES[direction],
    rows: toAxisRows(labelledAxes.filter((item) => item.axis.direction === direction)),
    addButtonLabel: AXIS_GROUP_ADD_LABELS[direction],
  };
}

function toAxisGroups(labelledAxes: readonly LabelledAxis[]): readonly AxisGroupViewModel[] {
  return [toAxisGroup('horizontal', labelledAxes), toAxisGroup('vertical', labelledAxes)];
}

/** Cả hai chiều — nguồn của kịch bản `success`/`forbidden`/`collapsed`. */
const FULL_GROUPS = toAxisGroups(AXIS_GRID_FIXTURE_LABELLED_AXES);

/** Chỉ trục dọc — nguồn của kịch bản `partial` ("chỉ có trục dọc"). */
const VERTICAL_ONLY_GROUPS: readonly AxisGroupViewModel[] = [
  { direction: 'horizontal', title: AXIS_GROUP_TITLES.horizontal, rows: [], addButtonLabel: AXIS_GROUP_ADD_LABELS.horizontal },
  toAxisGroup('vertical', AXIS_GRID_FIXTURE_VERTICAL_LABELLED_AXES),
];

const EMPTY_GROUPS: readonly AxisGroupViewModel[] = [
  { direction: 'horizontal', title: AXIS_GROUP_TITLES.horizontal, rows: [], addButtonLabel: AXIS_GROUP_ADD_LABELS.horizontal },
  { direction: 'vertical', title: AXIS_GROUP_TITLES.vertical, rows: [], addButtonLabel: AXIS_GROUP_ADD_LABELS.vertical },
];

/* -------------------------------------------------------------------------- */
/* Mục "Gốc toạ độ".                                                           */
/* -------------------------------------------------------------------------- */

/** Không có giao trục nào để chọn — bốn trường độ lệch đều là dấu gạch ngang chờ. */
const EMPTY_ORIGIN_PANEL: OriginPanelViewModel = {
  anchorOptions: [],
  selectedAnchor: null,
  offsetXPxText: MISSING_VALUE,
  offsetYPxText: MISSING_VALUE,
  offsetXMmText: MISSING_VALUE,
  offsetYMmText: MISSING_VALUE,
  offsetXPx: toPx(millimetres(0)),
  offsetYPx: toPx(millimetres(0)),
  offsetXMm: millimetres(0),
  offsetYMm: millimetres(0),
};

function anchorValueOf(horizontalLabel: string | null, verticalLabel: string | null): string | null {
  if (horizontalLabel === null) {
    return verticalLabel;
  }
  if (verticalLabel === null) {
    return horizontalLabel;
  }
  return `${horizontalLabel}-${verticalLabel}`;
}

const FULL_ORIGIN_PANEL: OriginPanelViewModel = (() => {
  const anchorOptions: AxisOriginAnchorOption[] = [];
  for (const horizontal of AXIS_GRID_FIXTURE_GRID.horizontal) {
    for (const vertical of AXIS_GRID_FIXTURE_GRID.vertical) {
      const value = `${horizontal.label}-${vertical.label}`;
      anchorOptions.push({ value, label: value });
    }
  }

  return {
    anchorOptions,
    selectedAnchor: anchorValueOf(
      AXIS_GRID_FIXTURE_ORIGIN_POSITION.horizontalLabel,
      AXIS_GRID_FIXTURE_ORIGIN_POSITION.verticalLabel,
    ),
    offsetXPxText: pixelText(toPx(AXIS_GRID_FIXTURE_ORIGIN_POSITION.offsetXMm)),
    offsetYPxText: pixelText(toPx(AXIS_GRID_FIXTURE_ORIGIN_POSITION.offsetYMm)),
    offsetXMmText: formatLength(AXIS_GRID_FIXTURE_ORIGIN_POSITION.offsetXMm, { unit: 'mm' }),
    offsetYMmText: formatLength(AXIS_GRID_FIXTURE_ORIGIN_POSITION.offsetYMm, { unit: 'mm' }),
    offsetXPx: toPx(AXIS_GRID_FIXTURE_ORIGIN_POSITION.offsetXMm),
    offsetYPx: toPx(AXIS_GRID_FIXTURE_ORIGIN_POSITION.offsetYMm),
    offsetXMm: AXIS_GRID_FIXTURE_ORIGIN_POSITION.offsetXMm,
    offsetYMm: AXIS_GRID_FIXTURE_ORIGIN_POSITION.offsetYMm,
  };
})();

/* -------------------------------------------------------------------------- */
/* Canvas — trục đã ở pixel, `axisLine()` cắt đoạn, không tự tính hình học.    */
/* -------------------------------------------------------------------------- */

function toCanvasAxis(labelled: LabelledAxis): AxisCanvasAxisViewModel {
  const line: AxisLine = axisLine(labelled.axis);

  return {
    id: `${labelled.axis.direction}-${labelled.label}`,
    label: labelled.label,
    direction: labelled.axis.direction,
    startPx: pointPx(line.start.x, line.start.y),
    endPx: pointPx(line.end.x, line.end.y),
    isVisible: true,
    isHighlighted: false,
  };
}

function toCanvas(
  labelledAxes: readonly LabelledAxis[],
  ghostFloor: AxisCanvasGhostFloorViewModel | null,
): AxisCanvasViewModel {
  return {
    axes: labelledAxes.map((labelled) => toCanvasAxis(labelled)),
    origin: ORIGIN_CANVAS,
    ghostFloor,
    boundsPx: DRAWING_BOUNDS_PX,
  };
}

const EMPTY_CANVAS: AxisCanvasViewModel = toCanvas([], null);

/* -------------------------------------------------------------------------- */
/* Mục "Căn chỉnh giữa các tầng".                                              */
/* -------------------------------------------------------------------------- */

function statusOf(report: FloorAlignmentReport, levelId: string): FloorAlignStatus {
  const isUnalignable = report.issues.some((issue) => issue.levelId === levelId && issue.kind === 'unalignable');
  if (isUnalignable) {
    return 'unalignable';
  }
  const isWarning = report.issues.some((issue) => issue.levelId === levelId && issue.kind === 'alignment');
  return isWarning ? 'warning' : 'ok';
}

function toFloorRow(alignment: FloorAlignment, report: FloorAlignmentReport): FloorAlignRowViewModel {
  return {
    levelId: alignment.levelId,
    name: alignment.name,
    offsetText: formatLength(alignment.maxResidualMm, { unit: 'mm' }),
    offsetMm: alignment.maxResidualMm,
    status: statusOf(report, alignment.levelId),
    isBase: alignment.isBase,
    isHovered: false,
  };
}

function toFloorRows(report: FloorAlignmentReport): readonly FloorAlignRowViewModel[] {
  return report.floors.map((alignment) => toFloorRow(alignment, report));
}

const WARNING_ACTION_LABEL = 'Tự động căn chỉnh';

/* -------------------------------------------------------------------------- */
/* Câu chữ cố định của từng trạng thái (A6 — tiếng Việt, viết hoa đầu câu).    */
/* -------------------------------------------------------------------------- */

const EMPTY_NOTICE = 'AI chưa dò ra trục nào trên bản vẽ này. Kiểm tra lại lớp tường hoặc thêm trục thủ công.';
const ERROR_MESSAGE = 'axis-grid: không tải được lưới trục ở công trình này.';
const VIEWER_ROLE_NOTICE = 'Bạn đang ở vai người xem: chỉ xem lưới trục, không thêm, sửa hay xoá được.';

/* -------------------------------------------------------------------------- */
/* Bảy kịch bản — mỗi hằng số LÀ một `AxisGridViewModel` hoàn chỉnh.           */
/* -------------------------------------------------------------------------- */

/** 1. Rỗng — chưa có trục nào, dò tự động lẫn thêm tay đều chưa có kết quả. */
export const AXIS_GRID_SCENARIO_EMPTY: AxisGridViewModel = {
  state: 'empty',
  groups: EMPTY_GROUPS,
  origin: EMPTY_ORIGIN_PANEL,
  floors: [],
  canvas: EMPTY_CANVAS,
  ghostEnabled: false,
  warningBanner: null,
  isCompact: false,
  isCollapsed: false,
  isViewerRole: false,
  viewerRoleNotice: null,
  emptyNotice: EMPTY_NOTICE,
  errorMessage: null,
};

/** 2. Đang tải — đang dò trục / đang tính căn tầng. */
export const AXIS_GRID_SCENARIO_LOADING: AxisGridViewModel = {
  state: 'loading',
  groups: EMPTY_GROUPS,
  origin: EMPTY_ORIGIN_PANEL,
  floors: [],
  canvas: EMPTY_CANVAS,
  ghostEnabled: false,
  warningBanner: null,
  isCompact: false,
  isCollapsed: false,
  isViewerRole: false,
  viewerRoleNotice: null,
  emptyNotice: null,
  errorMessage: null,
};

/**
 * 3. Một phần — TRẠNG THÁI CHÍNH của việc dò trục: mới có trục dọc (1, 2, 3, 4),
 * chưa có trục ngang nào. `floors` để rỗng vì căn tầng cần đủ cả hai chiều.
 */
export const AXIS_GRID_SCENARIO_PARTIAL: AxisGridViewModel = {
  state: 'partial',
  groups: VERTICAL_ONLY_GROUPS,
  origin: EMPTY_ORIGIN_PANEL,
  floors: [],
  canvas: toCanvas(AXIS_GRID_FIXTURE_VERTICAL_LABELLED_AXES, null),
  ghostEnabled: false,
  warningBanner: null,
  isCompact: false,
  isCollapsed: false,
  isViewerRole: false,
  viewerRoleNotice: null,
  emptyNotice: null,
  errorMessage: null,
};

/** 4. Lỗi — lớp dữ liệu trục hỏng. */
export const AXIS_GRID_SCENARIO_ERROR: AxisGridViewModel = {
  state: 'error',
  groups: EMPTY_GROUPS,
  origin: EMPTY_ORIGIN_PANEL,
  floors: [],
  canvas: EMPTY_CANVAS,
  ghostEnabled: false,
  warningBanner: null,
  isCompact: false,
  isCollapsed: false,
  isViewerRole: false,
  viewerRoleNotice: null,
  emptyNotice: null,
  errorMessage: ERROR_MESSAGE,
};

/** 5. Xong — đủ cả hai chiều trục, mọi tầng trong dung sai (`warningBanner === null`). */
export const AXIS_GRID_SCENARIO_SUCCESS: AxisGridViewModel = {
  state: 'success',
  groups: FULL_GROUPS,
  origin: FULL_ORIGIN_PANEL,
  floors: toFloorRows(AXIS_GRID_FIXTURE_ALL_ALIGNED_REPORT),
  canvas: toCanvas(AXIS_GRID_FIXTURE_LABELLED_AXES, { ...GHOST_FLOOR_BELOW, isVisible: false }),
  ghostEnabled: false,
  warningBanner: null,
  isCompact: false,
  isCollapsed: false,
  isViewerRole: false,
  viewerRoleNotice: null,
  emptyNotice: null,
  errorMessage: null,
};

/** 6. Không có quyền — vai Người xem; dữ liệu như bản THẬT (tầng 2 vẫn cảnh báo). */
export const AXIS_GRID_SCENARIO_FORBIDDEN: AxisGridViewModel = {
  state: 'forbidden',
  groups: FULL_GROUPS,
  origin: FULL_ORIGIN_PANEL,
  floors: toFloorRows(AXIS_GRID_FIXTURE_REPORT),
  canvas: toCanvas(AXIS_GRID_FIXTURE_LABELLED_AXES, GHOST_FLOOR_BELOW),
  ghostEnabled: true,
  warningBanner: {
    message: AXIS_GRID_FIXTURE_FLOOR2_ISSUE.message,
    actionLabel: WARNING_ACTION_LABEL,
    levelId: AXIS_GRID_FIXTURE_FLOOR2_ISSUE.levelId,
  },
  isCompact: false,
  isCollapsed: false,
  isViewerRole: true,
  viewerRoleNotice: VIEWER_ROLE_NOTICE,
  emptyNotice: null,
  errorMessage: null,
};

/** 7. Thu gọn — ẩn panel trái + panel căn tầng; dữ liệu như bản THẬT, chỉ khác cờ thu gọn. */
export const AXIS_GRID_SCENARIO_COLLAPSED: AxisGridViewModel = {
  state: 'collapsed',
  groups: FULL_GROUPS,
  origin: FULL_ORIGIN_PANEL,
  floors: toFloorRows(AXIS_GRID_FIXTURE_REPORT),
  canvas: toCanvas(AXIS_GRID_FIXTURE_LABELLED_AXES, GHOST_FLOOR_BELOW),
  ghostEnabled: true,
  warningBanner: {
    message: AXIS_GRID_FIXTURE_FLOOR2_ISSUE.message,
    actionLabel: WARNING_ACTION_LABEL,
    levelId: AXIS_GRID_FIXTURE_FLOOR2_ISSUE.levelId,
  },
  isCompact: false,
  isCollapsed: true,
  isViewerRole: false,
  viewerRoleNotice: null,
  emptyNotice: null,
  errorMessage: null,
};

/** Bảy kịch bản, đúng thứ tự `SEVEN_STATES` — cho `expectSevenStates` và cho story. */
export const AXIS_GRID_MANAGER_SCENARIOS: readonly AxisGridViewModel[] = [
  AXIS_GRID_SCENARIO_EMPTY,
  AXIS_GRID_SCENARIO_LOADING,
  AXIS_GRID_SCENARIO_PARTIAL,
  AXIS_GRID_SCENARIO_ERROR,
  AXIS_GRID_SCENARIO_SUCCESS,
  AXIS_GRID_SCENARIO_FORBIDDEN,
  AXIS_GRID_SCENARIO_COLLAPSED,
];

/** Kịch bản của một trạng thái — story và test tra theo tên nhánh. */
export const axisGridScenarioFor = (state: AxisGridScreenState): AxisGridViewModel =>
  AXIS_GRID_MANAGER_SCENARIOS.find((scenario) => scenario.state === state) ?? AXIS_GRID_SCENARIO_PARTIAL;

/* -------------------------------------------------------------------------- */
/* Kịch bản phụ — "một số tầng có trục, liệt kê theo tầng".                    */
/*                                                                             */
/* KHÔNG nằm trong bảy kịch bản ở trên (bảy trạng thái là bảy, không tám) —    */
/* đây là một biến thể khác của `partial`, cùng khuôn                         */
/* `OBJECT_LAYER_SCENARIO_FURNITURE_BRANCH` của `objectLayerReviewScenarios.ts`.*/
/* Tầng 1 đã có đủ trục (`ok`), tầng 2 có đủ trục nhưng còn lệch (`warning`),  */
/* tầng 3 CHƯA dò ra trục nào (`unalignable` — dưới hai trục khớp được với     */
/* tầng chuẩn) — ba dòng, đúng ba trạng thái mà A4 cho phép, liệt kê cùng lúc. */
/* -------------------------------------------------------------------------- */

export const AXIS_GRID_SCENARIO_PARTIAL_BY_FLOOR: AxisGridViewModel = {
  state: 'partial',
  groups: FULL_GROUPS,
  origin: FULL_ORIGIN_PANEL,
  floors: toFloorRows(AXIS_GRID_FIXTURE_PENDING_REPORT),
  canvas: toCanvas(AXIS_GRID_FIXTURE_LABELLED_AXES, GHOST_FLOOR_BELOW),
  ghostEnabled: true,
  warningBanner: {
    message: AXIS_GRID_FIXTURE_FLOOR2_ISSUE.message,
    actionLabel: WARNING_ACTION_LABEL,
    levelId: AXIS_GRID_FIXTURE_FLOOR2_ISSUE.levelId,
  },
  isCompact: false,
  isCollapsed: false,
  isViewerRole: false,
  viewerRoleNotice: null,
  emptyNotice: null,
  errorMessage: null,
};
