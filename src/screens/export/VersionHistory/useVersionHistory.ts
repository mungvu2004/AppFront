/**
 * Hook của S-33 — lịch sử phiên bản (`/du-an/:projectId/phien-ban`).
 *
 * View thuần chỉ nhận `model` + `actions` (mục D, R-60); tất cả phần còn lại của màn
 * ở đây. File này tiêu thụ `versionHistoryGateway.ts` và không dựng lại thứ gì trong
 * đó — `createVersionHistoryGateway` là cửa vào duy nhất tới dữ liệu phiên bản, và các
 * phép chuyển thuần nằm ở `versionHistoryModel.ts` (tách vì R-22).
 *
 * ## Trạng thái máy chủ: `useQuery`/`useMutation`, không `useState` (R-64)
 *
 * Không có một `useState` nào cho `isLoading` hay `error` ở đây. `useShareLinks.ts` tự
 * viết hai thứ ấy bằng tay và đó là **ngoại lệ đi trước, không phải khuôn mẫu**; khuôn
 * mẫu là `useExportPanel.ts`. `useState` trong file này chỉ giữ lựa chọn của người
 * dùng — cặp phiên bản đang so, tab đang mở, hàng đang trỏ, hộp thoại phục hồi — thứ
 * không ai ngoài màn này biết.
 *
 * ## Bốn quyết định đã chốt, chép lại để không ai gỡ nhầm
 *
 * 1. **Không có nhánh ghi đè.** 409 đi qua `CommitRestoreResult` kind `conflict` của
 *    cổng, thành `model.conflict`, và người đọc được nói AI đã sửa. `RestoreOutcome`
 *    không có trường nào cho phép ghi đè — cố ý.
 * 2. **Phục hồi làm ĐẾM PHIÊN BẢN TĂNG THÊM MỘT.** `appendVersionToHistory` đặt bản
 *    mới lên đầu và không bỏ mục nào, nên `versionCount` không bao giờ giảm sau một
 *    lượt phục hồi. Lịch sử mới ghi thẳng vào bộ nhớ đệm của `versionsQueryKey`.
 * 3. **Gộp theo NGƯỜI không tồn tại ở tầng logic** ⇒ `canGroupByAuthor` là `false` ở
 *    cổng và affordance ấy rời khỏi DOM. Gộp theo NGÀY thì có thật, qua
 *    `isSameCalendarDay` + `formatCalendarDate`.
 * 4. **`sceneLevels`/`sceneFrame` do HOOK nấu**, không phải view: `toBuildFloorInput`
 *    sống ở `@/domain` mà `local/no-data-layer-in-view` chặn trong `.tsx`. Khuôn chép
 *    từ `useViewer3D.ts:402-425`. Chưa có hình học ⇒ `[]` và `null`, và view hiện
 *    caption thay vì canvas — đó là kết quả hợp lệ, không phải stub.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { isEntityOfKind, type NormalizedSpatial } from '@/domain/spatial/normalize';
import { toBuildFloorInput } from '@/domain/spatial/toBuildFloorInput';
import { formatClockTime, formatDuration } from '@/lib/format/datetime';
import { formatNumber } from '@/lib/format/number';
import { MOTION_DURATIONS_MS } from '@/lib/motion/tokens';
import { UNDO_WINDOW_MS, type UndoTicket } from '@/lib/mutations/undoTicket';
import type { BuildFloorInput } from '@/lib/three/build/floor';
import type { VersionDiff } from '@/lib/versioning/diff';
import type { VersionHistoryEntry } from '@/lib/versioning/restore';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useStore } from '@/store';

import type {
  CompareModel,
  CompareTabId,
  ConflictNoticeModel,
  RestoreConfirmModel,
  RestoreOutcome,
  SevenState,
  UseVersionHistoryOptions,
  VersionHistoryActions,
  VersionHistoryModel,
  VersionHistoryOption,
  VersionHistoryResult,
  VisualDiffModel,
} from './types';
import { readFullVersion, versionsQueryKey } from './versionHistoryGateway';
import {
  buildDiffGroups,
  buildJsonLines,
  buildSceneFrame,
  buildVersionRows,
  changedEntityIdsOf,
  countsOf,
  EMPTY_DIFF_COUNTS,
  groupRowsByDay,
} from './versionHistoryModel';

/* -------------------------------------------------------------------------- */
/* 1 — Câu chữ                                                                */
/* -------------------------------------------------------------------------- */

