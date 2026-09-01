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
 *   `gateway.scale`. Không một phép nhân chia đơn vị nào viết tay (R-71, A15).
 * - Định dạng số: `formatLength` / `formatNumber` của `src/lib/format`. Không
 *   `toFixed`, không `toLocaleString` ở bất kỳ đâu trong thư mục màn (A15).
 *
 * ## Trạng thái máy chủ (R-64)
 *
 * Không `useState` nào giữ cờ đang-tải hay cờ hỏng. Lớp trục đi qua `useQuery`
 * dưới khoá `queryKeys.space.byFloor` — đúng khoá mà `invalidationMap.changeAxis`
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

import { alignFloors, type FloorAlignmentReport, type FloorIssue } from '@/domain/axes/alignFloors';
import { axisLine, type DetectedAxis } from '@/domain/axes/detect';
import {
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
import { pixels, type Pixels } from '@/domain/units/scale';
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
import { queryKeys } from '@/lib/query/queryKeys';
import { appNotificationBus } from '@/hooks/useNotifications';
import { useShortcut } from '@/hooks/useShortcut';
import { useStore } from '@/store';
import type { ProjectRole } from '@/types/project';

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
  emptyNotice:
    'Bạn có thể vẽ trục thủ công từ bản vẽ, hoặc cho hệ thống suy ra trục từ hình học tường bao.',
  viewerRoleNotice:
    'Vai trò hiện tại chỉ được xem, không được chỉnh sửa các trục. Liên hệ quản trị dự án nếu cần.',
  /**
   * Câu NÓI RA sự thật khi `persistAxisOrigin` chưa có đường.
   *
   * Câu nợ endpoint của cổng viết cho người nối dây, không cho người dùng; đây
   * là câu người dùng nghe được, và nó không hứa một lượt lưu nào đã xong.
   */
  originNotPersisted:
    'Đã ghim gốc toạ độ cho phiên làm việc này. Hệ thống chưa có chỗ lưu lựa chọn đó, nên nó mất sau khi tải lại trang.',
  shortcutUndo: 'Hoàn tác thay đổi trục gần nhất',
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
}

