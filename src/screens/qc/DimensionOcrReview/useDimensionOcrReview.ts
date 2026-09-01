/**
 * Nửa "suy nghĩ" của màn S-14 "Đọc kích thước OCR" — mọi thứ bốn view của màn
 * cần, đã xong. `dimensionOcrTypes.ts` là hợp đồng props duy nhất; hook này trả
 * về {@link DimensionOcrReviewModel}, tức {@link DimensionOcrModel} của T3 cộng
 * đúng bốn nhóm trường mà QĐ-7 của điều phối viên thêm cho T7 (xem khối "QĐ-7"
 * bên dưới). `dimensionOcrTypes.ts` KHÔNG bị sửa một dòng nào.
 *
 * ## Đường ghi (A10)
 *
 * Không một dòng nào gọi `set()` hay `_applyPatches()`. Mọi thay đổi đi: lệnh
 * `dimension.override` / `dimension.approve` (dựng bằng nguyên thuỷ công khai,
 * xem `dimensionOcrReviewGateway.ts`) → `dispatch`/`runTransaction` →
 * `SpatialPort.applyPatches` = `commit(patches, label)` → store.
 *
 * ## Trạng thái máy chủ (R-64)
 *
 * Không `useState` nào giữ cờ đang-tải hay cờ hỏng. BA lượt đọc, ba khoá của
 * `src/lib/query`: ảnh nền (`drawing.byFloor`), lớp kích thước
 * (`space.byFloor` — `queryKeys` chưa có domain `dimension`, nợ đã ghi ở cổng),
 * và tiến độ OCR (`progress.byFloor`). Mọi lượt ghi gọi
 * `applyInvalidation(queryClient, 'editDimension', …)` chứ không gọi
 * `invalidateQueries` trần. `useState` ở đây chỉ giữ trạng thái của riêng giao
 * diện: bộ lọc đang chọn, cờ thu gọn, cờ chế độ bàn phím, chuỗi đang chọn, và
 * số người duyệt đang gõ dở.
 *
 * ## Không công thức tự chế (R-61)
 *
 * - Độ lệch: `compareLengthToMeasured` (QĐ-5), qua `deviationOf` của cổng.
 * - Đo lại từ hình học: `measureDistance` (M-15), qua `measuredLengthOf`.
 * - Giá trị vô lý: `splitOutliers` + `SCALE_THRESHOLDS.outlierRejection` (QĐ-4).
 * - Ngưỡng độ tin cậy: `confidenceLevel` của `@/lib/format/semantic`.
 * - Số: `formatLength`/`formatNumber`/`formatPercent` qua tầng cổng.
 * - Bay khung nhìn: `flyToBounds` của `useCanvasViewport`.
 * Hook này không có một phép nhân, chia hay làm tròn nào.
 *
 * ## Chạy số 260 ms (QĐ-2)
 *
 * `useCountUp` của `src/hooks/useCountUp.ts` chạy trên slot `standard` —
 * `COUNT_UP_DURATION` của `src/lib/motion/useCountUp.ts` — tức đúng 260 ms của
 * `MOTION_DURATIONS_MS`. Không con số thời lượng nào viết ở màn (R-71). Đặc tả
 * gốc ghi 240 ms; thang chuyển động không có nấc đó, nên theo luật (QĐ-2).
 *
 * ## Tự lưu (D-07, A7) — không có nút lưu
 *
 * `useAutosave` giữ bộ đếm 800 ms (hằng `AUTOSAVE_DEBOUNCE_MS` của chính nó,
 * A7), và khi nó điểm thì `Autosave` của `createAutosave` chạy `saveNow()` —
 * nên chỉ có ĐÚNG MỘT bộ đếm, không phải hai như cảnh báo ở
 * `useAccountPreferences.ts`. `useSaveIndicator` đọc máy trạng thái đó và nói
 * kết quả ra cho trình đọc màn hình. Bước `sync` của `dispatch` chỉ đánh dấu
 * bẩn; lượt gửi thật xảy ra 800 ms sau thao tác cuối.
 *
 * ## Bàn phím (A12, R-54, I-01)
 *
 * Không một `addEventListener('keydown')` nào. `Enter` lưu và sang chuỗi chưa
 * duyệt kế tiếp, `Escape` bỏ sửa rồi mới đóng lớp trên cùng, `R` bật/tắt chế độ
 * duyệt bàn phím. **`Tab` cố ý KHÔNG được đăng ký**: nó là thứ tự focus gốc của
 * trình duyệt, và cướp nó bằng `preventDefault` chính là cách nhanh nhất phá vỡ
 * lời hứa A12 mà nó đáng ra phải giữ — T4 vẫn có nhãn "Tab · sang cột sau" cho
 * bảng phím tắt, và ô nhập của T7 nằm đúng thứ tự đó.
 *
 * Trong chế độ duyệt bàn phím, một chuỗi xong trong ĐÚNG hai lần gõ phím: gõ số
 * (một lượt `onEdit`) rồi `Enter`. Không có bước xác nhận nào chen vào.
 *
 * ## QĐ-7 — bốn nhóm trường thêm cho T7
 *
 * T7 khai `…ViewProps extends …Props` trong bốn file `.tsx` của nó, nên hook
 * cấp thêm: (1) ba hàm sửa xuống tới từng hàng; (2) `outlierMessage` mỗi hàng;
 * (3) `deviationPercentValue` + `formatDeviation` ở dải đối chiếu; (4) khối
 * `keyboardReview` mang hàng đang duyệt. Mọi trường của T3 giữ nguyên kiểu và
 * nguyên nghĩa — {@link DimensionOcrReviewModel} chỉ MỞ RỘNG, không thay thế.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Dimension, EntityId, Level } from '@/domain/spatial/types';
import { useAutosave } from '@/hooks/useAutosave';
import { useCanvasViewport } from '@/hooks/useCanvasViewport';
import { useCountUp } from '@/hooks/useCountUp';
import { appNotificationBus } from '@/hooks/useNotifications';
import { useSaveIndicator } from '@/hooks/useSaveIndicator';
import { useShortcut } from '@/hooks/useShortcut';
import { createAutosave, type Autosave } from '@/lib/autosave/createAutosave';
import { can } from '@/lib/auth/permissions';
import type { Command } from '@/lib/commands/types';
import type { ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import type { NotificationBus } from '@/lib/mutations/notificationBus';
import { applyInvalidation } from '@/lib/query/invalidation';
import { queryKeys } from '@/lib/query/queryKeys';
import { useStore } from '@/store';
import type { ProjectRole } from '@/types/project';

import {
  buildApproveDimensionCommand,
  buildOverrideDimensionCommand,
  createDimensionOcrDispatchDeps,
  createDimensionOcrMutation,
  createDimensionOcrReviewGateway,
  createDimensionUndoTicket,
  deviationOf,
  dimensionEntityIdOf,
  dimensionProgressLabel,
  dimensionsOf,
  drawingSizePxOf,
  formatDeviation,
  hostWallOf,
  implausibleDimensionIds,
  implausibleValueHint,
  levelOfGraph,
  lowConfidenceDimensionsOf,
  millimetresPerPixelOf,
  readValueOf,
  reviewCounterOf,
  scaleOfLevel,
  toCompareViewModel,
  toContentBounds,
  toDimensionChain,
  toDimensionRow,
  runDimensionTransaction,
  type DimensionOcrBackground,
  type DimensionOcrDispatchDeps,
  type DimensionOcrGraphPort,
  type DimensionOcrReviewGateway,
  type DimensionWriteVariables,
} from './dimensionOcrReviewGateway';
import { DIMENSION_OCR_TEXT } from './dimensionOcrText';
import type {
  DimensionCompareViewModel,
  DimensionFilterId,
  DimensionOcrModel,
  DimensionOcrScreenState,
  DimensionReviewCounter,
  DimensionRowViewModel,
} from './dimensionOcrTypes';

/* -------------------------------------------------------------------------- */
/* Hợp đồng vào.                                                               */
/* -------------------------------------------------------------------------- */

