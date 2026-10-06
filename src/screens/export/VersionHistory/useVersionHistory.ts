/**
 * Hook của S-33 — lịch sử phiên bản theo tầng (`/projects/:id/versions`).
 *
 * View thuần chỉ nhận `model` + `actions` (mục D); mọi câu, mọi phép tính ở đây hoặc ở
 * `versionHistoryModel.ts`/`versionHistoryScene.ts`/`versionHistoryCompare.ts` (thuần).
 *
 * ## Đọc
 * - N17: `useInfiniteQuery` trên `versionsQueryKey(floorId)` qua `gateway.listVersionPage`.
 * - N18: một `useQueries`, khoá `['version','snapshot',floorId,versionId]` — NGOÀI tiền tố N17,
 *   nên phục hồi không vô hiệu nội dung bất biến; `staleTime: Infinity`; tối đa
 *   {@link SNAPSHOT_CONCURRENCY} lượt cùng lúc; nạp trước {@link SNAPSHOT_PREFETCH_LIMIT} hàng đầu
 *   cộng cặp đang so, hàng khác nạp khi được chọn; `hasSnapshot: false` không gọi.
 *
 * ## Ghi (phục hồi, hoàn tác, "Tải lại")
 * 1. **Xả trước:** `flushAutosaves()`; tầng còn trong `unsavedFloorIds` → hộp thoại A9; đồng ý
 *    thì `discardFloor`, huỷ thì dừng.
 * 2. `baseVersion` = `floorMeta[floorId].revision` (vắng thì N16) — không bao giờ `sequence`.
 * 3. **Chuỗi nạp lại:** N16 → `replaceFloorLayer(..., { external: true })` (lớp và `revision`
 *    cùng một `set`, xoá zundo, tăng `serverReplaceSeq`) → `applyInvalidation('restoreVersion')`.
 *    N16 hỏng thì `revision` trong kho không đổi (lượt tự lưu sau nhận 409, không ghi đè) và dải
 *    "Tải lại" hiện. **Nợ:** kích thước của tầng vừa phục hồi hiện cũ tới khi tải lại trang.
 * 4. Không nhánh ghi đè: xung đột thành dải "Tải lại" (`model.conflict`).
 */

import { useInfiniteQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { FloorVersionSummary } from '@/api/schemas/versions';
import { flushAutosaves, useFloorLayerAutosave } from '@/hooks/useAutosave';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { formatDuration } from '@/lib/format/datetime';
import { MOTION_DURATIONS_MS } from '@/lib/motion/tokens';
import { createUndoTicket, UNDO_WINDOW_MS, type UndoTicket } from '@/lib/mutations/undoTicket';
import { applyInvalidation } from '@/lib/query/invalidation';
import { diffVersions } from '@/lib/versioning/diff';
import type { VersionHistoryEntry } from '@/lib/versioning/restore';
import { useStore } from '@/store';
import { replaceFloorLayer } from '@/store/commit';

import type {
  CompareModel,
  CompareTabId,
  ConflictNoticeModel,
  SevenState,
  UseVersionHistoryOptions,
  VersionHistoryActions,
  VersionHistoryModel,
  VersionHistoryOption,
  VersionHistoryResult,
  VersionSnapshotRead,
  VisualDiffModel,
} from './types';
import { COMPARE_TABS, compareSentenceOf, defaultPairOf, orderPair, togglePick, type VersionPair } from './versionHistoryCompare';
import {
  readFullVersion,
  toConflictNotice,
  toVersionMetadata,
  VERSION_LIST_FAILED_REASON,
  versionsQueryKey,
} from './versionHistoryGateway';
import {
  buildDiffGroups,
  buildJsonLines,
  buildRestoreConfirm,
  buildVersionRows,
  countsOf,
  createConcurrencyLimit,
  createPendingAnswer,
  EMPTY_DIFF_COUNTS,
  groupRowsByDay,
  isForbiddenRead,
  RELOAD_FAILED_NOTICE,
  RESTORE_CAPTION,
  RESTORE_FORBIDDEN_REASON,
  type RestoreDialog,
  writeErrorNotice,
} from './versionHistoryModel';
import { buildSceneFrame, buildVisualModel, convertScene } from './versionHistoryScene';

/** Lượt N18 cùng lúc. */
export const SNAPSHOT_CONCURRENCY = 2;
/** Số hàng đầu được nạp N18 trước khi ai chọn. */
export const SNAPSHOT_PREFETCH_LIMIT = 10;

/** Khoá N18 — ngoài tiền tố `versionsQueryKey`, nên `restoreVersion` không vô hiệu nó. */
export const snapshotQueryKey = (floorId: string, versionId: string) =>
  ['version', 'snapshot', floorId, versionId] as const;

interface Banner {
  readonly kind: 'reload' | 'error';
  readonly notice: ConflictNoticeModel;
}

/** Ổn định ở cấp module để `combine` của `useQueries` giữ được kết quả khi không gì đổi. */
const combineSnapshots = (results: readonly { data?: VersionSnapshotRead | undefined; isFetching: boolean }[]) => ({
  reads: results.map((result) => result.data),
  fetching: results.map((result) => result.isFetching),
});
type FlushOutcome = 'clean' | 'discarded' | 'cancelled';

const capitalizeFirst = (text: string): string => `${text.charAt(0).toLocaleUpperCase('vi-VN')}${text.slice(1)}`;

const EMPTY_SUMMARIES: readonly FloorVersionSummary[] = Object.freeze([]);

export function useVersionHistory(options: UseVersionHistoryOptions): VersionHistoryResult {
  const { apiClient, floorId, floorOptions, gateway, onExportVersion, onSelectFloor, onToast, projectId } = options;
  const canRestore = options.canRestore ?? true;
  const isNarrow = options.isNarrow ?? false;
  const readNow = options.now;

  const queryClient = useQueryClient();
  const reducedMotion = useReducedMotion();
  const graph = useStore((state) => state.spatial);
  const currentRevision = useStore((state) => state.floorMeta[floorId]?.revision ?? null);
  // Màn không có engine nào khác: gắn bộ lưu lớp tầng để `flushAutosaves()` xả được ống (F-04x-1).
  const { discardFloor } = useFloorLayerAutosave({ projectId, floorId, ...(apiClient !== undefined ? { apiClient } : {}) });
  /** Tên tầng (tên riêng, giữ hoa); vắng thì "tầng này". */
  const floorName = floorOptions?.find((option) => option.id === floorId)?.label ?? 'tầng này';

  /* ---- Lựa chọn của người dùng ----------------------------------------- */

  const [pickedPair, setPickedPair] = useState<VersionPair | null>(null);
  const [activeTab, setActiveTab] = useState<CompareTabId>('changes');
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<RestoreDialog | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [isRecomputing, setIsRecomputing] = useState(false);
  /** `confirmRestore()` gọi ngay sau `requestRestore()` trong cùng nhịp vẫn thấy mục tiêu. */
  const dialogRef = useRef<RestoreDialog | null>(null);
  const [discardQuestion] = useState(createPendingAnswer);

  const openDialog = useCallback((next: RestoreDialog | null): void => {
    dialogRef.current = next;
    setDialog(next);
  }, []);

  // Đổi tầng: bỏ cặp so, dải, hộp thoại của tầng cũ. Câu A9 đang chờ nhận "huỷ" để lượt ghi
  // của tầng cũ kết thúc thay vì treo trên `await`.
  useEffect(() => {
    setPickedPair(null);
    setBanner(null);
    discardQuestion.answer(false);
    openDialog(null);
  }, [discardQuestion, floorId, openDialog]);

  /* ---- N17 ---------------------------------------------------------------- */

  const versionsQuery = useInfiniteQuery({
    queryKey: versionsQueryKey(floorId),
    queryFn: ({ pageParam }) => gateway.listVersionPage(pageParam === undefined ? {} : { cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
  });

  const summaries = useMemo((): readonly FloorVersionSummary[] => {
    const byId = new Map<string, FloorVersionSummary>();

    for (const item of versionsQuery.data?.pages.flatMap((page) => page.items) ?? EMPTY_SUMMARIES) {
      byId.set(item.id, item);
    }

    return [...byId.values()].sort((a, b) => b.sequence - a.sequence);
  }, [versionsQuery.data]);
  const summaryMap = useMemo(() => new Map(summaries.map((item) => [item.id, item])), [summaries]);

  /* ---- N18 ---------------------------------------------------------------- */

  const [limit] = useState(() => createConcurrencyLimit(SNAPSHOT_CONCURRENCY));
  const wanted = useMemo(
    () =>
      new Set([
        ...summaries.slice(0, SNAPSHOT_PREFETCH_LIMIT).map((item) => item.id),
        ...[pickedPair?.left, pickedPair?.right].filter((id): id is string => typeof id === 'string'),
      ]),
    [summaries, pickedPair],
  );
  const snapshots = useQueries({
    queries: summaries.map((item) => ({
      queryKey: snapshotQueryKey(floorId, item.id),
      queryFn: (): Promise<VersionSnapshotRead> => limit(() => gateway.readSnapshot(item.id)),
      enabled: item.hasSnapshot && wanted.has(item.id),
      staleTime: Infinity,
    })),
    combine: combineSnapshots,
  });
  const snapshotsInFlight = snapshots.fetching.some(Boolean);
  const snapshotData = snapshots.reads;

  const { history, purgedIds } = useMemo(() => {
    const purged = new Set<string>();
    const entries = summaries.map((item, index): VersionHistoryEntry => {
      const read = snapshotData[index];

      if (!item.hasSnapshot || read?.kind === 'purged') {
        purged.add(item.id);
      }

      return read?.kind === 'snapshot'
        ? { kind: 'full', version: { ...toVersionMetadata(item), snapshot: read.snapshot } }
        : { kind: 'metadataOnly', version: toVersionMetadata(item) };
    });

    return { history: entries, purgedIds: purged };
  }, [summaries, snapshotData]);

  /* ---- Cặp so, diff ----------------------------------------------------- */

  const pair = useMemo(() => orderPair(pickedPair ?? defaultPairOf(history), history), [pickedPair, history]);
  const { left: leftVersionId, right: rightVersionId } = pair;
  const left = leftVersionId === null ? null : readFullVersion(history, leftVersionId);
  const right = rightVersionId === null ? null : readFullVersion(history, rightVersionId);
  const canDiff = left !== null && right !== null;
  const diff = useMemo(() => (left !== null && right !== null ? diffVersions(left.snapshot, right.snapshot) : null), [left, right]);
  const pairFetching = snapshots.fetching.some(
    (fetching, index) => fetching && [leftVersionId, rightVersionId].includes(summaries[index]?.id ?? null),
  );

  useEffect(() => {
    if (!canDiff) {
      setIsRecomputing(false);

      return undefined;
    }

    setIsRecomputing(true);
    const timer = setTimeout(() => setIsRecomputing(false), MOTION_DURATIONS_MS.fast);

    return () => clearTimeout(timer);
  }, [canDiff, leftVersionId, rightVersionId]);

  /* ---- Hàng, nhóm ------------------------------------------------------- */

  const dataUpdatedAt = versionsQuery.dataUpdatedAt;
  const now = useMemo((): Date => {
    if (readNow !== undefined) {
      return readNow();
    }

    return dataUpdatedAt === 0 ? new Date() : new Date(dataUpdatedAt);
  }, [readNow, dataUpdatedAt]);

  const builds = useMemo(
    () =>
      buildVersionRows({ history, now, leftVersionId, rightVersionId, summaries: summaryMap, purgedIds, currentRevision }),
    [history, now, leftVersionId, rightVersionId, summaryMap, purgedIds, currentRevision],
  );
  const rows = useMemo(() => builds.map((build) => build.row), [builds]);
  const groups = useMemo(() => groupRowsByDay(builds, now), [builds, now]);
  const versionOptions = useMemo(
    (): readonly VersionHistoryOption[] =>
      builds
        .filter((build) => !build.row.isMetadataOnly)
        .map((build) => ({ id: build.row.id, label: `${build.row.label} · ${build.row.relativeTimeLabel}` })),
    [builds],
  );

  /* ---- Tab "Trực quan", vùng so sánh ----------------------------------- */

  const scene = useMemo(() => convertScene(graph), [graph]);
  const sceneFrame = useMemo(() => buildSceneFrame(scene.levels, reducedMotion), [scene.levels, reducedMotion]);
  const visual = useMemo(
    (): VisualDiffModel =>
      buildVisualModel({
        capabilities: gateway.capabilities,
        graph,
        scene,
        sceneFrame,
        diff,
        leftVersionLabel: builds.find((build) => build.row.id === leftVersionId)?.row.label ?? null,
        hoveredEntityId,
        isFetchingDiff: pairFetching,
      }),
    [gateway.capabilities, graph, scene, sceneFrame, diff, builds, leftVersionId, hoveredEntityId, pairFetching],
  );

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
      teachingSentence: compareSentenceOf({
        hasDiff: diff !== null,
        isLoading: pairFetching || snapshotsInFlight,
        versionCount: history.length,
        fullCount: history.filter((entry) => entry.kind === 'full').length,
      }),
    }),
    [versionOptions, leftVersionId, rightVersionId, activeTab, diff, visual, isRecomputing, history, pairFetching, snapshotsInFlight],
  );

  /* ---- Ghi --------------------------------------------------------------- */

  const canTagVersion = gateway.capabilities.canTagVersion && gateway.tagVersion !== undefined && canRestore;
  const ticketNow = useMemo(() => (readNow === undefined ? {} : { now: () => readNow().getTime() }), [readNow]);

  /** Xả ống; tầng còn bẩn → hỏi A9. */
  const flushFirst = useCallback(async (): Promise<FlushOutcome> => {
    try {
      await flushAutosaves();
    } catch {
      // Lượt xả hỏng để tầng còn bẩn; câu hỏi A9 dưới đây mới là chỗ quyết.
    }

    if (!useStore.getState().unsavedFloorIds.includes(floorId)) {
      return 'clean';
    }

    const question = discardQuestion.ask();

    openDialog({ kind: 'discard' });

    if (!(await question)) {
      return 'cancelled';
    }

    discardFloor(floorId);

    return 'discarded';
  }, [discardFloor, discardQuestion, floorId, openDialog]);

  /** Chuỗi nạp lại tầng: N16 → `replaceFloorLayer` (external) → vô hiệu `restoreVersion`. */
  const reloadFloor = useCallback(async (): Promise<void> => {
    try {
      const { layer, revision } = await gateway.readFloorLayer();

      replaceFloorLayer(floorId, { layer, revision }, { external: true });
    } catch {
      setBanner({ kind: 'reload', notice: RELOAD_FAILED_NOTICE });
    }

    applyInvalidation(queryClient, 'restoreVersion', { floorId, projectId });
  }, [floorId, gateway, projectId, queryClient]);

  const runUndo = useCallback(
    async (ticket: UndoTicket): Promise<void> => {
      if (ticket.getStatus() !== 'active') {
        return;
      }

      const flushed = await flushFirst();

      if (flushed === 'cancelled') {
        return;
      }

      try {
        const outcome = await gateway.revertRestore(ticket);

        if (outcome.kind === 'conflict') {
          setBanner({ kind: 'reload', notice: outcome.conflict ?? toConflictNotice(null) });
          if (flushed === 'discarded') await reloadFloor();

          return;
        }

        await reloadFloor();
        onToast?.({ message: 'Đã hoàn tác lượt phục hồi' });
      } catch (error) {
        setBanner({ kind: 'error', notice: writeErrorNotice('undo', error) });
        if (flushed === 'discarded') await reloadFloor();
      }
    },
    [flushFirst, gateway, onToast, reloadFloor],
  );

  const runRestore = useCallback(
    async (versionId: string): Promise<void> => {
      const flushed = await flushFirst();

      if (flushed === 'cancelled') {
        return;
      }

      try {
        const base = useStore.getState().floorMeta[floorId]?.revision ?? (await gateway.readFloorLayer()).revision;
        const outcome = await gateway.restore(versionId, base);

        if (outcome.kind === 'conflict') {
          setBanner({ kind: 'reload', notice: outcome.conflict ?? toConflictNotice(null) });
          if (flushed === 'discarded') await reloadFloor();

          return;
        }

        if (outcome.unchanged === true) {
          void queryClient.invalidateQueries({ queryKey: versionsQueryKey(floorId) });
          onToast?.({ message: 'Phiên bản này trùng với hiện trạng' });
          // Bản sửa vừa bỏ vẫn nằm trong kho (`discardFloor` chỉ xoá cờ bẩn) — trả kho về bản máy chủ.
          if (flushed === 'discarded') await reloadFloor();

          return;
        }

        await reloadFloor();

        const ticket = outcome.undoTicket;
        const label = summaryMap.get(versionId)?.sequence;

        onToast?.({
          message: `Đã phục hồi phiên bản${label === undefined ? '' : ` v${String(label)}`} của ${floorName}; hoàn tác được trong ${formatDuration(UNDO_WINDOW_MS)}`,
          ...(ticket === undefined ? {} : { onUndo: () => void runUndo(ticket) }),
        });
      } catch (error) {
        setBanner({ kind: 'error', notice: writeErrorNotice('restore', error) });
        if (flushed === 'discarded') await reloadFloor();
      }
    },
    [flushFirst, floorId, floorName, gateway, onToast, queryClient, reloadFloor, runUndo, summaryMap],
  );

  const sendLabel = useCallback(
    async (versionId: string, label: string, previous: string | null): Promise<void> => {
      try {
        await gateway.tagVersion?.(versionId, label);
        void queryClient.invalidateQueries({ queryKey: versionsQueryKey(floorId) });

        if (previous === null) {
          return;
        }

        const ticket = createUndoTicket({
          description: 'Hoàn tác nhãn phiên bản',
          ...ticketNow,
          undo: () => void sendLabel(versionId, previous, null),
        });

        onToast?.({ message: label.trim().length === 0 ? 'Đã gỡ nhãn' : 'Đã gắn nhãn', onUndo: () => void ticket.undo() });
      } catch (error) {
        setBanner({ kind: 'error', notice: writeErrorNotice('label', error) });
      }
    },
    [floorId, gateway, onToast, queryClient, ticketNow],
  );

  /* ---- Trạng thái -------------------------------------------------------- */

  const listError = versionsQuery.error;
  const forbidden = listError !== null && isForbiddenRead(listError);
  const errorMessage = listError !== null && !forbidden ? VERSION_LIST_FAILED_REASON : null;

  const state = ((): SevenState => {
    if (forbidden) return 'forbidden';
    if (versionsQuery.isPending) return 'loading';
    if (errorMessage !== null) return 'error';
    if (isNarrow) return 'collapsed';
    if (summaries.length === 0) return 'empty';

    return snapshotsInFlight || visual.isBuilding || rows.some((row) => row.isMetadataOnly) ? 'partial' : 'success';
  })();

  /* ---- Việc làm được ---------------------------------------------------- */

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = versionsQuery;

  const actions = useMemo(
    (): VersionHistoryActions => ({
      selectLeftVersion: (versionId) => setPickedPair((previous) => ({ ...(previous ?? pair), left: versionId })),
      selectRightVersion: (versionId) => setPickedPair((previous) => ({ ...(previous ?? pair), right: versionId })),
      toggleCompareSelection: (versionId) => setPickedPair((previous) => togglePick(previous ?? pair, versionId)),
      setTab: setActiveTab,
      hoverDiffRow: setHoveredEntityId,
      requestRestore: (versionId) => {
        if (canRestore && rows.find((row) => row.id === versionId)?.isCurrent !== true) {
          openDialog({ kind: 'restore', versionId });
        }
      },
      confirmRestore: () => {
        const current = dialogRef.current;

        openDialog(null);

        if (current?.kind === 'discard') {
          discardQuestion.answer(true);
        } else if (current?.kind === 'restore') {
          void runRestore(current.versionId);
        }
      },
      cancelRestore: () => {
        const current = dialogRef.current;

        openDialog(null);

        if (current?.kind === 'discard') {
          discardQuestion.answer(false);
        }
      },
      exportVersion: (versionId) => onExportVersion?.(versionId),
      tagVersion: (versionId, label) => {
        if (canTagVersion) {
          void sendLabel(versionId, label, summaryMap.get(versionId)?.label ?? '');
        }
      },
      dismissConflict: () => {
        const current = banner;

        setBanner(null);

        if (current?.kind === 'reload') {
          void flushFirst().then((flushed) => (flushed === 'cancelled' ? undefined : reloadFloor()));
        }
      },
      loadMoreVersions: () => {
        if (hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      selectFloor: (nextFloorId) => onSelectFloor?.(nextFloorId),
    }),
    [
      banner,
      canRestore,
      canTagVersion,
      discardQuestion,
      fetchNextPage,
      flushFirst,
      hasNextPage,
      isFetchingNextPage,
      onExportVersion,
      onSelectFloor,
      openDialog,
      pair,
      reloadFloor,
      rows,
      runRestore,
      sendLabel,
      summaryMap,
    ],
  );

  const restoreConfirm = useMemo(() => buildRestoreConfirm(builds, dialog, floorName), [builds, dialog, floorName]);

  const model: VersionHistoryModel = {
    state,
    groups,
    rows,
    versionCount: summaries.length,
    isNarrow,
    compare,
    canRestore,
    restoreHiddenReason: canRestore ? null : RESTORE_FORBIDDEN_REASON,
    canTagVersion,
    // Xuất một phiên bản là ĐIỀU HƯỚNG sang S-34: khả năng đúng bằng "nơi gọi có cấp callback".
    canExportVersion: onExportVersion !== undefined,
    restoreCaption: RESTORE_CAPTION,
    restoreConfirm,
    conflict: banner?.notice ?? null,
    errorMessage,
    // HOP-DONG-MOI §5: tự lưu không sinh phiên bản, nên không có "đã lưu lúc" nào để đọc từ đây.
    savedAtLabel: null,
    canLoadMoreVersions: hasNextPage,
    floorSelect:
      floorOptions !== undefined && floorOptions.length > 0
        ? { label: 'Tầng', options: floorOptions, selectedId: floorId }
        : null,
    emptyTitle: `${capitalizeFirst(floorName)} chưa có phiên bản nào`,
  };

  return [model, actions];
}
