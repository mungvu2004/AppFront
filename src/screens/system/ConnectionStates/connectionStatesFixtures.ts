/**
 * S-45 — dữ liệu mẫu dùng chung cho story và test.
 *
 * Bộ số bám bộ mẫu chuẩn ở chỗ nó có nghĩa: "12 thay đổi chờ đồng bộ" là đúng
 * chuỗi mà mục 3.0 của bộ prompt liệt kê, và "Đã lưu lúc 14:32" là mốc giờ mẫu
 * của cả bộ.
 */

import type { SevenState } from '@/lib/testing/sevenStateScenarios';

import {
  actionLabelOf,
  decideConnectionCase,
  describePending,
  droppedLabelOf,
  headlineOf,
  lastSyncLabelOf,
  replayLabelOf,
  tierOf,
  toPendingRow,
  type PendingCommandLike,
} from './connectionStatesModel';
import type { ConnectionStatesActions, ConnectionStatesModel, ConnectionStatesProps } from './types';

/** 14:32 ngày 14-09-2026, giờ địa phương — mốc giờ mẫu của cả bộ tài liệu. */
export const SAMPLE_SYNC_AT = new Date(2026, 8, 14, 14, 32).getTime();

/** Mười hai lệnh đang chờ — đúng con số mà đặc tả S-45 lấy làm ví dụ. */
export const SAMPLE_PENDING: readonly PendingCommandLike[] = Array.from(
  { length: 12 },
  (_unused, index) => ({
    command: { label: `sửa tường #W-${String(index + 1).padStart(3, '0')}` },
    createdAt: SAMPLE_SYNC_AT - (12 - index) * 60_000,
    id: index + 1,
    sizeBytes: 1_200 + index * 40,
  }),
);

export const NOOP_ACTIONS: ConnectionStatesActions = {
  onCloseDetail: () => undefined,
  onOpenDetail: () => undefined,
  onReplayNow: () => undefined,
  onSignInAgain: () => undefined,
};

interface ScenarioSignals {
  readonly browserOnline: boolean;
  readonly pingOnline: boolean;
  readonly isReplaying: boolean;
  readonly justSynced: boolean;
  readonly isQueueFull: boolean;
  readonly isSessionExpired: boolean;
  readonly pending: readonly PendingCommandLike[];
}

/**
 * Bảy trạng thái, mỗi cái ứng với một cảnh có thật.
 *
 * Bảng này là chỗ duy nhất quyết định "trạng thái nào trông ra sao", nên story
 * và test không bao giờ lệch nhau.
 */
const SIGNALS_BY_STATE: Readonly<Record<SevenState, ScenarioSignals>> = {
  collapsed: {
    browserOnline: false,
    isQueueFull: false,
    isReplaying: false,
    isSessionExpired: false,
    justSynced: false,
    pending: SAMPLE_PENDING,
    pingOnline: false,
  },
  empty: {
    browserOnline: true,
    isQueueFull: false,
    isReplaying: false,
    isSessionExpired: false,
    justSynced: false,
    pending: [],
    pingOnline: true,
  },
  error: {
    browserOnline: true,
    isQueueFull: false,
    isReplaying: false,
    isSessionExpired: false,
    justSynced: false,
    pending: [],
    pingOnline: true,
  },
  forbidden: {
    browserOnline: true,
    isQueueFull: false,
    isReplaying: false,
    isSessionExpired: false,
    justSynced: false,
    pending: SAMPLE_PENDING,
    pingOnline: true,
  },
  loading: {
    browserOnline: true,
    isQueueFull: false,
    isReplaying: false,
    isSessionExpired: false,
    justSynced: false,
    pending: [],
    pingOnline: true,
  },
  partial: {
    browserOnline: true,
    isQueueFull: false,
    isReplaying: true,
    isSessionExpired: false,
    justSynced: false,
    pending: SAMPLE_PENDING.slice(0, 4),
    pingOnline: true,
  },
  success: {
    browserOnline: true,
    isQueueFull: false,
    isReplaying: false,
    isSessionExpired: false,
    justSynced: true,
    pending: [],
    pingOnline: true,
  },
};