const EMPTY_HISTORY: readonly VersionHistoryEntry[] = Object.freeze([]);
const EMPTY_LEVELS: readonly BuildFloorInput[] = Object.freeze([]);

/** Ba tab của vùng so sánh. "Thay đổi" đứng trước "JSON" vì tiếng thường đi trước JSON thô. */
const COMPARE_TABS: readonly VersionHistoryOption[] = Object.freeze([
  { id: 'changes', label: 'thay đổi' },
  { id: 'json', label: 'JSON' },
  { id: 'visual', label: 'trực quan' },
]);

const TEACHING_SENTENCE =
  'mới có một phiên bản nên chưa có gì để so sánh — mỗi lần bạn sửa bản vẽ, hệ thống tự lưu thêm một phiên bản vào đây';

const NO_COMPARE_PAIR_REASON = 'chưa chọn đủ hai phiên bản để so sánh';

const LIST_ERROR_FALLBACK = 'không tải được danh sách phiên bản của tầng này';

const RESTORE_FORBIDDEN_REASON =
  'vai trò của bạn trên dự án này chỉ đọc được lịch sử, nên nút phục hồi không hiện';

const RESTORE_CAPTION =
  'phục hồi không xoá gì: trạng thái hiện tại được giữ lại thành một phiên bản riêng, và bản phục hồi được thêm lên đầu danh sách';

const NO_MODEL_REASON = 'chưa có mô hình không gian nào được nạp, nên chưa dựng được cảnh';

const BROKEN_MODEL_REASON = 'mô hình hiện tại chưa dựng được thành cảnh, nên tab này để trống';

const NO_SCENE_REASON = 'màn này chưa nối được vào bộ dựng cảnh 3D';

/* -------------------------------------------------------------------------- */
/* 2 — Cặp phiên bản đang so                                                  */
/* -------------------------------------------------------------------------- */

interface VersionPair {
  readonly left: string | null;
  readonly right: string | null;
}

const NO_PAIR: VersionPair = Object.freeze({ left: null, right: null });

/**
 * Cặp mặc định: hai bản đầy đủ mới nhất, bản cũ hơn ở BÊN TRÁI.
 *
 * Bên trái là bản cũ vì `gateway.diff(left, right)` gọi thẳng
 * `diffVersions(previous, next)` — đảo hai bên thì "thêm" đọc thành "xoá".
 */
function defaultPairOf(history: readonly VersionHistoryEntry[]): VersionPair {
  const full = history.filter((entry) => entry.kind === 'full');
  const newer = full[0];
  const older = full[1];

  if (newer === undefined || older === undefined) {
    return NO_PAIR;
  }

  return { left: older.version.id, right: newer.version.id };
}

/** Xếp lại một cặp theo `sequence` để bản cũ luôn ở bên trái. */
function orderPair(pair: VersionPair, history: readonly VersionHistoryEntry[]): VersionPair {
  if (pair.left === null || pair.right === null) {
    return pair;
  }

  const sequenceOf = (id: string): number =>
    history.find((entry) => entry.version.id === id)?.version.sequence ?? 0;

  return sequenceOf(pair.left) <= sequenceOf(pair.right)
    ? pair
    : { left: pair.right, right: pair.left };
}

/* -------------------------------------------------------------------------- */
/* 3 — Hình học của tab "Trực quan"                                           */
/* -------------------------------------------------------------------------- */

