/**
 * S-45 — toàn bộ logic của lớp trạng thái kết nối.
 *
 * Hook không chạm `useStore`, không dựng `NetworkMonitor` và không dựng
 * `Replayer`: nó nhận số đo qua props. Lý do giống S-36 — hook test được bằng
 * `renderHook` thuần, và container là chỗ duy nhất biết vòng đời của hai bộ
 * theo dõi ấy.
 *
 * ## Bảy trạng thái
 *
 * | Trạng thái | Điều kiện |
 * |---|---|
 * | không có quyền | `canView === false` |
 * | lỗi | không đọc được hàng đợi (IndexedDB chặn, chế độ riêng tư…) |
 * | đang tải | chưa đọc xong lượt đầu |
 * | rỗng | trực tuyến, không lệnh chờ — **không hiện gì cả** |
 * | một phần | đang phát lại, xong một phần |
 * | thu gọn | dải rút thành một biểu tượng |
 * | thành công | đã đồng bộ xong |
 *
 * Trạng thái "rỗng" của màn này đặc biệt: nó vẽ ra **không gì cả**, và đó là
 * hành vi đúng. Một lớp kết nối luôn nói gì đó là một lớp người dùng học cách
 * không nhìn.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { SevenState } from '@/lib/testing/sevenStateScenarios';

import {
  actionLabelOf,
  decideConnectionCase,
  describePending,
  droppedLabelOf,
  headlineOf,
  lastSyncLabelOf,
  replayLabelOf,
  SYNCED_NOTICE_MS,
  tierOf,
  toPendingRow,
  type PendingCommandLike,
} from './connectionStatesModel';
import type { ConnectionStatesActions, ConnectionStatesModel } from './types';

const FORBIDDEN_MESSAGE =
  'Bạn không có quyền xem hàng đợi ngoại tuyến của dự án này. Hãy hỏi quản trị viên dự án.';

/** Thứ container truyền xuống. */
export interface UseConnectionStatesOptions {
  readonly browserOnline: boolean;
  readonly pingOnline: boolean;
  readonly isReplaying: boolean;
  readonly pendingCommands: readonly PendingCommandLike[];
  /** Số lệnh của lượt phát lại hiện tại, để dựng "8/12". */
  readonly replayTotal: number;
  readonly lastSuccessfulSyncAt: number | null;
  readonly deadLetterCommands: number;
  readonly isQueueFull: boolean;
  readonly isSessionExpired: boolean;
  readonly isLoading: boolean;
  readonly canView: boolean;
  readonly isCollapsed: boolean;
  readonly errorMessage: string | null;
  readonly onReplayNow: () => void;
  readonly onSignInAgain?: (() => void) | undefined;
}

export type UseConnectionStatesResult = readonly [ConnectionStatesModel, ConnectionStatesActions];

export function useConnectionStates(options: UseConnectionStatesOptions): UseConnectionStatesResult {
  const {
    browserOnline,
    canView,
    deadLetterCommands,
    errorMessage,
    isCollapsed,
    isLoading,
    isQueueFull,
    isReplaying,
    isSessionExpired,
    lastSuccessfulSyncAt,
    onReplayNow,
    onSignInAgain,
    pendingCommands,
    pingOnline,
    replayTotal,
  } = options;

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  /**
   * "Đã đồng bộ xong" hiện rồi tự ẩn sau bốn giây.
   *
   * Mốc neo là `lastSuccessfulSyncAt`, không phải `isReplaying` chuyển sang
   * `false`: một lượt phát lại hỏng cũng làm cờ ấy về `false`, và lúc đó nói
   * "đã đồng bộ xong" là nói dối.
   */
  useEffect(() => {
    if (lastSuccessfulSyncAt === null) {
      return;
    }

    setJustSynced(true);

    const timer = setTimeout(() => {
      setJustSynced(false);
    }, SYNCED_NOTICE_MS);

    return (): void => {
      clearTimeout(timer);
    };
  }, [lastSuccessfulSyncAt]);

  const pendingCount = pendingCommands.length;

  const connectionCase = useMemo(
    () =>
      decideConnectionCase({
        browserOnline,
        isQueueFull,
        isReplaying,
        isSessionExpired,
        justSynced,
        pendingCommands: pendingCount,
        pingOnline,
      }),
    [browserOnline, isQueueFull, isReplaying, isSessionExpired, justSynced, pendingCount, pingOnline],
  );

  const state: SevenState = useMemo(() => {
    if (!canView) {
      return 'forbidden';
    }

    if (errorMessage !== null) {
      return 'error';
    }

    if (isLoading) {
      return 'loading';
    }

    if (isCollapsed) {
      return 'collapsed';
    }

    if (connectionCase === 'syncing') {
      return 'partial';
    }

    if (connectionCase === 'synced') {
      return 'success';
    }

    return connectionCase === 'online' ? 'empty' : 'partial';
  }, [canView, connectionCase, errorMessage, isCollapsed, isLoading]);

  const pendingRows = useMemo(() => pendingCommands.map(toPendingRow), [pendingCommands]);

  const onOpenDetail = useCallback(() => {
    setIsDetailOpen(true);
  }, []);

  const onCloseDetail = useCallback(() => {
    setIsDetailOpen(false);
  }, []);

  const model: ConnectionStatesModel = {
    actionLabel: actionLabelOf(connectionCase),
    connectionCase,
    droppedCount: deadLetterCommands,
    droppedLabel: droppedLabelOf(deadLetterCommands),
    errorMessage,
    forbiddenMessage: canView ? null : FORBIDDEN_MESSAGE,
    headline: headlineOf(connectionCase, pendingCount),
    isCollapsed,
    isDetailOpen,
    lastSyncLabel: lastSyncLabelOf(lastSuccessfulSyncAt),
    pendingCount,
    pendingLabel: describePending(pendingCount),
    pendingRows: canView ? pendingRows : [],
    replayLabel: replayLabelOf(isReplaying, pendingCount, replayTotal),
    state,
    tier: tierOf(connectionCase),
  };

  const actions: ConnectionStatesActions = {
    onCloseDetail,
    onOpenDetail,
    onReplayNow,
    onSignInAgain: onSignInAgain ?? null,
  };

  return [model, actions];
}
