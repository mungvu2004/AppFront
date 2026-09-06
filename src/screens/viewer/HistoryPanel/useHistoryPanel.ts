/**
 * Nửa "suy nghĩ" của S-34 `HistoryPanel` — nơi cổng, kho và hoạt cảnh gặp hợp
 * đồng kiểu `historyPanelTypes.ts`.
 *
 * View là view thuần theo mục D: nó dựng được chỉ từ `HistoryPanelProps`. Mọi
 * phép tính nằm ở `useHistoryPanel.model.ts`, mọi lời gọi ra ngoài nằm ở
 * `historyPanelGateway.ts`, và file này chỉ nối ba thứ ấy lại.
 *
 * ## Sáu thứ file này chịu trách nhiệm
 *
 * 1. **Bảy trạng thái (A11)** — `deriveHistoryPanelState`, một hàm thuần ở tầng
 *    model. `forceState` chỉ dành cho story và bài kiểm.
 * 2. **Nhảy về một bước = gọi lặp `undo()`/`redo()`** — qua
 *    {@link HistoryPanelGateway.jumpBy}. Panel không giữ ngăn xếp nào của
 *    riêng nó; nó tính ra "lùi mấy bước" rồi bấm nút của ngăn xếp có sẵn đúng
 *    chừng ấy lần.
 * 3. **Lùi bước LUÔN có hoạt cảnh, không bao giờ tức thì.** Mục được đánh dấu
 *    trước, lượt nhảy thật chạy sau `MOTION_DURATIONS_MS.slow` (340 ms) — con
 *    số lấy từ thang chuyển động, không viết tay (R-71, mục B). Người bật
 *    "giảm chuyển động" của hệ điều hành thì `durationMs` trả 0 và lượt nhảy
 *    chạy ngay: đó là lựa chọn của họ, không phải một ngoại lệ của màn.
 * 4. **KHÔNG hộp thoại xác nhận.** Nhảy trạng thái hoàn tác được bằng chính
 *    lịch sử này, nên A9 không đòi hỏi gì — A9 chỉ áp cho việc KHÔNG hoàn tác
 *    được.
 * 5. **Trỏ chuột: bóng ma trạng thái trước + dẫn camera.** Vào thì
 *    `previewEntity(ảnh chụp before)` rồi `frameEntities` (R-07); ra thì
 *    `discardPreview()`. Cả hai đi qua cổng, nên hook không chạm `previewEdit`
 *    hay `ViewerSceneHandle` một lần nào.
 * 6. **`Ctrl+H` mở/đóng panel** (I-01, `HISTORY_PANEL_SHORTCUT`), đăng ký qua
 *    `shortcutRegistry`.
 *
 * ## Vì sao KHÔNG đăng ký `Mod+Z`
 *
 * `Ctrl+Z`/`Ctrl+Shift+Z` đã có chủ ở tầng chung và ở bốn màn QC bắt theo phạm
 * vi canvas. Panel này chỉ ĐỌC vị trí hiện tại (`currentItemId`) rồi để view
 * cuộn mục đang hoạt động vào tầm nhìn — nó phản ứng, không giành phím. Phán
 * quyết 4 ở đầu `historyPanelTypes.ts` là nguồn của quyết định này.
 *
 * ## Vì sao có một `useState` mang lỗi, và vì sao nó không phạm R-64
 *
 * R-64 cấm tự viết `isLoading`/`error` đứng thay cho trạng thái MÁY CHỦ. Ở đây
 * không có lượt đọc máy chủ nào để hỏng: lịch sử hoàn toàn cục bộ (không miền
 * `history` nào trong `queryKeys`). Thứ duy nhất hỏng được là một lượt NHẢY dừng
 * giữa chừng, và {@link JUMP_INTERRUPTED_REASON} là câu của chính tầng cổng nói
 * ra chuyện đó. Cùng lập luận `useRoomAreaPanel.ts` ghi cho `writeFailure`.
 *
 * ## Ngăn xếp là một đối tượng thay đổi tại chỗ, nên nó cần một nhịp đọc lại
 *
 * `HistoryStack` của S-06 không phát tín hiệu nào khi có bước mới. Nhịp đọc lại
 * ở đây là `state.lastCommitTimestamp` của `historySlice` — thứ `commit()` ghi
 * sau MỌI lượt ghi vào đồ thị, kể cả lượt ghi của một màn khác — cộng một bộ
 * đếm mà chính lượt nhảy của panel tăng lên. Không có `setInterval` nào dò
 * ngăn xếp, và không có bản sao ngăn xếp nào được nuôi ở đây.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { EntityId } from '@/domain/spatial/types';
import { useShortcut } from '@/hooks/useShortcut';
import { durationMs } from '@/lib/motion/tokens';
import { prefersReducedMotion } from '@/lib/motion/reducedMotion';
import { useStore } from '@/store';
import type { ProjectRole } from '@/types/project';

import type {
  CreateHistoryPanelGatewayOptions,
  HistorySceneHandle,
  HistoryPanelGateway,
} from './historyPanelGateway';
import { createHistoryPanelGateway, JUMP_INTERRUPTED_REASON } from './historyPanelGateway';
import {
  HISTORY_PANEL_SHORTCUT,
  type HistoryCategoryFilter,
  type HistoryFilters,
  type HistoryPanelState,
  type UseHistoryPanelResult,
} from './historyPanelTypes';
import {
  beforeSnapshotOf,
  buildTimelineItems,
  chronologicalSteps,
  currentItemIdOf,
  deriveHistoryPanelState,
  entityIdsOf,
  filterTimeline,
  groupTimeline,
  jumpOffsetOf,
  partialReasonOf,
  peopleOf,
  stepOfItem,
  visibleCountOf,
} from './useHistoryPanel.model';

/* -------------------------------------------------------------------------- */
/* Hằng số của màn.                                                            */
/* -------------------------------------------------------------------------- */

