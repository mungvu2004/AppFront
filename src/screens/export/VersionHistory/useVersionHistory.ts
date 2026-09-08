/**
 * Hook của S-33 — lịch sử phiên bản (`/du-an/:projectId/phien-ban`).
 *
 * View thuần chỉ nhận `model` + `actions` (mục D, R-60); tất cả phần còn lại của màn ở
 * đây. File này tiêu thụ `versionHistoryGateway.ts` và không dựng lại thứ gì trong đó —
 * `createVersionHistoryGateway` là cửa vào duy nhất tới dữ liệu phiên bản.
 *
 * Ba file anh em, tách vì R-22 (một file gộp lại vượt 400 dòng), đều thuần và không có
 * React: `versionHistoryModel.ts` (hàng, nhóm, ba số đếm, JSON thô),
 * `versionHistoryScene.ts` (tab "Trực quan"), `versionHistoryCompare.ts` (cặp phiên bản
 * đang so, dải tab).
 *
 * ## Trạng thái máy chủ: `useQuery`/`useMutation`, không `useState` (R-64)
 *
 * Không có một `useState` nào cho `isLoading` hay `error` ở đây. `useShareLinks.ts` tự
 * viết hai thứ ấy bằng tay và đó là **ngoại lệ đi trước, không phải khuôn mẫu**; khuôn
 * mẫu là `useExportPanel.ts`. `useState` trong file này chỉ giữ lựa chọn của người dùng
 * — cặp phiên bản đang so, tab đang mở, hàng đang trỏ, hộp thoại phục hồi — thứ không
 * ai ngoài màn này biết.
 *
 * ## Bốn quyết định đã chốt, chép lại để không ai gỡ nhầm
 *
 * 1. **Không có nhánh ghi đè.** 409 đi qua `CommitRestoreResult` kind `conflict` của
 *    cổng, thành `model.conflict`, và người đọc được nói AI đã sửa. `RestoreOutcome`
 *    không có trường nào cho phép ghi đè — cố ý.
 * 2. **Phục hồi làm ĐẾM PHIÊN BẢN TĂNG THÊM MỘT.** `appendVersionToHistory` đặt bản mới
 *    lên đầu và không bỏ mục nào, nên `versionCount` không bao giờ giảm sau một lượt
 *    phục hồi. Lịch sử mới ghi thẳng vào bộ nhớ đệm của `versionsQueryKey`.
 * 3. **Gộp theo NGƯỜI không tồn tại ở tầng logic** ⇒ `canGroupByAuthor` là `false` ở
 *    cổng và affordance ấy rời khỏi DOM. Gộp theo NGÀY thì có thật, qua
 *    `isSameCalendarDay` + `formatCalendarDate`.
 * 4. **`sceneLevels`/`sceneFrame` do HOOK nấu**, không phải view: `toBuildFloorInput`
 *    sống ở `@/domain` mà `local/no-data-layer-in-view` chặn trong `.tsx`. Chưa có hình
 *    học ⇒ `[]` và `null`, và view hiện caption thay vì canvas — đó là kết quả hợp lệ,
 *    không phải stub.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { formatClockTime, formatDuration } from '@/lib/format/datetime';
import { formatNumber } from '@/lib/format/number';
import { MOTION_DURATIONS_MS } from '@/lib/motion/tokens';
import { UNDO_WINDOW_MS, type UndoTicket } from '@/lib/mutations/undoTicket';
import type { VersionDiff } from '@/lib/versioning/diff';
import type { VersionHistoryEntry } from '@/lib/versioning/restore';
import { useStore } from '@/store';

import type {
  CompareModel,
  CompareTabId,
  ConflictNoticeModel,
  RestoreOutcome,
  SevenState,
  UseVersionHistoryOptions,
  VersionHistoryActions,
  VersionHistoryModel,
  VersionHistoryOption,
  VersionHistoryResult,
  VisualDiffModel,
} from './types';
import {
  COMPARE_TABS,
  defaultPairOf,
  NO_COMPARE_PAIR_REASON,
  orderPair,
  TEACHING_SENTENCE,
  togglePick,
  type VersionPair,
} from './versionHistoryCompare';
import { readFullVersion, versionsQueryKey } from './versionHistoryGateway';
import {
  buildDiffGroups,
  buildJsonLines,
  buildRestoreConfirm,
  buildVersionRows,
  countsOf,
  EMPTY_DIFF_COUNTS,
  groupRowsByDay,
  readErrorMessage,
  RESTORE_CAPTION,
  RESTORE_FORBIDDEN_REASON,
} from './versionHistoryModel';
import { buildSceneFrame, buildVisualModel, convertScene } from './versionHistoryScene';

/* -------------------------------------------------------------------------- */
/* 1 — Câu chữ của riêng hook                                                 */
/* -------------------------------------------------------------------------- */

