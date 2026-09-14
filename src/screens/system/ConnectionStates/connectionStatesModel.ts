/**
 * S-45 — phần tính thuần của lớp trạng thái kết nối.
 *
 * Không React, không kho, không mạng. Vào là số đo của T-09/T-10 cộng trạng
 * thái phiên, ra là một trường hợp, một tầng hiển thị và những câu đã dựng sẵn.
 *
 * Đặt riêng vì quyết định "hiện cái gì, ồn tới mức nào" là quyết định quan
 * trọng nhất của màn này — và một hàm thuần thì kiểm được cả bảy nhánh mà không
 * cần dựng một cây React nào.
 */

import { formatFileSize } from '@/lib/format/bytes';
import { formatClockTime } from '@/lib/format/datetime';
import { formatNumber } from '@/lib/format/number';

import type { ConnectionCase, ConnectionTier, PendingCommandRow } from './types';

/**
 * Thông báo "đã đồng bộ xong" tự ẩn sau ngần này.
 *
 * Bốn giây, theo đặc tả. **Không** nằm trên thang chuyển động 120/180/260/340 —
 * và đúng là không nên: thang ấy đo thời gian một thứ DI CHUYỂN, còn đây là
 * thời gian một câu ĐỨNG YÊN cho người ta đọc. Cùng loại với `UNDO_WINDOW_MS`
 * (8000) của `components/feedback/Toast.tsx`, và cùng lý do phải là một hằng số
 * có tên chứ không phải một con số rơi giữa mã (R-71).
 */
export const SYNCED_NOTICE_MS = 4_000;

/** Số đo mà {@link decideConnectionCase} cần. Mọi trường đều bắt buộc, không đoán. */
export interface ConnectionSignals {
  /** `navigator.onLine` — máy có đường vật lý không. */
  readonly browserOnline: boolean;
  /** Lượt ping tới máy chủ có kịp không. */
  readonly pingOnline: boolean;
  readonly pendingCommands: number;
  readonly isReplaying: boolean;
  /** Vừa phát lại xong trong khoảng {@link SYNCED_NOTICE_MS} gần đây. */
  readonly justSynced: boolean;
  /** Hàng đợi chạm trần 200 lệnh hoặc 5 MB của T-09. */
  readonly isQueueFull: boolean;
  /** Phiên đã rơi về vô danh. */
  readonly isSessionExpired: boolean;
}

/**
 * Một trường hợp duy nhất, chọn theo mức nghiêm trọng giảm dần.
 *
 * Thứ tự ở đây LÀ luật "ba tầng không được trộn": phiên hết hạn che mọi thứ,
 * hàng đợi đầy che việc mất mạng, và "mạng chậm" chỉ nói khi không còn gì
 * nghiêm trọng hơn để nói.
 *
 * Hai chỗ có điều kiện kèm số lệnh chờ, và đó là chủ ý: phiên hết hạn mà không
 * còn việc chưa lưu thì **không** đáng một tấm giữa màn — người dùng chỉ cần
 * đăng nhập lại lúc họ muốn. Tấm chắn giữa màn dành cho lúc có thứ sắp mất.
 */
export function decideConnectionCase(signals: ConnectionSignals): ConnectionCase {
  if (signals.isSessionExpired && signals.pendingCommands > 0) {
    return 'sessionExpired';
  }

  if (signals.isQueueFull) {
    return 'queueFull';
  }

  if (signals.isReplaying) {
    return 'syncing';
  }

  if (!signals.browserOnline && signals.pendingCommands > 0) {
    return 'offline';
  }

  if (signals.justSynced) {
    return 'synced';
  }

  if (signals.browserOnline && !signals.pingOnline) {
    return 'degraded';
  }

  return 'online';
}

/** Mức ồn ào được phép của một trường hợp. Bảng này là chỗ duy nhất quyết định điều đó. */
export function tierOf(connectionCase: ConnectionCase): ConnectionTier {
  switch (connectionCase) {
    case 'sessionExpired':
      return 'blocking';
    case 'offline':
    case 'syncing':
    case 'synced':
    case 'queueFull':
      return 'band';
    case 'degraded':
      return 'statusBar';
    case 'online':
      return 'none';
  }
}