/** Mã đăng ký của phím tắt — nói RÕ nơi binding sống, để cảnh báo trùng đọc được. */
export const HISTORY_PANEL_SHORTCUT_ID = 'historyPanel.toggle';

/** Câu mô tả phím tắt trên màn trợ giúp. Viết thường, kiểu câu (A6). */
export const HISTORY_PANEL_SHORTCUT_DESCRIPTION = 'mở hoặc đóng bảng lịch sử';

/** Bộ lọc lúc mở panel: mọi loại việc, mọi người. */
const DEFAULT_FILTERS: HistoryFilters = { category: 'all', actorId: null };

/* -------------------------------------------------------------------------- */
/* Tham số.                                                                    */
/* -------------------------------------------------------------------------- */

export interface UseHistoryPanelOptions {
  /**
   * Cổng của panel. Vắng mặt thì hook dựng cổng THẬT.
   *
   * Ngược với `useViewerShell` (mặc định cổng giả), và cùng chiều với
   * `useViewer3D`: một panel chạy được nhưng hiện lịch sử bịa ra là thứ khó
   * phát hiện nhất trong bốn cạm bẫy của hợp đồng cổng.
   */
  readonly gateway?: HistoryPanelGateway;
  /**
   * Ngăn xếp hoàn tác của phiên làm việc (S-06), chuyển thẳng cho cổng mặc định.
   *
   * Ngăn xếp là một ĐỐI TƯỢNG của phiên chứ không phải một kho toàn cục:
   * `createHistoryStack()` sinh ra instance rời nhau, và bảy màn QC đều nhận nó
   * qua `options.history`. Vắng mặt thì cổng dựng một ngăn xếp rỗng của riêng
   * nó — panel hiện trạng thái rỗng THÀNH THẬT chứ không mượn lịch sử của màn
   * khác. Nơi ráp truyền ngăn xếp thật xuống là đủ để panel sống; không ai phải
   * dựng cả một `HistoryPanelGateway` chỉ để đưa một ngăn xếp vào.
   */
  readonly history?: CreateHistoryPanelGatewayOptions['history'];
  /**
   * Vai của người dùng trên dự án, chuyển thẳng cho cổng mặc định.
   *
   * Vắng mặt là "CHƯA BIẾT vai" — panel ở `loading`, không nhảy sang
   * `forbidden`. Nơi ráp đọc nó bằng `useSession()` và bỏ trường này đi khi
   * `session.status === 'unknown'`.
   */
  readonly roles?: readonly ProjectRole[];
  /** Tay cầm cảnh 3D, chuyển thẳng cho cổng mặc định. */
  readonly scene?: HistorySceneHandle | null;
  /** Ai đang thao tác; mọi `actorId` khác chuỗi này là "người dùng khác". */
  readonly actorId?: string;
  /** Panel mở ra ở trạng thái thu gọn hay không. */
  readonly isCollapsed?: boolean;
  /** Ép một trong bảy trạng thái, cho story và bài kiểm A11. */
  readonly forceState?: HistoryPanelState;
  /** Đồng hồ của nhãn thời gian tương đối; chỗ tiêm cho bài kiểm. */
  readonly now?: () => number;
  /** Múi giờ IANA đọc mốc thời gian; vắng mặt thì dùng múi giờ của máy. */
  readonly timeZone?: string;
}

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