const EMPTY_HISTORY: readonly VersionHistoryEntry[] = Object.freeze([]);

/* -------------------------------------------------------------------------- */
/* 2 — Hook                                                                   */
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
  /*
   * Phiên bản đang chờ xác nhận, giữ SONG SONG trong một ref.
   *
   * `confirmRestore()` không nhận tham số (hợp đồng), nên nó phải đọc mục tiêu ở đâu đó.
   * Đọc từ `restoreTargetId` một mình là đọc qua closure của lượt render hiện tại: gọi
   * `requestRestore(id)` rồi `confirmRestore()` trong CÙNG một nhịp — thứ hợp đồng cho phép,
   * và thứ bộ kiểm làm — sẽ thấy `null` và lượt phục hồi im lặng không xảy ra. Ref được ghi
   * ngay trong `requestRestore`, nên thứ tự trong một nhịp không còn quyết định kết quả.
   */
  const restoreTargetRef = useRef<string | null>(null);
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
              /*
               * Phiếu hết hạn thì KHÔNG gọi cổng.
               *
               * `UNDO_WINDOW_MS` là lời hứa của A8 và phiếu tự biết mình còn sống hay
               * không (`undoTicket.ts:51-56`). Gửi một phiếu đã hết hạn ra cổng là một
               * lượt ghi mà người dùng không còn quyền yêu cầu — cổng thật có ném nó đi
               * hay không cũng không đổi được điều đó.
               */
              onUndo: (): void => {
                if (ticket.getStatus() === 'active') {
                  undoMutation.mutate(ticket);
                }
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

  /**
   * Mốc "bây giờ" mà mọi nhãn thời gian tương đối đo từ đó.
   *
   * Không bơm đồng hồ vào thì nó là LÚC DANH SÁCH VỀ (`dataUpdatedAt`), không phải lúc
   * render: hai thứ ấy chỉ lệch nhau vài mili giây, nhưng lấy mốc của dữ liệu thì
   * "12 phút trước" mới trẻ lại đúng vào lượt đọc sau chứ không đổi mỗi lần React vẽ
   * lại vì một lý do không liên quan. Trước lượt đọc đầu tiên `dataUpdatedAt` là 0, và
   * năm 1970 không phải một câu trả lời — lúc ấy dùng đồng hồ máy.
   */
  const dataUpdatedAt = versionsQuery.dataUpdatedAt;
  const now = useMemo((): Date => {
    if (readNow !== undefined) {
      return readNow();
    }

    return dataUpdatedAt === 0 ? new Date() : new Date(dataUpdatedAt);
  }, [readNow, dataUpdatedAt]);

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

  const visual = useMemo(
    (): VisualDiffModel =>
      buildVisualModel({
        capabilities: gateway.capabilities,
        graph,
        scene,
        sceneFrame,
        diff,
        leftVersionLabel:
          builds.find((build) => build.row.id === leftVersionId)?.row.label ?? null,
        hoveredEntityId,
        isFetchingDiff: diffQuery.isFetching,
      }),
    [
      gateway.capabilities,
      graph,
      scene,
      sceneFrame,
      diff,
      builds,
      leftVersionId,
      hoveredEntityId,
      diffQuery.isFetching,
    ],
  );

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

  const restoreConfirm = useMemo(
    () => buildRestoreConfirm(builds, restoreTargetId),
    [builds, restoreTargetId],
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

  // A7: không có nút lưu, nên "đã lưu lúc mấy giờ" đọc từ mốc của phiên bản mới nhất —
  // đó chính là lượt tự lưu gần nhất, không phải một đồng hồ riêng của màn.
  const savedAtLabel =
    history[0] === undefined
      ? null
      : `đã lưu lúc ${formatClockTime(new Date(history[0].version.createdAt))}`;

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

  // Sửa cặp đang so, bắt đầu từ cặp ĐANG HIỆN chứ không từ rỗng: chưa ai bấm gì thì
  // `pickedPair` là `null` và màn đang hiện cặp mặc định, nên đổi một bên lúc ấy mà bắt
  // đầu từ một cặp rỗng sẽ xoá mất bên kia ngay trước mắt người dùng.
  const pickPair = useCallback(
    (next: (previous: VersionPair) => VersionPair): void => {
      setPickedPair((previous) => next(previous ?? pair));
    },
    [pair],
  );

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
      requestRestore: (versionId) => {
        restoreTargetRef.current = versionId;
        setRestoreTargetId(versionId);
      },
      confirmRestore: () => {
        const target = restoreTargetRef.current ?? restoreTargetId;

        if (target !== null) {
          restoreMutation.mutate(target);
        }

        restoreTargetRef.current = null;
        setRestoreTargetId(null);
      },
      cancelRestore: () => {
        restoreTargetRef.current = null;
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
/* 3 — Phép phụ                                                               */
/* -------------------------------------------------------------------------- */
