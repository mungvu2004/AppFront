/**
 * Lệnh dấu đếm trong hàng đợi ngoại tuyến, và phiên (tab) giữ chúng.
 *
 * ## Lệnh dấu đếm `uploadDrawing`
 *
 * Màn tải bản vẽ ghi một lệnh `uploadDrawing` cho mỗi tệp chờ mạng để
 * ConnectionStates đếm nó là "chờ đồng bộ" (FIX-459). Lệnh không mang được
 * `File` — tệp nằm trong bộ nhớ của màn, màn tự tải khi mạng về và tự gỡ lệnh.
 * Nên `replayer` không gửi nó (NO-402), và chỉ tab ghi nó được gỡ nó khi còn sống.
 *
 * ## Phiên tab và Web Locks (NO-400)
 *
 * Mỗi lần nạp module là một tab: {@link TAB_SESSION_ID}. Lệnh dấu đếm mang mã
 * phiên đã ghi nó, và tab giữ khoá `offline-tab-session:<mã>` suốt đời mình
 * (khoá chung — nhiều nơi trong cùng tab giữ được cùng lúc). Trình duyệt nhả
 * khoá khi tab đóng hay tải lại, nên "phiên còn sống" = "khoá còn được giữ".
 *
 * Không có Web Locks thì không biết tab khác còn sống hay không: coi là sống —
 * đếm thừa một lệnh mồ côi còn hơn gỡ mất dấu đếm của một tab đang chờ mạng.
 * Cái giá: trên trình duyệt ấy, lệnh của một tab đã đóng không còn ai gỡ.
 */

import { createUuid } from '@/lib/http/ids';

export const UPLOAD_DRAWING_COMMAND_KIND = 'uploadDrawing';

/** Phần `navigator.locks` mà module này dùng — test cắm bản giả. */
export interface TabLocks {
  request(name: string, options: { mode: 'shared' }, callback: () => Promise<unknown>): Promise<unknown>;
  query(): Promise<{ held?: readonly { name?: string }[] }>;
}

/** Mã phiên của tab này. */
export const TAB_SESSION_ID = createUuid();

const lockNameOf = (sessionId: string): string => `offline-tab-session:${sessionId}`;

/** `navigator.locks` nếu trình duyệt có, không thì `null`. */
export const defaultTabLocks = (): TabLocks | null => globalThis.navigator?.locks ?? null;

/** Lệnh `uploadDrawing` (`command: unknown` trong hàng đợi). */
export function isUploadDrawingCommand(command: unknown): boolean {
  return (
    typeof command === 'object' &&
    command !== null &&
    (command as { readonly kind?: unknown }).kind === UPLOAD_DRAWING_COMMAND_KIND
  );
}

const heldSessions = new WeakMap<TabLocks, Map<string, Promise<void>>>();

/**
 * Giữ khoá của phiên tới hết đời tab; xong khi khoá đã được cấp — ghi lệnh mang
 * mã phiên chỉ sau lúc ấy, để tab khác không thấy lệnh mà chưa thấy khoá.
 * Xin khoá hỏng thì vẫn xong: lệnh khi ấy chỉ bị coi là mồ côi (đếm thiếu), không mất tệp.
 */
export function holdTabSession(sessionId: string, locks: TabLocks | null): Promise<void> {
  if (locks === null) {
    return Promise.resolve();
  }

  const sessions = heldSessions.get(locks) ?? new Map<string, Promise<void>>();
  let held = sessions.get(sessionId);

  if (held === undefined) {
    held = new Promise<void>((granted) => {
      locks
        .request(lockNameOf(sessionId), { mode: 'shared' }, () => {
          granted();
          return new Promise<never>(() => undefined);
        })
        .catch(() => granted());
    });
    sessions.set(sessionId, held);
    heldSessions.set(locks, sessions);
  }

  return held;
}

/**
 * Đọc một lần những phiên đang sống; trả phép hỏi "phiên đã ghi lệnh này còn
 * sống không" cho mọi lệnh của một lượt dọn.
 *
 * - Lệnh không mang mã phiên là của bản dựng trước NO-400: mồ côi, như FIX-459.
 * - Phiên của chính tab, hay trình duyệt không có Web Locks: sống (an toàn).
 * - `query()` hỏng: không biết, nên cũng coi là sống.
 */
export async function readLiveTabSessions(
  ownSessionId: string,
  locks: TabLocks | null,
): Promise<(sessionId: unknown) => boolean> {
  let heldNames: ReadonlySet<string> | null = null;

  if (locks !== null) {
    try {
      heldNames = new Set(((await locks.query()).held ?? []).map((lock) => lock.name ?? ''));
    } catch {
      heldNames = null;
    }
  }

  return (sessionId) =>
    typeof sessionId === 'string' &&
    (sessionId === ownSessionId || heldNames === null || heldNames.has(lockNameOf(sessionId)));
}
