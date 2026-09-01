/**
 * Nửa "suy nghĩ" của màn S-16 "Quản lý tầng" — mọi thứ view của màn cần, đã xong.
 *
 * `floorManagerTypes.ts` là hợp đồng view-model DUY NHẤT của màn và nó ĐÃ ĐÓNG
 * BĂNG; hook này trả về đúng {@link UseFloorManagerResult}, tức toàn bộ
 * `FloorManagerViewProps` cộng ba trường container cần. Mục D: view thuần test
 * được CHỈ từ props, nên không một phép tính nào của màn sống ngoài file này.
 *
 * ## Không công thức tự chế (R-61) — màn không cộng cao độ, không đếm tay
 *
 * - Cao độ khi xếp lại chồng tầng: `createReorderLevelsCommand`. Hàm `restack`
 *   bên trong nó dựng lại CẢ chồng tầng từ `building.datumElevationMm`
 *   (`roomFloorCommands.ts:668-684`), và nó được gọi sẵn trong
 *   `validateReorderLevels` lẫn `createReorderLevelsCommand`. Phát lệnh reorder
 *   = cao độ được tính lại đúng, bởi mã đã có test. **Không một vòng lặp cộng
 *   dồn nào trong màn.**
 * - Đỉnh ngăn xếp: `ceilingElevationMm` (M-11) qua `stackTopMm` của cổng.
 * - Căn tầng: `alignFloors` (M-11). Câu cảnh báo đọc ở `FloorIssue.message` —
 *   không câu nào soạn lại ở đây.
 * - Đếm tường / phòng / diện tích một tầng: `idsOnLevel` + `isEntityOfKind`
 *   (D-12) qua cổng. Không nơi nào duyệt toàn đồ thị.
 * - Tiến độ QC: `groupViolationsByLevel` + `explainHealthScore`
 *   (`src/domain/rules/healthScore.ts`). Không có "đã duyệt / tổng" theo tầng ở
 *   tầng domain (T1 xác nhận NOT FOUND), nên điểm sức khoẻ 0–100 là con số
 *   thật, và tỷ lệ 0..1 chia cho `HEALTH_SCORE_MAX` chứ không cho một hằng thô.
 * - Chặn trùng cao độ: `findElevationConflict` của cổng — nó gọi
 *   `validateChangeLevelElevation` trước và dùng NGUYÊN VĂN câu của hàm đó.
 * - Định dạng số: `formatLength` / `formatArea` / `formatNumber` /
 *   `formatPercent` của `src/lib/format` (P-01, A15). Không `toFixed`, không
 *   `toLocaleString`, không một phép quy đổi đơn vị viết tay nào — mm ↔ m đi
 *   qua `millimetresToMetres` / `metresToMillimetres` của `src/domain/units`.
 *
 * ## Trạng thái máy chủ (R-64)
 *
 * Không `useState` nào giữ cờ đang-tải hay cờ hỏng. Danh sách tầng đi qua
 * `useQuery` dưới khoá `queryKeys.floor.list(projectId)` — đúng khoá
 * `invalidationMap.editFloor` dọn — và mọi lượt ghi gọi
 * `applyInvalidation(queryClient, 'editFloor', …)`, không `invalidateQueries`
 * trần. `useShareLinks.ts` tự khai `isLoading`/`error` bằng tay; đó là ngoại lệ
 * đi trước, KHÔNG phải khuôn mẫu, và không một dòng nào ở đây chép nó.
 *
 * `invalidationMap` chưa có toán tử riêng cho thêm / xoá / sắp xếp tầng (T2 báo
 * NOT FOUND) và R-68 cấm thêm toán tử mới vào `src/lib`. Toán tử tổng quát gần
 * nhất đang có là **`editFloor`**, và nó làm mất hiệu lực đúng hai khoá màn này
 * đọc: `queryKeys.floor.detail(floorId)` và `queryKeys.floor.list(projectId)`
 * (`src/lib/query/invalidation.ts:51-54`). Mọi lượt ghi của màn dùng nó.
 *
 * ## Đường ghi (A10)
 *
 * Không một dòng nào gọi `set()` hay `_applyPatches()`. Mọi thay đổi đi: lệnh
 * dựng bằng nguyên thuỷ công khai → `dispatch` (năm bước) →
 * `SpatialPort.applyPatches` = `commit(patches, label)` → kho → rồi mới ghi lên
 * máy chủ qua `ENDPOINTS.floors.*` / `ENDPOINTS.spatial.floor`. Hoàn tác đi qua
 * `HistoryStack` 100 bước của S-06, KHÔNG phải ngăn xếp zundo của store.
 *
 * ## Đổi chiều cao = MỘT bước lịch sử
 *
 * `createChangeFloorHeightCommands` trả HAI lệnh (đổi chiều cao, rồi xếp chồng
 * lại trên context đã áp bước một) và `runFloorTransaction` chạy chúng như một
 * khối: một `UndoEntry`, một lần `Ctrl+Z`. Xem đầu `floorManagerGateway.ts`.
 *
 * ## Xoá tầng: KHÔNG hộp thoại
 *
 * CẤM TUYỆT ĐỐI. Xoá chạy ngay và phát vé hoàn tác `createUndoTicket`
 * (`UNDO_WINDOW_MS` = 8000 ms — hằng, không phải số gõ tay). A9 không mâu
 * thuẫn: A9 chỉ đòi hộp thoại cho việc A8 KHÔNG hoàn tác được.
 *
 * ## Bàn phím (A12, R-72)
 *
 * Không một `addEventListener('keydown')` nào. `Ctrl/Cmd+Z` đăng ký qua
 * `useShortcut` ở tầng `canvas`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { alignFloors, type FloorAlignmentReport, type FloorIssue } from '@/domain/axes/alignFloors';
import { explainHealthScore, groupViolationsByLevel, HEALTH_SCORE_MAX } from '@/domain/rules/healthScore';
import type { Violation } from '@/domain/rules/registry';
import type { Level, LevelId } from '@/domain/spatial/types';
import {
  metres,
  metresToMillimetres,
  millimetres,
  millimetresToMetres,
  squareMetres,
} from '@/domain/units/types';

import type { Floor } from '@/api/contracts';

import { can } from '@/lib/auth/permissions';
import type { Command } from '@/lib/commands/types';
import type { CommandContext } from '@/lib/commands/business/shared';
import { describeError, toAppError } from '@/lib/errors';
import { formatArea, formatLength } from '@/lib/format/measure';
import { formatNumber, formatPercent, MISSING_VALUE, parseNumber } from '@/lib/format/number';
import { getAppAnnouncer, type Announcer } from '@/lib/input/announcer';
import type { ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import type { NotificationBus } from '@/lib/mutations/notificationBus';
import { applyInvalidation } from '@/lib/query/invalidation';
import { queryKeys } from '@/lib/query/queryKeys';
import type { ApiResult } from '@/api/client';

import { appNotificationBus } from '@/hooks/useNotifications';
import { useCountUp } from '@/hooks/useCountUp';
import { useShortcut } from '@/hooks/useShortcut';
import { selectViolations } from '@/store/selectors';
import { useStore } from '@/store';
import type { ProjectRole } from '@/types/project';

import {
  areaOfLevel,
  createAddFloorCommand,
  createChangeFloorHeightCommands,
  createChangeLevelElevationCommand,
  createDuplicateFloorCommand,
  createFloorManagerDispatchDeps,
  createFloorManagerGateway,
  createFloorUndoTicket,
  createRemoveFloorCommand,
  createRenameFloorCommand,
  createReorderLevelsCommand,
  duplicateFloorToastDescription,
  FLOOR_DUPLICATE_NOTIFICATION_TYPE,
  FLOOR_MANAGER_MISSING_CAPABILITIES,
  FLOOR_MANAGER_UNSUPPORTED_NOTICES,
  FLOOR_PERSIST_FAILED_NOTIFICATION_TYPE,
  FLOOR_REMOVE_NOTIFICATION_TYPE,
  FLOOR_REORDER_NOTIFICATION_TYPE,
  findElevationConflict,
  floorWriteBodyOf,
  floorPlansOf,
  levelsOf,
  REORDER_FLOORS_TOAST_DESCRIPTION,
  roomsOfLevel,
  removeFloorToastDescription,
  runFloorCommand,
  runFloorTransaction,
  stackBottomMm,
  stackTopMm,
  wallCountOfLevel,
  type FloorManagerGateway,
} from './floorManagerGateway';
import type {
  DuplicateElevationViolation,
  ElevationTickVm,
  FloorEditableField,
  FloorManagerScreenState,
  FloorRowDraft,
  FloorRowVm,
  FloorTableFooterVm,
  SectionBandVm,
  UseFloorManagerResult,
} from './floorManagerTypes';

/* -------------------------------------------------------------------------- */
/* Chuỗi cố định của màn — một chỗ duy nhất (A6: thường, kiểu câu).            */
/* -------------------------------------------------------------------------- */

