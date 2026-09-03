/**
 * Nửa "suy nghĩ" của màn S-18 "Chuẩn hoá độ dày tường" — nơi cổng dữ liệu
 * (`thicknessStandardizationGateway.ts`) gặp hợp đồng kiểu
 * (`thicknessTypes.ts`).
 *
 * View của màn thuần và kiểm được chỉ từ props (mục D của CLAUDE.md); mọi phép
 * đọc, mọi lượt ghi, mọi con số thành chuỗi đều xảy ra ở đây hoặc ở cổng,
 * KHÔNG ở view.
 *
 * ## Sáu lời hứa file này giữ
 *
 * 1. **Kéo ngưỡng là thao tác THUẦN.** {@link useThicknessStandardization}
 *    giữ ba ngưỡng trong state của giao diện; đổi chúng chỉ tính lại cột biểu
 *    đồ, bảng nhóm, bảng chi tiết và bốn con số. Không một nhánh nào của
 *    `onThresholdDrag` chạm tới `runTransaction`, nên kéo qua lại năm lần thì
 *    ngăn xếp hoàn tác vẫn đúng 0 bước.
 * 2. **Không tích sẵn.** `acceptedMeasurements` khởi tạo RỖNG, nên `accepted`
 *    của mọi hàng nhóm là `false` cho tới khi người dùng tự bấm (CẤM TUYỆT
 *    ĐỐI).
 * 3. **Áp = MỘT lời gọi `runTransaction`** — cả lô lệnh của mọi nhóm đã đồng ý
 *    đi vào đúng một lượt, cho đúng MỘT bước hoàn tác và MỘT vé D-05 tám giây
 *    (A8). Đường thứ hai — gán một nhóm cho các hàng đang chọn — đi qua CÙNG
 *    một lượt chạy đó, không phải một cơ chế thứ hai.
 * 4. **Sau khi áp, M-04 chạy lại.** `resolveWallShapes` không có đường ghi
 *    ngược vào đồ thị (`docs/notes/thickness/commands.md` mục 4), nên hình
 *    tường của phần xem trước là một `useMemo` khoá theo đồ thị: đồ thị đổi thì
 *    mối nối được dựng lại từ đầu.
 * 5. **Áp dụng lại bộ lọc không bao giờ ghi đè im lặng tường đã duyệt.** Lượt
 *    bấm đầu tiên chỉ dựng {@link ReapplyFilterWarning} mang ĐÚNG số tường đã
 *    duyệt sẽ bị đổi; chỉ lượt bấm sau đó mới ghi, và người dùng chọn được
 *    "loại chúng ra".
 * 6. **Trạng thái máy chủ đi qua `@tanstack/react-query`** (R-64): không một
 *    `useState` nào giữ cờ đang tải hay cờ hỏng.
 *
 * ## Vì sao ba ngưỡng đổi được mà màn vẫn không tự khai bảng ngưỡng
 *
 * Việc gán nhóm nằm ở {@link groupOfMeasurement} của cổng, và hàm đó gọi thẳng
 * `standardizeThickness` khi ba ngưỡng còn mặc định; khi người dùng đã kéo một
 * ngưỡng thì luật biên vẫn đọc từ chính M-05. Hook ở đây không so sánh một số
 * đo với một con số nào của riêng nó (R-61).
 *
 * ## Phím tắt đi qua `shortcutRegistry`, không `addEventListener`
 *
 * A12/R-54: Esc đóng lớp trên cùng của màn — bảng xem trước trước, rồi cảnh
 * báo áp dụng lại. Khi không còn lớp nào để đóng thì đăng ký tự tắt, nên phím
 * rơi xuống tầng `global` và lời hứa A12 không bị màn này lấy mất.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { EntityId, LevelId, Wall, WallId } from '@/domain/spatial/types';
import { appNotificationBus } from '@/hooks/useNotifications';
import { useShortcut } from '@/hooks/useShortcut';
import { createAutosave, type Autosave } from '@/lib/autosave/createAutosave';
import { can } from '@/lib/auth/permissions';
import type { Command } from '@/lib/commands/types';
import type { HistoryStack } from '@/lib/commands/history';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import { describeError } from '@/lib/errors/describeError';
import { toAppError } from '@/lib/errors/toAppError';
import type { ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { durationMs } from '@/lib/motion';
import type { NotificationBus } from '@/lib/mutations/notificationBus';
import { applyInvalidation } from '@/lib/query/invalidation';
import { queryKeys } from '@/lib/query/queryKeys';
import { useStore } from '@/store';
import type { ProjectRole } from '@/types/project';

import {
  buildApplyPreview,
  buildAssignGroupCommands,
  buildStandardizeThicknessCommands,
  createMockThicknessStandardizationGateway,
  createThicknessDispatchDeps,
  createThicknessStandardizationGateway,
  createThicknessUndoTicket,
  groupOfMeasurement,
  isApplicable,
  levelIndexOf,
  levelsOfGraph,
  runStandardizeBatch,
  standardizeDescription,
  summaryOf,
  thicknessLegend,
  THICKNESS_NOTIFICATION_TYPE,
  thresholdLabelsOf,
  toGroupRows,
  toHistogramBins,
  toSegmentRows,
  toThicknessWallShapes,
  wallsOfGraph,
  withThresholdAt,
  type ThicknessGraphPort,
  type ThicknessStandardizationGateway,
} from './thicknessStandardizationGateway';
import {
  DEFAULT_THICKNESS_SORT_KEY,
  DEFAULT_THICKNESS_THRESHOLDS,
  DEFAULT_TOLERANCE_MM,
  type ApplyPreview,
  type ReapplyFilterWarning,
  type ThicknessApplyBarProps,
  type ThicknessGroup,
  type ThicknessScreenState,
  type ThicknessSegmentRow,
  type ThicknessSegmentTableProps,
  type ThicknessSortKey,
  type ThicknessStandardizationProps,
  type ThicknessThresholds,
} from './thicknessTypes';

/* -------------------------------------------------------------------------- */
/* Chuỗi của hook — mọi câu người dùng đọc mà cổng không sinh ra.              */
/* -------------------------------------------------------------------------- */