interface SceneConversion {
  readonly levels: readonly BuildFloorInput[];
  readonly failed: boolean;
}

const NO_SCENE: SceneConversion = Object.freeze({ levels: EMPTY_LEVELS, failed: false });

/**
 * Đồ thị không gian thành đầu vào dựng sàn, một mục cho mỗi tầng.
 *
 * `toBuildFloorInput` NÉM khi đồ thị hỏng chỉ mục hoặc mang số đo không hữu hạn. Đó là
 * một mô hình không dựng được, không phải sự cố kỹ thuật để hiện mã lỗi — nó thành một
 * câu giải thích trên tab, đúng cách `useViewer3D.ts:418-425` xử lý.
 */
function convertScene(graph: NormalizedSpatial | null): SceneConversion {
  if (graph === null) {
    return NO_SCENE;
  }

  try {
    const levels: BuildFloorInput[] = [];

    for (const id of graph.byKind.level) {
      const entity = graph.byId[id];

      if (entity === undefined || !isEntityOfKind('level', entity)) {
        continue;
      }

      const input = toBuildFloorInput(graph, entity.id);

      if (input !== null) {
        levels.push(input);
      }
    }

    return { levels, failed: false };
  } catch {
    return { levels: EMPTY_LEVELS, failed: true };
  }
}

/* -------------------------------------------------------------------------- */
/* 4 — Hook                                                                   */
/* -------------------------------------------------------------------------- */

