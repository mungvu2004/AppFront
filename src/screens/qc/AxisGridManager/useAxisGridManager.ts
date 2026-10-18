/**
 * Nửa "suy nghĩ" của màn S-15 "Quản lý trục và gốc toạ độ" — mọi thứ view của
 * màn cần, đã xong.
 *
 * `axisGridTypes.ts` là hợp đồng view-model DUY NHẤT của màn và nó ĐÃ ĐÓNG
 * BĂNG; hook này trả về đúng {@link AxisGridManagerProps}, cộng vài trường
 * thoả thuận thêm với người tích hợp lớp 3 (xem {@link UseAxisGridManagerResult}).
 *
 * ## Không công thức tự chế (R-61) — màn không tự sinh trục, không tự tính lệch
 *
 * - Sinh trục từ tường chịu lực: `detectAxes` (M-10), gọi qua
 *   `detectAxesOfLevel` của cổng.
 * - Đặt mã trục: `labelAxes` (M-10). Mã "A"/"1" không do màn đánh.
 * - Lưới và gốc toạ độ: `buildAxisGrid` + `setOrigin` + `toAxisPosition` +
 *   `describePoint` (M-10).
 * - Căn tầng: `alignFloors` (M-11). Độ lệch còn lại đọc ở
 *   `FloorAlignment.maxResidualMm`, câu cảnh báo đọc ở `FloorIssue.message` —
 *   không câu nào soạn lại ở đây.
 * - Bắt điểm khi kéo trục: `snapToTargets` (M-03).
 * - Quy đổi mm ↔ px: `Scale` của `src/domain/units/scale.ts`, qua
 *   `scale`. Không một phép nhân chia đơn vị nào viết tay (R-71, A15).
 * - Định dạng số: `formatLength` / `formatNumber` của `src/lib/format`. Không
 *   `toFixed`, không `toLocaleString` ở bất kỳ đâu trong thư mục màn (A15).
 *
 * ## Trạng thái máy chủ (R-64)
 *
 * Không `useState` nào giữ cờ đang-tải hay cờ hỏng. N16 đi qua `useFloorLayer` (G22);
 * lượt ghi trục dọn khoá `space.byFloor` qua `invalidationMap.changeAxis`
 * dọn sau mỗi lượt ghi — và mọi lượt ghi gọi
 * `applyInvalidation(queryClient, 'changeAxis', …)`, không `invalidateQueries`
 * trần. `useState` ở đây chỉ giữ trạng thái của riêng giao diện: trục đang chọn,
 * trục đang ẩn, tầng đang trỏ, cờ bóng ma, cờ thu gọn, giao trục neo và câu
 * chặn khoảng cách gần nhất.
 *
 * ## Đường ghi (A10)
 *
 * Không một dòng nào gọi `set()` hay `_applyPatches()`. Mọi thay đổi đi: lệnh
 * dựng bằng nguyên thuỷ công khai → `dispatch` (năm bước) →
 * `SpatialPort.applyPatches` = `commit(patches, label)` → kho. Hoàn tác đi qua
 * `HistoryStack` 100 bước của S-06, KHÔNG phải ngăn xếp zundo của store.
 *
 * ## Gốc toạ độ là trạng thái màn, không phải lệnh
 *
 * Điều phối viên đã sửa quyết định Q1 sau khảo sát: không tầng nào của repo có
 * chỗ ghi gốc toạ độ, nên `onAnchorChange` KHÔNG sinh lệnh — nó ghim lưới bằng
 * `setOrigin` và nói ra sự thật "chưa lưu được" qua
 * `gateway.persistAxisOrigin` (nhánh `supported: false` có kiểu). Xem đầu
 * `axisGridManagerGateway.ts`.
 *
 * ## Bàn phím (A12, R-72)
 *
 * Không một `addEventListener('keydown')` nào. `Ctrl/Cmd+Z` đăng ký qua
 * `useShortcut` ở tầng `canvas` — tầng đứng TRÊN `global` trong
 * `SCOPE_PRIORITY`, nên khi màn đang mở thì hoàn tác chạy trên ngăn xếp của
 * chính màn và `findOverlaps` không có hai đăng ký cùng tầng nào để kêu.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';

import { alignFloors, type FloorAlignmentReport, type FloorIssue } from '@/domain/axes/alignFloors';
import { axisLine, type DetectedAxis } from '@/domain/axes/detect';
import {
  axisLabelAt,
  buildAxisGrid,
  describePoint,
  labelAxes,
  PROJECT_ORIGIN,
  setOrigin,
  toAxisPosition,
  type AxisGrid,
  type LabelledAxis,
} from '@/domain/axes/label';
import { snapToTargets, type SnapTarget } from '@/domain/units/snap';
import type { PointMm } from '@/domain/units/compare';
import { millimetres, type Millimetres } from '@/domain/units/types';
import { millimetresPerPixel, pixels, scaleFromRatio, type Pixels } from '@/domain/units/scale';
import type { Axis, LevelId } from '@/domain/spatial/types';
import { toPointMm } from '@/lib/commands/business/shared';
import type { Command } from '@/lib/commands/types';
import { can } from '@/lib/auth/permissions';
import { describeError, toAppError } from '@/lib/errors';
import { getAppAnnouncer, type Announcer } from '@/lib/input/announcer';
import type { ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { formatLength } from '@/lib/format/measure';
import { formatNumber, MISSING_VALUE } from '@/lib/format/number';
import type { NotificationBus } from '@/lib/mutations/notificationBus';
import { applyInvalidation } from '@/lib/query/invalidation';
import { useFloorLayer } from '@/hooks/useFloorLayer';
import { appNotificationBus } from '@/hooks/useNotifications';
import { useShortcut } from '@/hooks/useShortcut';
import { useStore } from '@/store';
import type { ProjectRole } from '@/types/project';

import { useFloorLayerReadFailure, type FloorLayerReadFailure } from '../shared/floorLayerReadFailure';
import { useProvisionalScaleNotice, type ProvisionalScaleNotice } from '../shared/provisionalScaleNotice';
import { useLeaveWarning } from '../shared/useLeaveWarning';

import {
  announceSpacingViolation,
  axesOfLevel,
  AXIS_AUTO_ALIGN_NOTIFICATION_TYPE,
  AXIS_REMOVE_NOTIFICATION_TYPE,
  AUTO_ALIGN_UNDONE_MESSAGE,
  addAxisDescription,
  buildAddAxisCommand,
  buildAutoAlignCommand,
  buildMoveAxisCommand,
  buildRemoveAxisCommand,
  buildRenameAxisCommand,
  MIN_AXIS_SPACING_MM,
  createAxisEntity,
  createAxisGridDispatchDeps,
  createAxisGridManagerGateway,
  createAxisUndoTicket,
  describeSpacingViolation,
  detectAxesOfLevel,
  findSpacingViolation,
  floorPlansOf,
  labelForNewAxis,
  levelExtentMm,
  levelOf,
  levelsOf,
  axesInDirection,
  extendPerpendicularAxes,
  nextAxisCoordinateMm,
  outlineOfBounds,
  removeToastDescription,
  runAxisCommand,
  toDetectedAxes,
  toPixelPoint,
  toPixelRect,
  wallsOfLevel,
  type AxisGridBoundsMm,
  type AxisGridManagerGateway,
} from './axisGridManagerGateway';
import type {
  AxisAddOptions,
  AxisCanvasAxisViewModel,
  AxisCanvasGhostFloorViewModel,
  AxisCanvasViewModel,
  AxisGridDirection,
  AxisGridPixelRect,
  AxisGridScreenState,
  AxisGridManagerProps,
  AxisGridViewModel,
  AxisGridWarningBanner,
  AxisGroupViewModel,
  AxisOriginAnchorOption,
  AxisRowViewModel,
  AxisSpacingViolation,
  FloorAlignRowViewModel,
  FloorAlignStatus,
  OriginPanelViewModel,
} from './axisGridTypes';

/* -------------------------------------------------------------------------- */
/* Câu chữ — bảng đối chiếu `.orca-notes/S15-T4-copy.md`.                      */
/* -------------------------------------------------------------------------- */

