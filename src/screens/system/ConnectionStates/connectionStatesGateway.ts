/**
 * S-45 — cửa vào duy nhất tới tầng ngoại tuyến.
 *
 * Gom ba cửa ra ngoài lại để một bài kiểm thay được cả ba, cùng khuôn
 * `mobileViewerGateway.ts`.
 *
 * ## Vì sao lớp này KHÔNG tự dựng `Replayer`
 *
 * `createReplayer` đòi một `sendCommand` — tức đường gửi lệnh thật của ứng
 * dụng. Lớp trạng thái kết nối là thứ **nói ra** việc đồng bộ, không phải thứ
 * **làm** việc đồng bộ; dựng một `Replayer` thứ hai ở đây sẽ có hai vòng phát
 * lại tranh nhau cùng một hàng đợi IndexedDB.
 *
 * Nên `onReplayNow` và `syncStatus` là thứ vỏ ứng dụng truyền vào. Khi chưa ai
 * truyền, lớp vẫn chạy đúng với những gì nó tự đọc được: trạng thái mạng và
 * hàng đợi.
 */

import {
  listPendingCommands,
  MAX_PENDING_BYTES,
  MAX_PENDING_COMMANDS,
  type PendingCommand,
  type QueueStoreError,
} from '@/lib/offline/queueStore';
import { createNetworkMonitor, type NetworkMonitor } from '@/lib/offline/networkMonitor';
import type { Result } from '@/lib/http';

/** Hai cửa mà lớp này tự mở được. */
export interface ConnectionStatesGateway {
  /** T-10: dựng bộ theo dõi mạng. Gọi một lần cho mỗi lần gắn lớp. */
  readonly createMonitor: () => NetworkMonitor;
  /** T-09: đọc hàng đợi của một dự án. Chỉ đọc — lớp này không bao giờ ghi. */
  readonly listPending: (projectId: string) => Promise<Result<PendingCommand[], QueueStoreError>>;
}

export function createConnectionStatesGateway(
  overrides: Partial<ConnectionStatesGateway> = {},
): ConnectionStatesGateway {
  return {
    createMonitor: overrides.createMonitor ?? ((): NetworkMonitor => createNetworkMonitor()),
    listPending: overrides.listPending ?? listPendingCommands,
  };
}

/**
 * Hàng đợi đã chạm trần chưa.
 *
 * Đọc hai giới hạn từ chính `queueStore` chứ không chép lại 200 và 5 MB vào màn
 * (R-71). Một trong hai chạm là đầy: T-09 từ chối lệnh mới khi vượt **bất kỳ**
 * giới hạn nào.
 */
export function isQueueFull(pending: readonly PendingCommand[]): boolean {
  if (pending.length >= MAX_PENDING_COMMANDS) {
    return true;
  }

  const bytes = pending.reduce((total, command) => total + command.sizeBytes, 0);

  return bytes >= MAX_PENDING_BYTES;
}
