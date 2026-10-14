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
 * ## Tự lưu thật (BUG-577)
 *
 * Kích thước đi qua bộ lưu lớp chung như tường/đối tượng: `useFloorLayerAutosave`
 * gửi PUT #35 với `body.dimensions` (thay cả danh sách), 409 → dải "Tải lại",
 * `beforeunload` do chính bộ lưu giữ. Nhãn "Đã lưu lúc…" / "Chưa lưu" / lỗi lấy từ
 * `useSaveIndicator` nên chỉ nói "đã lưu" khi máy chủ đã nhận.
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
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { displayCodesOf } from '@/domain/spatial/ids';
import type { Dimension, Level } from '@/domain/spatial/types';
import { useCanvasViewport } from '@/hooks/useCanvasViewport';
import { useCountUp } from '@/hooks/useCountUp';
import { useFloorLayerAutosave, type FloorLayerSaveBlock } from '@/hooks/useAutosave';
import { useFloorLayer } from '@/hooks/useFloorLayer';
import { useSaveIndicator } from '@/hooks/useSaveIndicator';
import { useZoomCluster } from '@/hooks/useZoomCluster';
import { appNotificationBus } from '@/hooks/useNotifications';
import { useProjectConfidenceThreshold } from '@/hooks/useProjectConfidenceThreshold';
import { useShortcut } from '@/hooks/useShortcut';
import { can } from '@/lib/auth/permissions';
import { readWireError } from '@/lib/errors/wireError';
import { newestEntryId, undoIfNewest } from '@/lib/commands/history';
import type { Command } from '@/lib/commands/types';
import type { ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import type { NotificationBus } from '@/lib/mutations/notificationBus';
import { applyInvalidation } from '@/lib/query/invalidation';
import { queryKeys } from '@/lib/query/queryKeys';
import { useStore } from '@/store';
import { currentSelection } from '@/store/commit';
import type { ProjectRole } from '@/types/project';

import {
  buildApproveDimensionCommand,
  buildOverrideDimensionCommand,
  createDimensionOcrDispatchDeps,
  createDimensionOcrReviewGateway,
  createDimensionUndoTicket,
  deviationOf,
  dimensionProgressLabel,
  dimensionsOf,
  wallsOfGraph,
  drawingSizePxOf,
  type DimensionDrawingSizePx,
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
} from './dimensionOcrReviewGateway';
import { DIMENSION_OCR_TEXT } from './dimensionOcrText';
import { useFloorLayerReadFailure, type FloorLayerReadFailure } from '../shared/floorLayerReadFailure';
import type {
  DimensionCanvasZoom,
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
  /** Lối ra của màn "không mở được tầng này" (G09). */
  readonly onNavigate?: (path: string) => void;
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
  /** Nhãn trạng thái lưu thật (BUG-577): "Đã lưu lúc…", "Chưa lưu", lỗi. `null` ở vai chỉ xem. */
  readonly saveLabel: string | null;
  readonly saveState: 'saved' | 'dirty' | 'saving' | 'failed' | 'offline' | null;
  /** Khối lưu (409 → "Tải lại", 403, 422…) — cùng dải với bốn màn QC khác. */
  readonly saveBlock: FloorLayerSaveBlock | null;
  readonly rows: readonly DimensionOcrRowModel[];
  readonly compare: DimensionOcrCompareModel | null;
  readonly keyboardReview: DimensionOcrKeyboardReviewModel;
  /** Lượt đọc N16 hỏng khi chưa có tài liệu — cả màn thay bằng một lối ra (G09, BUG-326). */
  readonly readFailure: FloorLayerReadFailure | null;
  /** Khổ bản vẽ (px) — `viewBox` của lớp chuỗi (G13). */
  readonly drawingSizePx: DimensionDrawingSizePx | null;
  /** Cụm thu phóng nối vào lớp bản vẽ (G07). */
  readonly canvasZoom: DimensionCanvasZoom;
}

/* -------------------------------------------------------------------------- */
/* Hằng của riêng hook.                                                        */
/* -------------------------------------------------------------------------- */

/** Loại thông báo của một lượt sửa — viết đúng một chỗ (R-71). */
const EDIT_NOTIFICATION_TYPE = 'dimensionOcrReview.editDimension';
const DIMENSION_UNDO_REFUSED_TYPE = 'dimensionOcrReview.undoRefused';

const NO_DIMENSIONS: readonly Dimension[] = [];
/** Mức thu phóng phần trăm ứng với `scale(1)`. */
const FULL_ZOOM_PERCENT = 100;
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
  if (input.isViewerRole && !input.isLoading) {
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
  const [draft, setDraftState] = useState<DimensionDraft | null>(null);
  /*
   * Bản nháp đọc ĐỒNG BỘ (BUG-580): Enter làm ô nhập mất tiêu điểm — `NumericField`
   * chốt số qua `onEdit` — rồi gọi duyệt NGAY trong cùng lượt xử lý sự kiện, trước
   * khi React kịp render lại. Đọc `draft` của closure lúc đó là đọc số cũ.
   */
  const draftRef = useRef<DimensionDraft | null>(null);
  const setDraft = useCallback((next: DimensionDraft | null) => {
    draftRef.current = next;
    setDraftState(next);
  }, []);

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

  /* N16 của tầng URL — `useFloorLayer` quyết định nó vào kho thế nào (G08, như SCR-16/17). */
  const floorLayer = useFloorLayer({ floorId, projectId, read: gateway.readLayer });
  const failure = useFloorLayerReadFailure(floorLayer, projectId, options.onNavigate);
  /* Chỉ 404 (tầng/dự án không còn) thay cả màn; lỗi khác giữ canvas + "Thử lại" (A11). */
  const readFailure = readWireError(floorLayer.error)?.status === 404 ? failure : null;

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
  const setSelection = useStore((state) => state.setSelection);

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

  const level = useMemo<Level | null>(() => levelOfGraph(graph, floorId), [floorId, graph]);
  const hasError = floorLayer.error !== null;

  // Lượt đọc duy nhất làm nên trạng thái lỗi — khuôn `useAxisGridManager` (B-V6-45).
  const onRetry = floorLayer.refetch;
  const isLoading = floorLayer.isPending || graph === null;
  const hasPartialOcr = ocrProgressQuery.data?.isComplete === false;

  const dimensions = useMemo<readonly Dimension[]>(
    () => (hasError ? NO_DIMENSIONS : dimensionsOf(graph, level)),
    [graph, hasError, level],
  );

  /* Mã hiển thị tính trên cả tầng — hàng và khoá tra cứu luôn là mã thực thể. */
  const displayCodes = useMemo<ReadonlyMap<string, string>>(
    () =>
      new Map([
        ...displayCodesOf(dimensions.map((dimension) => dimension.id)),
        ...displayCodesOf(
          wallsOfGraph(graph)
            .filter((wall) => level === null || wall.levelId === level.id)
            .map((wall) => wall.id),
        ),
      ]),
    [dimensions, graph, level],
  );

  const reviewCounter = useMemo(() => reviewCounterOf(dimensions), [dimensions]);
  /* Ngưỡng của dự án, không hằng 0,70 (BUG-354, như FIX-1603). */
  const confidenceThreshold = useProjectConfidenceThreshold(projectId, gateway.readConfidenceThreshold);
  const lowConfidenceDimensions = useMemo(
    () => lowConfidenceDimensionsOf(dimensions, confidenceThreshold),
    [confidenceThreshold, dimensions],
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

  const { autosave, saveBlock } = useFloorLayerAutosave({
    projectId,
    floorId,
    ...(gateway.apiClient === undefined ? {} : { apiClient: gateway.apiClient }),
  });
  const saveIndicator = useSaveIndicator(autosave);

  const dispatchBundle = useMemo<DimensionOcrDispatchDeps>(
    () =>
      createDimensionOcrDispatchDeps({
        graph: storePort,
        selectionBefore: currentSelection,
        selectionAfter: currentSelection,
        onSynced: () => {
          autosave.notifyChange();
        },
      }),
    [autosave, storePort],
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
  /* Lệnh — mọi hàm sửa đi qua đây, và tắt hẳn ở vai Người xem.               */
  /* ---------------------------------------------------------------------- */

  const dimensionById = useCallback(
    (displayId: string): Dimension | null => {
      return dimensions.find((dimension) => dimension.id === displayId) ?? null;
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
      // BUG-579: the toast takes back ITS step only, as SCR-16/17/21 do.
      const entryId = newestEntryId(dispatchBundle.history);
      notifications.publish({
        type: EDIT_NOTIFICATION_TYPE,
        title: label,
        description: '',
        undoTicket: createDimensionUndoTicket({
          description: label,
          now: gateway.now,
          undo: () => {
            const refused = undoIfNewest(dispatchBundle.history, entryId, applyUndo);

            if (refused !== null) {
              notifications.publish({ type: DIMENSION_UNDO_REFUSED_TYPE, title: refused, description: '' });
            }
          },
        }),
      });
    },
    [applyUndo, canEdit, dispatchBundle, gateway, invalidate, notifications],
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
    [canEdit, setDraft],
  );

  const onCancelEdit = useCallback(() => {
    setDraft(null);
  }, [setDraft]);

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

      const pending = draftRef.current;
      const pendingValue =
        pending !== null && pending.dimensionId === displayId ? pending.valueMm : null;
      const commands: Command[] = [];
      let staged: Dimension = dimension;

      if (pendingValue !== null && pendingValue !== readValueOf(dimension)) {
        commands.push(buildOverrideDimensionCommand(dimension, pendingValue, gateway.actorId, displayCodes));
        staged = { ...dimension, overrideValueMm: pendingValue };
      }

      if (!dimension.reviewed) {
        commands.push(buildApproveDimensionCommand(staged, gateway.actorId, displayCodes));
      }

      if (commands.length === 0) {
        return;
      }

      const label = commands[commands.length - 1]?.description ?? '';

      setDraft(null);
      setSelectedDimensionId(nextUnreviewedId(orderedRowsRef.current, displayId));

      void runBlock(displayId, commands, label);
    },
    [canEdit, dimensionById, displayCodes, gateway, runBlock, setDraft],
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

  /* G07: cụm thu phóng có chủ — mức sống ở đây, khung bản vẽ áp `scale`. */
  const zoomCluster = useZoomCluster();
  const canvasZoom = useMemo<DimensionCanvasZoom>(
    () => ({
      percent: zoomCluster.zoomLevel,
      scale: zoomCluster.zoomLevel / FULL_ZOOM_PERCENT,
      onZoomIn: zoomCluster.zoomIn,
      onZoomOut: zoomCluster.zoomOut,
      onReset: zoomCluster.resetZoom,
    }),
    [zoomCluster.resetZoom, zoomCluster.zoomIn, zoomCluster.zoomLevel, zoomCluster.zoomOut],
  );

  const onSelect = useCallback(
    (dimensionId: string | null) => {
      /* BUG-603: bấm lại vào chính hàng (hay ô) đang sửa giữ nguyên bản nháp; chỉ đổi hàng mới bỏ nó. */
      if (draftRef.current?.dimensionId !== dimensionId) {
        setDraft(null);
      }

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
    [dimensionById, drawingSize, flyToBounds, scale, setDraft, setSelection],
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
        : new Map([[draft.dimensionId, draft.valueMm]]),
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
          draft !== null && draft.dimensionId === displayId
            ? draft.valueMm
            : undefined;
        const row = toDimensionRow(
          dimension,
          hostWallOf(graph, dimension),
          scale,
          imageUrl,
          draftValue,
          displayCodes,
          confidenceThreshold,
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
      confidenceThreshold,
      dimensions,
      draft,
      graph,
      imageUrl,
      implausibleIds,
      onApprove,
      onCancelEdit,
      onEdit,
      scale,
      displayCodes,
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
          selectedDimensionId !== null && selectedDimensionId === dimension.id,
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
  const isKeyboardModeRef = useRef(isKeyboardReviewMode);
  isKeyboardModeRef.current = isKeyboardReviewMode;
  const approveRef = useRef(approveDimension);
  approveRef.current = approveDimension;

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
   * Lớp trên cùng là chế độ duyệt bàn phím khi nó bật (ô nhập ở đó nuốt phím R,
   * nên Esc là lối tắt nó — BUG-583), không thì dải đối chiếu của chuỗi đang
   * chọn. `enabled` tắt đăng ký khi không có gì để đóng, nên lúc đó phím rơi
   * xuống handler `global` của `shortcutRegistry` — lời hứa A12 không bị màn
   * này lấy mất trong bất kỳ trạng thái nào.
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

        if (isKeyboardModeRef.current) {
          setKeyboardReviewMode(false);

          return;
        }

        onSelect(null);
      },
    },
    { ...shortcutOptions, enabled: selectedDimensionId !== null || isKeyboardReviewMode },
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

  /* BUG-582: Mod+Z đi vào ngăn xếp của chính màn, như SCR-16/17/19 — không rơi xuống undo toàn cục. */
  useShortcut(
    {
      id: 'dimensionOcrReview.undo',
      combo: 'Mod+Z',
      scope: 'canvas',
      description: DIMENSION_OCR_TEXT.keyboard.keys.undo.description,
      onTrigger: onUndo,
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
    saveLabel: canEdit ? saveIndicator.label : null,
    saveState: canEdit ? saveIndicator.state : null,
    saveBlock,
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
    onRetry,

    keyboardReview,
    readFailure,
    drawingSizePx: drawingSize,
    canvasZoom,
  };
}