export interface UseDimensionOcrReviewOptions {
  readonly projectId: string;
  readonly floorId: string;
  readonly roles?: readonly ProjectRole[];
  /** Cổng dữ liệu tiêm được. Vắng mặt thì hook dựng cổng thật, đúng một lần. */
  readonly gateway?: DimensionOcrReviewGateway;
  /** Sổ phím tiêm được — bài kiểm dựng sổ riêng để không đụng sổ dùng chung. */
  readonly registry?: ShortcutRegistry;
  /** Ép thu gọn bảng duyệt — cho story và bài kiểm muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
  /** Bus thông báo — chỗ toast hoàn tác của A8 đi ra. */
  readonly notifications?: NotificationBus;
}

/* -------------------------------------------------------------------------- */
/* Hợp đồng ra — T3 mở rộng theo QĐ-7.                                         */
/* -------------------------------------------------------------------------- */

/**
 * Một hàng, cộng những gì T7 cần để hàng tự làm việc của nó (QĐ-7 mục 1 và 2).
 *
 * Ba hàm sửa mang đúng chữ ký của {@link DimensionOcrRowProps} nên T7 truyền
 * thẳng xuống; `outlierMessage` là câu `outlierHint()` của T4 đã ghép sẵn, hoặc
 * `null` khi giá trị của hàng không lệch khỏi phần còn lại của bản vẽ.
 */
