/**
 * Nửa "suy nghĩ" của màn S-13 "Lớp đối tượng" — mọi thứ ba view của màn cần, đã
 * xong. `objectLayerTypes.ts` là hợp đồng props duy nhất; hook này trả về đúng
 * {@link ObjectLayerReviewModel}.
 *
 * ## Đường ghi (A10)
 *
 * Không một dòng nào gọi `set()` hay `_applyPatches()`. Mọi thay đổi đi: lệnh
 * S-07 (hoặc một trong ba lệnh QĐ-3 dựng bằng nguyên thuỷ công khai) →
 * `dispatch`/`runTransaction` → `SpatialPort.applyPatches` = `commit(patches,
 * label)` → store. Xem `objectLayerReviewGateway.ts` để có lý do và trích dẫn.
 *
 * ## Trạng thái máy chủ (R-64)
 *
 * Không `useState` nào giữ cờ đang-tải hay cờ hỏng. BA lượt đọc, ba khoá của
 * `src/lib/query`: ảnh nền (`drawing.byFloor`), lớp đối tượng
 * (`space.byFloor`), và nhánh nội thất (`progress.byFloor`). Mọi lượt ghi gọi
 * `applyInvalidation(queryClient, …)` với đúng thao tác đã khai trong
 * `invalidationMap`, không gọi `invalidateQueries` trần. `useState` ở đây chỉ
 * giữ trạng thái của riêng giao diện: ba cờ lớp, tập chip lọc, ba nhóm gấp, cờ
 * thu gọn, cờ "chỉ hiện mục dưới ngưỡng", đối tượng đang rê chuột và nhóm loại
 * đang chọn.
 *
 * ## Không công thức tự chế (R-61)
 *
 * - Gắn, kiểm chồng lấn, chiếu vị trí, đo đoạn tường: `attachToWall`,
 *   `placeOnWall`, `openingCentre`, `validateOpening`, `openingSpan`,
 *   `findOrphans` của M-08, gọi qua tầng cổng.
 * - Trôi lỗ mở khi tường đổi: `reflowOpenings` của M-09.
 * - Quy đổi fraction ↔ `offsetMm`: `offsetOnWall`/`relativePositionOf` của
 *   `src/lib/commands/business/shared.ts`.
 * - Ngưỡng độ tin cậy: `confidenceLevel` của `@/lib/format/semantic`.
 * - Số: `formatLength`/`formatNumber` qua các hàm định dạng của tầng cổng.
 * - Màu: `src/lib/coloring`.
 * Hook này không có một phép nhân, chia hay làm tròn nào.
 *
 * ## D-06 — hai mươi lượt kéo, một bước lịch sử
 *
 * Lượt kéo Slider phát MỘT lệnh `opening.move` (hoặc `furniture.move`) mỗi lần
 * giá trị đổi, và `createHistoryStack` gộp chúng khi hai lệnh liên tiếp cùng
 * loại, cùng người, cùng thực thể và cách nhau dưới `MERGE_WINDOW_MS`
 * (= `COALESCE_WINDOW_MS` = 400 ms). Không con số 400 nào viết ở màn (R-71).
 *
 * ## Bàn phím (A12, R-54)
 *
 * Không một `addEventListener('keydown')` nào. `D`/`W`/`F` đặt nhóm loại,
 * `1`/`2`/`3` đổi loại trong nhóm, `Mod+Z` hoàn tác, và `Escape` đóng lớp trên
 * cùng — lớp trên cùng của màn này là thanh tra bên phải, nên `Escape` bỏ vùng
 * chọn. Nó chỉ được đăng ký KHI có đối tượng đang chọn; lúc không có gì để
 * đóng, phím rơi xuống tầng `global` của `shortcutRegistry` như lời hứa A12
 * yêu cầu.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { EntityId, Level, SwingDirection, WallId } from '@/domain/spatial/types';
import type { RelativePosition } from '@/domain/openings/types';
import type { Wall as SolidWall } from '@/domain/walls/types';
import { useCanvasViewport } from '@/hooks/useCanvasViewport';
import { appNotificationBus } from '@/hooks/useNotifications';
import { useShortcut } from '@/hooks/useShortcut';
import { can } from '@/lib/auth/permissions';
import type { Command } from '@/lib/commands/types';
import type { CommandContext } from '@/lib/commands/business/shared';
import type { ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import type { NotificationBus } from '@/lib/mutations/notificationBus';
import { applyInvalidation } from '@/lib/query/invalidation';
import { queryKeys } from '@/lib/query/queryKeys';
import { planReveals, revealAnchor, describeSelection } from '@/lib/selection/revealPolicy';
import {
  combineSelection,
  selectSingle,
  toggleSelection,
  type SelectionContext,
} from '@/lib/selection/selectionOps';
import { createSelectionChannel } from '@/lib/selection/syncChannel';
import type { ColorTokenName } from '@/lib/coloring/scales';
import { useStore } from '@/store';
import type { ProjectRole } from '@/types/project';

import {
  attachOrphanToNearestWall,
  buildAddOpeningCommand,
  manualDoorProposalOf,
  buildApproveObjectCommand,
  buildChangeObjectKindCommand,
  buildChangeObjectSwingCommand,
  buildDeleteFurnitureCommand,
  buildDeleteOpeningCommand,
  buildMoveFurnitureCommand,
  buildMoveOpeningCommand,
  commandContextOf,
  confidenceLegendOf,
  confidenceModeOf,
  countsOf,
  createObjectLayerDispatchDeps,
  createObjectLayerMutation,
  createObjectLayerReviewGateway,
  createObjectUndoTicket,
  dataLayerTokens,
  displayIdOf,
  entityIdOf,
  graphWallsOf,
  isLowConfidenceObject,
  layerTreeTotalLabel,
  levelOfGraph,
  lowConfidenceNotice,
  lowConfidenceObjectsOf,
  millimetresPerPixelOf,
  objectPlacementsOf,
  objectsOf,
  OBJECT_LAYER_TEXT,
  offsetForPosition,
  positionOnWall,
  reviewCounterOf,
  reviewProgressLabel,
  siblingOpeningsOf,
  solidWallsOf,
  toDragMeasurement,
  toObjectInspector,
  toObjectRow,
  toPaintSubject,
  runObjectCommand,
  runObjectTransaction,
  wallBoundsPx,
  wallOutlinesOf,
  type ObjectLayerBackground,
  type ObjectLayerDispatchDeps,
  type ObjectLayerGraphPort,
  type ObjectLayerReviewGateway,
  type ObjectSeedEntry,
  type ObjectWriteVariables,
} from './objectLayerReviewGateway';
import {
  OBJECT_SUBTYPES,
  OBJECT_SUBTYPE_LAYER,
  isOrphanObject,
  type ObjectLayerId,
  type ObjectLayerReviewModel,
  type ObjectLayerScreenState,
  type ObjectLayerVisibility,
  type ObjectReviewCounter,
  type ObjectSubtype,
  type ReviewObject,
} from './objectLayerTypes';

/* -------------------------------------------------------------------------- */
/* Hợp đồng vào.                                                               */
/* -------------------------------------------------------------------------- */