export function useHistoryPanel(options: UseHistoryPanelOptions = {}): UseHistoryPanelResult {
  const { gateway: injected, history, roles, scene, actorId } = options;
  const now = options.now ?? Date.now;

  const gateway = useMemo(
    () =>
      injected ??
      createHistoryPanelGateway({
        ...(history === undefined ? {} : { history }),
        ...(roles === undefined ? {} : { roles }),
        ...(scene === undefined ? {} : { scene }),
        ...(actorId === undefined ? {} : { actorId }),
      }),
    [actorId, history, injected, roles, scene],
  );

  /* ---- Nhịp đọc lại ngăn xếp -------------------------------------------- */

  const lastCommitTimestamp = useStore((state) => state.lastCommitTimestamp);
  const [jumpCount, setJumpCount] = useState(0);

  /* ---- Ba trục điều khiển của người dùng --------------------------------- */

  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [isCollapsed, setIsCollapsed] = useState(options.isCollapsed ?? false);

  /** Lý do lượt nhảy gần nhất không đi hết; `null` khi không có lượt nào hỏng. */
  const [failure, setFailure] = useState<string | null>(null);

  /* ---- Đọc ngăn xếp, dựng dòng thời gian --------------------------------- */

  const steps = useMemo(
    () => ({ undoSteps: gateway.history.undoSteps(), redoSteps: gateway.history.redoSteps() }),
    /* `jumpCount` và `lastCommitTimestamp` là hai nhịp đọc lại; xem đầu file. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gateway, jumpCount, lastCommitTimestamp],
  );

  const items = useMemo(
    () =>
      buildTimelineItems({
        undoSteps: steps.undoSteps,
        redoSteps: steps.redoSteps,
        currentActorId: gateway.currentActorId,
        nowMs: now(),
        expandedIds,
        timeZone: options.timeZone,
      }),
    /* `now` là một đồng hồ, không phải một giá trị: đọc nó trong danh sách phụ
       thuộc sẽ dựng lại danh sách mỗi khung hình. Nhãn tương đối được tính lại
       khi ngăn xếp đổi, và đó là lúc duy nhất nó cần đổi. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expandedIds, gateway, options.timeZone, steps],
  );

  const visible = useMemo(() => filterTimeline(items, filters), [filters, items]);

  const groups = useMemo(
    () => groupTimeline(visible, now(), options.timeZone),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options.timeZone, visible],
  );

  const people = useMemo(() => peopleOf(items), [items]);
  const visibleCount = useMemo(() => visibleCountOf(groups), [groups]);
  const currentItemId = useMemo(() => currentItemIdOf(items), [items]);

  const partialReason = partialReasonOf(steps.undoSteps.length + steps.redoSteps.length);

  const derivedState = deriveHistoryPanelState({
    rolesKnown: gateway.rolesKnown,
    canJump: gateway.canJump,
    hasFailure: failure !== null,
    isCollapsed,
    visibleCount,
    partialReason,
  });

  const state = options.forceState ?? derivedState;

  /* ---- Nhảy về một bước: hoạt cảnh trước, ngăn xếp sau -------------------- */

  /**
   * Thời lượng của một lượt lùi.
   *
   * Slot `slow` (340 ms) là nhịp dài nhất thang chuyển động cho phép, và một
   * lượt lùi mấy chục bước là thay đổi lớn nhất panel làm được — nhảy tức thì
   * thì người dùng mất dấu mình vừa đi đâu. `durationMs` trả 0 khi hệ điều hành
   * bật "giảm chuyển động".
   */
  const jumpDurationMs = durationMs('slow', { reducedMotion: prefersReducedMotion() });

  const [jumpingItemId, setJumpingItemId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const onJumpTo = useCallback(
    (itemId: string) => {
      if (!gateway.canJump) {
        return;
      }

      const offset = jumpOffsetOf({ ...steps, itemId });

      if (offset === null || offset === 0) {
        return;
      }

      /* Đánh dấu TRƯỚC: mục sáng lên ngay khi bấm, còn ngăn xếp đổi sau hoạt
         cảnh. Không hộp thoại xác nhận nào ở giữa — lượt nhảy này hoàn tác được
         bằng chính lịch sử đang mở, nên A9 không áp. */
      setJumpingItemId(itemId);

      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;

        const applied = gateway.jumpBy(offset);

        setJumpingItemId(null);
        setJumpCount((count) => count + 1);
        setFailure(applied.length === Math.abs(offset) ? null : JUMP_INTERRUPTED_REASON);
      }, jumpDurationMs);
    },
    [gateway, jumpDurationMs, steps],
  );

  /* ---- Trỏ chuột: bóng ma trạng thái trước + dẫn camera ------------------- */

  const onHoverItem = useCallback(
    (itemId: string | null) => {
      if (itemId === null) {
        gateway.scene.discardPreview();

        return;
      }

      const step = stepOfItem(chronologicalSteps(steps), itemId);

      if (step === null) {
        return;
      }

      const snapshot = beforeSnapshotOf(step);

      if (snapshot !== null) {
        gateway.scene.previewEntity(snapshot.entityId, snapshot.entity);
      }

      const item = items.find((candidate) => candidate.id === itemId);

      if (item !== undefined) {
        gateway.scene.frameEntities(entityIdsOf(item));
      }
    },
    [gateway, items, steps],
  );

  /* ---- Bấm một đối tượng liên quan: chọn nó + khuôn camera (R-07) --------- */

  const onSelectEntity = useCallback(
    (entityId: string) => {
      /* `HistoryEntityRef.id` là một chuỗi ở hợp đồng view, nhưng nó tới từ
         `EntityChange.id` nên nó LUÔN là một mã có tiền tố hợp lệ. */
      const id = entityId as EntityId;

      gateway.scene.selectEntity(id);
      gateway.scene.frameEntities([id]);
    },
    [gateway],
  );

  /* ---- Bộ lọc, lô, thu gọn ----------------------------------------------- */

  const onCategoryChange = useCallback((category: HistoryCategoryFilter) => {
    setFilters((current) => ({ ...current, category }));
  }, []);

  const onActorChange = useCallback((nextActorId: string | null) => {
    setFilters((current) => ({ ...current, actorId: nextActorId }));
  }, []);

  const onToggleBatch = useCallback((itemId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (!next.delete(itemId)) {
        next.add(itemId);
      }

      return next;
    });
  }, []);

  const onToggleCollapse = useCallback(() => {
    setIsCollapsed((current) => !current);
  }, []);

  /* ---- `Ctrl+H` (I-01) ---------------------------------------------------- */

  useShortcut({
    id: HISTORY_PANEL_SHORTCUT_ID,
    combo: HISTORY_PANEL_SHORTCUT,
    scope: 'sidePanel',
    description: HISTORY_PANEL_SHORTCUT_DESCRIPTION,
    onTrigger: onToggleCollapse,
  });

  /* ---- Tải thêm và thử lại ------------------------------------------------ */

  /**
   * "Tải thêm" — khả năng CÒN THIẾU, và nó nói ra điều đó.
   *
   * `supports.loadArchivedSteps` là `false` và `partialReason` không bao giờ là
   * `'archived'`, nên nút này không có đường xuất hiện trên màn. Nó vẫn gọi cổng
   * thay vì im lặng: một nút bấm không phản hồi gì là đúng thứ R-69 gọi là bản
   * tạm, còn một câu tiếng Việt nói rõ "chưa có kho lịch sử cũ" thì không.
   */
  const onLoadMore = useCallback(() => {
    void gateway.loadArchivedSteps().then((result) => {
      if (!result.ok) {
        setFailure(result.reason);
      }
    });
  }, [gateway]);

  const onRetry = useCallback(() => {
    setFailure(null);
    setJumpCount((count) => count + 1);
  }, []);

  return {
    state,
    groups,
    visibleCount,
    filters,
    people,
    /* Trong lúc hoạt cảnh chạy, mục ĐANG ĐƯỢC NHẮM là mục hoạt động — view cuộn
       tới đó ngay chứ không đợi ngăn xếp đổi xong. */
    currentItemId: jumpingItemId ?? currentItemId,
    canJump: gateway.canJump,
    partialReason,
    isCollapsed,
    error: failure,
    onCategoryChange,
    onActorChange,
    onJumpTo,
    onHoverItem,
    onSelectEntity,
    onToggleBatch,
    onToggleCollapse,
    onLoadMore,
    onRetry,
  };
}