/** "12 thay đổi chờ đồng bộ" — định dạng số ở đây, không ở view (A15). */
export function describePending(count: number): string {
  return `${formatNumber(count)} thay đổi chờ đồng bộ`;
}

/** Một câu cho mỗi trường hợp. Đúng một câu. */
export function headlineOf(connectionCase: ConnectionCase, pendingCount: number): string {
  switch (connectionCase) {
    case 'sessionExpired':
      return `Đăng nhập lại để lưu ${describePending(pendingCount)}.`;
    case 'queueFull':
      return `Hàng đợi ngoại tuyến đã đầy với ${describePending(pendingCount)}. Nối mạng lại để đồng bộ; làm tiếp lúc này có thể mất thay đổi mới.`;
    case 'syncing':
      return 'Đang đồng bộ lại những thay đổi đã làm khi ngoại tuyến.';
    case 'offline':
      return `Đang làm việc ngoại tuyến · ${describePending(pendingCount)}.`;
    case 'synced':
      return 'Đã đồng bộ xong.';
    case 'degraded':
      return 'Kết nối chậm, thao tác có thể trễ.';
    case 'online':
      return '';
  }
}

/** Nhãn hành động duy nhất của mỗi trường hợp; `null` khi không có gì để làm. */
export function actionLabelOf(connectionCase: ConnectionCase): string | null {
  switch (connectionCase) {
    case 'sessionExpired':
      return 'Đăng nhập lại';
    case 'queueFull':
    case 'offline':
    case 'syncing':
      return 'Xem chi tiết';
    case 'synced':
    case 'degraded':
    case 'online':
      return null;
  }
}

/** "Đã đồng bộ xong lúc 14:32", hoặc `null` khi chưa lần nào đồng bộ được. */
export function lastSyncLabelOf(lastSuccessfulSyncAt: number | null): string | null {
  if (lastSuccessfulSyncAt === null) {
    return null;
  }

  return `Đã đồng bộ xong lúc ${formatClockTime(lastSuccessfulSyncAt)}`;
}

/** "8/12" khi đang phát lại. `null` khi không phát lại, hoặc khi hàng đợi rỗng. */
export function replayLabelOf(
  isReplaying: boolean,
  pendingCount: number,
  totalCount: number,
): string | null {
  if (!isReplaying || totalCount === 0) {
    return null;
  }

  const done = Math.max(totalCount - pendingCount, 0);

  return `${formatNumber(done)}/${formatNumber(totalCount)}`;
}

/**
 * Lệnh bị bỏ khi phát lại hỏng — D-09.
 *
 * Đặc tả đòi "liệt kê rõ lệnh nào bị bỏ", nên con số này không bao giờ bị gộp
 * vào số lệnh chờ: mất lặng lẽ là đúng thứ màn này tồn tại để chặn.
 */
export function droppedLabelOf(droppedCount: number): string | null {
  if (droppedCount === 0) {
    return null;
  }

  return `${formatNumber(droppedCount)} lệnh không phát lại được và đã bị bỏ. Mở chi tiết để xem chúng là gì.`;
}

/** Thứ `lib/offline/queueStore` trả về, phần mà màn cần đọc. */
export interface PendingCommandLike {
  readonly id: number;
  readonly createdAt: number;
  readonly sizeBytes: number;
  readonly command: unknown;
}

/**
 * Nhãn của một lệnh đang chờ.
 *
 * `PendingCommand.command` là `unknown` — hàng đợi cố ý không biết nó chở gì.
 * Nên nhãn đọc trường `label` nếu lệnh có, và lùi về một câu chung nếu không.
 * Bịa ra một cái tên đẹp hơn từ hình dạng đối tượng là đoán.
 */
export function toPendingRow(pending: PendingCommandLike): PendingCommandRow {
  const command = pending.command;
  const label =
    typeof command === 'object' &&
    command !== null &&
    'label' in command &&
    typeof (command as { label: unknown }).label === 'string'
      ? (command as { label: string }).label
      : 'thay đổi chưa đặt tên';

  return {
    createdAtLabel: formatClockTime(pending.createdAt),
    id: String(pending.id),
    label,
    sizeLabel: formatFileSize(pending.sizeBytes),
  };
}