export interface UseObjectLayerReviewOptions {
  readonly projectId: string;
  readonly floorId: string;
  readonly roles?: readonly ProjectRole[];
  /** Cổng dữ liệu tiêm được. Vắng mặt thì hook dựng cổng thật, đúng một lần. */
  readonly gateway?: ObjectLayerReviewGateway;
  /** Sổ phím tiêm được — bài kiểm dựng sổ riêng để không đụng sổ dùng chung. */
  readonly registry?: ShortcutRegistry;
  /** Ép thu gọn hai panel — cho story và bài kiểm muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
  /** Bus thông báo — chỗ toast hoàn tác của A8 đi ra. */
  readonly notifications?: NotificationBus;
}

/* -------------------------------------------------------------------------- */
/* Hằng của riêng hook.                                                        */
/* -------------------------------------------------------------------------- */

/** Loại thông báo của một lượt xoá — viết đúng một chỗ (R-71). */
const DELETE_NOTIFICATION_TYPE = 'objectLayerReview.deleteObject';

/** Loại thông báo của một lượt gắn vào tường gần nhất — viết đúng một chỗ (R-71). */
const ATTACH_NOTIFICATION_TYPE = 'objectLayerReview.attachToNearestWall';

/** Loại thông báo của một lượt thêm tay — viết đúng một chỗ (R-71). */
const ADD_NOTIFICATION_TYPE = 'objectLayerReview.addManually';

/** Ba lớp con bật hết lúc mở màn. */
const ALL_LAYERS_VISIBLE: ObjectLayerVisibility = { door: true, window: true, furniture: true };

/** Ba nhóm mở hết lúc mở màn. */
const NO_GROUPS_COLLAPSED: ObjectLayerVisibility = { door: false, window: false, furniture: false };

/** Chưa chip lọc nào bật. */
const NO_SUBTYPE_FILTERS: ReadonlySet<ObjectSubtype> = new Set<ObjectSubtype>();

const NO_OBJECTS: readonly ReviewObject[] = [];
const NO_SELECTION_IDS: readonly EntityId[] = [];

/* -------------------------------------------------------------------------- */
/* Phép ghép thuần — kiểm được mà không cần dựng hook.                          */
/* -------------------------------------------------------------------------- */

/**
 * Bảy trạng thái của A11, DẪN XUẤT từ dữ liệu chứ không phải bảy cờ rời rạc.
 *
 * Thứ tự quyết định là thứ tự trả lời: quyền trước, rồi vỏ màn, rồi lỗi, rồi
 * đang tải, rồi mới tới đếm. Nhánh nội thất lỗi KHÔNG đẩy màn sang `error`: nó
 * chỉ giữ màn ở `partial` để lớp nội thất hiện một hàng cần chú ý, đúng câu
 * "không chặn cả màn" của đặc tả.
 */
export function deriveScreenState(input: {
  readonly isViewerRole: boolean;
  readonly isCollapsed: boolean;
  readonly hasError: boolean;
  readonly isLoading: boolean;
  readonly hasFurnitureAttention: boolean;
  readonly counter: ObjectReviewCounter;
}): ObjectLayerScreenState {
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
    return input.hasFurnitureAttention ? 'partial' : 'success';
  }

  return 'partial';
}

/** Ba cờ lớp, tập chip lọc và cờ "chỉ hiện mục dưới ngưỡng" áp lên danh sách. */
export function applyObjectFilters(
  objects: readonly ReviewObject[],
  filters: {
    readonly layerVisibility: ObjectLayerVisibility;
    readonly subtypes: ReadonlySet<ObjectSubtype>;
    readonly lowConfidenceOnly: boolean;
  },
): readonly ReviewObject[] {
  return objects.filter((object) => {
    if (!filters.layerVisibility[object.layer]) {
      return false;
    }

    if (filters.subtypes.size > 0 && !filters.subtypes.has(object.subtype)) {
      return false;
    }

    return !(filters.lowConfidenceOnly && (object.reviewed || !isLowConfidenceObject(object.confidence)));
  });
}

/**
 * Ba ô 1/2/3 của một nhóm loại.
 *
 * Nhóm cửa đi có hai loại con, nhóm cửa sổ có một, nhóm nội thất có năm — nên ô
 * thứ ba của hai nhóm đầu trống, và hai loại con cuối của nhóm nội thất không
 * có phím tắt. Danh sách cắt từ {@link OBJECT_SUBTYPES}, không gõ tay lần thứ hai.
 */
export const subtypeSlotsOf = (layer: ObjectLayerId): readonly ObjectSubtype[] =>
  OBJECT_SUBTYPES.filter((subtype) => OBJECT_SUBTYPE_LAYER[subtype] === layer);

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