/**
 * Mọi thứ view thuần nhận, cộng vài trường thoả thuận thêm với người tích hợp.
 *
 * Trải đúng {@link AxisGridManagerProps} — hợp đồng props đã đóng băng của T3 —
 * nên lớp 3 truyền thẳng kết quả này vào `<AxisGridManager {...result} />`.
 */
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

  const axisLayerQuery = useQuery({
    queryKey: queryKeys.space.byFloor(floorId),
    queryFn: ({ signal }) => gateway.readAxisLayer({ floorId, projectId, signal }),
  });

  const storeGraph = useStore((state) => state.spatial);
  const setSpatial = useStore((state) => state.setSpatial);

  const loaded = axisLayerQuery.data ?? null;

  /* Nạp đồ thị của tầng vào kho một lần, nếu kho còn trống. */
  useEffect(() => {
    if (storeGraph === null && loaded !== null) {
      setSpatial(loaded, null);
    }
  }, [loaded, setSpatial, storeGraph]);

  /*
   * Đọc kho trước, lượt tải sau: giữa lúc `useEffect` trên chưa chạy, view vẫn
   * có dữ liệu để vẽ — đúng cái màn trắng mà A11 tồn tại để chặn.
   */
  const graph = storeGraph ?? loaded;
  const level = useMemo(() => levelOf(graph, options.levelId), [graph, options.levelId]);
  const levelId = level?.id ?? null;

  const hasError = axisLayerQuery.isError;
  const isLoading = axisLayerQuery.isPending || graph === null;

  /* ---------------------------------------------------------------------- */
  /* Trục — kho trước, dò tự động sau. Màn KHÔNG tự sinh trục.                */
  /* ---------------------------------------------------------------------- */

  const storedAxes = useMemo(() => axesOfLevel(graph, levelId), [graph, levelId]);

  /*
   * Trục của tầng: cái đã lưu thắng; tầng chưa có trục nào thì lưới được DÒ từ
   * tường chịu lực bằng `detectAxes` (M-10) và hiện ra như một bản xem trước.
   * Một lượt bấm "Suy ra từ tường bao" (`onRetry` ở trạng thái rỗng) mới ghi
   * bản xem trước đó vào đồ thị — không lượt ghi tự động nào lúc tải màn.
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
    () => (hasError ? [] : labelAxes(detectedAxes)),
    [detectedAxes, hasError],
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
           * Bước `sync` chỉ đánh dấu bản vẽ bẩn. `persistAxisGrid` chưa có
           * endpoint (xem bản kê nợ của cổng), nên KHÔNG có lượt gửi nào để
           * xếp hàng — bịa một lượt lưu ở đây là nói dối người dùng.
           */
        },
      }),
    [],
  );

  const invalidate = useCallback(() => {
    applyInvalidation(queryClient, 'changeAxis', { floorId, projectId });
  }, [floorId, projectId, queryClient]);

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

  const onAxisAdd = useCallback(
    (direction: AxisGridDirection) => {
      if (levelId === null) {
        return;
      }

      const coordinateMm = nextAxisCoordinateMm(labelledAxes, direction);
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
      const label = labelForNewAxis(detectedAxes, candidate);

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

      void run(buildAddAxisCommand({ axes: [axis], actorId: gateway.actorId })).then((ok) => {
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
      rejectWhenTooClose,
      run,
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

      if (before === undefined || labelled === undefined) {
        return;
      }

      const direction = labelled.axis.direction;
      const droppedMm = gateway.scale.pixelsToMillimetres(coordinatePx);
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

      void run(buildMoveAxisCommand({ before, coordinateMm, actorId: gateway.actorId }));
    },
    [axisByRowId, gateway, labelledAxes, rejectWhenTooClose, run, snapTargets],
  );

  const onAxisRemove = useCallback(
    (axisId: string) => {
      const axis = axisByRowId.get(axisId);

      if (axis === undefined) {
        return;
      }

      void run(buildRemoveAxisCommand({ axis, actorId: gateway.actorId })).then((ok) => {
        if (!ok) {
          return;
        }

        const ticket = createAxisUndoTicket({
          description: removeToastDescription(axis.label),
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
    [applyUndo, axisByRowId, gateway, notifications, run],
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
   * "Thử lại" ở trạng thái lỗi, "Suy ra từ tường bao" ở trạng thái rỗng.
   *
   * Hợp đồng props đã đóng băng và chỉ có MỘT hàm cho hai nút này; view chọn
   * nhãn theo `state`. Lượt suy ra ghi cả lưới dò được vào đồ thị bằng ĐÚNG MỘT
   * lệnh `axis.add` mang nhiều `changeForAdd`, nên nó cũng hoàn tác được trong
   * một thao tác.
   */
  const onRetry = useCallback(() => {
    if (hasError) {
      void axisLayerQuery.refetch();

      return;
    }

    if (levelId === null || detectedPreview.length === 0) {
      return;
    }

    const preview = labelAxes(detectedPreview);

    void run(
      buildAddAxisCommand({
        axes: preview.map((labelled) =>
          createAxisEntity({
            id: gateway.nextAxisId(),
            levelId,
            label: labelled.label,
            direction: labelled.axis.direction,
            coordinateMm: labelled.axis.coordinateMm,
            extent,
          }),
        ),
        actorId: gateway.actorId,
      }),
    );
  }, [axisLayerQuery, detectedPreview, extent, gateway, hasError, levelId, run]);

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
    const offsetXPx = gateway.scale.millimetresToPixels(position.offsetXMm);
    const offsetYPx = gateway.scale.millimetresToPixels(position.offsetYMm);

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
  }, [anchor, gateway, grid, originPoint]);

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
        outlinePx: outlineOfBounds(bounds).map((point) => toPixelPoint(point, gateway.scale)),
        isVisible: ghostEnabled,
        isHighlighted: hoveredLevelId === other.id,
      });
    }

    return ghosts;
  }, [gateway, ghostEnabled, graph, hoveredLevelId, levelId]);

  const canvas = useMemo<AxisCanvasViewModel>(() => {
    const axes: AxisCanvasAxisViewModel[] = labelledAxes.map((labelled) => {
      const line = axisLine(labelled.axis);
      const id = axisRowId(labelled.axis.direction, labelled.label);

      return {
        id,
        label: labelled.label,
        direction: labelled.axis.direction,
        startPx: toPixelPoint(line.start, gateway.scale),
        endPx: toPixelPoint(line.end, gateway.scale),
        isVisible: !hiddenRowIds.includes(id),
        isHighlighted: selectedRowId === id,
      };
    });

    return {
      axes,
      origin: {
        pointPx: toPixelPoint(originPoint, gateway.scale),
        label: AXIS_GRID_TEXT.originCanvasLabel,
      },
      ghostFloors,
      boundsPx: extent === null ? EMPTY_BOUNDS_PX : toPixelRect(extent, gateway.scale),
    };
  }, [
    extent,
    gateway,
    ghostFloors,
    hiddenRowIds,
    labelledAxes,
    originPoint,
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

    return describeError(toAppError(axisLayerQuery.error)).description;
  }, [axisLayerQuery.error, hasError]);

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
    }),
    [
      canvas,
      errorMessage,
      floors,
      ghostEnabled,
      groups,
      hasError,
      isCollapsed,
      isViewerRole,
      options.isCompact,
      origin,
      state,
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
  };
}
