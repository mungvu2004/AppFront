/**
 * Nửa "suy nghĩ" của `FurnitureLibraryPanel` — panel thư viện model 280px bên
 * trái `Viewer3D`.
 *
 * View của panel thuần và kiểm được chỉ từ props (mục D của CLAUDE.md): mọi lượt
 * đọc, mọi lượt ghi, mọi con số thành chuỗi xảy ra ở đây hoặc ở
 * `furnitureLibraryPanelGateway.ts`, không ở view.
 *
 * ## R-61 — hook NỐI LẠI LOGIC ĐÃ CÓ, không chứa công thức tự chế
 *
 * Không một phép hình học, làm tròn, quy đổi đơn vị hay định dạng số nào được
 * viết ở đây. Bảng dưới là toàn bộ những gì hook NỐI vào, và không có mục nào
 * thứ mười một:
 *
 * | Việc | Đường đã có |
 * |---|---|
 * | Danh mục model (D-01/D-02) | `libraryListQueryOptions` (`@/lib/query/libraryQueries`) |
 * | Nạp trước khi chạm thẻ (D-03) | `prefetchLibraryItemOnHover` — không `setTimeout` tay |
 * | Lọc chip + ô tìm | `matchesLibraryFilter` (`@/api/client`) + `foldForSearch` |
 * | Định dạng (A15/P-01) | `formatNumber`/`formatLength`/`formatFileSize` |
 * | Kéo thả (I-03) | `useDragDropSession` — panel KHÔNG tự nuôi `reduceDragDrop` |
 * | Đặt được hay không (R-08) | `validateAddFurniture`, tiêm làm `DragDropDeps.validateDrop` |
 * | Thêm/xoá đồ đạc (S-07) | `createAddFurnitureCommand` / `createDeleteFurnitureCommand` |
 * | Điều phối lệnh (S-05) | `runTransaction` qua `SpatialPort` cài bằng `commit` |
 * | Hoàn tác + toast (A8/D-05) | `commit` ghi `lastCommitLabel`; `useUndoableToast` ở vỏ tự hiện |
 * | So le lưới (mục B) | `staggerSchedule` + `useMotionConditions` — không số trễ viết tay |
 * | Ngân sách hiệu năng (R-04) | `checkBudget` + `SCENE_BUDGET` |
 * | Phím tắt (A12/R-54) | `useShortcut` — KHÔNG `addEventListener('keydown')` |
 *
 * ## Bốn điều hook này cố ý KHÔNG làm
 *
 * 1. **Không `useState` cho tải/lỗi (R-64).** `libraryQuery.isPending` và
 *    `libraryQuery.isError` là nguồn duy nhất, `libraryQuery.refetch` là nút
 *    "Thử lại" của trạng thái lỗi.
 * 2. **Không gọi `set()` của store (A10).** `commit` chỉ sống trong cổng, bên
 *    trong `SpatialPort.applyPatches`; hook đứng phía trên `runTransaction`.
 * 3. **Không tự nạp `.glb`, không tự kiểm va chạm, không tự tính vị trí đặt.**
 *    `modelUrl` chỉ là một chuỗi ở tầng này; phán quyết đặt được hay không là
 *    của `validateAddFurniture`, và câu từ chối là câu của nó.
 * 4. **Không tự dựng toast.** `commit` ghi `lastCommitLabel`/`lastCommitTimestamp`
 *    và `useUndoableToast` (đã chạy ở tầng vỏ) hiện cửa sổ `UNDO_WINDOW_MS`. Con
 *    số 8000 không xuất hiện trong file này (R-71).
 *
 * ## Khoảng trống đã biết, ghi ra thay vì giấu (E.10)
 *
 * `FurnitureModelCard.isHeavy` tính cảnh nền bằng KHÔNG, vì không có đường nào
 * đưa một `SceneReading` của `Viewer3D` xuống panel. Mọi `true` là cảnh báo
 * thật; `false` có thể là ÂM TÍNH GIẢ khi cảnh đã gần chạm trần. Lý do đầy đủ
 * nằm ở docblock của `isHeavyLibraryItem` trong `furnitureLibraryPanelGateway.ts`.
 *
 * ## Hai chỗ hợp đồng cứng quyết định hành vi, không phải hook
 *
 * - **Quyền (trạng thái 6).** `UseFurnitureLibraryPanelOptions.canUploadModel`
 *   là kết quả `can('manage', 'library', { roles })` mà CONTAINER tính — đúng
 *   như `furnitureLibraryPanelTypes.ts` khai. Hook tính lại phép ấy sẽ dựng
 *   nguồn sự thật thứ hai cho cùng một câu hỏi, nên nó nhận phán quyết và chỉ
 *   quyết phần thuộc về mình: thẻ nào khoá, `onUploadModel` có hay `null`.
 * - **Nạp trước.** `FurnitureModelCard` không có trường trỏ chuột, nên đường
 *   `prefetchLibraryItemOnHover` được gọi trong `onSelect` — chỗ gần nhất mà hợp
 *   đồng props cho phép chạm tới.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { createAppApiClient } from '@/api/appClient';
import type { LibraryItem } from '@/api/client';
import type { Furniture, Point } from '@/domain/spatial/types';
import { useAppShell } from '@/hooks/useAppShell';
import { useDragDropSession } from '@/hooks/useDragDropSession';
import { useMotionConditions } from '@/hooks/useMotionConditions';
import { useShortcut } from '@/hooks/useShortcut';
import type { DragDropDeps, FurnitureDropRequest } from '@/lib/input/dragDrop';
import { describeError, toAppError } from '@/lib/errors';
import { staggerSchedule } from '@/lib/motion/stagger';
import { libraryListQueryOptions, prefetchLibraryItemOnHover } from '@/lib/query/libraryQueries';
import { useStore } from '@/store';

import {
  addFurnitureCommandOf,
  buildReplaceAllCommands,
  createFurnitureLibraryDispatchDeps,
  detectedFurnitureCounts,
  detectedGroupLabel,
  dimensionsLabelOf,
  dragLibraryItemOf,
  dropRefusalsOf,
  fileSizeCaptionOf,
  floorFurniture,
  FURNITURE_LIBRARY_PANEL_ACTOR_ID,
  isHeavyLibraryItem,
  levelIdOf,
  mintFurnitureId,
  replaceAllDialogLabel,
  replaceAllPreviewItems,
  runFurnitureLibraryCommands,
  thumbnailAltTextOf,
  visibleLibraryItems,
  type DetectedFurnitureCount,
  type FurnitureLibraryDispatchBundle,
} from './furnitureLibraryPanelGateway';
import {
  FURNITURE_CATEGORY_IDS,
  FURNITURE_CATEGORY_LABELS,
  type DetectedFurnitureGroup,
  type FurnitureCategoryChip,
  type FurnitureCategoryId,
  type FurnitureLibraryEmptyVariant,
  type FurnitureLibraryPanelContent,
  type FurnitureLibraryPanelState,
  type FurnitureModelCard,
  type FurnitureModelCardMotion,
  type ReplaceAllPreview,
  type UseFurnitureLibraryPanelOptions,
  type UseFurnitureLibraryPanelResult,
} from './furnitureLibraryPanelTypes';

/**
 * Điểm nhấc của một lượt kéo bằng chuột, tính bằng milimét mặt bằng.
 *
 * `FurnitureModelCard.onDragStart` không nhận tham số nào (hợp đồng cứng), nên
 * thẻ không có toạ độ để trao. Phiên bắt đầu ở gốc mặt bằng và ĐI THEO con trỏ
 * ngay từ sự kiện `move` đầu tiên mà cảnh gửi tới `moveTo` — không có vị trí đặt
 * nào được panel tự tính (cấm tuyệt đối).
 */
