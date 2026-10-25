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
 *    duyệt sẽ bị đổi; lượt bấm sau đó mở bảng xem trước (người dùng chọn được
 *    "loại chúng ra"), và chỉ "Áp dụng" trong bảng mới ghi (BUG-593).
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
import { useQueryClient } from '@tanstack/react-query';

import { displayCodesOf } from '@/domain/spatial/ids';
import type { LevelId, Wall, WallId } from '@/domain/spatial/types';
import { useFloorLayerAutosave } from '@/hooks/useAutosave';
import { useFloorLayer } from '@/hooks/useFloorLayer';
import { appNotificationBus } from '@/hooks/useNotifications';
import { useSaveIndicator } from '@/hooks/useSaveIndicator';
import { useShortcut } from '@/hooks/useShortcut';
import { ROUTES } from '@/routes/paths';
import { can } from '@/lib/auth/permissions';
import type { Command } from '@/lib/commands/types';
import { newestEntryId, undoIfNewest, type HistoryStack } from '@/lib/commands/history';
import type { ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { durationMs } from '@/lib/motion';
import type { NotificationBus } from '@/lib/mutations/notificationBus';
import { applyInvalidation } from '@/lib/query/invalidation';
import { useStore } from '@/store';
import { currentSelection } from '@/store/commit';
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
  batchRowsOf,
  batchSentenceOf,
  batchStatusOf,
  statusSentenceOf,
  toManualRows,
  toTargetGroups,
  type ThicknessBatchProps,
} from './thicknessBatch';
import {
  DEFAULT_THICKNESS_SORT_KEY,
  DEFAULT_THICKNESS_THRESHOLDS,
  DEFAULT_TOLERANCE_MM,
  THICKNESS_GROUPS_MM,
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
import { useFloorLayerReadFailure } from '../shared/floorLayerReadFailure';
import { useProvisionalScaleNotice } from '../shared/provisionalScaleNotice';

/** Ngưỡng nhớ theo dự án trong phiên (G4a-33); tải lại trang vẫn giữ. */
const MIN_THRESHOLD_MM = THICKNESS_GROUPS_MM[0] ?? 100; // bậc nhỏ nhất của thang sáu bậc
const thresholdsKey = (projectId: string): string => `thickness-thresholds:${projectId}`;
function readSavedThresholds(projectId: string): ThicknessThresholds {
  try {
    const raw: unknown = JSON.parse(window.sessionStorage.getItem(thresholdsKey(projectId)) ?? 'null');
    if (Array.isArray(raw) && raw.length === DEFAULT_THICKNESS_THRESHOLDS.length && raw.every((v) => typeof v === 'number')) {
      return raw as unknown as ThicknessThresholds;
    }
  } catch {
    /* sessionStorage chặn hoặc hỏng: dùng mặc định. */
  }
  return DEFAULT_THICKNESS_THRESHOLDS;
}
function saveThresholds(projectId: string, value: ThicknessThresholds): void {
  try {
    window.sessionStorage.setItem(thresholdsKey(projectId), JSON.stringify(value));
  } catch {
    /* bỏ qua */
  }
}

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
    'Mọi đoạn tường đã ở đúng nhóm chuẩn, không còn gì để đổi. Kéo một ngưỡng trên biểu đồ nếu bạn muốn gom thêm đoạn vào một nhóm khác.',
  /* BUG-619 (luật S-21): còn đoạn xem tay thì "mọi đoạn đã đúng nhóm" là câu sai về dữ liệu. */
  outOfToleranceNotice: (count: number): string =>
    `${count} đoạn tường cần xem tay (dày bất thường, có thể là cột BTCT), lô chuẩn hoá không đổi chúng. Mở từng đoạn ở màn duyệt tường để sửa tay.`,
  emptyNoMeasurementNotice:
    'Chưa có số đo độ dày nào cho công trình này. Sang lớp tường để dò lại các đoạn tường, rồi quay lại đây để chuẩn hoá độ dày.',
  viewerRoleNotice:
    'Bạn đang xem với vai người xem: áp chuẩn hoá, gán nhóm và sửa dung sai đều tắt. Nhờ người quản trị dự án đổi vai nếu bạn cần sửa độ dày tường.',
  escapeShortcut: 'Đóng bảng xem trước hoặc cảnh báo áp lại cho mọi tường lệch nhóm.',
  undoShortcut: 'Hoàn tác lượt chuẩn hoá độ dày gần nhất.',
  applyBatchShortcut: 'Đổi các nhóm độ dày đã tích về chuẩn.',
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
  /** Lối ra của dải tỉ lệ tạm (F-04x-2) — container truyền `onNavigate` của nó. */
  readonly onNavigate?: (path: string) => void;
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
  ThicknessBatchProps &
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
/** Toast "Hoàn tác" bị từ chối vì đã có bước mới hơn (BUG-579). */
const THICKNESS_UNDO_REFUSED_TYPE = 'thicknessStandardization.undoRefused';

/** Bảng xem trước đang mở cùng đúng các hàng nó sẽ áp (BUG-593). */
interface PreviewPlan {
  readonly preview: ApplyPreview;
  readonly rows: readonly ThicknessSegmentRow[];
}

/* -------------------------------------------------------------------------- */
/* Phép ghép thuần — kiểm được mà không cần dựng hook.                          */
/* -------------------------------------------------------------------------- */

/**
 * Bảy trạng thái của A11, theo đúng thứ tự ưu tiên hai màn QC anh em đã chốt.
 *
 * Vai trò đi SAU thu gọn/hỏng/tải/rỗng: hàm sửa đã tắt ở hook (`canEdit`), còn
 * trạng thái phải nói đúng điều màn đang vẽ — người xem lúc đang tải thấy khung
 * xương, không thấy "chưa có đoạn nào" (BUG-601). `error` đi trước `loading` vì
 * một lượt đọc đã hỏng thì không còn "đang tải" nữa.
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
  /* Vai trò KHÔNG đứng trước thu gọn/hỏng/tải/rỗng (BUG-601): người xem lúc đang tải vẫn phải thấy khung xương. */
  /* 21-B-009: thu gọn lúc đang tải vẫn là khung xương (cột phải của nhánh loading tự lo nút bung lại). */
  if (input.isCollapsed && !input.isLoading) {
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

  if (input.isViewerRole) {
    return 'forbidden';
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

    /* Vai trò — trạng thái 6 vô hiệu MỌI hàm sửa, ở tầng hook.                */
  /* ---------------------------------------------------------------------- */

  const roles = options.roles ?? [];
  const canEdit = can('edit', 'layer', { roles });
  const isViewerRole = !canEdit;

  /* ---------------------------------------------------------------------- */
  /* Trạng thái của riêng giao diện — KHÔNG có isLoading/error ở đây (R-64). */
  /* ---------------------------------------------------------------------- */

  const [thresholds, setThresholds] = useState<ThicknessThresholds>(() => readSavedThresholds(projectId));
  const [thresholdsProjectId, setThresholdsProjectId] = useState(projectId);

  /* Đổi dự án mà màn không gắn lại: nạp ngưỡng của dự án mới ngay lúc render (RV1#15). */
  if (thresholdsProjectId !== projectId) {
    setThresholdsProjectId(projectId);
    setThresholds(readSavedThresholds(projectId));
  }
  const [toleranceMm, setToleranceMm] = useState(DEFAULT_TOLERANCE_MM);
  const [acceptedMeasurements, setAcceptedMeasurements] =
    useState<ReadonlySet<number>>(NO_MEASUREMENTS);
  const [sortKey, setSortKey] = useState<ThicknessSortKey>(DEFAULT_THICKNESS_SORT_KEY);
  /* Bảng xem trước giữ ĐÚNG các hàng nó kê: "Áp dụng" ghi đúng thứ vừa xem (BUG-593). */
  const [previewPlan, setPreviewPlan] = useState<PreviewPlan | null>(null);
  const preview = previewPlan?.preview ?? null;
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

  /* N16 của tầng — `useFloorLayer` quyết định nó vào kho thế nào (F-04x-2). */
  const floorLayer = useFloorLayer({ floorId, projectId, read: gateway.readLayer });
  const provisionalScaleNotice = useProvisionalScaleNotice(
    floorLayer.scaleStatus,
    projectId,
    floorId,
    options.onNavigate,
    canEdit,
  );
  const readFailure = useFloorLayerReadFailure(floorLayer, projectId, options.onNavigate);

  /* ---------------------------------------------------------------------- */
  /* Đồ thị đang sửa — nơi `commit` ghi vào.                                  */
  /* ---------------------------------------------------------------------- */

  const graph = useStore((state) => state.spatial);
  const setSpatial = useStore((state) => state.setSpatial);
  const loadedFloorCount = useStore((state) => Object.keys(state.floorMeta).length);
  const selectedIds = useStore((state) => state.selectedIds);
  const hoveredId = useStore((state) => state.hoveredId);
  const setSelection = useStore((state) => state.setSelection);
  const setHovered = useStore((state) => state.setHovered);

  /*
   * Cổng giả (story, test) cắm đồ thị bộ mẫu vào kho còn trống, revision 0 khớp
   * N16 giả. Cổng thật đọc kho nên `graph.read()` là `null` ở đây; kho khi ấy do
   * `useFloorLayer` nạp từ N16.
   */
  useEffect(() => {
    if (graph !== null) {
      return;
    }

    const seed = gateway.graph.read();

    if (seed !== null) {
      setSpatial(seed, null, { floorRevisions: { [floorId]: 0 }, projectId });
    }
  }, [floorId, gateway, graph, projectId, setSpatial]);

  /*
   * Kho giữ nhiều tầng khi người dùng nhảy SPA giữa các tầng (S-06): bảng, biểu đồ, xem trước và Áp dụng chỉ nhận
   * tường của TẦNG NÀY (`levelId === floorId`, quy ước của các màn QC). Kho một tầng — kể cả đồ thị mẫu nhiều
   * tầng của story/test — giữ nguyên mọi tường.
   */
  const walls = useMemo(() => {
    const all = wallsOfGraph(graph);
    const hasThisLevel = graph !== null && graph.byKind.level.some((id) => id === floorId);

    return loadedFloorCount > 1 && hasThisLevel ? all.filter((wall) => wall.levelId === floorId) : all;
  }, [floorId, graph, loadedFloorCount]);
  /* Nhãn tường tính trên mọi tường, nên không trùng dù mã BE hay mã A14 (B-V6-09). */
  const wallCodes = useMemo(() => displayCodesOf(walls.map((wall) => wall.id)), [walls]);
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
        codes: wallCodes,
      }),
    [levelIndex, thresholds, toleranceMm, wallCodes, walls],
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

  const replaceSelection = useCallback(
    (ids: readonly WallId[]) => {
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

  /* Bộ lưu lớp chung mỗi người–dự án (F-04x-1); 409 → dải "Tải lại". */
  const { autosave, saveBlock } = useFloorLayerAutosave({
    projectId,
    floorId,
    ...(gateway.apiClient === undefined ? {} : { apiClient: gateway.apiClient }),
  });

  const saveIndicator = useSaveIndicator(autosave);

  /* ---------------------------------------------------------------------- */
  /* Đường ghi — MỘT transaction, MỘT bước hoàn tác 100 bước của S-06.        */
  /* ---------------------------------------------------------------------- */

  const dispatchBundle = useMemo(
    () =>
      createThicknessDispatchDeps({
        graph: storePort,
        selectionBefore: currentSelection,
        selectionAfter: currentSelection,
        onSynced: () => {
          autosave.notifyChange();
        },
        ...(options.history === undefined ? {} : { history: options.history }),
      }),
    [autosave, options.history, storePort],
  );

  /* Máy chủ vừa thay tầng (tải lại sau xung đột) — các bước hoàn tác cũ không còn khớp (R14). */
  const serverReplaceSeq = useStore((state) => state.serverReplaceSeq);
  const replaceSeqRef = useRef(serverReplaceSeq);

  useEffect(() => {
    if (replaceSeqRef.current !== serverReplaceSeq) {
      replaceSeqRef.current = serverReplaceSeq;
      dispatchBundle.history.clear();
    }
  }, [dispatchBundle, serverReplaceSeq]);

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
    // G63: the bar's own "Hoàn tác" took the step back — its toast would sit over the bar.
    notifications.withdraw(THICKNESS_NOTIFICATION_TYPE);
  }, [applyUndo, notifications]);

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

      /* BUG-579: vé giữ đúng bước của lượt áp này, không "bước trên cùng" lúc bấm. */
      const entryId = newestEntryId(dispatchBundle.history);
      const ticket = createThicknessUndoTicket({
        description: label,
        now: gateway.now,
        undo: () => {
          const refused = undoIfNewest(dispatchBundle.history, entryId, applyUndo);

          if (refused !== null) {
            notifications.publish({ type: THICKNESS_UNDO_REFUSED_TYPE, title: refused, description: '' });
          }
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
    setThresholds((previous) => {
      /* Không kéo xuống dưới nhóm chuẩn nhỏ nhất (100 mm): tường mỏng không nhảy nhóm (G4a-33). */
      const next = withThresholdAt(previous, index, Math.max(mm, MIN_THRESHOLD_MM));
      saveThresholds(projectId, next);
      return next;
    });
  }, [projectId]);

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

  /* ---------------------------------------------------------------------- */
  /* Gán nhóm thẳng — MỘT lượt chạy, một toast hoàn tác, như SCR-16.          */
  /* ---------------------------------------------------------------------- */

  const assignGroup = useCallback(
    (wallIds: readonly WallId[], group: ThicknessGroup) => {
      const current = useStore.getState().spatial;

      if (current === null || wallIds.length === 0) {
        return;
      }

      const chosen = new Set(wallIds);

      void runBatch(
        buildAssignGroupCommands(
          allRows.filter((row) => chosen.has(row.wallId)),
          group,
          { graph: current, actorId: gateway.actorId },
        ),
      );
    },
    [allRows, gateway, runBatch],
  );

  /* BUG-585: đổi nhóm trên một hàng là ghi thật (một bước hoàn tác), không phải một ghi đè cục bộ không ai lưu. */
  const onChangeNormalizedGroup = useCallback(
    (wallId: WallId, group: ThicknessGroup) => {
      assignGroup([wallId], group);
    },
    [assignGroup],
  );

  const onApplySelectedGroup = useCallback(
    (group: ThicknessGroup) => {
      assignGroup(selectedWallIds, group);
    },
    [assignGroup, selectedWallIds],
  );

  /* ---------------------------------------------------------------------- */
  /* Xem trước rồi mới áp (CẤM TUYỆT ĐỐI).                                   */
  /* ---------------------------------------------------------------------- */

  /* Dựng BẢNG, không phát lệnh: không một độ dày nào đổi ở bước này. */
  const openPreviewOf = useCallback(
    (rows: readonly ThicknessSegmentRow[]) => {
      setPreviewPlan({ preview: buildApplyPreview(rows, toleranceMm), rows });
    },
    [toleranceMm],
  );

  const onOpenPreview = useCallback(() => {
    openPreviewOf(allRows.filter((row) => acceptedMeasurements.has(row.measuredMm)));
  }, [acceptedMeasurements, allRows, openPreviewOf]);

  const onCancelPreview = useCallback(() => {
    setPreviewPlan(null);
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Lô của bản Z (S-21): tích nhóm rồi "Đổi N đoạn" — panel trái là bảng xem trước. */
  /* ---------------------------------------------------------------------- */

  const targetGroups = useMemo(
    () => toTargetGroups(allRows, acceptedMeasurements),
    [acceptedMeasurements, allRows],
  );
  const manualRows = useMemo(() => toManualRows(allRows), [allRows]);
  const batchRows = useMemo(
    () => batchRowsOf(allRows, acceptedMeasurements),
    [acceptedMeasurements, allRows],
  );
  const candidateCount = targetGroups.reduce((total, group) => total + group.wallCount, 0);
  const reviewedCount = allRows.filter((row) => row.reviewed).length;

  const onToggleGroupAccepted = useCallback(
    (group: ThicknessGroup, accepted: boolean) => {
      const target = targetGroups.find((entry) => entry.group === group);

      if (target === undefined) {
        return;
      }

      setAcceptedMeasurements((previous) => {
        const next = new Set(previous);

        for (const value of target.measurements) {
          if (accepted) {
            next.add(value);
          } else {
            next.delete(value);
          }
        }

        return next;
      });
    },
    [targetGroups],
  );

  const onAcceptAllGroups = useCallback(() => {
    setAcceptedMeasurements(
      (previous) => new Set([...previous, ...targetGroups.flatMap((group) => group.measurements)]),
    );
  }, [targetGroups]);

  const onApplyBatch = useCallback(() => {
    const current = useStore.getState().spatial;

    if (!canEdit || current === null || batchRows.length === 0) {
      return;
    }

    setAcceptedMeasurements(NO_MEASUREMENTS);
    void runBatch(
      buildStandardizeThicknessCommands(batchRows, {
        graph: current,
        actorId: gateway.actorId,
        acceptedMeasurements: new Set(batchRows.map((row) => row.measuredMm)),
      }),
    );
  }, [batchRows, canEdit, gateway, runBatch]);

  const onApplyPreview = useCallback(() => {
    if (previewPlan === null) {
      return;
    }

    setPreviewPlan(null);

    const current = useStore.getState().spatial;

    if (current === null) {
      return;
    }

    void runBatch(
      buildStandardizeThicknessCommands(previewPlan.rows, {
        graph: current,
        actorId: gateway.actorId,
        acceptedMeasurements: new Set(previewPlan.rows.map((row) => row.measuredMm)),
      }),
    );
  }, [gateway, previewPlan, runBatch]);

  /* ---------------------------------------------------------------------- */
  /* Áp dụng lại bộ lọc — không bao giờ ghi đè im lặng tường đã duyệt.        */
  /* ---------------------------------------------------------------------- */

  /**
   * Lượt bấm ĐẦU TIÊN chỉ dựng cảnh báo mang đúng số tường đã duyệt sẽ bị đổi;
   * nó không ghi một chữ nào. Lượt bấm sau đó mở BẢNG XEM TRƯỚC như mọi đường
   * áp khác (BUG-593) — "loại chúng ra" (`excludeReviewed`) bỏ tường đã duyệt
   * khỏi bảng đó. Chỉ "Áp dụng" trong bảng mới ghi.
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
      openPreviewOf(excludeReviewed ? targets.filter((row) => !row.reviewed) : targets);
    },
    [allRows, canEdit, openPreviewOf, reapplyWarning],
  );

  /* ---------------------------------------------------------------------- */
  /* Phím tắt — qua sổ đăng ký, không `addEventListener` (A12/R-54).          */
  /* ---------------------------------------------------------------------- */

  const shortcutOptions = useMemo(
    () => (options.shortcutRegistry === undefined ? {} : { registry: options.shortcutRegistry }),
    [options.shortcutRegistry],
  );

  const { onNavigate } = options;
  const onNavigateToWalls = useMemo(
    () => (onNavigate === undefined ? undefined : () => onNavigate(ROUTES.project.walls(projectId, floorId))),
    [floorId, onNavigate, projectId],
  );

  /* Mã đoạn xem tay là link: chọn sẵn đoạn đó trong kho chung rồi sang màn duyệt tường. */
  const onOpenWall = useCallback(
    (wallId: WallId) => {
      setSelection([wallId]);
      onNavigateToWalls?.();
    },
    [onNavigateToWalls, setSelection],
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
      /* sidePanel, not canvas: the registry skips canvas for any INPUT target, and the "Đồng ý" checkbox is an INPUT (21-E-007). */
      scope: 'sidePanel',
      description: THICKNESS_SCREEN_TEXT.escapeShortcut,
      onTrigger: () => {
        if (preview !== null) {
          setPreviewPlan(null);

          return;
        }

        onDismissReapplyWarning();
      },
    },
    { ...shortcutOptions, enabled: hasTopLayer },
  );

  /* Enter đổi lô đã tích; nút/ô đang focus vẫn tự nhận Enter của nó (BUG-597). */
  useShortcut(
    {
      id: 'thicknessStandardization.applyBatch',
      combo: 'Enter',
      scope: 'sidePanel',
      description: THICKNESS_SCREEN_TEXT.applyBatchShortcut,
      onTrigger: onApplyBatch,
    },
    { ...shortcutOptions, enabled: canEdit && batchRows.length > 0 && !hasTopLayer },
  );

  /* BUG-582: Mod+Z đi vào ngăn xếp của chính màn — cùng việc với nút "Hoàn tác" — không rơi xuống undo toàn cục. */
  useShortcut(
    {
      id: 'thicknessStandardization.undo',
      combo: 'Mod+Z',
      scope: 'canvas',
      description: THICKNESS_SCREEN_TEXT.undoShortcut,
      onTrigger: onUndo,
    },
    { ...shortcutOptions, enabled: canEdit },
  );

  /* ---------------------------------------------------------------------- */
  /* Bảy trạng thái và ba câu đi kèm.                                        */
  /* ---------------------------------------------------------------------- */

  const errorMessage = floorLayer.error === null ? null : floorLayer.errorMessage;

  const isLoading = floorLayer.isPending;

  const state = deriveThicknessScreenState({
    isViewerRole,
    isCollapsed,
    hasError: errorMessage !== null,
    isLoading,
    segmentCount: allRows.length,
    applicableCount,
    hasApplied,
  });

  /* Sau một lượt áp, "mọi đoạn đã đúng nhóm" vẫn là sự thật cần nói — như trạng thái rỗng (BUG-421). */
  const isAllStandard = summary.segmentCount > 0 && summary.normalizedCount === summary.segmentCount;
  const emptyNotice =
    state === 'empty'
      ? allRows.length === 0
        ? THICKNESS_SCREEN_TEXT.emptyNoMeasurementNotice
        : manualRows.length > 0
          ? THICKNESS_SCREEN_TEXT.outOfToleranceNotice(manualRows.length)
          : THICKNESS_SCREEN_TEXT.emptyNotice
      : state === 'success' && isAllStandard
        ? THICKNESS_SCREEN_TEXT.emptyNotice
        : null;

  const batchStatus = batchStatusOf(allRows.length, candidateCount, manualRows.length);

  return {
    state,

    targetGroups,
    manualRows,
    batchCount: batchRows.length,
    candidateCount,
    batchSentence: batchSentenceOf({
      batchCount: batchRows.length,
      groupCount: targetGroups.filter((group) => group.accepted).length,
      candidateCount,
      manualCount: manualRows.length,
      reviewedCount,
    }),
    statusSentence: statusSentenceOf(summary),
    batchStatus,
    saveLabel: saveIndicator.label,
    reviewedCount,
    onToggleGroupAccepted,
    onAcceptAllGroups,
    onApplyBatch,
    onOpenWall,

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
    onNavigateToWalls,
    errorMessage,

    selectedWallIds,
    onToggleRowSelected,
    onToggleAllSelected,
    onClearSelection,
    onChangeNormalizedGroup,
    onApplySelectedGroup,
    flashingWallIds,
    saveBlock,
    provisionalScaleNotice,
    readFailure,
  };
}

/** Cổng có dữ liệu, xuất lại để story và bài kiểm cắm vào cùng một chỗ (R-73). */
export { createMockThicknessStandardizationGateway };