/** Cổng thật dựng đúng một lần cho suốt đời component. */
function useResolvedGateway(
  injected: ObjectLayerReviewGateway | undefined,
): ObjectLayerReviewGateway {
  const fallbackRef = useRef<ObjectLayerReviewGateway | null>(null);

  if (injected !== undefined) {
    return injected;
  }

  fallbackRef.current ??= createObjectLayerReviewGateway();

  return fallbackRef.current;
}

export function useObjectLayerReview(
  options: UseObjectLayerReviewOptions,
): ObjectLayerReviewModel {
  const { floorId, projectId } = options;
  const gateway = useResolvedGateway(options.gateway);
  const queryClient = useQueryClient();

  /* ---------------------------------------------------------------------- */
  /* Vai trò — trạng thái 6 vô hiệu MỌI hàm sửa, ở tầng hook.                */
  /* ---------------------------------------------------------------------- */

  const roles = options.roles ?? [];
  const canEdit = can('edit', 'layer', { roles });
  const isViewerRole = !canEdit;

  /* ---------------------------------------------------------------------- */
  /* Trạng thái của riêng giao diện.                                         */
  /* ---------------------------------------------------------------------- */

  const [layerVisibility, setLayerVisibility] = useState<ObjectLayerVisibility>(ALL_LAYERS_VISIBLE);
  const [subtypeFilters, setSubtypeFilters] = useState<ReadonlySet<ObjectSubtype>>(NO_SUBTYPE_FILTERS);
  const [collapsedGroups, setCollapsedGroups] = useState<ObjectLayerVisibility>(NO_GROUPS_COLLAPSED);
  const [ownCollapsed, setOwnCollapsed] = useState(false);
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);
  const [activeLayerOverride, setActiveLayerOverride] = useState<ObjectLayerId | null>(null);
  /**
   * Đối tượng đang được kéo dọc tường.
   *
   * `MeasurementLabel` phân biệt "đang đo" với "đã chốt" bằng chính cờ này, và
   * `MeasurementState` của `useMeasurementLabel` là bộ ba giá trị duy nhất
   * trong repo cho việc đó — không đặt tên trạng thái thứ hai ở màn (R-71).
   */
  const [draggingObjectId, setDraggingObjectId] = useState<string | null>(null);
  /**
   * Đối tượng CHƯA GẮN đang được chọn.
   *
   * Vùng chọn của S-10 chạy trên `EntityId` của đồ thị, và một đối tượng chưa
   * gắn KHÔNG có mặt trong đồ thị (xem `buildObjectLayerGraph`) — `selectSingle`
   * vì thế từ chối nó và trả về vùng chọn rỗng, đúng như nó phải làm. Nên lượt
   * chọn một đối tượng chưa gắn được giữ ở đây, cạnh vùng chọn thật chứ không
   * lẫn vào nó, và hai đường không bao giờ cùng bật.
   */
  const [orphanSelection, setOrphanSelection] = useState<string | null>(null);
  /**
   * Cờ "chỉ hiện mục dưới ngưỡng tin cậy".
   *
   * `null` nghĩa là người dùng chưa đụng tới, và lúc đó câu trả lời là chính
   * đặc tả: trạng thái một phần mở màn với năm mục dưới ngưỡng ĐÃ LỌC SẴN. Một
   * `useState(false)` đơn giản sẽ không làm được điều đó vì lúc dựng hook chưa
   * có dữ liệu để biết có mục nào dưới ngưỡng hay không.
   */
  const [lowConfidenceChoice, setLowConfidenceChoice] = useState<boolean | null>(null);

  /**
   * Dòng bộ mẫu của những đối tượng người duyệt tự thêm trong phiên này.
   *
   * `objectsOf` đọc đồ thị QUA bộ mẫu (một dòng bộ mẫu là chỗ mã hiển thị gặp
   * mã máy), nên một đối tượng vừa thêm mà không có dòng của nó sẽ nằm trong đồ
   * thị mà không hiện ra ở đâu — đúng thứ một nút "thêm" im lặng trông như.
   * Cổng không sửa được (bộ mẫu của nó là hằng), nên dòng mới sống ở đây, cạnh
   * chính lượt ghi đã tạo ra nó.
   */
  const [manualEntries, setManualEntries] = useState<readonly ObjectSeedEntry[]>([]);

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

  const objectLayerQuery = useQuery({
    queryKey: queryKeys.space.byFloor(floorId),
    queryFn: ({ signal }) => gateway.readObjectLayer({ floorId, projectId, signal }),
  });

  /*
   * Nhánh nội thất, khoá RIÊNG.
   *
   * `progress.byFloor` là khoá "tiến độ nhận diện của tầng" và nó KHÔNG nằm
   * trong `invalidationMap.editWall`, nên một lượt duyệt cửa không xoá mất câu
   * "nhận diện nội thất lỗi, cửa vẫn xong". Gộp nhánh này vào `readObjectLayer`
   * sẽ để một lỗi nhận diện ghế sofa xoá sạch chín cửa đã duyệt khỏi màn hình —
   * đúng thứ đặc tả cấm.
   */
  const furnitureQuery = useQuery({
    queryKey: queryKeys.progress.byFloor(floorId),
    queryFn: ({ signal }) => gateway.readFurnitureBranch({ floorId, projectId, signal }),
  });

  /* Lần đọc ảnh nền THÀNH CÔNG gần nhất, giữ lại qua mọi lượt hỏng sau đó. */
  const lastBackgroundRef = useRef<ObjectLayerBackground | null>(null);

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
  const hasError = objectLayerQuery.isError;
  const isLoading = objectLayerQuery.isPending || graph === null;

  /** Bộ mẫu của cổng cộng những dòng người duyệt tự thêm trong phiên này. */
  const seed = useMemo<readonly ObjectSeedEntry[]>(
    () => (manualEntries.length === 0 ? gateway.seed : [...gateway.seed, ...manualEntries]),
    [gateway, manualEntries],
  );

  const objects = useMemo<readonly ReviewObject[]>(
    () => (hasError ? NO_OBJECTS : objectsOf(graph, level, seed)),
    [graph, hasError, level, seed],
  );

  const counts = useMemo(() => countsOf(objects), [objects]);
  const reviewCounter = useMemo(() => reviewCounterOf(objects), [objects]);
  const lowConfidenceObjects = useMemo(() => lowConfidenceObjectsOf(objects), [objects]);
  const lowConfidenceOnly = lowConfidenceChoice ?? lowConfidenceObjects.length > 0;

  const solidWalls = useMemo(() => solidWallsOf(graph, level), [graph, level]);
  const graphWalls = useMemo(() => graphWallsOf(graph, level), [graph, level]);
  const wallOutlines = useMemo(
    () => (level === null ? [] : wallOutlinesOf(graphWalls, level)),
    [graphWalls, level],
  );

  /* ---------------------------------------------------------------------- */
  /* Cổng ghi — `dispatch` chạy qua `commit`, hoàn tác 100 bước của S-06.     */
  /* ---------------------------------------------------------------------- */

  const storePort = useMemo<ObjectLayerGraphPort>(
    () => ({ read: () => useStore.getState().spatial }),
    [],
  );

  const selectionSnapshotRef = useRef<readonly EntityId[]>(selectedIds);
  selectionSnapshotRef.current = selectedIds;
  const selectionBeforeRef = useRef<readonly EntityId[]>(selectedIds);

  /**
   * Lượt ghi đang chờ máy chủ — bước `sync` của `dispatch` đọc nó.
   *
   * `SyncPort.enqueue` là chỗ S-11 nói "bản vẽ bẩn rồi", và ở màn này nó châm
   * ngòi cho lượt ghi lạc quan của D-04: lệnh đã áp vào kho TRƯỚC khi máy chủ
   * trả lời, còn `rollback` của mutation gỡ nó ra bằng đúng ngăn xếp hoàn tác
   * của S-06 nếu lượt gửi hỏng.
   */
  const pendingWriteRef = useRef<ObjectWriteVariables | null>(null);
  const persistRef = useRef<(variables: ObjectWriteVariables) => void>(() => undefined);

  const dispatchBundle = useMemo<ObjectLayerDispatchDeps>(
    () =>
      createObjectLayerDispatchDeps({
        graph: storePort,
        selectionBefore: () => ({ selectedIds: selectionBeforeRef.current }),
        selectionAfter: () => ({ selectedIds: selectionSnapshotRef.current }),
        onSynced: () => {
          const pending = pendingWriteRef.current;

          if (pending !== null) {
            persistRef.current(pending);
          }
        },
      }),
    [storePort],
  );

  /* ---------------------------------------------------------------------- */
  /* Vùng chọn (S-10) và đồng bộ hai chiều (S-11).                            */
  /* ---------------------------------------------------------------------- */

  const channel = useMemo(() => createSelectionChannel(), []);

  useEffect(() => () => channel.dispose(), [channel]);

  const selectionContext = useMemo<SelectionContext | null>(
    () =>
      graph === null || level === null
        ? null
        : { spatial: graph, activeLevelId: level.id, layers: {} },
    [graph, level],
  );

  const objectById = useCallback(
    (objectId: string): ReviewObject | null =>
      objects.find((object) => object.id === objectId) ?? null,
    [objects],
  );

  const entityIdOfObject = useCallback(
    (objectId: string): EntityId | null => {
      const object = objectById(objectId);

      return object === null ? null : (entityIdOf(object.id, object.layer) as EntityId);
    },
    [objectById],
  );

  const selectedObjectId = useMemo<string | null>(() => {
    if (orphanSelection !== null) {
      return objects.some((object) => object.id === orphanSelection) ? orphanSelection : null;
    }

    const anchor = revealAnchor(selectedIds);

    if (anchor === null) {
      return null;
    }

    const displayId = displayIdOf(anchor);

    return objects.some((object) => object.id === displayId) ? displayId : null;
  }, [objects, orphanSelection, selectedIds]);

  const pushSelection = useCallback(
    (next: readonly EntityId[]) => {
      selectionBeforeRef.current = selectionSnapshotRef.current;
      setSelection([...next]);
      /* S-11: một lượt đẩy cho cả canvas và danh sách, gộp trong một khung hình. */
      channel.push([...next]);
    },
    [channel, setSelection],
  );

  const onSelect = useCallback(
    (objectId: string | null) => {
      if (selectionContext === null) {
        return;
      }

      setDraggingObjectId(null);
      setOrphanSelection(null);

      if (objectId === null) {
        pushSelection(NO_SELECTION_IDS);

        return;
      }

      const object = objectById(objectId);

      if (object === null) {
        return;
      }

      /* Đối tượng chưa gắn không nằm trong đồ thị, nên nó đi đường riêng. */
      if (isOrphanObject(object)) {
        pushSelection(NO_SELECTION_IDS);
        setOrphanSelection(objectId);

        return;
      }

      const entityId = entityIdOfObject(objectId);

      if (entityId === null) {
        return;
      }

      pushSelection(selectSingle(selectedIds, entityId, selectionContext));
    },
    [entityIdOfObject, objectById, pushSelection, selectedIds, selectionContext],
  );

  const onToggleSelect = useCallback(
    (objectId: string) => {
      const entityId = entityIdOfObject(objectId);

      if (entityId === null || selectionContext === null) {
        return;
      }

      pushSelection(toggleSelection(selectedIds, entityId, selectionContext));
    },
    [entityIdOfObject, pushSelection, selectedIds, selectionContext],
  );

  const onSelectLayerObjects = useCallback(
    (layer: ObjectLayerId) => {
      if (selectionContext === null) {
        return;
      }

      const ids = objects
        .filter((object) => object.layer === layer)
        .map((object) => entityIdOf(object.id, object.layer) as EntityId);

      pushSelection(combineSelection(selectedIds, ids, 'replace', selectionContext));
    },
    [objects, pushSelection, selectedIds, selectionContext],
  );

  const onHover = useCallback((objectId: string | null) => {
    setHoveredObjectId(objectId);
  }, []);

  /* S-11: nói cho kênh biết danh sách đang thấy gì, rồi hỏi nó phải lộ ra cái nào. */
  useEffect(() => {
    channel.reportVisible('list', selectedIds);
    planReveals(selectedIds, describeSelection(selectedIds), { list: selectedIds });
  }, [channel, selectedIds]);

  /* ---------------------------------------------------------------------- */
  /* Khung nhìn — R-07 bay tới tường chủ.                                     */
  /* ---------------------------------------------------------------------- */

  const { viewport, flyToBounds } = useCanvasViewport();

  /* ---------------------------------------------------------------------- */
  /* Lệnh — mọi hàm sửa đi qua đây, và tắt hẳn ở vai Người xem.               */
  /* ---------------------------------------------------------------------- */

  const invalidate = useCallback(
    (layer: ObjectLayerId) => {
      applyInvalidation(queryClient, layer === 'furniture' ? 'moveFurniture' : 'editWall', {
        floorId,
        projectId,
      });
    },
    [floorId, projectId, queryClient],
  );

  /** Một lệnh đơn, gộp được theo D-06 khi hai lượt liền nhau dưới 400 ms. */
  const runSingle = useCallback(
    async (
      objectId: string,
      layer: ObjectLayerId,
      build: (context: CommandContext) => Command | null,
    ) => {
      const current = useStore.getState().spatial;

      if (!canEdit || current === null) {
        return;
      }

      const command = build(commandContextOf(current, gateway.actorId));

      if (command === null) {
        return;
      }

      pendingWriteRef.current = { objectId, projectId, floorId };

      const result = await runObjectCommand(command, dispatchBundle);

      if (result.ok) {
        invalidate(layer);
      }
    },
    [canEdit, dispatchBundle, floorId, gateway, invalidate, projectId],
  );

  /** Một khối lệnh đi cùng nhau — sinh ĐÚNG MỘT bước hoàn tác, không gộp với lượt kéo. */
  const runBlock = useCallback(
    async (
      objectId: string,
      layer: ObjectLayerId,
      build: (context: CommandContext) => Command | null,
    ) => {
      const current = useStore.getState().spatial;

      if (!canEdit || current === null) {
        return;
      }

      const command = build(commandContextOf(current, gateway.actorId));

      if (command === null) {
        return;
      }

      pendingWriteRef.current = { objectId, projectId, floorId };

      const result = await runObjectTransaction([command], dispatchBundle, command.description);

      if (result.ok) {
        invalidate(layer);
      }
    },
    [canEdit, dispatchBundle, floorId, gateway, invalidate, projectId],
  );

  const wallOfObject = useCallback(
    (hostWallId: WallId): SolidWall | null =>
      solidWalls.find((wall) => wall.id === hostWallId) ?? null,
    [solidWalls],
  );

  const onChangeSubtype = useCallback(
    (objectId: string, subtype: ObjectSubtype) => {
      const object = objectById(objectId);

      if (object === null || isOrphanObject(object)) {
        return;
      }

      void runBlock(object.id, object.layer, (context) => {
        const entityId = entityIdOf(object.id, object.layer);
        const before = context.graph.byId[entityId];
        const wall = wallOfObject(object.hostWallId);

        if (before === undefined || wall === null || !('wallId' in before)) {
          return null;
        }

        const built = buildChangeObjectKindCommand({
          before,
          wall,
          siblings: siblingOpeningsOf(context.graph, wall),
          subtype,
          actorId: context.actorId,
        });

        return built.ok ? built.data : null;
      });
    },
    [objectById, runBlock, wallOfObject],
  );

  const onChangeSwing = useCallback(
    (objectId: string, swing: SwingDirection) => {
      const object = objectById(objectId);

      if (object === null) {
        return;
      }

      void runBlock(object.id, object.layer, (context) => {
        const before = context.graph.byId[entityIdOf(object.id, object.layer)];

        if (before === undefined || !('wallId' in before)) {
          return null;
        }

        const built = buildChangeObjectSwingCommand({ before, swing, actorId: context.actorId });

        return built.ok ? built.data : null;
      });
    },
    [objectById, runBlock],
  );

  const onApprove = useCallback(
    (objectId: string) => {
      const object = objectById(objectId);

      if (object === null || object.reviewed) {
        return;
      }

      void runBlock(object.id, object.layer, (context) => {
        const before = context.graph.byId[entityIdOf(object.id, object.layer)];

        if (before === undefined || (!('wallId' in before) && !('boundingBox' in before))) {
          return null;
        }

        return buildApproveObjectCommand(before, context.actorId);
      });
    },
    [objectById, runBlock],
  );

  const onDragPosition = useCallback(
    (objectId: string, relativePosition: RelativePosition) => {
      const object = objectById(objectId);

      if (object === null || isOrphanObject(object)) {
        return;
      }

      const wall = wallOfObject(object.hostWallId);

      if (wall === null) {
        return;
      }

      setDraggingObjectId(object.id);

      void runSingle(object.id, object.layer, (context) => {
        const entityId = entityIdOf(object.id, object.layer);

        if (object.layer === 'furniture') {
          const built = buildMoveFurnitureCommand(
            { furnitureId: entityId as never, to: positionOnWall(wall, relativePosition) },
            context,
          );

          return built.ok ? built.data : null;
        }

        const built = buildMoveOpeningCommand(
          { openingId: entityId as never, offsetMm: offsetForPosition(object, wall, relativePosition) },
          context,
        );

        return built.ok ? built.data : null;
      });
    },
    [objectById, runSingle, wallOfObject],
  );

  /* ---------------------------------------------------------------------- */
  /* Hoàn tác — ngăn xếp 100 bước của S-06, KHÔNG phải zundo.                 */
  /* ---------------------------------------------------------------------- */

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
    invalidate('door');
  }, [canEdit, dispatchBundle, invalidate, setSelection]);

  const onUndo = useCallback(() => {
    applyUndo();
  }, [applyUndo]);

  /* ---------------------------------------------------------------------- */
  /* D-04 — lượt ghi lạc quan, xếp hàng theo từng đối tượng.                  */
  /* ---------------------------------------------------------------------- */

  /*
   * `applyOptimistic` để trống có chủ đích: thay đổi ĐÃ được áp vào kho bởi
   * `dispatch` ngay trước khi mutation chạy, và đó chính là "lạc quan" theo
   * nghĩa của D-04 — người duyệt thấy kết quả trước khi máy chủ trả lời. Việc
   * còn lại của mutation là chụp ảnh cache, gỡ ra khi lượt gửi hỏng (`rollback`
   * chạy trên ngăn xếp hoàn tác 100 bước của S-06), và dọn khoá đã cũ.
   */
  const persistMutation = useMutation(
    createObjectLayerMutation(queryClient, {
      gateway,
      applyOptimistic: () => undefined,
      rollback: () => {
        applyUndo();
      },
      affectedKeys: (variables) => [queryKeys.space.byFloor(variables.floorId)],
      afterSuccess: (variables) => {
        applyInvalidation(queryClient, 'editWall', {
          floorId: variables.floorId,
          projectId: variables.projectId,
        });
      },
    }),
  );

  persistRef.current = (variables) => {
    persistMutation.mutate(variables);
  };

  /* ---------------------------------------------------------------------- */
  /* Xoá (A8) — tức thì, không hộp thoại, kèm vé hoàn tác 8000 ms.            */
  /* ---------------------------------------------------------------------- */

  const notifications = options.notifications ?? appNotificationBus;

  const onDelete = useCallback(
    (objectId: string) => {
      const object = objectById(objectId);

      if (object === null) {
        return;
      }

      void runSingle(object.id, object.layer, (context) => {
        const entityId = entityIdOf(object.id, object.layer);
        const built =
          object.layer === 'furniture'
            ? buildDeleteFurnitureCommand({ furnitureId: entityId as never }, context)
            : buildDeleteOpeningCommand({ openingId: entityId as never }, context);

        return built.ok ? built.data : null;
      }).then(() => {
        const ticket = createObjectUndoTicket({
          displayId: object.id,
          now: gateway.now,
          undo: applyUndo,
        });

        /*
         * A8: mọi thay đổi hoàn tác được, KÈM TOAST hoàn tác. Cửa sổ tám giây do
         * chính vé mang (`UNDO_WINDOW_MS`), nên không thời lượng nào phải truyền.
         */
        notifications.publish({
          type: DELETE_NOTIFICATION_TYPE,
          title: ticket.description,
          description: '',
          undoTicket: ticket,
        });
      });
    },
    [applyUndo, gateway, notifications, objectById, runSingle],
  );

  /* ---------------------------------------------------------------------- */
  /* Đối tượng chưa gắn tường — hành động gọi M-08, màn không tự tìm.         */
  /* ---------------------------------------------------------------------- */

  /*
   * Lượt gắn có thể bị TỪ CHỐI, và lời từ chối phải tới được người duyệt.
   *
   * `findOrphans` nêu tường đáng gợi ý, nhưng `validateAddOpening` của S-07
   * vẫn chạy `validateOpening` của M-08 trên đó — và tường gần nhất có thể đã
   * có một lỗ mở đúng chỗ ấy. Màn KHÔNG được tự đi tìm tường thứ hai (CẤM
   * TUYỆT ĐỐI); nó nói ra câu tiếng Việt mà domain trả về, để người duyệt
   * quyết định.
   */
  const onAttachToNearestWall = useCallback(
    (objectId: string) => {
      const entry = seed.find((candidate) => candidate.displayId === objectId) ?? null;
      const current = useStore.getState().spatial;

      if (entry === null || level === null || current === null || !canEdit) {
        return;
      }

      const input = attachOrphanToNearestWall(entry, current, level, seed);

      if (input === null) {
        notifications.publish({
          type: ATTACH_NOTIFICATION_TYPE,
          title: OBJECT_LAYER_TEXT.attachNoWall,
          description: '',
        });

        return;
      }

      const built = buildAddOpeningCommand(input, commandContextOf(current, gateway.actorId));

      if (!built.ok) {
        notifications.publish({
          type: ATTACH_NOTIFICATION_TYPE,
          title: OBJECT_LAYER_TEXT.attachRefused,
          description: built.error.reasons.join(' '),
        });

        return;
      }

      void runSingle(entry.displayId, entry.layer, () => built.data);
    },
    [canEdit, gateway, level, notifications, runSingle, seed],
  );

  /*
   * "thêm thủ công" của trạng thái rỗng — một lệnh `opening.add` thật.
   *
   * Màn đề nghị ĐÚNG MỘT chỗ (`manualDoorProposalOf`, giữa tim đoạn tường đầu
   * tiên, toạ độ do `placeOnWall` của M-08 trả) rồi để `validateOpening` phán
   * quyết. Bị từ chối thì người duyệt đọc được câu từ chối của domain; màn
   * không đi tìm một tường thứ hai (CẤM TUYỆT ĐỐI).
   */
  const onAddManually = useCallback(() => {
    const current = useStore.getState().spatial;

    if (!canEdit || current === null || level === null) {
      return;
    }

    const proposal = manualDoorProposalOf(current, level, seed);

    if (proposal === null) {
      notifications.publish({
        type: ADD_NOTIFICATION_TYPE,
        title: OBJECT_LAYER_TEXT.addNoWall,
        description: '',
      });

      return;
    }

    const built = buildAddOpeningCommand(
      proposal.input,
      commandContextOf(current, gateway.actorId),
    );

    if (!built.ok) {
      notifications.publish({
        type: ADD_NOTIFICATION_TYPE,
        title: OBJECT_LAYER_TEXT.addRefused,
        description: built.error.reasons.join(' '),
      });

      return;
    }

    setManualEntries((entries) => [...entries, proposal.entry]);
    void runSingle(proposal.entry.displayId, 'door', () => built.data);
  }, [canEdit, gateway, level, notifications, runSingle, seed]);

  /* ---------------------------------------------------------------------- */
  /* Bấm liên kết tường chủ — chọn tường đó và bay khung nhìn tới (R-07).     */
  /* ---------------------------------------------------------------------- */

  const drawingSize = useMemo(
    () => ({
      width: background?.widthMm ?? 0,
      height: background?.heightMm ?? 0,
    }),
    [background],
  );

  const onSelectHostWall = useCallback(
    (wallId: WallId) => {
      if (selectionContext === null) {
        return;
      }

      pushSelection(selectSingle(selectedIds, wallId, selectionContext));

      const outline = wallOutlines.find((shape) => shape.id === wallId);
      const bounds = outline === undefined ? null : wallBoundsPx(outline.outline, level);

      if (bounds !== null) {
        flyToBounds(bounds, drawingSize.width, drawingSize.height);
      }
    },
    [drawingSize, flyToBounds, level, pushSelection, selectedIds, selectionContext, wallOutlines],
  );

  /* ---------------------------------------------------------------------- */
  /* Lớp con, chip lọc, nhóm gấp.                                            */
  /* ---------------------------------------------------------------------- */

  const onToggleLayer = useCallback((layer: ObjectLayerId) => {
    setLayerVisibility((previous) => ({ ...previous, [layer]: !previous[layer] }));
  }, []);

  const onToggleSubtypeFilter = useCallback((subtype: ObjectSubtype) => {
    setSubtypeFilters((previous) => {
      const next = new Set(previous);

      if (next.has(subtype)) {
        next.delete(subtype);
      } else {
        next.add(subtype);
      }

      return next;
    });
  }, []);

  const onToggleGroupCollapsed = useCallback((layer: ObjectLayerId) => {
    setCollapsedGroups((previous) => ({ ...previous, [layer]: !previous[layer] }));
  }, []);

  const onToggleLowConfidenceOnly = useCallback(() => {
    setLowConfidenceChoice((previous) => !(previous ?? true));
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Nhóm loại đang chọn — `D`/`W`/`F` và ba ô 1/2/3.                         */
  /* ---------------------------------------------------------------------- */

  const selectedObject = selectedObjectId === null ? null : objectById(selectedObjectId);
  const activeLayer = activeLayerOverride ?? selectedObject?.layer ?? null;
  const activeSubtype = selectedObject?.subtype ?? null;

  const onSelectLayer = useCallback((layer: ObjectLayerId) => {
    setActiveLayerOverride(layer);
  }, []);

  const selectedObjectIdRef = useRef(selectedObjectId);
  selectedObjectIdRef.current = selectedObjectId;
  const activeLayerRef = useRef(activeLayer);
  activeLayerRef.current = activeLayer;
  const changeSubtypeRef = useRef(onChangeSubtype);
  changeSubtypeRef.current = onChangeSubtype;

  const onSelectSubtypeSlot = useCallback((slot: 1 | 2 | 3) => {
    const layer = activeLayerRef.current;
    const objectId = selectedObjectIdRef.current;

    if (layer === null || objectId === null) {
      return;
    }

    const subtype = subtypeSlotsOf(layer)[slot - 1];

    if (subtype !== undefined) {
      changeSubtypeRef.current(objectId, subtype);
    }
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Bàn phím — qua sổ phím, KHÔNG addEventListener (A12, R-54).             */
  /* ---------------------------------------------------------------------- */

  const shortcutOptions = useMemo(
    () => (options.registry === undefined ? {} : { registry: options.registry }),
    [options.registry],
  );

  useShortcut(
    {
      id: 'objectLayerReview.layer.door',
      combo: 'D',
      scope: 'canvas',
      description: OBJECT_LAYER_TEXT.shortcutLayer,
      onTrigger: () => onSelectLayer('door'),
    },
    { ...shortcutOptions, enabled: canEdit },
  );
  useShortcut(
    {
      id: 'objectLayerReview.layer.window',
      combo: 'W',
      scope: 'canvas',
      description: OBJECT_LAYER_TEXT.shortcutLayer,
      onTrigger: () => onSelectLayer('window'),
    },
    { ...shortcutOptions, enabled: canEdit },
  );
  useShortcut(
    {
      id: 'objectLayerReview.layer.furniture',
      combo: 'F',
      scope: 'canvas',
      description: OBJECT_LAYER_TEXT.shortcutLayer,
      onTrigger: () => onSelectLayer('furniture'),
    },
    { ...shortcutOptions, enabled: canEdit },
  );
  useShortcut(
    {
      id: 'objectLayerReview.subtype.1',
      combo: '1',
      scope: 'canvas',
      description: OBJECT_LAYER_TEXT.shortcutSubtype,
      onTrigger: () => onSelectSubtypeSlot(1),
    },
    { ...shortcutOptions, enabled: canEdit },
  );
  useShortcut(
    {
      id: 'objectLayerReview.subtype.2',
      combo: '2',
      scope: 'canvas',
      description: OBJECT_LAYER_TEXT.shortcutSubtype,
      onTrigger: () => onSelectSubtypeSlot(2),
    },
    { ...shortcutOptions, enabled: canEdit },
  );
  useShortcut(
    {
      id: 'objectLayerReview.subtype.3',
      combo: '3',
      scope: 'canvas',
      description: OBJECT_LAYER_TEXT.shortcutSubtype,
      onTrigger: () => onSelectSubtypeSlot(3),
    },
    { ...shortcutOptions, enabled: canEdit },
  );
  useShortcut(
    {
      id: 'objectLayerReview.undo',
      combo: 'Mod+Z',
      scope: 'canvas',
      description: OBJECT_LAYER_TEXT.shortcutUndo,
      onTrigger: onUndo,
    },
    { ...shortcutOptions, enabled: canEdit },
  );
  /*
   * A12 — Esc đóng lớp trên cùng.
   *
   * Lớp trên cùng của màn này là thanh tra bên phải, và nó mở đúng khi có đối
   * tượng được chọn. `enabled` tắt đăng ký khi không có gì để đóng, nên lúc đó
   * phím rơi xuống handler `global` của `shortcutRegistry` — lời hứa A12 không
   * bị màn này lấy mất trong bất kỳ trạng thái nào.
   */
  useShortcut(
    {
      id: 'objectLayerReview.closeTopLayer',
      combo: 'Escape',
      scope: 'canvas',
      description: 'Đóng thanh tra đối tượng',
      onTrigger: () => onSelect(null),
    },
    { ...shortcutOptions, enabled: selectedObjectId !== null },
  );

  /* ---------------------------------------------------------------------- */
  /* Ghép kết quả — mọi con số đã thành chuỗi trước khi rời khỏi đây (A15).   */
  /* ---------------------------------------------------------------------- */

  const visibleObjects = useMemo(
    () =>
      applyObjectFilters(objects, {
        layerVisibility,
        subtypes: subtypeFilters,
        lowConfidenceOnly,
      }),
    [layerVisibility, lowConfidenceOnly, objects, subtypeFilters],
  );

  const rows = useMemo(() => visibleObjects.map(toObjectRow), [visibleObjects]);

  const inspector = useMemo(() => {
    if (selectedObject === null) {
      return null;
    }

    const wall = isOrphanObject(selectedObject) ? null : wallOfObject(selectedObject.hostWallId);

    return toObjectInspector(selectedObject, wall);
  }, [selectedObject, wallOfObject]);

  const paintSubjects = useMemo(
    () => (level === null ? [] : objects.map((object) => toPaintSubject(object, level.id))),
    [level, objects],
  );

  const confidenceMode = useMemo(() => confidenceModeOf(paintSubjects), [paintSubjects]);

  /* Chú giải dựng cùng bảng màu — đếm theo chính màu mode tô ra, không đếm lại. */
  const confidenceLegend = useMemo(
    () => confidenceLegendOf(confidenceMode, paintSubjects),
    [confidenceMode, paintSubjects],
  );

  const confidenceTokenOf = useCallback(
    (objectId: string): ColorTokenName => {
      const subject = paintSubjects.find((candidate) => candidate.id === objectId);

      return subject === undefined
        ? confidenceLegend.unpaintedToken
        : confidenceMode.paint(subject);
    },
    [confidenceLegend, confidenceMode, paintSubjects],
  );

  const placements = useMemo(
    () => objectPlacementsOf(visibleObjects, solidWalls, level),
    [level, solidWalls, visibleObjects],
  );

  /*
   * Số đo hai đầu tường của đối tượng đang chọn.
   *
   * Trạng thái là `'measuring'` trong lúc kéo và `'idle'` khi chỉ đang chọn —
   * đúng ba giá trị `MeasurementState` mà `MeasurementLabel` đọc. `null` khi
   * chưa chọn gì hoặc đối tượng chưa gắn được vào tường nào: một đối tượng
   * không có tường chủ thì không có hai đầu tường để mà đo.
   */
  const dragMeasurement = useMemo(() => {
    if (selectedObject === null || isOrphanObject(selectedObject)) {
      return null;
    }

    const wall = wallOfObject(selectedObject.hostWallId);

    if (wall === null) {
      return null;
    }

    return toDragMeasurement(
      selectedObject,
      wall,
      level,
      draggingObjectId === selectedObject.id ? 'measuring' : 'idle',
    );
  }, [draggingObjectId, level, selectedObject, wallOfObject]);

  const tokens = useMemo(() => dataLayerTokens(layerVisibility), [layerVisibility]);

  const hasFurnitureAttention = furnitureQuery.isError;

  const state = deriveScreenState({
    isViewerRole,
    isCollapsed,
    hasError,
    isLoading,
    hasFurnitureAttention,
    counter: reviewCounter,
  });

  return {
    state,
    objects,
    counts,
    reviewCounter,
    reviewProgressLabel: reviewProgressLabel(reviewCounter.reviewed, reviewCounter.total),
    selectedObjectId,
    hoveredObjectId,
    layerVisibility,
    subtypeFilters,
    collapsedGroups,
    isCompact: isCollapsed,
    isCollapsed,
    isViewerRole,
    viewerRoleNotice: isViewerRole ? OBJECT_LAYER_TEXT.forbidden : null,
    emptyNotice: reviewCounter.total === 0 && !isLoading && !hasError ? OBJECT_LAYER_TEXT.emptyExplanation : null,
    errorMessage: hasError ? OBJECT_LAYER_TEXT.errorMessage : null,
    furnitureAttentionNotice: hasFurnitureAttention ? OBJECT_LAYER_TEXT.furnitureAttention : null,

    onChangeSubtype,
    onChangeSwing,
    onDragPosition,
    onDelete,
    onApprove,
    onAttachToNearestWall,
    onSelectHostWall,

    onSelect,
    onHover,

    onToggleLayer,
    onToggleSubtypeFilter,
    onToggleGroupCollapsed,
    onUndo,
    onToggleCollapsed,

    placements,
    dragMeasurement,
    rows,
    inspector,
    wallOutlines,
    backgroundImageUrl: background?.imageUrl ?? null,
    backgroundImageAlt: background?.imageAlt ?? '',
    millimetresPerPixel: millimetresPerPixelOf(level),
    layerTotalLabel: layerTreeTotalLabel(counts.total),
    partialNotice: lowConfidenceObjects.length === 0 ? null : lowConfidenceNotice(lowConfidenceObjects.length),
    dataLayerTokens: tokens,
    confidenceTokenOf,
    undoStepCount: dispatchBundle.history.undoSteps().length,
    viewport,
    activeLayer,
    activeSubtype,
    isLowConfidenceOnly: lowConfidenceOnly,
    onSelectLayer,
    onSelectSubtypeSlot,
    onToggleSelect,
    onSelectLayerObjects,
    onToggleLowConfidenceOnly,
    onAddManually,
  };
}
