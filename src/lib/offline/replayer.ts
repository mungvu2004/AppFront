import type { HttpError, Result } from '@/lib/http';
import { createIdempotencyKey } from '@/lib/http';
import type { NetworkMonitor, NetworkMonitorStatus } from './networkMonitor';
import { createQueueStore, type PendingCommand, type QueueStore } from './queueStore';

const OFFLINE_SYNC_CHANNEL_NAME = 'offline-sync';
const DEFAULT_ELECTION_WINDOW_MS = 50;
const TEMPORARY_STATUS_CODES = new Set([408, 429]);

export interface ReplayCommandContext {
  idempotencyKey: string;
  pendingCommand: PendingCommand;
  signal?: AbortSignal;
}

export type ReplayCommandSender = (
  command: unknown,
  context: ReplayCommandContext,
) => Promise<Result<unknown, HttpError>>;

export interface SyncStatus {
  deadLetterCommands: number;
  failedCommands: number;
  isOnline: boolean;
  isReplaying: boolean;
  lastSuccessfulSyncAt: number | null;
  pendingCommands: number;
}

export type SyncStatusListener = (status: SyncStatus) => void;

export interface Replayer {
  getStatus(): SyncStatus;
  replayNow(): Promise<SyncStatus>;
  start(): void;
  stop(): void;
  subscribe(listener: SyncStatusListener): () => void;
}

export interface CreateReplayerOptions {
  broadcastChannelFactory?: (name: string) => BroadcastChannel;
  electionWindowMs?: number;
  idempotencyKeyFactory?: (command: PendingCommand) => string;
  isOnline?: () => boolean;
  networkMonitor?: Pick<NetworkMonitor, 'getStatus' | 'subscribe'>;
  now?: () => number;
  projectId: string;
  queueStore?: QueueStore;
  sendCommand: ReplayCommandSender;
  signal?: AbortSignal;
}

type OfflineSyncMessage =
  | {
      ownerId: string;
      projectId: string;
      type: 'replay-active' | 'replay-candidate' | 'replay-complete';
    };

const okStatus = (status: number | undefined): status is number =>
  typeof status === 'number' && status >= 400 && status < 500 && !TEMPORARY_STATUS_CODES.has(status);

const toDeadLetterReason = (error: HttpError): string => {
  if (typeof error.status === 'number') {
    return `Máy chủ từ chối lệnh với mã ${error.status}.`;
  }

  return 'Máy chủ từ chối lệnh vĩnh viễn.';
};

const isOfflineSyncMessage = (value: unknown): value is OfflineSyncMessage => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const message = value as Partial<OfflineSyncMessage>;

  return (
    typeof message.ownerId === 'string' &&
    typeof message.projectId === 'string' &&
    (message.type === 'replay-active' || message.type === 'replay-candidate' || message.type === 'replay-complete')
  );
};