/** Chuỗi cố định của màn, một chỗ duy nhất, đúng bảng đối chiếu của T4 (A6). */
export const AXIS_GRID_TEXT = {
  groupTitleHorizontal: 'Trục ngang',
  groupTitleVertical: 'Trục dọc',
  addAxisHorizontal: 'Thêm trục ngang',
  addAxisVertical: 'Thêm trục dọc',
  warningActionLabel: 'Xem trên bản vẽ',
  originCanvasLabel: '0,0',
  /* BUG-594: không hứa "suy ra từ tường bao" — trạng thái rỗng nghĩa là lượt dò ấy đã không ra gì. */
  emptyNotice: 'Chưa dò được trục nào từ tường bao của tầng này. Thêm trục bằng tay để bắt đầu.',
  viewerRoleNotice:
    'Vai trò hiện tại chỉ được xem, không được chỉnh sửa các trục. Liên hệ quản trị dự án nếu cần.',
  /**
   * Câu NÓI RA sự thật khi cổng không lưu được gốc (bộ mẫu tắt lưu).
   *
   * Câu nợ endpoint của cổng viết cho người nối dây, không cho người dùng; đây
   * là câu người dùng nghe được, và nó không hứa một lượt lưu nào đã xong.
   */
  originNotPersisted:
    'Đã ghim gốc toạ độ cho phiên làm việc này. Hệ thống chưa có chỗ lưu lựa chọn đó, nên nó mất sau khi tải lại trang.',
  shortcutUndo: 'Hoàn tác thay đổi trục gần nhất',
  shortcutRedo: 'Làm lại thay đổi trục vừa hoàn tác',
  /** BUG-578: chỉ hiện khi cổng không lưu được lưới trục (bộ mẫu); cổng thật lưu từ G4b-17. */
  unsavedNotice: 'Trục chỉ giữ trong phiên này — tải lại trang sẽ mất các thay đổi.',
  /** G4b-17: lượt lưu trục/gốc lên máy chủ hỏng. */
  saveFailed: 'Chưa lưu được thay đổi trục lên máy chủ. Kiểm tra kết nối rồi sửa lại một lần nữa.',
  /** BUG-594, BUG-601: "Căn chỉnh tự động" bị khoá thì nói vì sao. */
  autoAlignViewer: 'Vai người xem không căn chỉnh được các tầng.',
  autoAlignSingleFloor: 'Cần ít nhất hai tầng có trục để căn chỉnh.',
  autoAlignNothing: 'Các tầng đã khớp nhau, không còn gì để căn.',
} as const;

const AXIS_GROUP_TITLES: Readonly<Record<AxisGridDirection, string>> = {
  horizontal: AXIS_GRID_TEXT.groupTitleHorizontal,
  vertical: AXIS_GRID_TEXT.groupTitleVertical,
};

const AXIS_GROUP_ADD_LABELS: Readonly<Record<AxisGridDirection, string>> = {
  horizontal: AXIS_GRID_TEXT.addAxisHorizontal,
  vertical: AXIS_GRID_TEXT.addAxisVertical,
};

/** Hai hướng, đúng thứ tự panel trái liệt kê chúng. */
const AXIS_DIRECTIONS: readonly AxisGridDirection[] = ['horizontal', 'vertical'];

/* -------------------------------------------------------------------------- */
/* Phép ghép thuần — kiểm được mà không cần dựng hook.                          */
/* -------------------------------------------------------------------------- */

/** Mã hàng của một trục, đúng quy ước `axisGridManagerScenarios.ts` dùng. */
export const axisRowId = (direction: AxisGridDirection, label: string): string =>
  `${direction}-${label}`;

/** Số đo bằng pixel, viết thành chữ — dấu thập phân là dấu phẩy (A15). */
export const pixelText = (valuePx: Pixels): string => `${formatNumber(valuePx)} px`;

/** Số đo bằng milimét, viết thành chữ. `unit: 'mm'` giữ nguyên đơn vị dù số lớn. */
export const millimetreText = (valueMm: Millimetres): string =>
  formatLength(valueMm, { unit: 'mm' });

export interface AxisGridStateInput {
  readonly isViewerRole: boolean;
  readonly isCollapsed: boolean;
  readonly hasError: boolean;
  readonly isLoading: boolean;
  readonly horizontalCount: number;
  readonly verticalCount: number;
  readonly hasWarning: boolean;
  readonly floorsAllWithinTolerance: boolean;
}

/**
 * Bảy trạng thái của A11 / R-63, suy ra từ dữ liệu — tên lấy nguyên văn từ
 * `SEVEN_STATES` của `src/lib/testing/sevenStateScenarios.ts`.
 *
 * Thứ tự nhánh là thứ tự "cái gì che cái gì" mà `axisGridTypes.ts` khai:
 * `forbidden` và `collapsed` là cách MÀN đang được xem nên chúng đứng trước;
 * `error` che `loading`; `loading` tách khỏi `empty` bằng chính cờ đang tải chứ
 * không bằng "không có hàng nào", vì cả hai đều không có hàng nào.
 */
export function deriveAxisGridScreenState(input: AxisGridStateInput): AxisGridScreenState {
  if (input.isViewerRole) {
    return 'forbidden';
  }

  if (input.isCollapsed) {
    return 'collapsed';
  }

  if (input.hasError) {
    return 'error';
  }

  if (input.isLoading) {
    return 'loading';
  }

  if (input.horizontalCount === 0 && input.verticalCount === 0) {
    return 'empty';
  }

  if (input.horizontalCount === 0 || input.verticalCount === 0) {
    return 'partial';
  }

  return !input.hasWarning && input.floorsAllWithinTolerance ? 'success' : 'partial';
}

/** Ba trạng thái căn tầng mà A4 cho phép — không có nhánh thứ tư. */
export function floorStatusOf(report: FloorAlignmentReport, levelId: string): FloorAlignStatus {
  const issuesHere = report.issues.filter((issue) => issue.levelId === levelId);

  if (issuesHere.some((issue) => issue.kind === 'unalignable')) {
    return 'unalignable';
  }

  return issuesHere.some((issue) => issue.kind === 'alignment') ? 'warning' : 'ok';
}

/** Vấn đề căn tầng nặng nhất, hoặc `null` khi mọi tầng trong dung sai. */
export function worstAlignmentIssue(report: FloorAlignmentReport): FloorIssue | null {
  let worst: FloorIssue | null = null;

  for (const issue of report.issues) {
    if (issue.kind !== 'alignment' && issue.kind !== 'unalignable') {
      continue;
    }

    if (worst === null || issue.amountMm > worst.amountMm) {
      worst = issue;
    }
  }

  return worst;
}