export function useVersionHistory(options: UseVersionHistoryOptions): VersionHistoryResult {
  const { gateway, floorId, onToast, onExportVersion } = options;
  const canRestore = options.canRestore ?? true;
  const isNarrow = options.isNarrow ?? false;
  const readNow = options.now;

  const queryClient = useQueryClient();
  const reducedMotion = useReducedMotion();
  const graph = useStore((state) => state.spatial);

  /* ---- Lựa chọn của người dùng ----------------------------------------- */

  const [pickedPair, setPickedPair] = useState<VersionPair | null>(null);
  const [activeTab, setActiveTab] = useState<CompareTabId>('changes');
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  const [restoreTargetId, setRestoreTargetId] = useState<string | null>(null);
  const [isRecomputing, setIsRecomputing] = useState(false);

  /* ---- Đọc: danh sách phiên bản và bản so ------------------------------ */

  const versionsQuery = useQuery({
    queryKey: versionsQueryKey(floorId),
    queryFn: (): Promise<readonly VersionHistoryEntry[]> => gateway.listVersions(floorId),
  });

  const history = versionsQuery.data ?? EMPTY_HISTORY;
  const pair = useMemo(
    () => orderPair(pickedPair ?? defaultPairOf(history), history),
    [pickedPair, history],
  );
  const { left: leftVersionId, right: rightVersionId } = pair;

  const canDiff =
    leftVersionId !== null &&
    rightVersionId !== null &&
    readFullVersion(history, leftVersionId) !== null &&
    readFullVersion(history, rightVersionId) !== null;

  const diffQuery = useQuery({
    queryKey: [...versionsQueryKey(floorId), 'diff', leftVersionId, rightVersionId],
    queryFn: (): Promise<VersionDiff> => {
      if (leftVersionId === null || rightVersionId === null) {
        return Promise.reject(new Error(NO_COMPARE_PAIR_REASON));
      }

      return gateway.diff(leftVersionId, rightVersionId);
    },
    enabled: canDiff,
  });

  const diff = diffQuery.data ?? null;

  /**
   * Một nhịp "đang tính lại" mỗi lần cặp phiên bản đổi.
   *
   * Thời lượng lấy từ `MOTION_DURATIONS_MS.fast` — thang chuyển động chỉ có năm giá
   * trị và không con số nào khác được viết ra ở đây (mục B, R-71).
   */
  useEffect(() => {
    if (!canDiff) {
      setIsRecomputing(false);

      return undefined;
    }

    setIsRecomputing(true);
    const timer = setTimeout(() => {
      setIsRecomputing(false);
    }, MOTION_DURATIONS_MS.fast);

    return () => {
      clearTimeout(timer);
    };
  }, [canDiff, leftVersionId, rightVersionId]);

  /* ---- Ghi: phục hồi, hoàn tác, gắn nhãn -------------------------------- */

  const writeHistory = useCallback(
    (next: readonly VersionHistoryEntry[]): void => {
      queryClient.setQueryData(versionsQueryKey(floorId), next);
    },
    [queryClient, floorId],
  );

  const undoMutation = useMutation<readonly VersionHistoryEntry[], Error, UndoTicket>({
    mutationFn: (ticket) => gateway.undoRestore(ticket),
    onSuccess: writeHistory,
  });

  const restoreMutation = useMutation<RestoreOutcome, Error, string>({
    mutationFn: (versionId) => gateway.restore(versionId),
    onSuccess: (outcome, versionId) => {
      if (outcome.kind !== 'restored' || outcome.history === undefined) {
        return;
      }

      writeHistory(outcome.history);

      const label = history.find((entry) => entry.version.id === versionId)?.version.sequence;
      const ticket = outcome.undoTicket;
      const restored =
        label === undefined ? '' : ` v${formatNumber(label, { grouping: false })}`;

      onToast?.({
        message: `đã phục hồi nội dung của phiên bản${restored}; hoàn tác được trong ${formatDuration(UNDO_WINDOW_MS)}`,
        ...(ticket === undefined
          ? {}
          : {
              onUndo: (): void => {
                undoMutation.mutate(ticket);
              },
            }),
      });
    },
  });

  const tagMutation = useMutation<void, Error, { versionId: string; label: string }>({
    mutationFn: async ({ versionId, label }) => {
      await gateway.tagVersion?.(versionId, label);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: versionsQueryKey(floorId) });
    },
  });

  /* ---- Hàng, nhóm, ba số đếm ------------------------------------------- */

  const now = useMemo(() => (readNow === undefined ? new Date() : readNow()), [readNow, history]);

  const builds = useMemo(
    () => buildVersionRows({ history, now, leftVersionId, rightVersionId }),
    [history, now, leftVersionId, rightVersionId],
  );

  const rows = useMemo(() => builds.map((build) => build.row), [builds]);
  const groups = useMemo(() => groupRowsByDay(builds, now), [builds, now]);

  const versionOptions = useMemo(
    (): readonly VersionHistoryOption[] =>
      builds
        .filter((build) => !build.row.isMetadataOnly)
        .map((build) => ({
          id: build.row.id,
          label: `${build.row.label} · ${build.row.relativeTimeLabel}`,
        })),
    [builds],
  );

  /* ---- Tab "Trực quan" -------------------------------------------------- */

  const scene = useMemo(() => convertScene(graph), [graph]);
  const sceneFrame = useMemo(
    () => buildSceneFrame(scene.levels, reducedMotion),
    [scene.levels, reducedMotion],
  );

  const changedEntityIds = useMemo((): readonly string[] => {
    if (diff === null) {
      return [];
    }

    const ids = changedEntityIdsOf(diff);

    // Tô sáng một mã không có trong đồ thị hiện tại là tô vào chỗ trống: đối tượng ấy
    // đã bị xoá kể từ bản cũ. Lọc ở đây để caption đếm đúng thứ người xem thật sự thấy.
    return graph === null ? ids : ids.filter((id) => graph.byId[id] !== undefined);
  }, [diff, graph]);

  const visual = useMemo((): VisualDiffModel => {
    const isAvailable = gateway.capabilities.canShowCurrentModel3d && sceneFrame !== null;
    const leftLabel = builds.find((build) => build.row.id === leftVersionId)?.row.label ?? null;
    const marked = formatNumber(changedEntityIds.length);

    return {
      isAvailable,
      unavailableReason: unavailableReasonOf(gateway.capabilities.canShowCurrentModel3d, graph, scene),
      isBuilding: isAvailable && diffQuery.isFetching,
      caption:
        leftLabel === null
          ? `đây là mô hình hiện tại chứ không phải một bản cũ; ${marked} đối tượng đã đổi đang được tô sáng`
          : `đây là mô hình hiện tại chứ không phải phiên bản ${leftLabel}; ${marked} đối tượng đã đổi đang được tô sáng`,
      sceneLevels: scene.levels,
      sceneFrame,
      changedEntityIds,
      hoveredEntityId: gateway.capabilities.canHighlightEntity ? hoveredEntityId : null,
    };
  }, [
    gateway.capabilities,
    sceneFrame,
    scene,
    graph,
    builds,
    leftVersionId,
    changedEntityIds,
    diffQuery.isFetching,
    hoveredEntityId,
  ]);

  /* ---- Vùng so sánh ----------------------------------------------------- */

  const compare = useMemo(
    (): CompareModel => ({
      leftOptions: versionOptions,
      rightOptions: versionOptions,
      leftVersionId,
      rightVersionId,
      activeTab,
      tabs: COMPARE_TABS,
      totals: diff === null ? EMPTY_DIFF_COUNTS : countsOf(diff),
      groups: diff === null ? [] : buildDiffGroups(diff),
      jsonLines: diff === null ? [] : buildJsonLines(diff),
      visual,
      isRecomputing,
      teachingSentence: history.length <= 1 ? TEACHING_SENTENCE : null,
    }),
    [versionOptions, leftVersionId, rightVersionId, activeTab, diff, visual, isRecomputing, history.length],
  );

  /* ---- Phục hồi: hộp thoại, xung đột, lỗi ------------------------------- */

  const targetLabel =
    restoreTargetId === null
      ? null
      : (builds.find((build) => build.row.id === restoreTargetId)?.row.label ?? null);

  const restoreConfirm = useMemo(
    (): RestoreConfirmModel => ({
      isOpen: restoreTargetId !== null,
      title:
        targetLabel === null ? 'phục hồi phiên bản này?' : `phục hồi phiên bản ${targetLabel}?`,
      reassurance: RESTORE_CAPTION,
      confirmLabel: 'phục hồi',
      cancelLabel: 'để nguyên',
      targetVersionLabel: targetLabel,
    }),
    [restoreTargetId, targetLabel],
  );

  const outcome = restoreMutation.data;
  const conflict: ConflictNoticeModel | null =
    outcome !== undefined && outcome.kind === 'conflict' ? (outcome.conflict ?? null) : null;

  const errorMessage = readErrorMessage([
    versionsQuery.error,
    diffQuery.error,
    restoreMutation.error,
    undoMutation.error,
    tagMutation.error,
  ]);

  const savedAtLabel =
    history[0] === undefined ? null : `đã lưu lúc ${formatClockTime(history[0].version.createdAt)}`;

  const state = useMemo((): SevenState => {
    if (!canRestore) {
      return 'forbidden';
    }
    if (versionsQuery.isPending) {
      return 'loading';
    }
    if (errorMessage !== null) {
      return 'error';
    }
    if (isNarrow) {
      return 'collapsed';
    }
    if (history.length <= 1) {
      return 'empty';
    }

    return visual.isBuilding || rows.some((row) => row.isMetadataOnly) ? 'partial' : 'success';
  }, [canRestore, versionsQuery.isPending, errorMessage, isNarrow, history.length, visual.isBuilding, rows]);

  /* ---- Việc làm được ---------------------------------------------------- */

  const pickPair = useCallback((next: (previous: VersionPair) => VersionPair): void => {
    setPickedPair((previous) => next(previous ?? NO_PAIR));
  }, []);

  const actions = useMemo(
    (): VersionHistoryActions => ({
      selectLeftVersion: (versionId) => {
        pickPair((previous) => ({ ...previous, left: versionId }));
      },
      selectRightVersion: (versionId) => {
        pickPair((previous) => ({ ...previous, right: versionId }));
      },
      toggleCompareSelection: (versionId) => {
        setPickedPair((previous) => togglePick(previous ?? pair, versionId));
      },
      setTab: setActiveTab,
      hoverDiffRow: setHoveredEntityId,
      requestRestore: setRestoreTargetId,
      confirmRestore: () => {
        if (restoreTargetId !== null) {
          restoreMutation.mutate(restoreTargetId);
        }

        setRestoreTargetId(null);
      },
      cancelRestore: () => {
        setRestoreTargetId(null);
      },
      exportVersion: (versionId) => {
        onExportVersion?.(versionId);
      },
      tagVersion: (versionId, label) => {
        if (gateway.tagVersion !== undefined) {
          tagMutation.mutate({ versionId, label });
        }
      },
      dismissConflict: () => {
        restoreMutation.reset();
      },
    }),
    [pickPair, pair, restoreTargetId, restoreMutation, tagMutation, gateway, onExportVersion],
  );

  const model = useMemo(
    (): VersionHistoryModel => ({
      state,
      groups,
      rows,
      versionCount: history.length,
      isNarrow,
      compare,
      canRestore,
      restoreHiddenReason: canRestore ? null : RESTORE_FORBIDDEN_REASON,
      canTagVersion: gateway.capabilities.canTagVersion && gateway.tagVersion !== undefined,
      // R-73: xuất một phiên bản là ĐIỀU HƯỚNG sang S-34, nên khả năng ấy đúng bằng
      // "nơi gọi có cấp callback không" — không đợi một endpoint xuất-theo-phiên-bản nào.
      canExportVersion: onExportVersion !== undefined,
      restoreCaption: RESTORE_CAPTION,
      restoreConfirm,
      conflict,
      errorMessage,
      savedAtLabel,
    }),
    [
      state,
      groups,
      rows,
      history.length,
      isNarrow,
      compare,
      canRestore,
      gateway,
      onExportVersion,
      restoreConfirm,
      conflict,
      errorMessage,
      savedAtLabel,
    ],
  );

  return [model, actions];
}