/**
 * Bốn câu của riêng màn, chữ thường kiểu câu (A6).
 *
 * Hai câu `empty…` BẮT BUỘC kèm bước đi tiếp: một màn rỗng không nói được phải
 * làm gì tiếp là đúng thứ A11 tồn tại để chặn.
 */
export const THICKNESS_SCREEN_TEXT = {
  emptyNotice:
    'Mọi đoạn tường đã ở đúng nhóm chuẩn, không còn gì để áp. Kéo một ngưỡng trên biểu đồ hoặc nới ô dung sai nếu bạn muốn gom thêm đoạn vào một nhóm khác.',
  emptyNoMeasurementNotice:
    'Chưa có số đo độ dày nào cho công trình này. Sang lớp tường để dò lại các đoạn tường, rồi quay lại đây để chuẩn hoá độ dày.',
  viewerRoleNotice:
    'Bạn đang xem với vai Người xem: áp chuẩn hoá, gán nhóm và sửa dung sai đều tắt. Nhờ người quản trị dự án đổi vai nếu bạn cần sửa độ dày tường.',
  escapeShortcut: 'Đóng bảng xem trước hoặc cảnh báo áp dụng lại bộ lọc.',
} as const;

/* -------------------------------------------------------------------------- */
/* Tham số vào và giá trị ra.                                                  */
/* -------------------------------------------------------------------------- */

export interface UseThicknessStandardizationOptions {
  readonly projectId: string;
  readonly floorId: string;
  readonly roles?: readonly ProjectRole[];
  /** Cổng dữ liệu tiêm được. Vắng mặt thì hook dựng cổng thật, đúng một lần. */
  readonly gateway?: ThicknessStandardizationGateway;
  /** Ép thu gọn canvas xem trước — cho story và bài kiểm muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
  /**
   * Bus thông báo — chỗ toast hoàn tác của A8 đi ra.
   *
   * Bỏ trống là bus của cả phiên (`appNotificationBus`), thứ `NotificationHost`
   * ở `src/main.tsx` đang vẽ. Bài kiểm và story tiêm bus riêng để hai lượt kiểm
   * không thấy thông báo của nhau.
   */
  readonly notifications?: NotificationBus;
  /**
   * Ngăn xếp hoàn tác tiêm được.
   *
   * `ThicknessStandardizationProps` không mang số bước lịch sử (hợp đồng kiểu
   * của T4 đã đóng băng), nên đây là cửa để bài kiểm đếm bước bằng chính
   * `HistoryStack` thật thay vì một bảng đếm thứ hai.
   */
  readonly history?: HistoryStack;
  /** Sổ phím tắt tiêm được; vắng mặt thì dùng sổ dùng chung của ứng dụng. */
  readonly shortcutRegistry?: ShortcutRegistry;
}