export interface DimensionOcrRowModel extends DimensionRowViewModel {
  /** Câu gợi ý khi giá trị của hàng lệch khỏi tập chuỗi còn lại. `null` khi bình thường. */
  readonly outlierMessage: string | null;
  readonly onEdit: (dimensionId: string, valueMm: number) => void;
  readonly onApprove: (dimensionId: string) => void;
  readonly onCancelEdit: () => void;
}

/**
 * Dải đối chiếu, cộng hai thứ T7 cần để tự chạy số (QĐ-7 mục 3).
 *
 * `deviationLabel` đã là khung hình ĐANG chạy của lượt 260 ms trong hook, nên
 * T7 dùng thẳng được. `deviationPercentValue` là giá trị ĐÍCH dạng ratio cho
 * nơi nào muốn tự gọi `useCountUp`, và `formatDeviation` là bọc `formatPercent`
 * — T7 vì thế không bao giờ tự ghép dấu phần trăm hay dấu phẩy (A15).
 */
export interface DimensionOcrCompareModel extends DimensionCompareViewModel {
  readonly deviationPercentValue: number;
  readonly formatDeviation: (relativeDeviation: number) => string;
}

/** Chế độ duyệt bàn phím, đủ để T7 dựng lớp phủ của nó (QĐ-7 mục 4). */
export interface DimensionOcrKeyboardReviewModel {
  readonly isActive: boolean;
  /** Hàng đang duyệt. `null` khi chưa chọn chuỗi nào. */
  readonly row: DimensionOcrRowModel | null;
  readonly outlierMessage: string | null;
  readonly onEdit: (dimensionId: string, valueMm: number) => void;
  readonly onApprove: (dimensionId: string) => void;
  readonly onCancelEdit: () => void;
  readonly onToggle: () => void;
}

/** Mọi thứ hook trả về: hợp đồng T3, mở rộng đúng bốn nhóm của QĐ-7. */
export interface DimensionOcrReviewModel extends DimensionOcrModel {
  readonly rows: readonly DimensionOcrRowModel[];
  readonly compare: DimensionOcrCompareModel | null;
  readonly keyboardReview: DimensionOcrKeyboardReviewModel;
}

/* -------------------------------------------------------------------------- */
/* Hằng của riêng hook.                                                        */
/* -------------------------------------------------------------------------- */

/** Loại thông báo của một lượt sửa — viết đúng một chỗ (R-71). */
const EDIT_NOTIFICATION_TYPE = 'dimensionOcrReview.editDimension';

const NO_DIMENSIONS: readonly Dimension[] = [];
const NO_OVERRIDES: ReadonlyMap<string, number> = new Map<string, number>();

/** Số người duyệt đang gõ dở, chưa thành lệnh. */
interface DimensionDraft {
  /** Mã hiển thị, ví dụ `"M-014"`. */
  readonly dimensionId: string;
  readonly valueMm: number;
}

/* -------------------------------------------------------------------------- */
/* Phép ghép thuần — kiểm được mà không cần dựng hook.                          */
/* -------------------------------------------------------------------------- */

/**
 * Bảy trạng thái của A11, DẪN XUẤT từ dữ liệu chứ không phải bảy cờ rời rạc.
 *
 * Thứ tự quyết định là thứ tự trả lời: quyền trước, rồi vỏ màn, rồi lỗi, rồi
 * đang tải, rồi mới tới đếm. `hasPartialOcr` (OCR mới xong một phần bản vẽ)
 * KHÔNG đẩy màn sang `error`: nó chỉ giữ màn ở `partial` ngay cả khi mọi chuỗi
 * đọc được đã duyệt, đúng câu "một phần" của đặc tả.
 */
export function deriveScreenState(input: {
  readonly isViewerRole: boolean;
  readonly isCollapsed: boolean;
  readonly hasError: boolean;
  readonly isLoading: boolean;
  readonly hasPartialOcr: boolean;
  readonly counter: DimensionReviewCounter;
}): DimensionOcrScreenState {
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

  if (input.counter.total === 0) {
    return 'empty';
  }

  if (input.counter.reviewed === input.counter.total) {
    return input.hasPartialOcr ? 'partial' : 'success';
  }

  return 'partial';
}

/**
 * Ba lựa chọn của bộ lọc, áp lên danh sách hàng.
 *
 * Hàm THUẦN trên chính view model, nên bài kiểm chạy được không cần DOM và
 * không cần dựng hook.
 */
export function applyDimensionFilters<TRow extends DimensionRowViewModel>(
  rows: readonly TRow[],
  filter: DimensionFilterId,
): readonly TRow[] {
  if (filter === 'lowConfidence') {
    return rows.filter((row) => row.isLowConfidence);
  }

  if (filter === 'unreviewed') {
    return rows.filter((row) => !row.isReviewed);
  }

  return rows;
}