export const FLOOR_MANAGER_TEXT = {
  emptyTitle: 'chưa có tầng nào',
  emptyNotice: 'thêm tầng đầu tiên, hoặc nhập số tầng từ màn hình tạo dự án.',
  forbiddenNotice: 'vai của bạn chỉ xem được ngăn xếp tầng; mọi thao tác sửa đã được ẩn.',
  drawingsMissing: 'chưa có bản vẽ',
  persistFailedTitle: 'chưa lưu được thay đổi tầng',
  shortcutUndo: 'Hoàn tác thay đổi tầng gần nhất',
  uploadDrawingHint:
    'tải bản vẽ lên ở màn hình bản vẽ của tầng này; danh sách tầng chỉ cho biết tầng nào còn thiếu.',
  duplicateSuffix: 'bản sao',
  newFloorPrefix: 'Tầng',
} as const;

/** Đơn vị của cột "Cao độ (m)" và "Chiều cao (m)": một chữ số sau dấu phẩy. */
const METRE_FRACTION_DIGITS = 1;

/** Danh sách rỗng dùng chung, để `useMemo` không sinh mảng mới mỗi lượt vẽ. */
const NO_ROWS: readonly FloorRowVm[] = Object.freeze([]);
const NO_BANDS: readonly SectionBandVm[] = Object.freeze([]);
const NO_TICKS: readonly ElevationTickVm[] = Object.freeze([]);
const NO_VIOLATIONS: readonly Violation[] = Object.freeze([]);
const NO_FLOOR_IDS: readonly string[] = Object.freeze([]);

/* -------------------------------------------------------------------------- */
/* Phép ghép thuần — kiểm được mà không cần dựng hook.                          */
/* -------------------------------------------------------------------------- */

/** Số mét của một số đo milimét, đã định dạng, KHÔNG kèm hậu tố đơn vị. */
export const metreDraftText = (valueMm: number): string =>
  formatNumber(millimetresToMetres(millimetres(valueMm)), {
    fractionDigits: METRE_FRACTION_DIGITS,
  });

/** Số đo milimét viết thành mét cho người đọc, ví dụ `"3,9 m"` (A15). */
export const metreText = (valueMm: number): string =>
  formatLength(valueMm, { unit: 'm', fractionDigits: METRE_FRACTION_DIGITS });