const wait = (delayMs: number): Promise<void> => {
  if (delayMs <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
};

const createStableIdempotencyKey = (projectId: string, command: PendingCommand): string =>
  `offline-${projectId}-${command.id}-${command.createdAt}`;

export const createReplayer = (options: CreateReplayerOptions): Replayer => {
  const channel =
    options.broadcastChannelFactory?.(OFFLINE_SYNC_CHANNEL_NAME) ??
    (typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(OFFLINE_SYNC_CHANNEL_NAME) : null);
  const electionWindowMs = options.electionWindowMs ?? DEFAULT_ELECTION_WINDOW_MS;
  const listeners = new Set<SyncStatusListener>();
  const now = options.now ?? Date.now;
  const ownerId = createIdempotencyKey();
  const queueStore = options.queueStore ?? createQueueStore();
  const idempotencyKeyFactory =
    options.idempotencyKeyFactory ?? ((command: PendingCommand) => createStableIdempotencyKey(options.projectId, command));

  let activeRunnerCount = 0;
  let failedCommands = 0;
  let isReplaying = false;
  let lastSuccessfulSyncAt: number | null = null;
  let pendingCommands = 0;
  let replayInFlight: Promise<SyncStatus> | null = null;
  let stopNetworkSubscription: (() => void) | null = null;

  const resolveOnline = (): boolean => {
    if (options.isOnline) {
      return options.isOnline();
    }

    const monitorStatus: NetworkMonitorStatus | undefined = options.networkMonitor?.getStatus();

    return monitorStatus?.online ?? true;
  };

  const getStatus = (): SyncStatus => ({
    deadLetterCommands: failedCommands,
    failedCommands,
    isOnline: resolveOnline(),
    isReplaying,
    lastSuccessfulSyncAt,
    pendingCommands,
  });

  const emit = (): void => {
    const status = getStatus();
    listeners.forEach((listener) => listener(status));
  };

  const postMessage = (message: OfflineSyncMessage): void => {
    channel?.postMessage(message);
  };

  const onBroadcastMessage = (event: MessageEvent<unknown>): void => {
    if (!isOfflineSyncMessage(event.data) || event.data.projectId !== options.projectId || event.data.ownerId === ownerId) {
      return;
    }

    if (event.data.type === 'replay-candidate' && isReplaying) {
      postMessage({
        ownerId,
        projectId: options.projectId,
        type: 'replay-active',
      });
    }
  };

  channel?.addEventListener('message', onBroadcastMessage);

  const refreshPendingCount = async (): Promise<void> => {
    const listResult = await queueStore.listPendingCommands(options.projectId);

    if (listResult.ok) {
      pendingCommands = listResult.data.length;
      emit();
    }
  };

  const acquireReplaySlot = async (): Promise<boolean> => {
    if (!channel) {
      return true;
    }

    const contenders = new Set([ownerId]);
    let hasActiveRunner = activeRunnerCount > 0;

    const onCandidateMessage = (event: MessageEvent<unknown>): void => {
      if (!isOfflineSyncMessage(event.data) || event.data.projectId !== options.projectId || event.data.ownerId === ownerId) {
        return;
      }

      if (event.data.type === 'replay-candidate') {
        contenders.add(event.data.ownerId);
      }

      if (event.data.type === 'replay-active') {
        hasActiveRunner = true;
      }
    };

    channel.addEventListener('message', onCandidateMessage);
    postMessage({
      ownerId,
      projectId: options.projectId,
      type: 'replay-candidate',
    });
    await wait(electionWindowMs);
    postMessage({
      ownerId,
      projectId: options.projectId,
      type: 'replay-candidate',
    });
    await wait(electionWindowMs);
    channel.removeEventListener('message', onCandidateMessage);

    if (hasActiveRunner) {
      return false;
    }

    return [...contenders].sort()[0] === ownerId;
  };

  const sendPendingCommands = async (): Promise<void> => {
    const listResult = await queueStore.listPendingCommands(options.projectId);

    if (!listResult.ok) {
      return;
    }

    pendingCommands = listResult.data.length;
    emit();

    const commands = [...listResult.data].sort((first, second) => first.createdAt - second.createdAt || first.id - second.id);

    for (const pendingCommand of commands) {
      const sendResult = await options.sendCommand(pendingCommand.command, {
        idempotencyKey: idempotencyKeyFactory(pendingCommand),
        pendingCommand,
        ...(options.signal ? { signal: options.signal } : {}),
      });

      if (sendResult.ok) {
        const deleteResult = await queueStore.deletePendingCommand(pendingCommand.id);

        if (!deleteResult.ok) {
          return;
        }

        lastSuccessfulSyncAt = now();
        pendingCommands -= 1;
        emit();
        continue;
      }

      if (okStatus(sendResult.error.status)) {
        const deadLetterResult = await queueStore.moveToDeadLetter(pendingCommand.id, toDeadLetterReason(sendResult.error));

        if (!deadLetterResult.ok) {
          return;
        }

        failedCommands += 1;
        pendingCommands -= 1;
        emit();
        continue;
      }

      return;
    }
  };

  const runReplay = async (): Promise<SyncStatus> => {
    if (!resolveOnline()) {
      await refreshPendingCount();

      return getStatus();
    }

    const acquiredSlot = await acquireReplaySlot();

    if (!acquiredSlot) {
      await refreshPendingCount();

      return getStatus();
    }

    activeRunnerCount += 1;
    isReplaying = true;
    emit();
    postMessage({
      ownerId,
      projectId: options.projectId,
      type: 'replay-active',
    });

    try {
      await sendPendingCommands();
    } finally {
      activeRunnerCount -= 1;
      isReplaying = false;
      emit();
      postMessage({
        ownerId,
        projectId: options.projectId,
        type: 'replay-complete',
      });
    }

    return getStatus();
  };

  const replayNow = async (): Promise<SyncStatus> => {
    if (!replayInFlight) {
      replayInFlight = runReplay().finally(() => {
        replayInFlight = null;
      });
    }

    return replayInFlight;
  };

  const start = (): void => {
    if (!stopNetworkSubscription && options.networkMonitor) {
      stopNetworkSubscription = options.networkMonitor.subscribe((status) => {
        emit();

        if (status.online) {
          void replayNow();
        }
      });
    }

    void refreshPendingCount();

    if (resolveOnline()) {
      void replayNow();
    }
  };

  const stop = (): void => {
    stopNetworkSubscription?.();
    stopNetworkSubscription = null;
    channel?.removeEventListener('message', onBroadcastMessage);
    channel?.close();
  };

  return {
    getStatus,
    replayNow,
    start,
    stop,
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
};