/** Giá trị của một giao trục, ví dụ `"A-1"`. `null` khi thiếu một trong hai chiều. */
export function anchorValueOf(
  horizontalLabel: string | null,
  verticalLabel: string | null,
): string | null {
  if (horizontalLabel === null) {
    return verticalLabel;
  }

  if (verticalLabel === null) {
    return horizontalLabel;
  }

  return `${horizontalLabel}-${verticalLabel}`;
}

/** Điểm giao của hai trục trên lưới, hoặc `null` khi mã không khớp trục nào. */
export function anchorPointOf(grid: AxisGrid, anchor: string): PointMm | null {
  const horizontal = grid.horizontal.find((item) => anchor.startsWith(`${item.label}-`));
  const vertical = grid.vertical.find((item) => anchor.endsWith(`-${item.label}`));

  if (horizontal === undefined || vertical === undefined) {
    return null;
  }

  return { x: vertical.axis.coordinateMm, y: horizontal.axis.coordinateMm };
}

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

export interface UseAxisGridManagerOptions {
  readonly projectId: string;
  readonly floorId: string;
  /** Tầng đang xem; vắng mặt thì tầng đầu tiên của đồ thị. */
  readonly levelId?: LevelId;
  readonly roles?: readonly ProjectRole[];
  /** Cổng tiêm được; vắng mặt thì hook dựng cổng thật ĐÚNG MỘT LẦN. */
  readonly gateway?: AxisGridManagerGateway;
  readonly registry?: ShortcutRegistry;
  readonly notifications?: NotificationBus;
  readonly announcer?: Announcer;
  /** Story ép trạng thái `collapsed` mà không phải bấm nút. */
  readonly forceCollapsed?: boolean;
  /** Dưới 1.024px panel trái thành tấm trượt đáy; lớp 3 đo và truyền vào. */
  readonly isCompact?: boolean;
  /** Lối ra của trạng thái đọc lớp hỏng (BUG-326); route nối `useNavigate`. */
  readonly onNavigate?: (path: string) => void;
}

/**
 * Mọi thứ view thuần nhận, cộng vài trường thoả thuận thêm với người tích hợp.
 *
 * Trải đúng {@link AxisGridManagerProps} — hợp đồng props đã đóng băng của T3 —
 * nên lớp 3 truyền thẳng kết quả này vào `<AxisGridManager {...result} />`.
 */
/** G4b-16: gộp khung ảnh nền (gốc 0,0) vào hộp bao để vừa khung không cắt ảnh. */
function withBackground(bounds: AxisGridPixelRect, background: AxisCanvasBackground | null): AxisGridPixelRect {
  if (background === null) {
    return bounds;
  }

  const x = Math.min(bounds.x, 0);
  const y = Math.min(bounds.y, 0);

  return {
    x: pixels(x),
    y: pixels(y),
    width: pixels(Math.max(bounds.x + bounds.width, background.widthPx) - x),
    height: pixels(Math.max(bounds.y + bounds.height, background.heightPx) - y),
  };
}