/** Người dùng gõ mét, mô hình giữ milimét. Quy đổi đi qua `src/domain/units`. */
export const draftToMillimetres = (draftValue: string): number | null => {
  const parsed = parseNumber(draftValue);

  return parsed === undefined ? null : metresToMillimetres(metres(parsed));
};

/** Một phép đếm viết thành chữ; `"—"` khi chưa đếm được (`MISSING_VALUE`). */
export const countText = (value: number | null): string =>
  value === null ? MISSING_VALUE : formatNumber(value, { fractionDigits: 0 });

/** Ví dụ `"2 bản vẽ"`, hoặc `"chưa có bản vẽ"` khi tầng chưa có bản vẽ nào. */
export const drawingCountText = (count: number): string =>
  count === 0
    ? FLOOR_MANAGER_TEXT.drawingsMissing
    : `${formatNumber(count, { fractionDigits: 0 })} bản vẽ`;

/** Ví dụ `"4 tầng"`. */
export const floorCountText = (count: number): string =>
  `${formatNumber(count, { fractionDigits: 0 })} tầng`;

/** Nhãn của một dải lát cắt, ví dụ `"Tầng trệt · 3,9 m"` — hook nối, view không nối. */
export const bandLabel = (name: string, heightMm: number): string =>
  `${name} · ${metreText(heightMm)}`;

/**
 * `offsetRatio` ở dạng chuỗi CSS.
 *
 * Dấu thập phân của CSS là dấu CHẤM — đây là chuỗi máy đọc, không phải số người
 * đọc, nên A15 không áp vào nó. Phép nhân 100 xảy ra ở đây, tại viewmodel, chứ
 * không ở view.
 */
export const cssPercentOf = (ratio: number): string => `${String(ratio * 100)}%`;

export interface FloorManagerStateInput {
  readonly isViewerRole: boolean;
  readonly isCollapsed: boolean;
  readonly hasError: boolean;
  readonly isLoading: boolean;
  readonly rowCount: number;
  readonly needsDrawingCount: number;
}

/**
 * Bảy trạng thái của A11 / R-63, suy ra từ dữ liệu — tên lấy nguyên văn từ
 * `SEVEN_STATES` của `src/lib/testing/sevenStateScenarios.ts`.
 *
 * Thứ tự nhánh là thứ tự "cái gì che cái gì" mà `floorManagerTypes.ts` khai:
 * `forbidden` → `collapsed` → `error` → `loading` → `empty` → `partial` →
 * `success`. `loading` tách khỏi `empty` bằng chính cờ đang tải chứ không bằng
 * "không có dòng nào", vì cả hai đều không có dòng nào.
 */
export function deriveFloorManagerScreenState(
  input: FloorManagerStateInput,
): FloorManagerScreenState {
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

  if (input.rowCount === 0) {
    return 'empty';
  }

  return input.needsDrawingCount > 0 ? 'partial' : 'success';
}

/** Vấn đề xếp chồng nặng nhất mà M-11 tìm ra, hoặc `null` khi ngăn xếp lành. */
export function worstStackIssue(report: FloorAlignmentReport): FloorIssue | null {
  let worst: FloorIssue | null = null;

  for (const issue of report.issues) {
    if (issue.kind !== 'overlap' && issue.kind !== 'clearHeight') {
      continue;
    }

    if (worst === null || issue.amountMm > worst.amountMm) {
      worst = issue;
    }
  }

  return worst;
}

/** Bỏ bộ đệm văn bản của một dòng, trả lại bản ghi mới — không đụng bản cũ. */
const withoutDraft = (
  drafts: Readonly<Record<string, FloorRowDraft>>,
  floorId: string,
): Readonly<Record<string, FloorRowDraft>> =>
  Object.fromEntries(Object.entries(drafts).filter(([key]) => key !== floorId));

/** Tên của tầng mới, ví dụ `"Tầng 5"`. Nhãn giao diện, không phải mã. */
export const newFloorName = (index: number): string =>
  `${FLOOR_MANAGER_TEXT.newFloorPrefix} ${formatNumber(index, { fractionDigits: 0, grouping: false })}`;

/** Tên của bản sao, ví dụ `"Tầng 2 (bản sao)"`. */
export const duplicateFloorName = (sourceName: string): string =>
  `${sourceName} (${FLOOR_MANAGER_TEXT.duplicateSuffix})`;

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

export interface UseFloorManagerOptions {
  readonly projectId: string;
  readonly roles?: readonly ProjectRole[];
  /** Cổng tiêm được; vắng mặt thì hook dựng cổng thật ĐÚNG MỘT LẦN. */
  readonly gateway?: FloorManagerGateway;
  readonly registry?: ShortcutRegistry;
  readonly notifications?: NotificationBus;
  readonly announcer?: Announcer;
  /** Story ép trạng thái `collapsed` mà không phải bấm nút. */
  readonly forceCollapsed?: boolean;
  /** Dưới 1.024px lát cắt xuống dưới bảng; lớp 3 đo bề rộng và truyền vào. */
  readonly isCompact?: boolean;
  /**
   * Đưa người dùng tới màn tải bản vẽ của một tầng.
   *
   * Điều hướng là việc của container (`react-router-dom` chỉ được nhập ở vỏ
   * route), nên hook nhận nó từ ngoài. Vắng mặt thì liên kết "tải lên" chọn
   * dòng đó và NÓI RA nơi tải lên, chứ không giả vờ đã làm gì.
   */
  readonly onNavigateToDrawings?: (floorId: string) => void;
}

/** Cổng thật dựng đúng một lần cho suốt đời component. */
function useResolvedGateway(injected: FloorManagerGateway | undefined): FloorManagerGateway {
  const fallbackRef = useRef<FloorManagerGateway | null>(null);

  if (injected !== undefined) {
    return injected;
  }

  fallbackRef.current ??= createFloorManagerGateway();

  return fallbackRef.current;
}

