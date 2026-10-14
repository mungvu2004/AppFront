import { useEffect, useRef } from 'react';

import { guardBeforeUnload } from '@/lib/autosave/beforeUnload';

/**
 * Hỏi trước khi rời trang khi màn còn thay đổi CHỈ sống trong phiên này — chưa
 * có endpoint ghi, nên tải lại là mất (BUG-577 kích thước, BUG-578 trục).
 *
 * Không gửi gì lúc rời (`sendBeacon` rỗng): không có chỗ nào để gửi tới. Cờ đọc
 * qua ref nên trình nghe gắn đúng một lần cho suốt đời màn.
 */
export function useLeaveWarning(hasSessionChanges: boolean): void {
  const hasChangesRef = useRef(hasSessionChanges);
  hasChangesRef.current = hasSessionChanges;

  useEffect(
    () =>
      guardBeforeUnload({
        hasUnsavedChanges: () => hasChangesRef.current,
        sendBeacon: () => undefined,
      }),
    [],
  );
}