/** G4b-16: ảnh bản vẽ của tầng, toạ độ px cùng hệ với trục (gốc 0,0). */
export interface AxisCanvasBackground {
  readonly url: string;
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface UseAxisGridManagerResult extends AxisGridManagerProps {
  /**
   * Câu chặn khoảng cách tối thiểu gần nhất, `null` khi lượt vừa rồi hợp lệ.
   *
   * `AxisGridViewModel` đã đóng băng và không có trường nào mang câu này —
   * đưa nó vào `errorMessage` sẽ lật màn sang trạng thái `error` (bất biến 4
   * của `axisGridTypes.ts`), tức nói dối. Nó đi ra bằng hai trường thoả thuận
   * thêm dưới đây, và song song đó đã được đọc lên `aria-live` ngay lúc bị
   * chặn.
   */
  readonly spacingViolation: AxisSpacingViolation | null;
  readonly spacingMessage: string | null;
  /** Ngăn xếp hoàn tác của chính màn — bài nghiệm thu đếm bước trên nó. */
  readonly historyStepCount: () => number;
  readonly canUndo: boolean;
  /** Đọc lớp hỏng khi chưa có tài liệu → cả màn là một trạng thái lỗi (BUG-326). */
  readonly readFailure: FloorLayerReadFailure | null;
  /** BUG-578: câu "chỉ giữ trong phiên". `null` ở vai chỉ xem — vai đó không sửa gì. */
  readonly unsavedNotice: string | null;
  /** G4b-15: dải "tỷ lệ tạm" — số mm của trục đang tính theo tỷ lệ chưa hiệu chỉnh. */
  readonly provisionalScaleNotice: ProvisionalScaleNotice | null;
  /** G4b-16: ảnh bản vẽ dưới lưới, đã đổi sang px theo cùng tỷ lệ với trục. */
  readonly background: AxisCanvasBackground | null;
  /** G4b-20: trả câu lỗi (tên rỗng/trùng…) hoặc null khi đã đổi. */
  readonly onAxisRename: (axisId: string, label: string) => string | null;
  readonly onAxisSpacingChange: (axisId: string, spacingMm: number) => string | null;
  /** BUG-594/601: vì sao "Căn chỉnh tự động" bị khoá; `null` khi bấm được và có việc để làm. */
  readonly autoAlignBlockedReason: string | null;
}

/** Cổng thật dựng đúng một lần cho suốt đời component. */
function useResolvedGateway(injected: AxisGridManagerGateway | undefined): AxisGridManagerGateway {
  const fallbackRef = useRef<AxisGridManagerGateway | null>(null);

  if (injected !== undefined) {
    return injected;
  }

  fallbackRef.current ??= createAxisGridManagerGateway();

  return fallbackRef.current;
}

const NO_ROWS: readonly AxisRowViewModel[] = Object.freeze([]);
const NO_FLOORS: readonly FloorAlignRowViewModel[] = Object.freeze([]);
const NO_GHOSTS: readonly AxisCanvasGhostFloorViewModel[] = Object.freeze([]);

const EMPTY_BOUNDS_PX: AxisGridPixelRect = {
  x: pixels(0),
  y: pixels(0),
  width: pixels(0),
  height: pixels(0),
};

export function useAxisGridManager(
  options: UseAxisGridManagerOptions,
): UseAxisGridManagerResult {
  const { floorId, projectId } = options;
  const gateway = useResolvedGateway(options.gateway);
  const queryClient = useQueryClient();
  const notifications = options.notifications ?? appNotificationBus;
  const announcerRef = useRef<Announcer | null>(options.announcer ?? null);

  const announce = useCallback((message: string) => {
    announcerRef.current ??= getAppAnnouncer();
    announcerRef.current.announce(message, 'assertive');
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Vai trò — trạng thái 6 vô hiệu MỌI hàm sửa, ở tầng hook.                */
  /* ---------------------------------------------------------------------- */

  const roles = options.roles ?? [];
  const canEdit = can('edit', 'layer', { roles });
  const isViewerRole = !canEdit;

  /* ---------------------------------------------------------------------- */
  /* Trạng thái của riêng giao diện.                                         */
  /* ---------------------------------------------------------------------- */

  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [hiddenRowIds, setHiddenRowIds] = useState<readonly string[]>([]);
  const [hoveredLevelId, setHoveredLevelId] = useState<string | null>(null);
  const [ghostEnabled, setGhostEnabled] = useState(false);
  const [ownCollapsed, setOwnCollapsed] = useState(false);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [originPoint, setOriginPoint] = useState<PointMm>(PROJECT_ORIGIN.point);
  const [spacingViolation, setSpacingViolation] = useState<AxisSpacingViolation | null>(null);

  const isCollapsed = options.forceCollapsed ?? ownCollapsed;

  /* ---------------------------------------------------------------------- */
  /* Lượt đọc máy chủ (R-64).                                                 */
  /* ---------------------------------------------------------------------- */

  /*
   * N16 của tầng URL — `useFloorLayer` quyết định nó vào kho thế nào (G22): kho giữ
   * tầng khác (vào bằng SPA) thì tầng này được đọc và thêm vào, không "Chưa có trục nào".
   */
  const floorLayer = useFloorLayer({ floorId, projectId, read: gateway.readLayer });

  /* G4b-17: gốc toạ độ đã lưu (N16 `origin`) là điểm ghim lưới khi mở màn. */
  const savedOriginX = floorLayer.data?.origin?.x;
  const savedOriginY = floorLayer.data?.origin?.y;
  useEffect(() => {
    if (savedOriginX !== undefined && savedOriginY !== undefined) {
      setOriginPoint({ x: millimetres(savedOriginX), y: millimetres(savedOriginY) });
    }
  }, [savedOriginX, savedOriginY]);

  const graph = useStore((state) => state.spatial);
  const setSpatial = useStore((state) => state.setSpatial);

  /* Cổng giả (story, test) cắm đồ thị bộ mẫu vào kho còn trống, revision 0 khớp N16 giả. */
  useEffect(() => {
    if (graph !== null) {
      return;
    }

    const seed = gateway.graph.read();

    if (seed !== null) {
      setSpatial(seed, null, { floorRevisions: { [floorId]: 0 }, projectId });
    }
  }, [floorId, gateway, graph, projectId, setSpatial]);

  const level = useMemo(() => levelOf(graph, options.levelId), [graph, options.levelId]);
  const levelId = level?.id ?? null;

  /* R16: ty le THAT cua tang; cong chi giu ty le du phong khi tang chua co. */
  const levelRatio = level?.scaleMillimetresPerPixel ?? null;
  const scale = useMemo(
    () => (levelRatio === null ? gateway.scale : scaleFromRatio(millimetresPerPixel(levelRatio))),
    [gateway.scale, levelRatio],
  );

  const hasError = floorLayer.error !== null;
  const readFailure = useFloorLayerReadFailure(floorLayer, projectId, options.onNavigate);
  const backgroundQuery = useQuery({
    queryKey: queryKeys.drawing.byFloor(floorId),
    queryFn: ({ signal }) => gateway.readBackground?.({ floorId, projectId, signal }) ?? null,
    enabled: gateway.readBackground !== undefined,
  });
  const background = useMemo<AxisCanvasBackground | null>(() => {
    const data = backgroundQuery.data;

    if (data === undefined || data === null || data.imageUrl === null || data.widthMm === null || data.heightMm === null) {
      return null;
    }

    return {
      url: data.imageUrl,
      widthPx: scale.millimetresToPixels(millimetres(data.widthMm)),
      heightPx: scale.millimetresToPixels(millimetres(data.heightMm)),
    };
  }, [backgroundQuery.data, scale]);

  const provisionalScaleNotice = useProvisionalScaleNotice(
    floorLayer.scaleStatus,
    projectId,
    floorId,
    options.onNavigate,
    canEdit,
  );
  const isLoading = floorLayer.isPending || graph === null;

  /* ---------------------------------------------------------------------- */
  /* Trục — kho trước, dò tự động sau. Màn KHÔNG tự sinh trục.                */
  /* ---------------------------------------------------------------------- */

  const storedAxes = useMemo(() => axesOfLevel(graph, levelId), [graph, levelId]);

  /*
   * Trục của tầng: cái đã lưu thắng; tầng chưa có trục nào thì lưới được DÒ từ
   * tường chịu lực bằng `detectAxes` (M-10) và hiện ra như một bản xem trước.
   * Lần sửa đầu tiên (thêm, xoá, kéo — `previewEntities`) mới ghi bản xem
   * trước đó vào đồ thị — không lượt ghi tự động nào lúc tải màn.
   */
  const detectedPreview = useMemo(
    () => (storedAxes.length > 0 ? [] : detectAxesOfLevel(graph, level)),
    [graph, level, storedAxes.length],
  );

  const detectedAxes = useMemo<readonly DetectedAxis[]>(
    () => (storedAxes.length > 0 ? toDetectedAxes(storedAxes) : detectedPreview),
    [detectedPreview, storedAxes],
  );

  const labelledAxes = useMemo<readonly LabelledAxis[]>(
    () => {
      if (hasError) {
        return [];
      }

      /*
       * G4b-21: trục đã lưu giữ nhãn của chính nó — xoá D không đổi tên E→D,
       * F→E… Chỉ bản xem trước (chưa lưu) mới đặt tên theo thứ tự.
       */
      const overrides = storedAxes.flatMap((stored, index) => {
        const detected = detectedAxes[index];

        return detected === undefined
          ? []
          : [{ direction: detected.direction, coordinateMm: detected.coordinateMm, label: stored.label }];
      });

      return labelAxes(detectedAxes, overrides);
    },
    [detectedAxes, hasError, storedAxes],
  );

  /**
   * Mã hàng → thực thể trong kho. Bản xem trước chưa có thực thể nào.
   *
   * Ghép theo THAM CHIẾU chứ không theo chỉ số: `labelAxes` sắp lại danh sách
   * (trục dọc trước, trục ngang sau) nhưng giữ nguyên chính đối tượng
   * `DetectedAxis` đã nhận, còn `toDetectedAxes` giữ đúng thứ tự của đồ thị —
   * nên chỉ có tham chiếu mới nối lại được hai đầu.
   */
  const axisByRowId = useMemo(() => {
    const entityOf = new Map<DetectedAxis, Axis>();

    if (storedAxes.length > 0) {
      detectedAxes.forEach((detected, index) => {
        const stored = storedAxes[index];

        if (stored !== undefined) {
          entityOf.set(detected, stored);
        }
      });
    }

    const table = new Map<string, Axis>();

    for (const labelled of labelledAxes) {
      const stored = entityOf.get(labelled.axis);

      if (stored !== undefined) {
        table.set(axisRowId(labelled.axis.direction, labelled.label), stored);
      }
    }

    return table;
  }, [detectedAxes, labelledAxes, storedAxes]);

  const grid = useMemo(
    () => buildAxisGrid(labelledAxes, setOrigin(originPoint)),
    [labelledAxes, originPoint],
  );

  /* ---------------------------------------------------------------------- */
  /* Căn tầng — `alignFloors` (M-11) tính, màn chỉ đọc kết quả.               */
  /* ---------------------------------------------------------------------- */

  const report = useMemo<FloorAlignmentReport>(
    () => alignFloors(floorPlansOf(graph)),
    [graph],
  );

  const worstIssue = useMemo(() => worstAlignmentIssue(report), [report]);

  /* ---------------------------------------------------------------------- */
  /* Đường ghi.                                                              */
  /* ---------------------------------------------------------------------- */

  const dispatchBundle = useMemo(
    () =>
      createAxisGridDispatchDeps({
        graph: { read: () => useStore.getState().spatial },
        selectionBefore: () => ({ selectedIds: [] }),
        selectionAfter: () => ({ selectedIds: [] }),
        onSynced: () => {
          /*
           * Bước `sync` chỉ đánh dấu bản vẽ bẩn. Lượt lưu lên máy chủ
           * (`persistAxisGrid`, G4b-17) chạy trong `invalidate`, nơi cả sửa,
           * hoàn tác và làm lại cùng đi qua.
           */
        },
      }),
    [],
  );

  /* G4b-17: lưu trục của tầng qua #35 rồi mới làm mới cache, để lượt đọc lại thấy bản đã lưu. */
  const invalidate = useCallback(() => {
    const graphNow = useStore.getState().spatial;
    const save =
      gateway.supports.persistAxisGrid && graphNow !== null
        ? gateway.persistAxisGrid({ floorId, projectId, graph: graphNow }).catch(() => {
            announce(AXIS_GRID_TEXT.saveFailed);
          })
        : Promise.resolve();

    void save.then(() => {
      applyInvalidation(queryClient, 'changeAxis', { floorId, projectId });
    });
  }, [announce, floorId, gateway, projectId, queryClient]);

  /** Chạy một lệnh qua đủ năm bước; `false` khi vai trò không cho sửa hoặc lệnh rỗng. */
  const run = useCallback(
    async (command: Command | null): Promise<boolean> => {
      if (!canEdit || command === null) {
        return false;
      }

      const result = await runAxisCommand(command, dispatchBundle);

      if (result.ok) {
        invalidate();
      }

      return result.ok;
    },
    [canEdit, dispatchBundle, invalidate],
  );

  const applyUndo = useCallback(() => {
    if (!canEdit) {
      return false;
    }

    const transition = dispatchBundle.history.undo();

    if (transition === null) {
      return false;
    }

    dispatchBundle.deps.spatial.applyPatches(transition.patches);
    invalidate();

    return true;
  }, [canEdit, dispatchBundle, invalidate]);

  const onUndo = useCallback(() => {
    applyUndo();
  }, [applyUndo]);

  /* G4b-24: Ctrl+Shift+Z làm lại bước vừa hoàn tác. */
  const onRedo = useCallback(() => {
    if (!canEdit) {
      return;
    }

    const transition = dispatchBundle.history.redo();

    if (transition === null) {
      return;
    }

    dispatchBundle.deps.spatial.applyPatches(transition.patches);
    invalidate();
  }, [canEdit, dispatchBundle, invalidate]);

  /* ---------------------------------------------------------------------- */
  /* Chặn hai trục cách nhau dưới MIN_AXIS_SPACING_MM.                        */
  /* ---------------------------------------------------------------------- */

  /** Chặn và NÓI VÌ SAO — trả `true` khi lượt đặt bị từ chối. */
  const rejectWhenTooClose = useCallback(
    (candidate: {
      readonly label: string;
      readonly direction: AxisGridDirection;
      readonly coordinateMm: Millimetres;
      readonly neighbours: readonly LabelledAxis[];
    }): boolean => {
      const violation = findSpacingViolation(candidate);

      if (violation === null) {
        setSpacingViolation(null);

        return false;
      }

      setSpacingViolation(violation);
      announce(announceSpacingViolation(violation));

      return true;
    },
    [announce],
  );

  /* ---------------------------------------------------------------------- */
  /* Hàm xử lý của panel trục.                                               */
  /* ---------------------------------------------------------------------- */

  const onAxisSelect = useCallback((axisId: string | null) => {
    setSelectedRowId(axisId);
  }, []);

  const onAxisToggleVisibility = useCallback((axisId: string) => {
    setHiddenRowIds((previous) =>
      previous.includes(axisId)
        ? previous.filter((id) => id !== axisId)
        : [...previous, axisId],
    );
  }, []);

  const extent = useMemo<AxisGridBoundsMm | null>(
    () => levelExtentMm(graph, levelId),
    [graph, levelId],
  );

  /**
   * Bản xem trước dò từ tường, thành thực thể để GHI (BUG-320, BUG-594).
   *
   * Trục xem trước chưa có thực thể nào, nên xoá hay kéo nó trước đây không làm
   * gì. Lần sửa đầu tiên ghi cả lưới dò được trong MỘT lệnh `axis.add` — bỏ trục
   * bị xoá, hoặc đặt trục bị kéo ở toạ độ mới — nên một Ctrl+Z trả về bản xem trước.
   * `[]` khi tầng đã có trục lưu: lúc đó không có gì để ghi thêm.
   */
  const previewEntities = useCallback(
    (edit?: { readonly rowId: string; readonly coordinateMm?: Millimetres }): Axis[] => {
      if (storedAxes.length > 0 || levelId === null) {
        return [];
      }

      return labelledAxes.flatMap((labelled) => {
        const isEdited = edit !== undefined && axisRowId(labelled.axis.direction, labelled.label) === edit.rowId;

        if (isEdited && edit.coordinateMm === undefined) {
          return [];
        }

        return [
          createAxisEntity({
            id: gateway.nextAxisId(),
            levelId,
            label: labelled.label,
            direction: labelled.axis.direction,
            coordinateMm: isEdited && edit.coordinateMm !== undefined ? edit.coordinateMm : labelled.axis.coordinateMm,
            extent,
          }),
        ];
      });
    },
    [extent, gateway, labelledAxes, levelId, storedAxes.length],
  );

  const onAxisAdd = useCallback(
    (direction: AxisGridDirection, addOptions?: AxisAddOptions) => {
      if (levelId === null) {
        return;
      }

      const lastInDirection = axesInDirection(labelledAxes, direction).at(-1);
      const coordinateMm =
        addOptions?.spacingMm !== undefined && lastInDirection !== undefined
          ? millimetres(lastInDirection.axis.coordinateMm + addOptions.spacingMm)
          : nextAxisCoordinateMm(labelledAxes, direction);
      const candidate: DetectedAxis = {
        direction,
        coordinateMm,
        startMm: millimetres(extent === null ? 0 : direction === 'vertical' ? extent.y : extent.x),
        endMm: millimetres(
          extent === null
            ? 0
            : direction === 'vertical'
              ? extent.y + extent.height
              : extent.x + extent.width,
        ),
        spreadMm: millimetres(0),
        wallIds: [],
      };
      /*
       * G4b-21: trục đã lưu giữ tên riêng, nên trục mới (luôn đặt ở cuối) lấy
       * tên kế tiếp chưa ai dùng — xoá B rồi thêm thì ra E, không trùng/không dùng lại B.
       */
      const taken = new Set(labelledAxes.map((item) => item.label));
      let nextIndex = labelledAxes.filter((item) => item.axis.direction === direction).length;

      while (taken.has(axisLabelAt(direction, nextIndex))) {
        nextIndex += 1;
      }

      const typedLabel = addOptions?.label?.trim() ?? '';
      const label =
        typedLabel.length > 0
          ? typedLabel
          : storedAxes.length > 0
            ? axisLabelAt(direction, nextIndex)
            : labelForNewAxis(detectedAxes, candidate);

      if (
        rejectWhenTooClose({ label, direction, coordinateMm, neighbours: labelledAxes })
      ) {
        return;
      }

      const axis = createAxisEntity({
        id: gateway.nextAxisId(),
        levelId,
        label,
        direction,
        coordinateMm,
        extent,
      });
      /*
       * BUG-320: tầng chưa có trục lưu thì danh sách đang hiện là BẢN XEM TRƯỚC
       * dò từ tường. Ghi riêng trục mới thì `storedAxes` hết rỗng và bản xem
       * trước biến mất — nên ghi cả lưới dò được cùng trục mới trong một lệnh.
       */
      const previewAxes = previewEntities();

      void run(
        buildAddAxisCommand({
          axes: [...previewAxes, axis],
          actorId: gateway.actorId,
          extended: extendPerpendicularAxes(storedAxes, direction, coordinateMm),
        }),
      ).then((ok) => {
        if (ok) {
          announce(addAxisDescription(label));
        }
      });
    },
    [
      announce,
      detectedAxes,
      extent,
      gateway,
      labelledAxes,
      levelId,
      previewEntities,
      rejectWhenTooClose,
      run,
      storedAxes,
    ],
  );

  /**
   * Bắt điểm khi kéo trục — `snapToTargets` (M-03), lưới 50 mm TẮT.
   *
   * Đích bắt là đầu mút tim tường của tầng (`kind: 'wallVertex'`): một trục
   * được vạch qua tường, nên đó là thứ nó phải dính vào. Lưới `gridStepMm`
   * (50 mm) tắt hẳn — nó là lưới đặt đồ đạc, và bật nó lên sẽ lặng lẽ kéo một
   * đường trục trắc đạc về bội số gần nhất, tức là sửa số đo của kỹ sư mà
   * không nói.
   */
  const snapTargets = useMemo<readonly SnapTarget[]>(
    () =>
      wallsOfLevel(graph, levelId).flatMap((wall) => [
        {
          kind: 'wallVertex' as const,
          id: `${wall.id}-start`,
          position: toPointMm(wall.centreline.start),
        },
        {
          kind: 'wallVertex' as const,
          id: `${wall.id}-end`,
          position: toPointMm(wall.centreline.end),
        },
      ]),
    [graph, levelId],
  );

  const onAxisDrag = useCallback(
    (axisId: string, coordinatePx: Pixels) => {
      const before = axisByRowId.get(axisId);
      const labelled = labelledAxes.find(
        (item) => axisRowId(item.axis.direction, item.label) === axisId,
      );

      if (labelled === undefined) {
        return;
      }

      const direction = labelled.axis.direction;
      const droppedMm = scale.pixelsToMillimetres(coordinatePx);
      const along = axisLine(labelled.axis).start;
      const snapped = snapToTargets(
        direction === 'vertical' ? { x: droppedMm, y: along.y } : { x: along.x, y: droppedMm },
        snapTargets,
        { gridEnabled: false },
      );
      const coordinateMm = direction === 'vertical' ? snapped.point.x : snapped.point.y;

      const neighbours = labelledAxes.filter((item) => item !== labelled);

      if (
        rejectWhenTooClose({ label: labelled.label, direction, coordinateMm, neighbours })
      ) {
        return;
      }

      void run(
        before === undefined
          ? buildAddAxisCommand({ axes: previewEntities({ rowId: axisId, coordinateMm }), actorId: gateway.actorId })
          : buildMoveAxisCommand({ before, coordinateMm, actorId: gateway.actorId }),
      );
    },
    [axisByRowId, gateway, labelledAxes, previewEntities, rejectWhenTooClose, run, scale, snapTargets],
  );

  /** G4b-20: đổi tên trục đã lưu; tên rỗng hoặc trùng thì báo lý do, không đổi. */
  const onAxisRename = useCallback(
    (axisId: string, nextLabel: string): string | null => {
      const label = nextLabel.trim().toUpperCase();
      const before = axisByRowId.get(axisId);

      if (label.length === 0) {
        return 'Tên trục không được để trống.';
      }

      if (labelledAxes.some((item) => item.label === label && axisRowId(item.axis.direction, item.label) !== axisId)) {
        return `Đã có trục ${label}. Chọn tên khác.`;
      }

      if (before === undefined) {
        return 'Thêm, xoá hoặc kéo một trục trước để lưu lưới, rồi mới đổi tên được.';
      }

      if (before.label !== label) {
        void run(buildRenameAxisCommand({ before, label, actorId: gateway.actorId }));
      }

      return null;
    },
    [axisByRowId, gateway, labelledAxes, run],
  );

  /** G4b-20: sửa khoảng cách tới trục kế = dời trục kế tới toạ độ trục này + khoảng cách (mm). */
  const onAxisSpacingChange = useCallback(
    (axisId: string, spacingMm: number): string | null => {
      const labelled = labelledAxes.find((item) => axisRowId(item.axis.direction, item.label) === axisId);

      if (labelled === undefined) {
        return null;
      }

      if (!Number.isFinite(spacingMm) || spacingMm < MIN_AXIS_SPACING_MM) {
        return `Khoảng cách phải từ ${MIN_AXIS_SPACING_MM} mm trở lên.`;
      }

      const sameDirection = labelledAxes
        .filter((item) => item.axis.direction === labelled.axis.direction)
        .sort((a, b) => a.axis.coordinateMm - b.axis.coordinateMm);
      const next = sameDirection[sameDirection.indexOf(labelled) + 1];

      if (next === undefined) {
        return 'Trục cuối cùng không có trục kế để đo khoảng cách.';
      }

      const nextId = axisRowId(next.axis.direction, next.label);
      const before = axisByRowId.get(nextId);

      if (before === undefined) {
        return 'Thêm, xoá hoặc kéo một trục trước để lưu lưới, rồi mới sửa khoảng cách được.';
      }

      void run(
        buildMoveAxisCommand({
          before,
          coordinateMm: millimetres(labelled.axis.coordinateMm + spacingMm),
          actorId: gateway.actorId,
        }),
      );

      return null;
    },
    [axisByRowId, gateway, labelledAxes, run],
  );

  const onAxisRemove = useCallback(
    (axisId: string) => {
      const axis = axisByRowId.get(axisId);
      // The label the row SHOWS (labelAxes relabels after a delete); the stored entity may still carry its old one (BUG-722).
      const label = labelledAxes.find((item) => axisRowId(item.axis.direction, item.label) === axisId)?.label ?? axis?.label;

      if (label === undefined) {
        return;
      }

      const command =
        axis === undefined
          ? buildAddAxisCommand({ axes: previewEntities({ rowId: axisId }), actorId: gateway.actorId })
          : buildRemoveAxisCommand({ axis, actorId: gateway.actorId });

      void run(command).then((ok) => {
        if (!ok) {
          return;
        }

        announce(removeToastDescription(label));

        const ticket = createAxisUndoTicket({
          description: removeToastDescription(label),
          now: gateway.now,
          undo: () => {
            applyUndo();
          },
        });

        notifications.publish({
          type: AXIS_REMOVE_NOTIFICATION_TYPE,
          title: ticket.description,
          description: '',
          undoTicket: ticket,
        });
      });
    },
    [announce, applyUndo, axisByRowId, gateway, labelledAxes, notifications, previewEntities, run],
  );

  const onViewOnDrawing = useCallback(
    (axisId: string) => {
      const labelled = labelledAxes.find(
        (item) => axisRowId(item.axis.direction, item.label) === axisId,
      );

      if (labelled === undefined) {
        return;
      }

      setSelectedRowId(axisId);
      /* Câu đọc lên do `describePoint` (M-10) soạn — màn không tự tả vị trí. */
      announce(describePoint(axisLine(labelled.axis).start, grid));
    },
    [announce, grid, labelledAxes],
  );

  /* ---------------------------------------------------------------------- */
  /* Gốc toạ độ — trạng thái màn, không phải lệnh.                            */
  /* ---------------------------------------------------------------------- */

  const onAnchorChange = useCallback(
    (anchorValue: string) => {
      const point = anchorPointOf(grid, anchorValue);

      if (point === null) {
        return;
      }

      setAnchor(anchorValue);
      setOriginPoint(setOrigin(point).point);

      /*
       * Nói ra sự thật thay vì im lặng: lựa chọn này không sống qua được một
       * lần tải lại trang vì chưa tầng nào có chỗ ghi gốc toạ độ. Nhánh
       * `supported: false` của cổng mang nguyên câu giải thích đó.
       */
      void gateway
        .persistAxisOrigin({ floorId, projectId, anchor: anchorValue, point })
        .then((result) => {
          if (!result.supported) {
            announce(AXIS_GRID_TEXT.originNotPersisted);
          }
        }, () => {
          announce(AXIS_GRID_TEXT.saveFailed);
        });
    },
    [announce, floorId, gateway, grid, projectId],
  );

  /* ---------------------------------------------------------------------- */
  /* Bóng ma tầng dưới và căn tầng.                                          */
  /* ---------------------------------------------------------------------- */

  const onGhostToggle = useCallback(() => {
    setGhostEnabled((previous) => !previous);
  }, []);

  const onFloorRowHover = useCallback((nextLevelId: string | null) => {
    setHoveredLevelId(nextLevelId);
  }, []);

  const onViewFloorOnDrawing = useCallback(
    (targetLevelId: string) => {
      setHoveredLevelId(targetLevelId);
      setGhostEnabled(true);

      const alignment = report.floors.find((floor) => floor.levelId === targetLevelId);

      if (alignment !== undefined) {
        announce(`${alignment.name}, lệch ${millimetreText(alignment.maxResidualMm)}.`);
      }
    },
    [announce, report],
  );

  /**
   * Căn tự động TOÀN BỘ tầng, trong ĐÚNG MỘT lệnh (CẤM TUYỆT ĐỐI).
   *
   * `alignFloors` đã chạy ở trên và cho `report`; hàm này chỉ giao báo cáo đó
   * cho `buildAutoAlignCommand`, hàm gom thay đổi của mọi tầng vào một
   * `Command` duy nhất. Vé hoàn tác phát kèm để toast có nút "Hoàn tác" (A8).
   */
  const onAutoAlign = useCallback(() => {
    const current = useStore.getState().spatial;

    if (current === null) {
      return;
    }

    const command = buildAutoAlignCommand({ report, graph: current, actorId: gateway.actorId });

    if (command === null) {
      return;
    }

    void run(command).then((ok) => {
      if (!ok) {
        return;
      }

      const ticket = createAxisUndoTicket({
        /* Nguyên văn `undoToast.message` của T4, đếm tầng do chính lệnh mang. */
        description: command.description,
        now: gateway.now,
        undo: () => {
          if (applyUndo()) {
            announce(AUTO_ALIGN_UNDONE_MESSAGE);
          }
        },
      });

      notifications.publish({
        type: AXIS_AUTO_ALIGN_NOTIFICATION_TYPE,
        title: ticket.description,
        description: '',
        undoTicket: ticket,
      });
    });
  }, [announce, applyUndo, gateway, notifications, report, run]);

  /* ---------------------------------------------------------------------- */
  /* Vỏ màn.                                                                 */
  /* ---------------------------------------------------------------------- */

  const onToggleCollapsed = useCallback(() => {
    setOwnCollapsed((previous) => !previous);
  }, []);

  /**
   * "Thử lại" ở trạng thái lỗi.
   *
   * Nhánh "Suy ra từ tường bao" ở trạng thái rỗng đã bỏ (BUG-594): trạng thái
   * rỗng chỉ có khi lượt dò từ tường KHÔNG ra trục nào, nên nút ấy không bao giờ
   * suy ra được gì. Trạng thái rỗng nay mời "Thêm trục ngang" (`onAxisAdd`).
   */
  const refetchLayer = floorLayer.refetch;
  const onRetry = useCallback(() => {
    if (hasError) {
      refetchLayer();
    }
  }, [refetchLayer, hasError]);

  /* ---------------------------------------------------------------------- */
  /* Phím tắt (A12) — không một `addEventListener` nào (R-72).                */
  /* ---------------------------------------------------------------------- */

  const shortcutOptions = useMemo(
    () => (options.registry === undefined ? {} : { registry: options.registry }),
    [options.registry],
  );

  useShortcut(
    {
      id: 'axisGridManager.undo',
      combo: 'Mod+Z',
      scope: 'canvas',
      description: AXIS_GRID_TEXT.shortcutUndo,
      onTrigger: onUndo,
    },
    { ...shortcutOptions, enabled: canEdit },
  );

  useShortcut(
    {
      id: 'axisGridManager.redo',
      combo: 'Mod+Shift+Z',
      scope: 'canvas',
      description: AXIS_GRID_TEXT.shortcutRedo,
      onTrigger: onRedo,
    },
    { ...shortcutOptions, enabled: canEdit },
  );

  /* ---------------------------------------------------------------------- */
  /* View-model — ĐỊNH DẠNG SỐ XẢY RA Ở ĐÂY, không ở view (A15).              */
  /* ---------------------------------------------------------------------- */

  const groups = useMemo<readonly AxisGroupViewModel[]>(
    () =>
      AXIS_DIRECTIONS.map((direction) => {
        const inGroup = labelledAxes.filter((item) => item.axis.direction === direction);

        return {
          direction,
          title: AXIS_GROUP_TITLES[direction],
          addButtonLabel: AXIS_GROUP_ADD_LABELS[direction],
          /* G4b-22: tên kế tiếp chưa ai dùng, điền sẵn vào ô thêm trục. */
          nextLabel: (() => {
            const taken = new Set(labelledAxes.map((item) => item.label));
            let index = inGroup.length;

            while (taken.has(axisLabelAt(direction, index))) {
              index += 1;
            }

            return axisLabelAt(direction, index);
          })(),
          rows: inGroup.map((labelled, index) => {
            const next = inGroup[index + 1];
            const spacingMm =
              next === undefined
                ? null
                : millimetres(next.axis.coordinateMm - labelled.axis.coordinateMm);
            const id = axisRowId(direction, labelled.label);

            return {
              id,
              label: labelled.label,
              direction,
              spacingMm,
              spacingText: spacingMm === null ? null : millimetreText(spacingMm),
              isVisible: !hiddenRowIds.includes(id),
              isSelected: selectedRowId === id,
            };
          }),
        };
      }),
    [hiddenRowIds, labelledAxes, selectedRowId],
  );

  const horizontalCount = grid.horizontal.length;
  const verticalCount = grid.vertical.length;

  const origin = useMemo<OriginPanelViewModel>(() => {
    const anchorOptions: AxisOriginAnchorOption[] = [];

    for (const horizontal of grid.horizontal) {
      for (const vertical of grid.vertical) {
        const value = `${horizontal.label}-${vertical.label}`;
        anchorOptions.push({ value, label: value });
      }
    }

    if (anchorOptions.length === 0) {
      return {
        anchorOptions: [],
        selectedAnchor: null,
        offsetXPxText: MISSING_VALUE,
        offsetYPxText: MISSING_VALUE,
        offsetXMmText: MISSING_VALUE,
        offsetYMmText: MISSING_VALUE,
        offsetXPx: pixels(0),
        offsetYPx: pixels(0),
        offsetXMm: millimetres(0),
        offsetYMm: millimetres(0),
      };
    }

    const position = toAxisPosition(originPoint, grid);
    const offsetXPx = scale.millimetresToPixels(position.offsetXMm);
    const offsetYPx = scale.millimetresToPixels(position.offsetYMm);

    return {
      anchorOptions,
      selectedAnchor:
        anchor ?? anchorValueOf(position.horizontalLabel, position.verticalLabel),
      offsetXPxText: pixelText(offsetXPx),
      offsetYPxText: pixelText(offsetYPx),
      offsetXMmText: millimetreText(position.offsetXMm),
      offsetYMmText: millimetreText(position.offsetYMm),
      offsetXPx,
      offsetYPx,
      offsetXMm: position.offsetXMm,
      offsetYMm: position.offsetYMm,
    };
  }, [anchor, grid, originPoint, scale]);

  const floors = useMemo<readonly FloorAlignRowViewModel[]>(
    () =>
      hasError
        ? NO_FLOORS
        : report.floors.map((alignment) => ({
            levelId: alignment.levelId,
            name: alignment.name,
            offsetText: millimetreText(alignment.maxResidualMm),
            offsetMm: alignment.maxResidualMm,
            status: floorStatusOf(report, alignment.levelId),
            isBase: alignment.isBase,
            isHovered: hoveredLevelId === alignment.levelId,
          })),
    [hasError, hoveredLevelId, report],
  );

  const ghostFloors = useMemo<readonly AxisCanvasGhostFloorViewModel[]>(() => {
    if (graph === null) {
      return NO_GHOSTS;
    }

    const ghosts: AxisCanvasGhostFloorViewModel[] = [];

    for (const other of levelsOf(graph)) {
      if (other.id === levelId) {
        continue;
      }

      const bounds = levelExtentMm(graph, other.id);

      if (bounds === null) {
        continue;
      }

      ghosts.push({
        levelId: other.id,
        outlinePx: outlineOfBounds(bounds).map((point) => toPixelPoint(point, scale)),
        isVisible: ghostEnabled,
        isHighlighted: hoveredLevelId === other.id,
      });
    }

    return ghosts;
  }, [ghostEnabled, graph, hoveredLevelId, levelId, scale]);

  const canvas = useMemo<AxisCanvasViewModel>(() => {
    const axes: AxisCanvasAxisViewModel[] = labelledAxes.map((labelled) => {
      const line = axisLine(labelled.axis);
      const id = axisRowId(labelled.axis.direction, labelled.label);

      return {
        id,
        label: labelled.label,
        direction: labelled.axis.direction,
        startPx: toPixelPoint(line.start, scale),
        endPx: toPixelPoint(line.end, scale),
        isVisible: !hiddenRowIds.includes(id),
        isHighlighted: selectedRowId === id,
      };
    });

    return {
      axes,
      origin: {
        pointPx: toPixelPoint(originPoint, scale),
        label: AXIS_GRID_TEXT.originCanvasLabel,
      },
      ghostFloors,
      boundsPx: withBackground(extent === null ? EMPTY_BOUNDS_PX : toPixelRect(extent, scale), background),
    };
  }, [
    background,
    extent,
    ghostFloors,
    hiddenRowIds,
    labelledAxes,
    originPoint,
    scale,
    selectedRowId,
  ]);

  const warningBanner = useMemo<AxisGridWarningBanner | null>(() => {
    if (hasError || worstIssue === null) {
      return null;
    }

    return {
      message: worstIssue.message,
      actionLabel: AXIS_GRID_TEXT.warningActionLabel,
      levelId: worstIssue.levelId,
    };
  }, [hasError, worstIssue]);

  const floorsAllWithinTolerance = floors.every((floor) => floor.status === 'ok');

  /* BUG-594/601: cùng lệnh `onAutoAlign` sẽ chạy — `null` là không còn gì để dời. */
  const autoAlignCommand = useMemo(
    () => (graph === null ? null : buildAutoAlignCommand({ report, graph, actorId: gateway.actorId })),
    [gateway.actorId, graph, report],
  );
  const autoAlignBlockedReason = !canEdit
    ? AXIS_GRID_TEXT.autoAlignViewer
    : report.floors.length < 2
      ? AXIS_GRID_TEXT.autoAlignSingleFloor
      : autoAlignCommand === null
        ? AXIS_GRID_TEXT.autoAlignNothing
        : null;

  /* BUG-578: ngăn xếp còn bước là còn sửa đổi chỉ sống trong trang này — hỏi trước khi rời. */
  useLeaveWarning(dispatchBundle.history.canUndo());

  const state = deriveAxisGridScreenState({
    isViewerRole,
    isCollapsed,
    hasError,
    isLoading,
    horizontalCount,
    verticalCount,
    hasWarning: warningBanner !== null,
    floorsAllWithinTolerance,
  });

  const errorMessage = useMemo(() => {
    if (!hasError) {
      return null;
    }

    return describeError(toAppError(floorLayer.error)).description;
  }, [floorLayer.error, hasError]);

  const viewModel = useMemo<AxisGridViewModel>(
    () => ({
      state,
      groups: hasError ? groups.map((group) => ({ ...group, rows: NO_ROWS })) : groups,
      origin,
      floors,
      canvas,
      ghostEnabled,
      warningBanner,
      isCompact: options.isCompact ?? false,
      isCollapsed,
      isViewerRole,
      viewerRoleNotice: isViewerRole ? AXIS_GRID_TEXT.viewerRoleNotice : null,
      emptyNotice: state === 'empty' ? AXIS_GRID_TEXT.emptyNotice : null,
      errorMessage,
      // Theo dữ liệu, không theo `state` — vai người xem đứng trước `empty` (review-1 P2-2).
      hasNoAxes: hasError || (!isLoading && horizontalCount + verticalCount === 0),
    }),
    [
      canvas,
      errorMessage,
      floors,
      ghostEnabled,
      groups,
      hasError,
      horizontalCount,
      isCollapsed,
      isLoading,
      isViewerRole,
      options.isCompact,
      origin,
      state,
      verticalCount,
      warningBanner,
    ],
  );

  return {
    viewModel,

    onAxisToggleVisibility,
    onAxisSelect,
    onAxisAdd,
    onAxisDrag,
    onAxisRemove,
    onAxisRename,
    onAxisSpacingChange,
    onViewOnDrawing,

    onAnchorChange,

    onGhostToggle,
    onAutoAlign,
    onFloorRowHover,
    onViewFloorOnDrawing,

    onUndo,
    onRetry,
    onToggleCollapsed,

    spacingViolation,
    spacingMessage: spacingViolation === null ? null : describeSpacingViolation(spacingViolation),
    historyStepCount: () => dispatchBundle.history.undoSteps().length,
    canUndo: dispatchBundle.history.canUndo(),
    readFailure,
    unsavedNotice: canEdit && !gateway.supports.persistAxisGrid ? AXIS_GRID_TEXT.unsavedNotice : null,
    provisionalScaleNotice,
    background,
    autoAlignBlockedReason,
  };
}