export function useFloorManager(options: UseFloorManagerOptions): UseFloorManagerResult {
  const { projectId } = options;
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

  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [hoveredFloorId, setHoveredFloorId] = useState<string | null>(null);
  const [hiddenFloorIds, setHiddenFloorIds] = useState<readonly string[]>(NO_FLOOR_IDS);
  const [ownCollapsed, setOwnCollapsed] = useState(false);
  const [isAutoElevation, setIsAutoElevation] = useState(false);
  const [drafts, setDrafts] = useState<Readonly<Record<string, FloorRowDraft>>>({});
  const [editing, setEditing] = useState<{
    readonly floorId: string;
    readonly field: FloorEditableField;
  } | null>(null);
  const [duplicateElevation, setDuplicateElevation] = useState<{
    readonly message: string;
    readonly violation: DuplicateElevationViolation;
  } | null>(null);

  const isCollapsed = options.forceCollapsed ?? ownCollapsed;

  /* ---------------------------------------------------------------------- */
  /* Lượt đọc máy chủ (R-64).                                                 */
  /* ---------------------------------------------------------------------- */

  const floorListQuery = useQuery({
    queryKey: queryKeys.floor.list(projectId),
    queryFn: ({ signal }) => gateway.readFloorList({ projectId, signal }),
  });

  const storeGraph = useStore((state) => state.spatial);
  const setSpatial = useStore((state) => state.setSpatial);
  const violations = useStore(selectViolations);

  const loadedGraph = floorListQuery.data?.graph ?? null;

  /* Nạp đồ thị của dự án vào kho một lần, nếu kho còn trống. */
  useEffect(() => {
    if (storeGraph === null && loadedGraph !== null) {
      setSpatial(loadedGraph, null);
    }
  }, [loadedGraph, setSpatial, storeGraph]);

  /*
   * Đọc kho trước, lượt tải sau: giữa lúc `useEffect` trên chưa chạy, view vẫn
   * có dữ liệu để vẽ — đúng cái màn trắng mà A11 tồn tại để chặn.
   */
  const graph = storeGraph ?? loadedGraph;
  const hasError = floorListQuery.isError;
  const isLoading = floorListQuery.isPending || graph === null;

  const levels = useMemo(() => levelsOf(graph), [graph]);

  /** Tầng của máy chủ theo mã. `Floor.drawings` là nơi DUY NHẤT biết số bản vẽ. */
  const floorsById = useMemo(() => {
    const table = new Map<string, Floor>();

    for (const floor of floorListQuery.data?.floors ?? []) {
      table.set(floor.id, floor);
    }

    return table;
  }, [floorListQuery.data]);

  /* ---------------------------------------------------------------------- */
  /* Ngăn xếp — đỉnh và đáy đọc từ M-11, màn không cộng cao độ.               */
  /* ---------------------------------------------------------------------- */

  const topMm = useMemo(() => stackTopMm(graph), [graph]);
  const bottomMm = useMemo(() => stackBottomMm(graph), [graph]);

  /**
   * Bề cao của cả ngăn xếp.
   *
   * Hiệu của hai số ĐÃ có: đỉnh (`ceilingElevationMm` của M-11) trừ đáy (cao độ
   * thấp nhất). Đây là bề cao của KHUNG VẼ, không phải cao độ của một tầng nào
   * — cao độ tầng vẫn chỉ do `restack` trong tầng lệnh quyết định.
   */
  const totalStackHeightMm =
    topMm === null || bottomMm === null ? Number.NaN : topMm - bottomMm;

  /**
   * Số chạy khi ngăn xếp đổi chiều cao.
   *
   * `useCountUp` chạy ở slot `standard` (260 ms) — thang chuyển động chỉ có năm
   * giá trị và 240 ms mà đặc tả ghi không nằm trên thang, nên `COUNT_UP_DURATION`
   * của `src/lib/motion/useCountUp.ts` đã chốt `standard`. `from` bằng chính
   * giá trị hiện tại nên lượt vẽ đầu KHÔNG chạy số; chỉ lần đổi sau mới chạy.
   */
  const totalHeightRun = useCountUp(totalStackHeightMm, {
    from: totalStackHeightMm,
    format: { fractionDigits: METRE_FRACTION_DIGITS },
  });

  /*
   * Đọc `value` chứ không `text`: `text` của `useCountUp` là `formatNumber`
   * trần, còn cột này cần chuỗi CÓ đơn vị mét. `formatLength` là chính hàm
   * `text` gọi bên dưới, nên mọi khung hình vẫn là một con số đúng định dạng.
   */
  const totalHeightText = metreText(totalHeightRun.value);

  /* ---------------------------------------------------------------------- */
  /* Tiến độ QC — điểm sức khoẻ theo tầng (thay cho "P-03" không tồn tại).    */
  /* ---------------------------------------------------------------------- */

  const violationsByLevel = useMemo(() => {
    const table = new Map<string, readonly Violation[]>();

    for (const group of groupViolationsByLevel(violations)) {
      if (group.levelId !== null) {
        table.set(String(group.levelId), group.violations);
      }
    }

    return table;
  }, [violations]);

  /* ---------------------------------------------------------------------- */
  /* Đường ghi.                                                              */
  /* ---------------------------------------------------------------------- */

  const dispatchBundle = useMemo(
    () =>
      createFloorManagerDispatchDeps({
        graph: { read: () => useStore.getState().spatial },
        selectionBefore: () => ({ selectedIds: [] }),
        selectionAfter: () => ({ selectedIds: [] }),
        onSynced: () => {
          /*
           * Bước `sync` chỉ đánh dấu bản vẽ bẩn cho tự lưu (A7). Lượt ghi lên
           * máy chủ chạy ở chính hàm xử lý, sau khi `commit` đã cập nhật đồ thị
           * — xem `persistChangedLevels`.
           */
        },
      }),
    [],
  );

  const invalidate = useCallback(
    (floorId: string) => {
      applyInvalidation(queryClient, 'editFloor', { floorId, projectId });
    },
    [projectId, queryClient],
  );

  /** Nói ra một lượt ghi máy chủ KHÔNG xong — cấm im lặng, cấm bịa một lượt lưu. */
  const reportPersist = useCallback(
    (result: ApiResult<unknown>): void => {
      if (result.ok) {
        return;
      }

      notifications.publish({
        type: FLOOR_PERSIST_FAILED_NOTIFICATION_TYPE,
        title: FLOOR_MANAGER_TEXT.persistFailedTitle,
        description: describeError(toAppError(result.error)).description,
      });
    },
    [notifications],
  );

  /** Ngữ cảnh lệnh đọc đồ thị MỚI NHẤT — không phải bản chụp của lượt vẽ này. */
  const readContext = useCallback((): CommandContext | null => {
    const current = gateway.graph.read();

    return current === null ? null : { graph: current, actorId: gateway.actorId };
  }, [gateway]);

  /**
   * Ghi lên máy chủ những tầng mà lệnh THẬT SỰ đổi.
   *
   * Đọc thẳng ảnh chụp `after` của từng `change` — dữ liệu đã có trong tay, nên
   * không phải đoán tầng nào đã dịch. Trùng mã thì bản sau thắng.
   */
  const persistChangedLevels = useCallback(
    async (commands: readonly Command[]): Promise<void> => {
      const changed = new Map<string, Level>();

      for (const command of commands) {
        for (const change of command.changes) {
          if (change.kind === 'level' && change.after !== null) {
            changed.set(String(change.after.id), change.after);
          }
        }
      }

      for (const level of changed.values()) {
        reportPersist(
          await gateway.persistFloorFields({
            projectId,
            floorId: String(level.id),
            body: floorWriteBodyOf(level),
          }),
        );
      }
    },
    [gateway, projectId, reportPersist],
  );

  /** Chạy một lệnh qua đủ năm bước; `false` khi vai trò không cho sửa hoặc lệnh rỗng. */
  const run = useCallback(
    async (command: Command | null): Promise<boolean> => {
      if (!canEdit || command === null) {
        return false;
      }

      const result = await runFloorCommand(command, dispatchBundle);

      if (result.ok) {
        invalidate(String(command.scope.levelIds[0] ?? projectId));
      }

      return result.ok;
    },
    [canEdit, dispatchBundle, invalidate, projectId],
  );

  /** Chạy NHIỀU lệnh như MỘT bước lịch sử (QĐ-2). */
  const runAll = useCallback(
    async (commands: readonly Command[], label: string): Promise<boolean> => {
      if (!canEdit || commands.length === 0) {
        return false;
      }

      const result = await runFloorTransaction(commands, dispatchBundle, label);

      if (result.ok) {
        invalidate(String(commands[0]?.scope.levelIds[0] ?? projectId));
      }

      return result.ok;
    },
    [canEdit, dispatchBundle, invalidate, projectId],
  );

  const applyUndo = useCallback((): boolean => {
    if (!canEdit) {
      return false;
    }

    const transition = dispatchBundle.history.undo();

    if (transition === null) {
      return false;
    }

    dispatchBundle.deps.spatial.applyPatches(transition.patches);
    invalidate(projectId);

    return true;
  }, [canEdit, dispatchBundle, invalidate, projectId]);

  const onUndo = useCallback(() => {
    applyUndo();
  }, [applyUndo]);

  /**
   * Vé hoàn tác 8 giây + toast (A8). KHÔNG hộp thoại.
   *
   * `UNDO_WINDOW_MS` là mặc định của `createUndoTicket`, nên con số 8000 không
   * xuất hiện ở màn (R-71).
   */
  const publishUndoTicket = useCallback(
    (type: string, description: string) => {
      const ticket = createFloorUndoTicket({
        description,
        now: gateway.now,
        undo: () => {
          applyUndo();
        },
      });

      notifications.publish({ type, title: description, description: '', undoTicket: ticket });
    },
    [applyUndo, gateway, notifications],
  );

  /**
   * Đọc lại báo cáo căn tầng của M-11 sau một lượt xếp chồng, và NÓI RA vấn đề
   * nặng nhất bằng chính câu `FloorIssue.message` của domain.
   */
  const announceStackIssue = useCallback(() => {
    const current = gateway.graph.read();
    const issue = worstStackIssue(alignFloors(floorPlansOf(current)));

    if (issue !== null) {
      announce(issue.message);
    }
  }, [announce, gateway]);

  /* ---------------------------------------------------------------------- */
  /* Chọn, trỏ, thu gọn, công tắc.                                           */
  /* ---------------------------------------------------------------------- */

  const onSelectFloor = useCallback((floorId: string | null) => {
    setSelectedFloorId(floorId);
  }, []);

  const onHoverFloor = useCallback((floorId: string | null) => {
    setHoveredFloorId(floorId);
  }, []);

  const onToggleCollapsed = useCallback(() => {
    setOwnCollapsed((previous) => !previous);
  }, []);

  /**
   * Công tắc "Tự động tính cao độ".
   *
   * KHUNG ĐỌC của màn, không phải thay đổi mô hình — cùng loại với
   * `ghostEnabled` của `AxisGridManager`, nên A8 không đòi hoàn tác nó. Bật thì
   * ô cao độ chỉ đọc và cao độ hiển thị là cao độ mà `restack` đã dồn từ mốc
   * chuẩn; tắt thì người dùng gõ đè được. Màn KHÔNG tự cộng cao độ ở cả hai
   * nhánh: con số vẫn luôn là con số trong mô hình.
   */
  const onToggleAutoElevation = useCallback(() => {
    setIsAutoElevation((previous) => !previous);
  }, []);

  const onToggleHiddenIn3d = useCallback(
    (floorId: string) => {
      setHiddenFloorIds((previous) =>
        previous.includes(floorId)
          ? previous.filter((id) => id !== floorId)
          : [...previous, floorId],
      );

      /*
       * Nói ra sự thật thay vì im lặng: `Level` không có trường nào ghi trạng
       * thái ẩn khỏi 3D, nên lựa chọn này không sống qua một lần tải lại trang.
       * Nhánh `supported: false` của cổng mang nguyên câu giải thích đó.
       */
      void gateway
        .persistHiddenIn3d({ projectId, floorId, isHidden: !hiddenFloorIds.includes(floorId) })
        .then((result) => {
          if (!result.supported) {
            announce(result.notice);
          }
        });
    },
    [announce, gateway, hiddenFloorIds, projectId],
  );

  const onUploadDrawing = useCallback(
    (floorId: string) => {
      setSelectedFloorId(floorId);

      if (options.onNavigateToDrawings === undefined) {
        announce(FLOOR_MANAGER_TEXT.uploadDrawingHint);

        return;
      }

      options.onNavigateToDrawings(floorId);
    },
    [announce, options],
  );

  const onRetry = useCallback(() => {
    void floorListQuery.refetch();
  }, [floorListQuery]);

  /* ---------------------------------------------------------------------- */
  /* Sửa ba ô.                                                               */
  /* ---------------------------------------------------------------------- */

  const draftOf = useCallback(
    (level: Level): FloorRowDraft =>
      drafts[String(level.id)] ?? {
        name: level.name,
        elevation: metreDraftText(level.elevationMm),
        height: metreDraftText(level.heightMm),
      },
    [drafts],
  );

  const onFloorFieldChange = useCallback(
    (floorId: string, field: FloorEditableField, draftValue: string) => {
      setEditing({ floorId, field });
      setDrafts((previous) => {
        const current = previous[floorId] ?? {
          name: '',
          elevation: '',
          height: '',
        };

        return { ...previous, [floorId]: { ...current, [field]: draftValue } };
      });
    },
    [],
  );

  const onFloorFieldCancel = useCallback((floorId: string) => {
    setEditing(null);
    setDuplicateElevation(null);
    setDrafts((previous) => withoutDraft(previous, floorId));
  }, []);

  /**
   * Rời tiêu điểm hoặc Enter — giá trị đã CHỐT.
   *
   * `NumericField` chỉ báo giá trị khi chốt (debounce 800 ms hoặc blur/Enter,
   * `useNumericField.ts:14,86`), nên hook KHÔNG thêm một lớp debounce thứ hai và
   * không có con số 800 nào ở màn (R-71).
   */
  const onFloorFieldCommit = useCallback(
    (floorId: string, field: FloorEditableField) => {
      setEditing(null);

      const context = readContext();
      const draft = drafts[floorId];

      if (context === null || draft === undefined) {
        return;
      }

      const levelId = floorId as LevelId;
      const clearDraft = (): void => {
        setDrafts((previous) => withoutDraft(previous, floorId));
      };

      if (field === 'name') {
        const result = createRenameFloorCommand({ levelId, name: draft.name }, context);

        clearDraft();

        if (result.ok) {
          void run(result.data).then((ok) => {
            if (ok) {
              void persistChangedLevels([result.data]);
            }
          });
        }

        return;
      }

      const valueMm = draftToMillimetres(field === 'elevation' ? draft.elevation : draft.height);

      if (valueMm === null) {
        clearDraft();

        return;
      }

      if (field === 'elevation') {
        const conflict = findElevationConflict({ levelId, elevationMm: valueMm }, context);

        if (conflict !== null) {
          const message = conflict.reasons.join(' ');

          setDuplicateElevation({ message, violation: conflict.violation });
          announce(message);

          return;
        }

        setDuplicateElevation(null);

        const result = createChangeLevelElevationCommand({ levelId, elevationMm: valueMm }, context);

        clearDraft();

        if (result.ok) {
          void run(result.data).then((ok) => {
            if (ok) {
              void persistChangedLevels([result.data]);
              announceStackIssue();
            }
          });
        }

        return;
      }

      const built = createChangeFloorHeightCommands({ levelId, heightMm: valueMm }, context);

      clearDraft();

      if (!built.ok) {
        return;
      }

      const label = built.commands[0]?.description ?? '';

      void runAll(built.commands, label).then((ok) => {
        if (ok) {
          void persistChangedLevels(built.commands);
          announceStackIssue();
        }
      });
    },
    [announce, announceStackIssue, drafts, persistChangedLevels, readContext, run, runAll],
  );

  /* ---------------------------------------------------------------------- */
  /* Thêm, nhân bản, xoá, đổi thứ tự.                                        */
  /* ---------------------------------------------------------------------- */

  const onAddFloor = useCallback(() => {
    const context = readContext();

    if (context === null) {
      return;
    }

    const result = createAddFloorCommand(
      { id: gateway.nextLevelId(), name: newFloorName(levelsOf(context.graph).length + 1) },
      context,
    );

    if (!result.ok) {
      return;
    }

    void run(result.data).then(async (ok) => {
      if (!ok) {
        return;
      }

      const added = result.data.changes.find(
        (change) => change.kind === 'level' && change.after !== null,
      );

      if (added?.kind === 'level' && added.after !== null) {
        reportPersist(await gateway.persistAddFloor({ projectId, level: added.after }));
      }
    });
  }, [gateway, projectId, readContext, reportPersist, run]);

  const onDuplicateFloor = useCallback(
    (floorId: string, duplicateOptions: { readonly copyFurniture: boolean }) => {
      const context = readContext();

      if (context === null) {
        return;
      }

      const source = levelsOf(context.graph).find((level) => String(level.id) === floorId);

      if (source === undefined) {
        return;
      }

      const result = createDuplicateFloorCommand(
        {
          sourceLevelId: source.id,
          targetLevelId: gateway.nextLevelId(),
          name: duplicateFloorName(source.name),
          copyFurniture: duplicateOptions.copyFurniture,
        },
        context,
      );

      if (!result.ok) {
        return;
      }

      void run(result.data).then(async (ok) => {
        if (!ok) {
          return;
        }

        publishUndoTicket(
          FLOOR_DUPLICATE_NOTIFICATION_TYPE,
          duplicateFloorToastDescription(source.name),
        );

        const added = result.data.changes.find(
          (change) => change.kind === 'level' && change.after !== null,
        );

        if (added?.kind === 'level' && added.after !== null) {
          reportPersist(await gateway.persistAddFloor({ projectId, level: added.after }));
        }

        /* Nội dung sao chép được KHÔNG có chỗ ghi trên máy chủ — nói ra, đừng im. */
        const contents = await gateway.persistFloorContents({
          projectId,
          floorId: String(result.data.scope.levelIds[0] ?? floorId),
        });

        if (!contents.supported) {
          announce(contents.notice);
        }
      });
    },
    [announce, gateway, projectId, publishUndoTicket, readContext, reportPersist, run],
  );

  const onRemoveFloor = useCallback(
    (floorId: string) => {
      const context = readContext();

      if (context === null) {
        return;
      }

      const level = levelsOf(context.graph).find((entry) => String(entry.id) === floorId);

      if (level === undefined) {
        return;
      }

      const result = createRemoveFloorCommand({ levelId: level.id }, context);

      if (!result.ok) {
        return;
      }

      void run(result.data).then(async (ok) => {
        if (!ok) {
          return;
        }

        if (selectedFloorId === floorId) {
          setSelectedFloorId(null);
        }

        publishUndoTicket(FLOOR_REMOVE_NOTIFICATION_TYPE, removeFloorToastDescription(level.name));
        reportPersist(await gateway.persistRemoveFloor({ projectId, floorId }));
      });
    },
    [gateway, projectId, publishUndoTicket, readContext, reportPersist, run, selectedFloorId],
  );

  const onReorderFloors = useCallback(
    (floorIdsBottomUp: readonly string[]) => {
      const context = readContext();

      if (context === null) {
        return;
      }

      const result = createReorderLevelsCommand(
        { levelIds: floorIdsBottomUp.map((id) => id as LevelId) },
        context,
      );

      if (!result.ok) {
        return;
      }

      void run(result.data).then(async (ok) => {
        if (!ok) {
          return;
        }

        publishUndoTicket(FLOOR_REORDER_NOTIFICATION_TYPE, REORDER_FLOORS_TOAST_DESCRIPTION);
        announceStackIssue();

        reportPersist(
          await gateway.persistReorderFloors({ projectId, floorIds: floorIdsBottomUp }),
        );
        await persistChangedLevels([result.data]);
      });
    },
    [
      announceStackIssue,
      gateway,
      persistChangedLevels,
      projectId,
      publishUndoTicket,
      readContext,
      reportPersist,
      run,
    ],
  );

  /* ---------------------------------------------------------------------- */
  /* Phím tắt (A12) — không một `addEventListener` nào (R-72).                */
  /* ---------------------------------------------------------------------- */

  const shortcutOptions = useMemo(
    () => (options.registry === undefined ? {} : { registry: options.registry }),
    [options.registry],
  );

  useShortcut(
    {
      id: 'floorManager.undo',
      combo: 'Mod+Z',
      scope: 'canvas',
      description: FLOOR_MANAGER_TEXT.shortcutUndo,
      onTrigger: onUndo,
    },
    { ...shortcutOptions, enabled: canEdit },
  );

  /* ---------------------------------------------------------------------- */
  /* View-model — ĐỊNH DẠNG SỐ XẢY RA Ở ĐÂY, không ở view (A15).              */
  /* ---------------------------------------------------------------------- */

  /**
   * Đếm tường / phòng / diện tích của từng tầng, đọc qua `idsOnLevel` (D-12).
   *
   * Một tầng CHƯA có bản vẽ thì chưa đếm được gì — bảng hiện `"—"`
   * (`MISSING_VALUE`), không hiện `0`, vì `0` là một phép đếm đã chạy xong.
   */
  const countsByLevel = useMemo(() => {
    const table = new Map<
      string,
      { readonly wallCount: number; readonly roomCount: number; readonly areaM2: number }
    >();

    for (const level of levels) {
      const id = String(level.id);
      const drawingCount = floorsById.get(id)?.drawings.length ?? 0;

      if (drawingCount === 0) {
        continue;
      }

      table.set(id, {
        wallCount: wallCountOfLevel(graph, level.id),
        roomCount: roomsOfLevel(graph, level.id).length,
        areaM2: areaOfLevel(graph, level.id),
      });
    }

    return table;
  }, [floorsById, graph, levels]);

  const rows = useMemo<readonly FloorRowVm[]>(() => {
    if (hasError) {
      return NO_ROWS;
    }

    return levels.map((level) => {
      const id = String(level.id);
      const drawingCount = floorsById.get(id)?.drawings.length ?? 0;
      const hasDrawing = drawingCount > 0;
      const counts = countsByLevel.get(id) ?? null;
      const health = explainHealthScore(violationsByLevel.get(id) ?? NO_VIOLATIONS);
      const qcProgressRatio = health.score / HEALTH_SCORE_MAX;

      return {
        id,
        name: level.name,
        elevationText: metreText(level.elevationMm),
        elevationMm: millimetres(level.elevationMm),
        heightText: metreText(level.heightMm),
        heightMm: millimetres(level.heightMm),
        drawingCountText: drawingCountText(drawingCount),
        drawingCount,
        hasDrawing,
        wallCountText: countText(counts?.wallCount ?? null),
        roomCountText: countText(counts?.roomCount ?? null),
        areaText: counts === null ? MISSING_VALUE : formatArea(counts.areaM2),
        areaM2: counts === null ? null : squareMetres(counts.areaM2),
        qcProgressText: formatPercent(qcProgressRatio, { fractionDigits: 0 }),
        qcProgressRatio,
        isSelected: selectedFloorId === id,
        isHovered: hoveredFloorId === id,
        needsDrawing: !hasDrawing,
        isHiddenIn3d: hiddenFloorIds.includes(id),
        draft: draftOf(level),
        editingField: editing?.floorId === id ? editing.field : null,
      };
    });
  }, [
    countsByLevel,
    draftOf,
    editing,
    floorsById,
    hasError,
    hiddenFloorIds,
    hoveredFloorId,
    levels,
    selectedFloorId,
    violationsByLevel,
  ]);

  const bands = useMemo<readonly SectionBandVm[]>(() => {
    if (rows.length === 0 || !Number.isFinite(totalStackHeightMm) || totalStackHeightMm <= 0) {
      return NO_BANDS;
    }

    return rows.map((row) => ({
      levelId: row.id,
      label: bandLabel(row.name, row.heightMm),
      bandHeightRatio: row.heightMm / totalStackHeightMm,
      isSelected: row.isSelected,
      isHovered: row.isHovered,
      isHiddenIn3d: row.isHiddenIn3d,
      needsDrawing: row.needsDrawing,
    }));
  }, [rows, totalStackHeightMm]);

  const elevationTicks = useMemo<readonly ElevationTickVm[]>(() => {
    if (bottomMm === null || topMm === null || !Number.isFinite(totalStackHeightMm)) {
      return NO_TICKS;
    }

    const marks: { readonly id: string; readonly valueMm: number }[] = levels.map((level) => ({
      id: String(level.id),
      valueMm: level.elevationMm,
    }));

    marks.push({ id: 'stack-top', valueMm: topMm });

    return marks.map((mark) => {
      const offsetRatio =
        totalStackHeightMm <= 0 ? 0 : (mark.valueMm - bottomMm) / totalStackHeightMm;

      return {
        id: mark.id,
        labelText: metreText(mark.valueMm),
        offsetRatio,
        offsetCssPercent: cssPercentOf(offsetRatio),
      };
    });
  }, [bottomMm, levels, topMm, totalStackHeightMm]);

  const footer = useMemo<FloorTableFooterVm>(() => {
    let areaTotal: number | null = null;
    let wallTotal: number | null = null;
    let roomTotal: number | null = null;

    for (const row of rows) {
      const counts = countsByLevel.get(row.id);

      if (counts === undefined) {
        continue;
      }

      areaTotal = (areaTotal ?? 0) + counts.areaM2;
      wallTotal = (wallTotal ?? 0) + counts.wallCount;
      roomTotal = (roomTotal ?? 0) + counts.roomCount;
    }

    return {
      floorCountText: floorCountText(rows.length),
      totalHeightText,
      totalAreaText: areaTotal === null ? MISSING_VALUE : formatArea(areaTotal),
      totalWallCountText: countText(wallTotal),
      totalRoomCountText: countText(roomTotal),
    };
  }, [countsByLevel, rows, totalHeightText]);

  const needsDrawingCount = rows.filter((row) => row.needsDrawing).length;

  const state = deriveFloorManagerScreenState({
    isViewerRole,
    isCollapsed,
    hasError,
    isLoading,
    rowCount: rows.length,
    needsDrawingCount,
  });

  const errorMessage = useMemo(() => {
    if (!hasError) {
      return null;
    }

    return describeError(toAppError(floorListQuery.error)).description;
  }, [floorListQuery.error, hasError]);

  const unsupportedNotices = useMemo(
    () =>
      FLOOR_MANAGER_MISSING_CAPABILITIES.filter(
        (capability) => !gateway.supports[capability],
      ).map((capability) => FLOOR_MANAGER_UNSUPPORTED_NOTICES[capability]),
    [gateway],
  );

  return {
    state,

    rows,
    bands,
    elevationTicks,
    totalHeightText,
    footer,

    canEdit,
    isCollapsed,
    isCompact: options.isCompact ?? false,
    isAutoElevation,

    emptyNotice: state === 'empty' ? FLOOR_MANAGER_TEXT.emptyNotice : null,
    errorMessage,
    forbiddenNotice: isViewerRole ? FLOOR_MANAGER_TEXT.forbiddenNotice : null,
    duplicateElevationMessage: duplicateElevation?.message ?? null,
    duplicateElevationViolation: duplicateElevation?.violation ?? null,

    onSelectFloor,
    onHoverFloor,

    onFloorFieldChange,
    onFloorFieldCommit,
    onFloorFieldCancel,

    onReorderFloors,

    onAddFloor,
    onDuplicateFloor,
    onToggleHiddenIn3d,
    onRemoveFloor,

    onToggleAutoElevation,
    onUploadDrawing,
    onToggleCollapsed,
    onRetry,
    onUndo,

    historyStepCount: () => dispatchBundle.history.undoSteps().length,
    canUndo: dispatchBundle.history.canUndo(),
    unsupportedNotices,
  };
}