/* -------------------------------------------------------------------------- */
/* 5 — Phép phụ                                                               */
/* -------------------------------------------------------------------------- */

/** Vì sao tab "Trực quan" không dựng được cảnh; `null` khi nó dựng được. */
function unavailableReasonOf(
  canShowCurrentModel3d: boolean,
  graph: NormalizedSpatial | null,
  scene: SceneConversion,
): string | null {
  if (!canShowCurrentModel3d) {
    return NO_SCENE_REASON;
  }
  if (graph === null) {
    return NO_MODEL_REASON;
  }
  if (scene.failed || scene.levels.length === 0) {
    return BROKEN_MODEL_REASON;
  }

  return null;
}

/** Lỗi đầu tiên có thật trong danh sách, thành một câu người đọc hiểu. */
function readErrorMessage(errors: readonly (Error | null)[]): string | null {
  for (const error of errors) {
    if (error !== null) {
      return error.message.length === 0 ? LIST_ERROR_FALLBACK : error.message;
    }
  }

  return null;
}

/**
 * Bật/tắt một phiên bản trong cặp đang so.
 *
 * Đã chọn đủ hai bản thì lượt bấm thứ ba không làm gì — `isPickable` của hàng đã tắt ô
 * tích trước đó, và một lượt bấm lọt qua được không được phép lặng lẽ thay bản khác.
 */
function togglePick(pair: VersionPair, versionId: string): VersionPair {
  if (pair.left === versionId) {
    return { ...pair, left: null };
  }
  if (pair.right === versionId) {
    return { ...pair, right: null };
  }
  if (pair.left === null) {
    return { ...pair, left: versionId };
  }
  if (pair.right === null) {
    return { ...pair, right: versionId };
  }

  return pair;
}