/**
 * Mọi thứ hook trả về — hai hợp đồng của `thicknessTypes.ts`, không có hình
 * dạng thứ ba nào khai ở đây.
 *
 * Bảy trường chọn hàng (`selectedWallIds` … `flashingWallIds`) từng được T5
 * khai lại trong file này vì lúc đó `thicknessTypes.ts` đang đóng băng. Sau khi
 * T7 được điều phối viên cho phép bổ sung chúng vào
 * {@link ThicknessSegmentTableProps}, hai đường cùng tả một thứ — nên bản khai
 * thứ hai đã bị xoá và kể từ đây kiểu lấy THẮNG từ hợp đồng. `Pick` chứ
 * không phải cả `ThicknessSegmentTableProps`: `rows`/`onHoverRow` của bảng chi
 * tiết đến từ `segmentRows`/`onHoverWall` của màn, và view là nơi nối hai tên
 * đó lại với nhau.
 *
 * `onDismissReapplyWarning` đi cùng lối: một trường của
 * {@link ThicknessApplyBarProps} mà `ThicknessStandardizationProps` không
 * mang, `Pick` ra chứ không khai lại.
 */
export type UseThicknessStandardizationResult = ThicknessStandardizationProps &
  Pick<ThicknessApplyBarProps, 'onDismissReapplyWarning'> &
  Pick<
    ThicknessSegmentTableProps,
    | 'selectedWallIds'
    | 'onToggleRowSelected'
    | 'onToggleAllSelected'
    | 'onClearSelection'
    | 'onChangeNormalizedGroup'
    | 'onApplySelectedGroup'
    | 'flashingWallIds'
  >;

/* -------------------------------------------------------------------------- */
/* Hằng của riêng hook.                                                        */
/* -------------------------------------------------------------------------- */

const NO_WALL_IDS: readonly WallId[] = [];
const NO_MEASUREMENTS: ReadonlySet<number> = new Set<number>();
const NO_OVERRIDES: ReadonlyMap<WallId, ThicknessGroup> = new Map<WallId, ThicknessGroup>();

/* -------------------------------------------------------------------------- */
/* Phép ghép thuần — kiểm được mà không cần dựng hook.                          */
/* -------------------------------------------------------------------------- */

/**
 * Bảy trạng thái của A11, theo đúng thứ tự ưu tiên hai màn QC anh em đã chốt.
 *
 * Vai trò đi trước vì trạng thái 6 vô hiệu MỌI hàm sửa: một người xem nhìn màn
 * thu gọn vẫn là một người xem. `error` đi trước `loading` vì một lượt đọc đã
 * hỏng thì không còn "đang tải" nữa.
 *
 * `empty` và `success` tả CÙNG một sự thật dữ liệu — không còn đoạn nào áp được
 * — và chỉ khác nhau ở chỗ lượt áp vừa chạy hay chưa, đúng như
 * `thicknessStandardizationScenarios.ts` ghi nhận khi cho hai kịch bản dùng
 * chung một tập tường.
 */
export function deriveThicknessScreenState(input: {
  readonly isViewerRole: boolean;
  readonly isCollapsed: boolean;
  readonly hasError: boolean;
  readonly isLoading: boolean;
  readonly segmentCount: number;
  readonly applicableCount: number;
  readonly hasApplied: boolean;
}): ThicknessScreenState {
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

  if (input.segmentCount === 0) {
    return 'empty';
  }

  if (input.applicableCount === 0) {
    return input.hasApplied ? 'success' : 'empty';
  }

  return 'partial';
}

/**
 * Bảng chi tiết đã sắp — mặc định "trường hợp tệ nhất nổi lên đầu".
 *
 * `deviation` giảm dần vì cột đó là lý do màn tồn tại; ba khoá còn lại tăng
 * dần theo cách người đọc mong đợi (số đo nhỏ trước, độ tin cậy thấp trước,
 * tầng theo tên). So sánh chuỗi đi qua `localeCompare` để tên tầng có dấu xếp
 * đúng thứ tự tiếng Việt.
 */
export function sortSegmentRows(
  rows: readonly ThicknessSegmentRow[],
  sortKey: ThicknessSortKey,
): readonly ThicknessSegmentRow[] {
  const sorted = [...rows];

  if (sortKey === 'measured') {
    return sorted.sort((first, second) => first.measuredMm - second.measuredMm);
  }

  if (sortKey === 'confidence') {
    return sorted.sort((first, second) => first.confidence - second.confidence);
  }

  if (sortKey === 'floor') {
    return sorted.sort((first, second) => first.floorName.localeCompare(second.floorName));
  }

  return sorted.sort((first, second) => second.deviationMm - first.deviationMm);
}

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