/**
 * Chuỗi chưa duyệt kế tiếp sau chuỗi đang chọn, vòng lại từ đầu khi hết.
 *
 * `null` khi không còn chuỗi nào chưa duyệt — lúc đó màn đã ở trạng thái `xong`
 * và không có gì để nhảy tới.
 */
export function nextUnreviewedId(
  rows: readonly DimensionRowViewModel[],
  currentId: string | null,
): string | null {
  const startIndex = currentId === null ? -1 : rows.findIndex((row) => row.id === currentId);

  for (let step = 1; step <= rows.length; step += 1) {
    const row = rows[(startIndex + step + rows.length) % rows.length];

    if (row !== undefined && !row.isReviewed && row.id !== currentId) {
      return row.id;
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

/** Cổng thật dựng đúng một lần cho suốt đời component. */
function useResolvedGateway(
  injected: DimensionOcrReviewGateway | undefined,
): DimensionOcrReviewGateway {
  const fallbackRef = useRef<DimensionOcrReviewGateway | null>(null);

  if (injected !== undefined) {
    return injected;
  }

  fallbackRef.current ??= createDimensionOcrReviewGateway();

  return fallbackRef.current;
}

export function useDimensionOcrReview(
  options: UseDimensionOcrReviewOptions,
): DimensionOcrReviewModel {
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
  /* Trạng thái của riêng giao diện.                                         */
  /* ---------------------------------------------------------------------- */

  /**
   * Bộ lọc người dùng đã chọn.
   *
   * `null` nghĩa là chưa ai đụng tới, và lúc đó câu trả lời là chính đặc tả:
   * trạng thái một phần mở màn với những mục dưới ngưỡng ĐÃ LỌC SẴN. Một
   * `useState('all')` đơn giản không làm được điều đó vì lúc dựng hook chưa có
   * dữ liệu để biết có mục nào dưới ngưỡng hay không.
   */
  const [filterChoice, setFilterChoice] = useState<DimensionFilterId | null>(null);
  const [ownCollapsed, setOwnCollapsed] = useState(false);
  const [isKeyboardReviewMode, setKeyboardReviewMode] = useState(false);
  const [selectedDimensionId, setSelectedDimensionId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DimensionDraft | null>(null);

  const isCollapsed = options.forceCollapsed ?? ownCollapsed;

  const onToggleCollapsed = useCallback(() => {
    setOwnCollapsed((previous) => !previous);
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Ba lượt đọc máy chủ, TÁCH BẠCH (R-64).                                   */
  /* ---------------------------------------------------------------------- */

  const backgroundQuery = useQuery({
    queryKey: queryKeys.drawing.byFloor(floorId),
    queryFn: ({ signal }) => gateway.readBackground({ floorId, projectId, signal }),
  });

  const dimensionLayerQuery = useQuery({
    queryKey: queryKeys.space.byFloor(floorId),
    queryFn: ({ signal }) => gateway.readDimensionLayer({ floorId, projectId, signal }),
  });

  /*
   * Tiến độ OCR, khoá RIÊNG.
   *
   * `progress.byFloor` không nằm trong `invalidationMap.editDimension`, nên một
   * lượt duyệt kích thước không xoá mất câu "OCR mới xong một phần bản vẽ".
   */
  const ocrProgressQuery = useQuery({
    queryKey: queryKeys.progress.byFloor(floorId),
    queryFn: ({ signal }) => gateway.readOcrProgress({ floorId, projectId, signal }),
  });

  /* Lần đọc ảnh nền THÀNH CÔNG gần nhất, giữ lại qua mọi lượt hỏng sau đó. */
  const lastBackgroundRef = useRef<DimensionOcrBackground | null>(null);

  if (backgroundQuery.data !== undefined) {
    lastBackgroundRef.current = backgroundQuery.data;
  }

  const background = backgroundQuery.data ?? lastBackgroundRef.current;

  /* ---------------------------------------------------------------------- */
  /* Đồ thị đang sửa — nơi `commit` ghi vào.                                  */
  /* ---------------------------------------------------------------------- */

  const graph = useStore((state) => state.spatial);
  const setSpatial = useStore((state) => state.setSpatial);
  const selectedIds = useStore((state) => state.selectedIds);
  const setSelection = useStore((state) => state.setSelection);

  /* Nạp đồ thị của tầng vào kho một lần, nếu kho còn trống. */
  useEffect(() => {
    if (graph !== null) {
      return;
    }

    const seed = gateway.graph.read();

    if (seed !== null) {
      setSpatial(seed, null);
    }
  }, [gateway, graph, setSpatial]);

  const level = useMemo<Level | null>(() => levelOfGraph(graph), [graph]);
  const hasError = dimensionLayerQuery.isError;
  const isLoading = dimensionLayerQuery.isPending || graph === null;
  const hasPartialOcr = ocrProgressQuery.data?.isComplete === false;

  const dimensions = useMemo<readonly Dimension[]>(
    () => (hasError ? NO_DIMENSIONS : dimensionsOf(graph)),
    [graph, hasError],
  );

  const reviewCounter = useMemo(() => reviewCounterOf(dimensions), [dimensions]);
  const lowConfidenceDimensions = useMemo(
    () => lowConfidenceDimensionsOf(dimensions),
    [dimensions],
  );
  const activeFilter: DimensionFilterId =
    filterChoice ?? (lowConfidenceDimensions.length > 0 ? 'lowConfidence' : 'all');

  /* ---------------------------------------------------------------------- */
  /* Cổng ghi — `dispatch` chạy qua `commit`, hoàn tác 100 bước của S-06.     */
  /* ---------------------------------------------------------------------- */

  const storePort = useMemo<DimensionOcrGraphPort>(
    () => ({ read: () => useStore.getState().spatial }),
    [],
  );

  const selectionSnapshotRef = useRef<readonly EntityId[]>(selectedIds);
  selectionSnapshotRef.current = selectedIds;
  const selectionBeforeRef = useRef<readonly EntityId[]>(selectedIds);

  /**
   * Lượt ghi đang chờ gửi đi — bước `sync` của `dispatch` đặt nó.
   *
   * Khác màn S-13: ở đây bước `sync` KHÔNG gửi ngay, nó chỉ đánh dấu bẩn. A7
   * nói hệ thống lưu 800 ms sau thao tác cuối, nên lượt gửi thật do bộ đếm của
   * `useAutosave` châm ngòi.
   */
  const pendingWriteRef = useRef<DimensionWriteVariables | null>(null);
  const persistRef = useRef<(variables: DimensionWriteVariables) => Promise<void>>(() =>
    Promise.resolve(),
  );

  const dispatchBundle = useMemo<DimensionOcrDispatchDeps>(
    () =>
      createDimensionOcrDispatchDeps({
        graph: storePort,
        selectionBefore: () => ({ selectedIds: selectionBeforeRef.current }),
        selectionAfter: () => ({ selectedIds: selectionSnapshotRef.current }),
        onSynced: () => undefined,
      }),
    [storePort],
  );

  /* ---------------------------------------------------------------------- */
  /* Khung nhìn — R-07 bay tới chuỗi được chọn.                               */
  /* ---------------------------------------------------------------------- */

  const { flyToBounds } = useCanvasViewport();

  /* ---------------------------------------------------------------------- */
  /* Hoàn tác — ngăn xếp 100 bước của S-06, KHÔNG phải zundo.                 */
  /* ---------------------------------------------------------------------- */

  const invalidate = useCallback(() => {
    applyInvalidation(queryClient, 'editDimension', { floorId, projectId });
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
    invalidate();
  }, [canEdit, dispatchBundle, invalidate, setSelection]);

  const onUndo = useCallback(() => {
    applyUndo();
  }, [applyUndo]);

  /* ---------------------------------------------------------------------- */
  /* D-04 — lượt ghi lạc quan, xếp hàng theo từng chuỗi kích thước.           */
  /* ---------------------------------------------------------------------- */

  /*
   * `applyOptimistic` để trống có chủ đích: thay đổi ĐÃ được áp vào kho bởi
   * `dispatch` ngay khi người duyệt bấm, và đó chính là "lạc quan" theo nghĩa
   * của D-04. Việc còn lại của mutation là chụp ảnh cache, gỡ ra khi lượt gửi
   * hỏng (`rollback` chạy trên ngăn xếp hoàn tác của S-06) và dọn khoá đã cũ.
   */
  const persistMutation = useMutation(
    createDimensionOcrMutation(queryClient, {
      gateway,
      applyOptimistic: () => undefined,
      rollback: () => {
        applyUndo();
      },
      affectedKeys: (variables) => [queryKeys.space.byFloor(variables.floorId)],
      afterSuccess: (variables) => {
        applyInvalidation(queryClient, 'editDimension', {
          floorId: variables.floorId,
          projectId: variables.projectId,
        });
      },
    }),
  );

  persistRef.current = async (variables) => {
    await persistMutation.mutateAsync(variables);
  };

  /* ---------------------------------------------------------------------- */
  /* Tự lưu (D-07, A7) — 800 ms sau thao tác cuối, nói ra cho trình đọc.      */
  /* ---------------------------------------------------------------------- */

  /*
   * MỘT bộ đếm, không hai. `createAutosave` ở đây chỉ đóng vai MÁY TRẠNG THÁI
   * (`dirty → saving → saved/failed/offline`) mà `useSaveIndicator` đọc để nói
   * ra cho trình đọc màn hình; bộ đếm 800 ms là của `useAutosave`, và nó gọi
   * `saveNow()` — đường đi bỏ qua debounce của `createAutosave`, nên hai cơ chế
   * không bao giờ cùng chạy đồng hồ (cảnh báo ở `useAccountPreferences.ts`).
   */
  const autosave = useMemo<Autosave>(
    () =>
      createAutosave<DimensionWriteVariables>({
        getChanges: () => pendingWriteRef.current ?? undefined,
        save: async (variables) => {
          pendingWriteRef.current = null;
          await persistRef.current(variables);
        },
      }),
    [],
  );

  useSaveIndicator(autosave);

  const onAutosave = useCallback(async () => {
    await autosave.saveNow();
  }, [autosave]);

  useAutosave(onAutosave);

  /* ---------------------------------------------------------------------- */
  /* Lệnh — mọi hàm sửa đi qua đây, và tắt hẳn ở vai Người xem.               */
  /* ---------------------------------------------------------------------- */

  const dimensionById = useCallback(
    (displayId: string): Dimension | null => {
      const entityId = dimensionEntityIdOf(displayId);

      return dimensions.find((dimension) => dimension.id === entityId) ?? null;
    },
    [dimensions],
  );

  /**
   * Chạy một khối lệnh như MỘT bước hoàn tác, rồi đẩy toast hoàn tác của A8.
   *
   * Khối chứ không phải lệnh đơn: "gõ số rồi Enter" phát hai lệnh và người
   * duyệt chờ đợi đúng một lần `Ctrl+Z` đưa cả hai về.
   */
  const runBlock = useCallback(
    async (displayId: string, commands: readonly Command[], label: string): Promise<void> => {
      if (!canEdit || commands.length === 0) {
        return;
      }

      pendingWriteRef.current = { dimensionId: displayId, projectId, floorId };

      const result = await runDimensionTransaction(commands, dispatchBundle, label);

      if (!result.ok) {
        return;
      }

      invalidate();

      /*
       * A8: mọi thay đổi hoàn tác được, KÈM TOAST hoàn tác. Cửa sổ tám giây do
       * chính vé mang (`UNDO_WINDOW_MS`), nên không thời lượng nào phải truyền.
       * KHÔNG bọc `Toast.Provider` ở đây — bus là một, và bọc thêm một lớp nữa
       * sẽ cho hai toast cho cùng một lượt sửa.
       */
      notifications.publish({
        type: EDIT_NOTIFICATION_TYPE,
        title: label,
        description: '',
        undoTicket: createDimensionUndoTicket({
          description: label,
          now: gateway.now,
          undo: applyUndo,
        }),
      });
    },
    [applyUndo, canEdit, dispatchBundle, floorId, gateway, invalidate, notifications, projectId],
  );

  /** Số người duyệt vừa gõ vào một hàng — chưa thành lệnh, nhưng đối chiếu chạy lại NGAY. */
  const onEdit = useCallback(
    (dimensionId: string, valueMm: number) => {
      if (!canEdit) {
        return;
      }

      setSelectedDimensionId(dimensionId);
      setDraft({ dimensionId, valueMm });
    },
    [canEdit],
  );

  const onCancelEdit = useCallback(() => {
    setDraft(null);
  }, []);

  /**
   * Lưu số đang gõ (nếu có) và duyệt chuỗi, rồi sang chuỗi chưa duyệt kế tiếp.
   *
   * Hai lệnh đi trong MỘT giao dịch, nên một lần hoàn tác trả lại cả giá trị cũ
   * lẫn cờ duyệt cũ.
   */
  const approveDimension = useCallback(
    (displayId: string) => {
      const dimension = dimensionById(displayId);

      if (dimension === null || !canEdit) {
        return;
      }

      const pendingValue =
        draft !== null && draft.dimensionId === displayId ? draft.valueMm : null;
      const commands: Command[] = [];
      let staged: Dimension = dimension;

      if (pendingValue !== null && pendingValue !== readValueOf(dimension)) {
        commands.push(buildOverrideDimensionCommand(dimension, pendingValue, gateway.actorId));
        staged = { ...dimension, overrideValueMm: pendingValue };
      }

      if (!dimension.reviewed) {
        commands.push(buildApproveDimensionCommand(staged, gateway.actorId));
      }

      if (commands.length === 0) {
        return;
      }

      const label = commands[commands.length - 1]?.description ?? '';

      setDraft(null);
      setSelectedDimensionId(nextUnreviewedId(orderedRowsRef.current, displayId));

      void runBlock(displayId, commands, label);
    },
    [canEdit, dimensionById, draft, gateway, runBlock],
  );

  const onApprove = useCallback(
    (dimensionId: string) => {
      approveDimension(dimensionId);
    },
    [approveDimension],
  );

  /* ---------------------------------------------------------------------- */
  /* Chọn hàng — R-07 bay khung nhìn tới chuỗi được chọn.                     */
  /* ---------------------------------------------------------------------- */

  const scale = useMemo(() => scaleOfLevel(level), [level]);
  const drawingSize = useMemo(
    () => drawingSizePxOf(background ?? null, level),
    [background, level],
  );

  const onSelect = useCallback(
    (dimensionId: string | null) => {
      selectionBeforeRef.current = selectionSnapshotRef.current;
      setDraft(null);
      setSelectedDimensionId(dimensionId);

      if (dimensionId === null) {
        setSelection([]);

        return;
      }

      const dimension = dimensionById(dimensionId);

      if (dimension === null) {
        return;
      }

      setSelection([dimension.id]);

      if (drawingSize === null) {
        return;
      }

      const chain = toDimensionChain(dimension, scale, true);

      flyToBounds(toContentBounds(chain.boundsPx), drawingSize.width, drawingSize.height);
    },
    [dimensionById, drawingSize, flyToBounds, scale, setSelection],
  );

  const onFilterChange = useCallback((filter: DimensionFilterId) => {
    setFilterChoice(filter);
  }, []);

  const onToggleKeyboardMode = useCallback(() => {
    setKeyboardReviewMode((previous) => !previous);
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Ghép view model — mọi con số đã thành chuỗi trước khi rời khỏi đây (A15).*/
  /* ---------------------------------------------------------------------- */

  const imageUrl = background?.imageUrl ?? '';

  const draftOverrides = useMemo<ReadonlyMap<string, number>>(
    () =>
      draft === null
        ? NO_OVERRIDES
        : new Map([[dimensionEntityIdOf(draft.dimensionId), draft.valueMm]]),
    [draft],
  );

  /* QĐ-4: một lượt `splitOutliers` cho cả tập, không phải một lượt cho mỗi hàng. */
  const implausibleIds = useMemo(
    () => implausibleDimensionIds(dimensions, draftOverrides),
    [dimensions, draftOverrides],
  );

  const orderedRows = useMemo<readonly DimensionOcrRowModel[]>(
    () =>
      dimensions.map((dimension) => {
        const displayId = dimension.id;
        const draftValue =
          draft !== null && dimensionEntityIdOf(draft.dimensionId) === displayId
            ? draft.valueMm
            : undefined;
        const row = toDimensionRow(
          dimension,
          hostWallOf(graph, dimension),
          scale,
          imageUrl,
          draftValue,
        );

        return {
          ...row,
          outlierMessage: implausibleIds.has(displayId)
            ? implausibleValueHint(row.valueMm)
            : null,
          onEdit,
          onApprove,
          onCancelEdit,
        };
      }),
    [
      dimensions,
      draft,
      graph,
      imageUrl,
      implausibleIds,
      onApprove,
      onCancelEdit,
      onEdit,
      scale,
    ],
  );

  /* `approveDimension` cần danh sách đầy đủ để tìm chuỗi kế tiếp, không phải danh sách đã lọc. */
  const orderedRowsRef = useRef<readonly DimensionOcrRowModel[]>(orderedRows);
  orderedRowsRef.current = orderedRows;

  const rows = useMemo(
    () => applyDimensionFilters(orderedRows, activeFilter),
    [activeFilter, orderedRows],
  );

  const chains = useMemo(
    () =>
      dimensions.map((dimension) =>
        toDimensionChain(
          dimension,
          scale,
          selectedDimensionId !== null &&
            dimensionEntityIdOf(selectedDimensionId) === dimension.id,
        ),
      ),
    [dimensions, scale, selectedDimensionId],
  );

  const selectedDimension =
    selectedDimensionId === null ? null : dimensionById(selectedDimensionId);
  const selectedReadValue =
    selectedDimension === null
      ? null
      : draft !== null && draft.dimensionId === selectedDimensionId
        ? draft.valueMm
        : readValueOf(selectedDimension);

  /*
   * QĐ-2 — lượt chạy số 260 ms.
   *
   * `useCountUp` chạy trên slot `standard` (260 ms) và tự cắt về giá trị đích
   * khi người dùng đặt "giảm chuyển động", nên màn không viết một con số thời
   * lượng nào (R-71). Gọi vô điều kiện với đích `0` khi chưa chọn gì: thứ tự
   * hook không được đổi giữa hai lượt render.
   */
  const targetDeviation =
    selectedDimension === null || selectedReadValue === null
      ? 0
      : deviationOf(selectedDimension, selectedReadValue).relativeDeviation;
  const deviationRun = useCountUp(targetDeviation);

  const compare = useMemo<DimensionOcrCompareModel | null>(() => {
    if (selectedDimension === null || selectedReadValue === null) {
      return null;
    }

    return {
      ...toCompareViewModel(
        selectedDimension,
        selectedReadValue,
        formatDeviation(deviationRun.value),
      ),
      deviationPercentValue: targetDeviation,
      formatDeviation,
    };
  }, [deviationRun.value, selectedDimension, selectedReadValue, targetDeviation]);

  const selectedRow =
    orderedRows.find((row) => row.id === selectedDimensionId) ?? null;

  /* ---------------------------------------------------------------------- */
  /* Bàn phím — qua sổ phím, KHÔNG addEventListener (A12, R-54).             */
  /* ---------------------------------------------------------------------- */

  const shortcutOptions = useMemo(
    () => (options.registry === undefined ? {} : { registry: options.registry }),
    [options.registry],
  );

  const selectedIdRef = useRef(selectedDimensionId);
  selectedIdRef.current = selectedDimensionId;
  const approveRef = useRef(approveDimension);
  approveRef.current = approveDimension;
  const draftRef = useRef(draft);
  draftRef.current = draft;

  /*
   * Enter — lưu số đang gõ, duyệt chuỗi, nhảy sang chuỗi chưa duyệt kế tiếp.
   *
   * Đây là phím thứ HAI của "đúng hai lần gõ phím": phím thứ nhất là con số
   * người duyệt gõ vào ô nhập (một lượt `onEdit`). Không có bước xác nhận nào.
   */
  useShortcut(
    {
      id: 'dimensionOcrReview.saveAndNext',
      combo: 'Enter',
      scope: 'canvas',
      description: DIMENSION_OCR_TEXT.keyboard.keys.enter.description,
      onTrigger: () => {
        const current = selectedIdRef.current;

        if (current !== null) {
          approveRef.current(current);
        }
      },
    },
    { ...shortcutOptions, enabled: canEdit && selectedDimensionId !== null },
  );

  /*
   * A12 — Esc bỏ sửa, rồi mới đóng lớp trên cùng.
   *
   * Lớp trên cùng của màn này là dải đối chiếu của chuỗi đang chọn, và nó mở
   * đúng khi có chuỗi được chọn. `enabled` tắt đăng ký khi không có gì để đóng,
   * nên lúc đó phím rơi xuống handler `global` của `shortcutRegistry` — lời hứa
   * A12 không bị màn này lấy mất trong bất kỳ trạng thái nào.
   */
  useShortcut(
    {
      id: 'dimensionOcrReview.closeTopLayer',
      combo: 'Escape',
      scope: 'canvas',
      description: DIMENSION_OCR_TEXT.keyboard.keys.esc.description,
      onTrigger: () => {
        if (draftRef.current !== null) {
          setDraft(null);

          return;
        }

        onSelect(null);
      },
    },
    { ...shortcutOptions, enabled: selectedDimensionId !== null },
  );

  useShortcut(
    {
      id: 'dimensionOcrReview.keyboardMode',
      combo: 'R',
      scope: 'canvas',
      description: DIMENSION_OCR_TEXT.keyboard.keys.r.description,
      onTrigger: onToggleKeyboardMode,
    },
    { ...shortcutOptions, enabled: canEdit },
  );

  /* ---------------------------------------------------------------------- */
  /* Kết quả.                                                                */
  /* ---------------------------------------------------------------------- */

  const state = deriveScreenState({
    isViewerRole,
    isCollapsed,
    hasError,
    isLoading,
    hasPartialOcr,
    counter: reviewCounter,
  });

  const keyboardReview: DimensionOcrKeyboardReviewModel = {
    isActive: isKeyboardReviewMode,
    row: selectedRow,
    outlierMessage: selectedRow?.outlierMessage ?? null,
    onEdit,
    onApprove,
    onCancelEdit,
    onToggle: onToggleKeyboardMode,
  };

  return {
    state,
    rows,
    chains,
    reviewCounter,
    reviewProgressLabel: dimensionProgressLabel(reviewCounter),
    activeFilter,
    selectedDimensionId,
    compare,
    isKeyboardReviewMode,
    backgroundImageUrl: background?.imageUrl ?? null,
    backgroundImageAlt: background?.imageAlt ?? '',
    millimetresPerPixel: millimetresPerPixelOf(level),
    isCompact: isCollapsed,
    isCollapsed,
    isViewerRole,
    viewerRoleNotice: isViewerRole ? DIMENSION_OCR_TEXT.states.forbidden.description : null,
    emptyNotice:
      reviewCounter.total === 0 && !isLoading && !hasError
        ? DIMENSION_OCR_TEXT.states.empty.description
        : null,
    errorMessage: hasError ? DIMENSION_OCR_TEXT.states.error.description : null,

    onEdit,
    onApprove,
    onCancelEdit,

    onSelect,

    onFilterChange,
    onToggleKeyboardMode,
    onUndo,
    onToggleCollapsed,

    keyboardReview,
  };
}
