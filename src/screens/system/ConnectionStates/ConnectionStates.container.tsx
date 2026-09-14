/**
 * S-45 đã nối: bộ theo dõi mạng, hàng đợi ngoại tuyến, phiên đăng nhập, ranh
 * giới lỗi.
 *
 * ## Vòng đời của bộ theo dõi mạng
 *
 * `NetworkMonitor` đặt một khoảng lặp và gắn hai listener của `window`. Nó được
 * dựng **một lần cho mỗi lần gắn lớp**, `start()` khi gắn và `stop()` khi gỡ —
 * thiếu vế thứ hai là để lại một khoảng lặp chạy mãi sau khi người dùng rời
 * trang (R-28).
 *
 * ## Vì sao hàng đợi được đọc lại mỗi khi trạng thái mạng đổi
 *
 * `listPendingCommands` là một lượt đọc IndexedDB, không phải một luồng. Mốc
 * đáng đọc lại là lúc mạng đổi trạng thái: đó đúng là lúc hàng đợi vừa dài ra
 * (mất mạng) hoặc vừa ngắn lại (phát lại xong). Đọc theo nhịp đồng hồ thì hoặc
 * quá thưa để kịp, hoặc quá dày cho một lớp chỉ để nói một câu.
 *
 * ## Lớp này không có route
 *
 * Bảng 0.8 ghi "không route" cho S-45, và đúng vậy: nó là lớp dùng chung, nhúng
 * vào vỏ ứng dụng bằng `<ConnectionStatesContainer projectId />` (R-73).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { ScreenErrorBoundary, type ScreenErrorFallback } from '@/components/feedback/ScreenErrorBoundary';
import { useSession } from '@/hooks/useSession';
import type { PendingCommand } from '@/lib/offline/queueStore';

import { ConnectionStates } from './ConnectionStates';
import {
  createConnectionStatesGateway,
  isQueueFull,
  type ConnectionStatesGateway,
} from './connectionStatesGateway';
import type { ConnectionStatesContainerProps } from './types';
import { useConnectionStates } from './useConnectionStates';

const SCREEN_ID = 'connection-states';

const QUEUE_READ_FAILED =
  'Không đọc được hàng đợi ngoại tuyến trên máy này. Trình duyệt có thể đang chặn bộ nhớ cục bộ; mọi thay đổi mới sẽ chỉ nằm trong bộ nhớ tạm cho tới khi nối lại mạng.';

interface ContainerProps extends ConnectionStatesContainerProps {
  /** Đường tiêm cho story và test. */
  readonly gateway?: ConnectionStatesGateway;
  /** Vỏ ứng dụng sở hữu `Replayer`; lớp này chỉ mời nó chạy. */
  readonly onReplayNow?: () => void;
  readonly isReplaying?: boolean;
  readonly replayTotal?: number;
  readonly lastSuccessfulSyncAt?: number | null;
  readonly deadLetterCommands?: number;
  readonly isCollapsed?: boolean;
}

function ConnectionStatesCrashFallback({ report }: ScreenErrorFallback) {
  return (
    <p role="alert" className="px-5 py-2 text-[13px] leading-[18px] text-state-violation-text">
      {report.description.description}
    </p>
  );
}

function WiredConnectionStates(props: ContainerProps) {
  const {
    deadLetterCommands = 0,
    gateway: injectedGateway,
    isCollapsed = false,
    isReplaying = false,
    lastSuccessfulSyncAt = null,
    onReplayNow,
    onSignInAgain,
    projectId,
    replayTotal = 0,
  } = props;

  const session = useSession();

  const gateway = useMemo(
    () => injectedGateway ?? createConnectionStatesGateway(),
    [injectedGateway],
  );

  const monitor = useMemo(() => gateway.createMonitor(), [gateway]);
  const [status, setStatus] = useState(() => monitor.getStatus());
  const [pending, setPending] = useState<readonly PendingCommand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    monitor.start();

    const unsubscribe = monitor.subscribe(setStatus);

    return (): void => {
      unsubscribe();
      monitor.stop();
    };
  }, [monitor]);

  useEffect(() => {
    let cancelled = false;

    const read = async (): Promise<void> => {
      const result = await gateway.listPending(projectId);

      if (cancelled) {
        return;
      }

      setIsLoading(false);

      if (result.ok) {
        setPending(result.data);
        setErrorMessage(null);
        return;
      }

      setErrorMessage(QUEUE_READ_FAILED);
    };

    void read();

    return (): void => {
      cancelled = true;
    };
    // Đọc lại đúng lúc mạng đổi trạng thái — xem khối chú thích đầu file.
  }, [gateway, projectId, status.online]);

  const handleReplayNow = useCallback(() => {
    onReplayNow?.();
  }, [onReplayNow]);

  const [model, actions] = useConnectionStates({
    browserOnline: status.browserOnline,
    canView: session.status !== 'unknown',
    deadLetterCommands,
    errorMessage,
    isCollapsed,
    isLoading,
    isQueueFull: isQueueFull(pending),
    isReplaying,
    isSessionExpired: session.status === 'anonymous',
    lastSuccessfulSyncAt,
    onReplayNow: handleReplayNow,
    pendingCommands: pending,
    pingOnline: status.pingOnline,
    replayTotal,
    ...(onSignInAgain !== undefined ? { onSignInAgain } : {}),
  });

  return <ConnectionStates model={model} actions={actions} />;
}

/** `<ConnectionStatesContainer projectId />` — lớp trạng thái kết nối đã nối. */
export function ConnectionStatesContainer(props: ContainerProps) {
  return (
    <ScreenErrorBoundary
      key={props.projectId}
      screenId={SCREEN_ID}
      renderFallback={({ report, retry }) => (
        <ConnectionStatesCrashFallback report={report} retry={retry} />
      )}
    >
      <WiredConnectionStates {...props} />
    </ScreenErrorBoundary>
  );
}