/** Dựng `model` cho đúng một trong bảy trạng thái. */
export function buildConnectionStatesModel(state: SevenState): ConnectionStatesModel {
  const signals = SIGNALS_BY_STATE[state];
  const pendingCount = signals.pending.length;
  const canView = state !== 'forbidden';

  const connectionCase = decideConnectionCase({
    browserOnline: signals.browserOnline,
    isQueueFull: signals.isQueueFull,
    isReplaying: signals.isReplaying,
    isSessionExpired: signals.isSessionExpired,
    justSynced: signals.justSynced,
    pendingCommands: pendingCount,
    pingOnline: signals.pingOnline,
  });

  const deadLetterCommands = state === 'partial' ? 1 : 0;

  return {
    actionLabel: actionLabelOf(connectionCase),
    connectionCase,
    droppedCount: deadLetterCommands,
    droppedLabel: droppedLabelOf(deadLetterCommands),
    errorMessage:
      state === 'error'
        ? 'Không đọc được hàng đợi ngoại tuyến trên máy này. Trình duyệt có thể đang chặn bộ nhớ cục bộ.'
        : null,
    forbiddenMessage: canView
      ? null
      : 'Bạn không có quyền xem hàng đợi ngoại tuyến của dự án này. Hãy hỏi quản trị viên dự án.',
    headline: headlineOf(connectionCase, pendingCount),
    isCollapsed: state === 'collapsed',
    isDetailOpen: false,
    lastSyncLabel: lastSyncLabelOf(state === 'empty' ? null : SAMPLE_SYNC_AT),
    pendingCount,
    pendingLabel: describePending(pendingCount),
    pendingRows: canView ? signals.pending.map(toPendingRow) : [],
    replayLabel: replayLabelOf(signals.isReplaying, pendingCount, SAMPLE_PENDING.length),
    state,
    tier: tierOf(connectionCase),
  };
}

/**
 * Cảnh phiên hết hạn — tầng thứ ba, tấm giữa màn.
 *
 * Không nằm trong bảy trạng thái vì nó không phải một trạng thái của A11: nó là
 * một TRƯỜNG HỢP kết nối. Story riêng cho nó, vì đây là cảnh nguy hiểm nhất mà
 * màn này tồn tại để xử lý.
 */
export function buildSessionExpiredModel(): ConnectionStatesModel {
  const base = buildConnectionStatesModel('partial');
  const connectionCase = decideConnectionCase({
    browserOnline: true,
    isQueueFull: false,
    isReplaying: false,
    isSessionExpired: true,
    justSynced: false,
    pendingCommands: SAMPLE_PENDING.length,
    pingOnline: true,
  });

  return {
    ...base,
    actionLabel: actionLabelOf(connectionCase),
    connectionCase,
    headline: headlineOf(connectionCase, SAMPLE_PENDING.length),
    isCollapsed: false,
    pendingCount: SAMPLE_PENDING.length,
    pendingLabel: describePending(SAMPLE_PENDING.length),
    pendingRows: SAMPLE_PENDING.map(toPendingRow),
    replayLabel: null,
    tier: tierOf(connectionCase),
  };
}

/** Cảnh hàng đợi đầy — trần 200 lệnh hoặc 5 MB của T-09. */
export function buildQueueFullModel(): ConnectionStatesModel {
  const base = buildConnectionStatesModel('partial');
  const connectionCase = decideConnectionCase({
    browserOnline: false,
    isQueueFull: true,
    isReplaying: false,
    isSessionExpired: false,
    justSynced: false,
    pendingCommands: 200,
    pingOnline: false,
  });

  return {
    ...base,
    actionLabel: actionLabelOf(connectionCase),
    connectionCase,
    headline: headlineOf(connectionCase, 200),
    pendingCount: 200,
    pendingLabel: describePending(200),
    replayLabel: null,
    tier: tierOf(connectionCase),
  };
}

export function buildConnectionStatesProps(state: SevenState): ConnectionStatesProps {
  return { actions: NOOP_ACTIONS, model: buildConnectionStatesModel(state) };
}