const PICKUP_ORIGIN: Point = { x: 0, y: 0 };

/** Nhịp vào của lưới thẻ — hàng "lọc lưới" của bảng chuyển động (contract-ui mục 4). */
const GRID_DURATION = 'standard';

/**
 * Panel thư viện model: dữ liệu, bộ lọc, phiên kéo thả và bảy trạng thái.
 */
export function useFurnitureLibraryPanel(
  options: UseFurnitureLibraryPanelOptions,
): UseFurnitureLibraryPanelResult {
  const apiClient = useMemo(() => createAppApiClient(), []);
  const queryClient = useQueryClient();

  /* ---------------------------------------------------------------------- */
  /* Trạng thái máy chủ — nguồn DUY NHẤT của "đang tải" và "hỏng" (R-64).    */
  /* ---------------------------------------------------------------------- */

  const libraryQuery = useQuery(libraryListQueryOptions(apiClient.library));

  /* ---------------------------------------------------------------------- */
  /* Trạng thái cục bộ — KHÔNG có cờ tải hay cờ hỏng nào ở đây.              */
  /* ---------------------------------------------------------------------- */

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryId, setCategoryId] = useState<FurnitureCategoryId>('all');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [pendingGroupKind, setPendingGroupKind] = useState<Furniture['kind'] | null>(null);

  const graph = useStore((state) => state.spatial);
  const shell = useAppShell();
  const motionConditions = useMotionConditions();

  /* Danh mục về rỗng khi lượt đọc chưa xong. Mảng rỗng phải ỔN ĐỊNH: một `[]`
   * mới mỗi lượt vẽ sẽ làm mọi `useMemo` bên dưới chạy lại vô ích. */
  const libraryData = libraryQuery.data;
  const items = useMemo<readonly LibraryItem[]>(() => libraryData ?? [], [libraryData]);
  const levelId = levelIdOf(options.floorId);

  /* ---------------------------------------------------------------------- */
  /* Đường ghi — dựng MỘT lần, giữ nguyên ngăn xếp hoàn tác qua các lượt vẽ. */
  /* ---------------------------------------------------------------------- */

  const bundleRef = useRef<FurnitureLibraryDispatchBundle | null>(null);

  if (bundleRef.current === null) {
    bundleRef.current = createFurnitureLibraryDispatchDeps({
      graph: { read: () => useStore.getState().spatial },
      /* Ảnh chụp vùng chọn lấy từ CHÍNH `selectionSlice`: `HistoryStep` khôi
       * phục đúng vùng chọn của phiên làm việc khi hoàn tác. */
      selection: () => ({ selectedIds: useStore.getState().selectedIds }),
    });
  }

  const bundle = bundleRef.current;

  /* Ba thứ đọc-mới-nhất đi qua ref: container dựng lại `options` mỗi lượt vẽ, và
   * đặt chúng thẳng vào danh sách phụ thuộc thì mọi `useCallback` dưới đây mất
   * tác dụng. */
  const latestRef = useRef({ items, onModelDropped: options.onModelDropped });
  latestRef.current = { items, onModelDropped: options.onModelDropped };

  /** Mục thư viện của phiên kéo đang mở — `DragSession` chỉ giữ mã đồ đạc. */
  const draggedItemIdRef = useRef<string | null>(null);

  /* ---------------------------------------------------------------------- */
  /* Kéo thả (I-03) — máy có sẵn, hook chỉ tiêm phụ thuộc.                   */
  /* ---------------------------------------------------------------------- */

  const handleDrop = useCallback(
    (request: FurnitureDropRequest): void => {
      const current = useStore.getState().spatial;
      const modelId = draggedItemIdRef.current;

      draggedItemIdRef.current = null;

      if (current === null || modelId === null) {
        return;
      }

      const command = addFurnitureCommandOf(
        request.input,
        current,
        FURNITURE_LIBRARY_PANEL_ACTOR_ID,
      );

      if (command === null) {
        return;
      }

      void runFurnitureLibraryCommands([command], bundle, command.description).then((result) => {
        if (result.ok) {
          latestRef.current.onModelDropped(modelId, request.input.roomId ?? null);
        }
      });
    },
    [bundle],
  );

  const dragDeps = useMemo<DragDropDeps>(
    () => ({
      levelId,
      nextId: mintFurnitureId,
      validateDrop: (input) =>
        dropRefusalsOf(input, useStore.getState().spatial, FURNITURE_LIBRARY_PANEL_ACTOR_ID),
    }),
    [levelId],
  );

  const drag = useDragDropSession({ deps: dragDeps, onDrop: handleDrop });

  /* ---------------------------------------------------------------------- */
  /* Phím tắt (A12/R-54) — Esc huỷ phiên kéo và đóng hộp xem trước.          */
  /* ---------------------------------------------------------------------- */

  const isDragging = drag.state.phase === 'dragging';
  const isPreviewOpen = pendingGroupKind !== null;

  const cancelDrag = drag.cancel;

  useShortcut(
    {
      id: 'furnitureLibraryPanel.cancel',
      combo: 'Escape',
      scope: 'sidePanel',
      description: 'huỷ lượt kéo model và đóng hộp xem trước',
      onTrigger: () => {
        cancelDrag();
        draggedItemIdRef.current = null;
        setPendingGroupKind(null);
      },
    },
    /* Chỉ giữ phím khi có thứ để huỷ: ngoài lúc ấy, Esc đi tiếp tới
     * `global.closeTopLayer` như A12 hứa. */
    { enabled: isDragging || isPreviewOpen },
  );

  /* ---------------------------------------------------------------------- */
  /* Lọc, định dạng và dựng thẻ.                                             */
  /* ---------------------------------------------------------------------- */

  const visible = useMemo(
    () => visibleLibraryItems(items, categoryId, searchQuery),
    [items, categoryId, searchQuery],
  );

  const placedKinds = useMemo(() => {
    const kinds = new Set<Furniture['kind']>();

    for (const piece of floorFurniture(graph, options.floorId)) {
      kinds.add(piece.kind);
    }

    return kinds;
  }, [graph, options.floorId]);

  const pickUp = drag.pickUp;

  const startDrag = useCallback(
    (item: LibraryItem): void => {
      draggedItemIdRef.current = item.id;
      pickUp(dragLibraryItemOf(item), PICKUP_ORIGIN, 'pointer');
    },
    [pickUp],
  );

  const selectItem = useCallback(
    (item: LibraryItem): void => {
      setSelectedItemId(item.id);
      /* D-03 — nạp trước bản chi tiết. `prefetchOnHover` giữ cả hai điều kiện
       * (đứng yên đủ lâu, khoá còn rỗng); panel không tự hẹn giờ. */
      prefetchLibraryItemOnHover(queryClient, apiClient.library, item.id).onPointerEnter();
    },
    [apiClient, queryClient],
  );

  const canDrag = options.canUploadModel;

  const cards = useMemo<readonly FurnitureModelCard[]>(
    () =>
      visible.map((item) => ({
        id: item.id,
        name: item.name,
        thumbnailUrl: item.previewUrl ?? null,
        thumbnailStatus: item.previewUrl === undefined ? 'unavailable' : 'ready',
        thumbnailAltText: thumbnailAltTextOf(item),
        dimensionsLabel: dimensionsLabelOf(item),
        fileSizeCaption: fileSizeCaptionOf(item),
        /* `Furniture` không mang mã mục thư viện, nên "đã dùng" là câu hỏi ở mức
         * LOẠI đồ: tầng này đã có một món cùng `furnitureKind` hay chưa. */
        isUsedInProject: placedKinds.has(item.furnitureKind),
        isHeavy: isHeavyLibraryItem(item),
        isLocked: !canDrag,
        onDragStart: canDrag ? (): void => startDrag(item) : undefined,
        onSelect: (): void => selectItem(item),
      })),
    [visible, placedKinds, canDrag, startDrag, selectItem],
  );

  const cardMotions = useMemo<readonly FurnitureModelCardMotion[]>(() => {
    const schedule = staggerSchedule(cards.length, {
      ...motionConditions,
      duration: GRID_DURATION,
    });

    return cards.map((card, index) => ({
      card,
      delayMs: schedule[index]?.delayMs ?? 0,
      durationMs: schedule[index]?.durationMs ?? 0,
    }));
  }, [cards, motionConditions]);

  /* ---------------------------------------------------------------------- */
  /* Chip nhóm — duyệt `FURNITURE_CATEGORY_IDS`, không liệt kê lại.          */
  /* ---------------------------------------------------------------------- */

  const categoryChips = useMemo<readonly FurnitureCategoryChip[]>(
    () =>
      FURNITURE_CATEGORY_IDS.map((id) => ({
        id,
        label: FURNITURE_CATEGORY_LABELS[id],
        isActive: id === categoryId,
        onSelect: (): void => setCategoryId(id),
      })),
    [categoryId],
  );

  /* ---------------------------------------------------------------------- */
  /* "Đã phát hiện" và hộp xem trước "Thay thế tất cả".                      */
  /* ---------------------------------------------------------------------- */

  const detected = useMemo(
    () => detectedFurnitureCounts(floorFurniture(graph, options.floorId)),
    [graph, options.floorId],
  );

  const detectedGroups = useMemo<readonly DetectedFurnitureGroup[] | null>(() => {
    if (detected.length === 0) {
      return null;
    }

    return detected.map((group) => ({
      id: group.kind,
      label: detectedGroupLabel(group),
      /* (h) — XEM TRƯỚC RỒI MỚI ÁP: lượt bấm này KHÔNG đổi gì, nó chỉ mở hộp. */
      onReplaceAll: (): void => setPendingGroupKind(group.kind),
    }));
  }, [detected]);

  const applyReplaceAll = useCallback(
    (group: DetectedFurnitureCount, target: LibraryItem): void => {
      const current = useStore.getState().spatial;

      setPendingGroupKind(null);

      if (current === null) {
        return;
      }

      const commands = buildReplaceAllCommands(
        group,
        target,
        current,
        levelId,
        FURNITURE_LIBRARY_PANEL_ACTOR_ID,
      );

      if (commands.length === 0) {
        return;
      }

      void runFurnitureLibraryCommands(commands, bundle, replaceAllDialogLabel(group));
    },
    [bundle, levelId],
  );

  const replaceAllPreview = useMemo<ReplaceAllPreview | null>(() => {
    const group = detected.find((entry) => entry.kind === pendingGroupKind);
    const target = items.find((item) => item.id === selectedItemId);

    if (group === undefined || target === undefined) {
      return null;
    }

    return {
      detectedGroupId: group.kind,
      groupLabel: replaceAllDialogLabel(group),
      items: replaceAllPreviewItems(group, target),
      onConfirm: (): void => applyReplaceAll(group, target),
      onCancel: (): void => setPendingGroupKind(null),
    };
  }, [detected, items, pendingGroupKind, selectedItemId, applyReplaceAll]);

  /* ---------------------------------------------------------------------- */
  /* Bảy trạng thái (A11) — ĐÚNG một nhánh trả về.                           */
  /* ---------------------------------------------------------------------- */

  const clearFilters = useCallback((): void => {
    setSearchQuery('');
    setCategoryId('all');
  }, []);

  const content: FurnitureLibraryPanelContent = {
    searchQuery,
    onSearchQueryChange: setSearchQuery,
    categoryChips,
    detectedGroups,
    cards: cardMotions,
    replaceAllPreview,
    onUploadModel: options.canUploadModel ? options.onUploadModel : null,
  };

  if (libraryQuery.isPending) {
    return { state: { kind: 'loading' } };
  }

  if (libraryQuery.isError) {
    return {
      state: {
        kind: 'error',
        message: describeError(toAppError(libraryQuery.error)).description,
        onRetry: (): void => {
          void libraryQuery.refetch();
        },
      },
    };
  }

  if (cards.length === 0) {
    const hasFilter = searchQuery.trim() !== '' || categoryId !== 'all';
    const variant: FurnitureLibraryEmptyVariant = hasFilter ? 'no-match' : 'library-empty';

    return {
      state: {
        kind: 'empty',
        variant,
        searchedFor: searchQuery,
        ...(variant === 'no-match' ? { onClearFilters: clearFilters } : {}),
      },
    };
  }

  /* Bề rộng khung nhìn đọc từ `useAppShell` — `leftAsDrawer` LÀ ngưỡng
   * `collapsedBreakpointPx` (1024px) của hợp đồng, và nó là hook theo dõi khung
   * nhìn duy nhất của repo. Không `matchMedia` thứ hai ở đây (R-54). */
  if (shell.leftAsDrawer) {
    return { state: { kind: 'collapsed', ...content } };
  }

  if (!options.canUploadModel) {
    return { state: { kind: 'forbidden', ...content } };
  }

  if (cards.some((card) => card.thumbnailStatus === 'unavailable')) {
    return { state: { kind: 'partial', ...content } };
  }

  const state: FurnitureLibraryPanelState = { kind: 'success', ...content };

  return { state };
}