/** Cổng thật dựng đúng một lần cho suốt đời component. */
function useResolvedGateway(
  injected: ThicknessStandardizationGateway | undefined,
): ThicknessStandardizationGateway {
  const fallbackRef = useRef<ThicknessStandardizationGateway | null>(null);

  if (injected !== undefined) {
    return injected;
  }

  fallbackRef.current ??= createThicknessStandardizationGateway();

  return fallbackRef.current;
}

export function useThicknessStandardization(
  options: UseThicknessStandardizationOptions,
): UseThicknessStandardizationResult {
  const { floorId, projectId } = options;
  const gateway = useResolvedGateway(options.gateway);
  const queryClient = useQueryClient();
  const notifications = options.notifications ?? appNotificationBus;

  /* ---------------------------------------------------------------------- */
  /* Vai trò — trạng thái 6 vô hiệu MỌI hàm sửa, ở tầng hook.                */
  /* ---------------------------------------------------------------------- */

  const roles = options.roles ?? [];
  const canEdit = can('edit', 'layer', { roles });
  const isViewerRole = !canEdit;

  /* ---------------------------------------------------------------------- */
  /* Trạng thái của riêng giao diện — KHÔNG có isLoading/error ở đây (R-64). */
  /* ---------------------------------------------------------------------- */

  const [thresholds, setThresholds] = useState<ThicknessThresholds>(
    DEFAULT_THICKNESS_THRESHOLDS,
  );
  const [toleranceMm, setToleranceMm] = useState(DEFAULT_TOLERANCE_MM);
  const [acceptedMeasurements, setAcceptedMeasurements] =
    useState<ReadonlySet<number>>(NO_MEASUREMENTS);
  const [groupOverrides, setGroupOverrides] =
    useState<ReadonlyMap<WallId, ThicknessGroup>>(NO_OVERRIDES);
  const [sortKey, setSortKey] = useState<ThicknessSortKey>(DEFAULT_THICKNESS_SORT_KEY);
  const [preview, setPreview] = useState<ApplyPreview | null>(null);
  const [reapplyWarning, setReapplyWarning] = useState<ReapplyFilterWarning | null>(null);
  const [hoveredGroup, setHoveredGroup] = useState<ThicknessGroup | null>(null);
  const [hoveredBinIndex, setHoveredBinIndex] = useState<number | null>(null);
  const [ownCollapsed, setOwnCollapsed] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [flashingWallIds, setFlashingWallIds] = useState<readonly WallId[]>(NO_WALL_IDS);

  const isCollapsed = options.forceCollapsed ?? ownCollapsed;

  /* ---------------------------------------------------------------------- */
  /* Lượt đọc máy chủ duy nhất của màn (R-64).                               */
  /* ---------------------------------------------------------------------- */

  const layerQuery = useQuery({
    queryKey: queryKeys.space.byFloor(floorId),
    queryFn: ({ signal }) => gateway.readThicknessLayer({ floorId, projectId, signal }),
  });

  /* ---------------------------------------------------------------------- */
  /* Đồ thị đang sửa — nơi `commit` ghi vào.                                  */
  /* ---------------------------------------------------------------------- */

  const graph = useStore((state) => state.spatial);
  const setSpatial = useStore((state) => state.setSpatial);
  const selectedIds = useStore((state) => state.selectedIds);
  const hoveredId = useStore((state) => state.hoveredId);
  const setSelection = useStore((state) => state.setSelection);
  const setHovered = useStore((state) => state.setHovered);

  /* Nạp đồ thị vào kho một lần, nếu kho còn trống. */
  useEffect(() => {
    if (graph !== null) {
      return;
    }

    const seed = gateway.graph.read();

    if (seed !== null) {
      setSpatial(seed, null);
    }
  }, [gateway, graph, setSpatial]);

  const walls = useMemo(() => wallsOfGraph(graph), [graph]);
  const levels = useMemo(() => levelsOfGraph(graph), [graph]);
  const levelIndex = useMemo<ReadonlyMap<LevelId, typeof levels[number]>>(
    () => levelIndexOf(levels),
    [levels],
  );

  /* ---------------------------------------------------------------------- */
  /* Bảng chi tiết, bảng nhóm, biểu đồ, bốn con số — THUẦN từ ba ngưỡng.      */
  /* ---------------------------------------------------------------------- */

  const allRows = useMemo(
    () =>
      toSegmentRows(walls, {
        thresholds,
        toleranceMm,
        levels: levelIndex,
        groupOverrides,
      }),
    [groupOverrides, levelIndex, thresholds, toleranceMm, walls],
  );

  const segmentRows = useMemo(() => sortSegmentRows(allRows, sortKey), [allRows, sortKey]);
  const groupRows = useMemo(
    () => toGroupRows(allRows, acceptedMeasurements),
    [acceptedMeasurements, allRows],
  );
  const bins = useMemo(() => toHistogramBins(allRows), [allRows]);
  const summary = useMemo(() => summaryOf(allRows), [allRows]);
  const legend = useMemo(() => thicknessLegend(allRows), [allRows]);
  const thresholdLabels = useMemo(() => thresholdLabelsOf(thresholds), [thresholds]);
  const applicableCount = useMemo(() => allRows.filter(isApplicable).length, [allRows]);

  /*
   * Hình tường của canvas xem trước — M-04 chạy LẠI ở đây.
   *
   * Memo khoá theo `walls` và `levels`, và `commit` thay hẳn tham chiếu đồ thị sau
   * mỗi lượt ghi, nên một lượt áp xong là mối nối được dựng lại từ đầu — đúng
   * cách duy nhất `resolveWallShapes` cho phép (không có đường ghi ngược).
   */
  const groupByWallId = useMemo(
    () => new Map(allRows.map((row) => [row.wallId, row.normalizedGroup])),
    [allRows],
  );

  const shapes = useMemo(
    () =>
      toThicknessWallShapes(
        walls,
        levels,
        (wall: Wall) =>
          groupByWallId.get(wall.id) ?? groupOfMeasurement(wall.thicknessMm, thresholds),
      ),
    [groupByWallId, levels, thresholds, walls],
  );

  /* ---------------------------------------------------------------------- */
  /* Vùng chọn và rê chuột — kho dùng chung với canvas và hai bảng.           */
  /* ---------------------------------------------------------------------- */

  const wallIdIndex = useMemo(() => new Set(allRows.map((row) => row.wallId)), [allRows]);

  const selectedWallIds = useMemo<readonly WallId[]>(
    () => selectedIds.filter((id): id is WallId => wallIdIndex.has(id as WallId)),
    [selectedIds, wallIdIndex],
  );

  const selectionSnapshotRef = useRef<readonly EntityId[]>(selectedIds);
  selectionSnapshotRef.current = selectedIds;
  const selectionBeforeRef = useRef<readonly EntityId[]>(selectedIds);

  const replaceSelection = useCallback(
    (ids: readonly WallId[]) => {
      selectionBeforeRef.current = useStore.getState().selectedIds;
      setSelection([...ids]);
    },
    [setSelection],
  );

  /*
   * Đọc vùng chọn THẲNG từ kho chứ không từ `selectedWallIds` của lượt vẽ này.
   *
   * Người dùng tích ba hàng liên tiếp nhanh hơn một lượt vẽ lại: một closure
   * khoá theo giá trị của lượt vẽ trước sẽ thấy vùng chọn cũ và bỏ mất hai
   * hàng đầu. Kho là nơi vùng chọn thật sống, nên nó cũng là nơi phải đọc.
   */
  const onToggleRowSelected = useCallback(
    (wallId: WallId, selected: boolean) => {
      const current = useStore
        .getState()
        .selectedIds.filter((id): id is WallId => wallIdIndex.has(id as WallId));

      replaceSelection(
        selected
          ? [...current.filter((id) => id !== wallId), wallId]
          : current.filter((id) => id !== wallId),
      );
    },
    [replaceSelection, wallIdIndex],
  );

  const onToggleAllSelected = useCallback(
    (selected: boolean) => {
      replaceSelection(selected ? allRows.map((row) => row.wallId) : NO_WALL_IDS);
    },
    [allRows, replaceSelection],
  );

  const onClearSelection = useCallback(() => {
    replaceSelection(NO_WALL_IDS);
  }, [replaceSelection]);

  const onHoverWall = useCallback(
    (wallId: WallId | null) => {
      setHovered(wallId);
    },
    [setHovered],
  );

  /* ---------------------------------------------------------------------- */
  /* Nháy hàng vừa đổi — thời lượng lấy từ MOTION_DURATIONS_MS (R-71).        */
  /* ---------------------------------------------------------------------- */

  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashWalls = useCallback((wallIds: readonly WallId[]) => {
    setFlashingWallIds(wallIds);

    if (flashTimerRef.current !== null) {
      clearTimeout(flashTimerRef.current);
    }

    flashTimerRef.current = setTimeout(() => {
      setFlashingWallIds(NO_WALL_IDS);
    }, durationMs('slow'));
  }, []);

  useEffect(
    () => () => {
      if (flashTimerRef.current !== null) {
        clearTimeout(flashTimerRef.current);
      }
    },
    [],
  );

  /* ---------------------------------------------------------------------- */
  /* Tự lưu (A7) — không có nút lưu, và không bịa một lượt lưu đã xong.       */
  /* ---------------------------------------------------------------------- */

  const storePort = useMemo<ThicknessGraphPort>(
    () => ({ read: () => useStore.getState().spatial }),
    [],
  );

  const autosaveRef = useRef<Autosave | null>(null);
  const persistRef = useRef({ floorId, gateway, projectId });
  persistRef.current = { floorId, gateway, projectId };

  autosaveRef.current ??= createAutosave<NormalizedSpatial>({
    getChanges: () => useStore.getState().spatial ?? undefined,
    save: async (changes) => {
      const current = persistRef.current;
      const result = await current.gateway.persistThicknessStandardization({
        floorId: current.floorId,
        projectId: current.projectId,
        graph: changes,
      });

      if (!result.supported) {
        /*
         * Một khả năng chưa có endpoint KHÔNG được biến thành một lượt lưu đã
         * xong: ném ra là cách duy nhất để vỏ ứng dụng nói ra sự thật thay vì
         * hiện "Đã lưu lúc…" cho một lượt chưa hề rời khỏi máy.
         */
        throw new Error(result.missing);
      }
    },
  });

  const autosave = autosaveRef.current;

  /* ---------------------------------------------------------------------- */
  /* Đường ghi — MỘT transaction, MỘT bước hoàn tác 100 bước của S-06.        */
  /* ---------------------------------------------------------------------- */

  const dispatchBundle = useMemo(
    () =>
      createThicknessDispatchDeps({
        graph: storePort,
        selectionBefore: () => ({ selectedIds: selectionBeforeRef.current }),
        selectionAfter: () => ({ selectedIds: selectionSnapshotRef.current }),
        onSynced: () => {
          autosave.notifyChange();
        },
        ...(options.history === undefined ? {} : { history: options.history }),
      }),
    [autosave, options.history, storePort],
  );

  const invalidate = useCallback(() => {
    applyInvalidation(queryClient, 'editWall', { floorId, projectId });
  }, [floorId, projectId, queryClient]);

  const applyUndo = useCallback(() => {
    if (!canEdit) {
      return;
    }

    const transition = dispatchBundle.history.undo();

    if (transition === null) {
      return;
    }

    dispatchBundle.deps.spatial.applyPatches(transition.patches);
    setSelection([...transition.selection.selectedIds]);
    autosave.notifyChange();
    invalidate();
  }, [autosave, canEdit, dispatchBundle, invalidate, setSelection]);

  const onUndo = useCallback(() => {
    applyUndo();
  }, [applyUndo]);

  /**
   * Chạy CẢ LÔ như một lượt, rồi MỜI HOÀN TÁC (A8).
   *
   * Đây là chỗ duy nhất của hook đi tới `runStandardizeBatch`, nên hai đường
   * áp — "đồng ý cả nhóm" và "gán nhóm cho hàng đang chọn" — dùng chung đúng
   * một cơ chế và đúng một kiểu bước hoàn tác. Lô rỗng thì không có gì để chạy:
   * `validateCommands([])` từ chối, và "không có gì để áp" là trạng thái của
   * màn chứ không phải một lỗi.
   */
  const runBatch = useCallback(
    async (commands: readonly Command[]): Promise<void> => {
      if (!canEdit || commands.length === 0) {
        return;
      }

      const label = standardizeDescription(commands.length);
      const result = await runStandardizeBatch(commands, dispatchBundle, label);

      if (!result.ok) {
        return;
      }

      invalidate();
      setHasApplied(true);
      flashWalls(commands.flatMap((command) => command.scope.entityIds as readonly WallId[]));

      const ticket = createThicknessUndoTicket({
        description: label,
        now: gateway.now,
        undo: () => {
          applyUndo();
        },
      });

      notifications.publish({
        type: THICKNESS_NOTIFICATION_TYPE,
        title: ticket.description,
        description: '',
        undoTicket: ticket,
      });
    },
    [applyUndo, canEdit, dispatchBundle, flashWalls, gateway, invalidate, notifications],
  );

  /* ---------------------------------------------------------------------- */
  /* Kéo ngưỡng, dung sai, sắp xếp — THUẦN, không một lượt ghi nào.           */
  /* ---------------------------------------------------------------------- */

  const onThresholdDrag = useCallback((index: number, mm: number) => {
    setThresholds((previous) => withThresholdAt(previous, index, mm));
  }, []);

  const onChangeTolerance = useCallback((mm: number) => {
    setToleranceMm(mm);
    /* Dung sai đổi thì con số trong cảnh báo cũ không còn đúng nữa. */
    setReapplyWarning(null);
  }, []);

  const onChangeSortKey = useCallback((key: ThicknessSortKey) => {
    setSortKey(key);
  }, []);

  const onHoverBin = useCallback((index: number | null) => {
    setHoveredBinIndex(index);
  }, []);

  const onHoverGroup = useCallback((group: ThicknessGroup | null) => {
    setHoveredGroup(group);
  }, []);

  const onToggleCollapsed = useCallback(() => {
    setOwnCollapsed((previous) => !previous);
  }, []);

  const onToggleAccepted = useCallback((measuredMm: number, accepted: boolean) => {
    setAcceptedMeasurements((previous) => {
      const next = new Set(previous);

      if (accepted) {
        next.add(measuredMm);
      } else {
        next.delete(measuredMm);
      }

      return next;
    });
  }, []);

  const onChangeNormalizedGroup = useCallback((wallId: WallId, group: ThicknessGroup) => {
    setGroupOverrides((previous) => new Map(previous).set(wallId, group));
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Xem trước rồi mới áp (CẤM TUYỆT ĐỐI).                                   */
  /* ---------------------------------------------------------------------- */

  const acceptedRows = useMemo(
    () => allRows.filter((row) => acceptedMeasurements.has(row.measuredMm)),
    [acceptedMeasurements, allRows],
  );

  const onOpenPreview = useCallback(() => {
    /* Dựng BẢNG, không phát lệnh: không một độ dày nào đổi ở bước này. */
    setPreview(buildApplyPreview(acceptedRows, toleranceMm));
  }, [acceptedRows, toleranceMm]);

  const onCancelPreview = useCallback(() => {
    setPreview(null);
  }, []);

  const onApplyPreview = useCallback(() => {
    if (preview === null) {
      return;
    }

    setPreview(null);

    const current = useStore.getState().spatial;

    if (current === null) {
      return;
    }

    void runBatch(
      buildStandardizeThicknessCommands(allRows, {
        graph: current,
        actorId: gateway.actorId,
        acceptedMeasurements,
      }),
    );
  }, [acceptedMeasurements, allRows, gateway, preview, runBatch]);

  const onApplySelectedGroup = useCallback(
    (group: ThicknessGroup) => {
      const current = useStore.getState().spatial;

      if (current === null || selectedWallIds.length === 0) {
        return;
      }

      const chosen = new Set(selectedWallIds);

      void runBatch(
        buildAssignGroupCommands(
          allRows.filter((row) => chosen.has(row.wallId)),
          group,
          { graph: current, actorId: gateway.actorId },
        ),
      );
    },
    [allRows, gateway, runBatch, selectedWallIds],
  );

  /* ---------------------------------------------------------------------- */
  /* Áp dụng lại bộ lọc — không bao giờ ghi đè im lặng tường đã duyệt.        */
  /* ---------------------------------------------------------------------- */

  /**
   * Lượt bấm ĐẦU TIÊN chỉ dựng cảnh báo mang đúng số tường đã duyệt sẽ bị đổi;
   * nó không ghi một chữ nào. Lượt bấm sau đó mới chạy, và người duyệt chọn
   * được "loại chúng ra" (`excludeReviewed`) ngay trong cảnh báo. Gọi thẳng với
   * `excludeReviewed` bật thì chạy ngay — không có gì đã duyệt để cảnh báo.
   */
  const onReapplyFilter = useCallback(
    (excludeReviewed: boolean) => {
      if (!canEdit) {
        return;
      }

      const targets = allRows.filter(isApplicable);
      const reviewedTargets = targets.filter((row) => row.reviewed);

      if (!excludeReviewed && reviewedTargets.length > 0 && reapplyWarning === null) {
        setReapplyWarning({
          affectedReviewedCount: reviewedTargets.length,
          affectedWallIds: reviewedTargets.map((row) => row.wallId),
          excludeReviewed: false,
        });

        return;
      }

      setReapplyWarning(null);

      const current = useStore.getState().spatial;

      if (current === null) {
        return;
      }

      void runBatch(
        buildStandardizeThicknessCommands(targets, {
          graph: current,
          actorId: gateway.actorId,
          acceptedMeasurements: new Set(targets.map((row) => row.measuredMm)),
          ...(excludeReviewed
            ? { excludedWallIds: new Set(reviewedTargets.map((row) => row.wallId)) }
            : {}),
        }),
      );
    },
    [allRows, canEdit, gateway, reapplyWarning, runBatch],
  );

  /* ---------------------------------------------------------------------- */
  /* Phím tắt — qua sổ đăng ký, không `addEventListener` (A12/R-54).          */
  /* ---------------------------------------------------------------------- */

  const shortcutOptions = useMemo(
    () => (options.shortcutRegistry === undefined ? {} : { registry: options.shortcutRegistry }),
    [options.shortcutRegistry],
  );

  const hasTopLayer = preview !== null || reapplyWarning !== null;

  /**
   * Bỏ lớp cảnh báo áp dụng lại mà KHÔNG áp gì.
   *
   * Một hàm, hai nơi gọi: phím Escape ngay dưới đây và nút "Huỷ" của
   * `ThicknessApplyBar` (`onDismissReapplyWarning`). Tách ra để hai đường ấy
   * không thể trôi khỏi nhau — A12 nói Esc đóng lớp trên cùng, và một nút bấm
   * làm việc khác với chính phím ấy là đúng thứ lời hứa đó cấm.
   */
  const onDismissReapplyWarning = useCallback(() => {
    setReapplyWarning(null);
  }, []);

  useShortcut(
    {
      id: 'thicknessStandardization.closeTopLayer',
      combo: 'Escape',
      scope: 'canvas',
      description: THICKNESS_SCREEN_TEXT.escapeShortcut,
      onTrigger: () => {
        if (preview !== null) {
          setPreview(null);

          return;
        }

        onDismissReapplyWarning();
      },
    },
    { ...shortcutOptions, enabled: hasTopLayer },
  );

  /* ---------------------------------------------------------------------- */
  /* Bảy trạng thái và ba câu đi kèm.                                        */
  /* ---------------------------------------------------------------------- */

  const layerError: unknown = layerQuery.error;

  const errorMessage = useMemo<string | null>(
    () =>
      layerError === null || layerError === undefined
        ? null
        : describeError(toAppError(layerError)).description,
    [layerError],
  );

  const isLoading = layerQuery.isPending;

  const state = deriveThicknessScreenState({
    isViewerRole,
    isCollapsed,
    hasError: errorMessage !== null,
    isLoading,
    segmentCount: allRows.length,
    applicableCount,
    hasApplied,
  });

  const emptyNotice =
    state === 'empty'
      ? allRows.length === 0
        ? THICKNESS_SCREEN_TEXT.emptyNoMeasurementNotice
        : THICKNESS_SCREEN_TEXT.emptyNotice
      : null;

  return {
    state,

    bins,
    thresholds,
    thresholdLabels,
    onThresholdDrag,
    hoveredBinIndex,
    onHoverBin,
    isLoading,

    shapes,
    legend,
    isCollapsed,
    onToggleCollapsed,

    hoveredGroup,
    onHoverGroup,
    hoveredWallId: (hoveredId as WallId | null) ?? null,
    onHoverWall,

    groupRows,
    onToggleAccepted,

    segmentRows,
    sortKey,
    onChangeSortKey,

    summary,

    toleranceMm,
    onChangeTolerance,
    preview,
    onOpenPreview,
    onApplyPreview,
    onCancelPreview,
    onUndo,
    reapplyWarning,
    onReapplyFilter,
    onDismissReapplyWarning,

    isViewerRole,
    viewerRoleNotice: isViewerRole ? THICKNESS_SCREEN_TEXT.viewerRoleNotice : null,
    emptyNotice,
    errorMessage,

    selectedWallIds,
    onToggleRowSelected,
    onToggleAllSelected,
    onClearSelection,
    onChangeNormalizedGroup,
    onApplySelectedGroup,
    flashingWallIds,
  };
}

/** Cổng có dữ liệu, xuất lại để story và bài kiểm cắm vào cùng một chỗ (R-73). */
export { createMockThicknessStandardizationGateway };
