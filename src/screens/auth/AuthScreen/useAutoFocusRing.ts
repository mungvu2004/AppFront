/**
 * UX-34: ô email tự nhận tiêu điểm lúc mở trang, nhưng khi cửa sổ chưa được chọn trình duyệt
 * không vẽ `:focus-within` — người dùng bấm Tab rồi gõ nhầm email vào ô mật khẩu. Ô vừa tự nhận
 * tiêu điểm giữ vòng accent của `Input` (cùng token với mọi vòng tiêu điểm) tới khi rời ô.
 */
import { useCallback, useState } from 'react';

import { cn } from '@/lib/utils';

/** Gắn lên khung có viền của `Input` (`.group > div`), không lên cả khối nhãn + ô. */
const AUTO_FOCUS_RING =
  '[&>.group>div]:ring-2 [&>.group>div]:ring-accent [&>.group>div]:ring-offset-2 [&>.group>div]:ring-offset-bg-surface';

/** Props trải thẳng lên `Input`: `ref` (gọi tiếp `register`), `wrapperClassName`, `onBlur`. */
export function useAutoFocusRing(
  register: (element: HTMLInputElement | null) => void,
  onBlur: () => void,
  wrapperClassName: string,
) {
  const [isOn, setOn] = useState(false);
  const ref = useCallback(
    (element: HTMLInputElement | null) => {
      register(element);
      if (element !== null && element.ownerDocument.activeElement === element) setOn(true);
    },
    [register],
  );
  return {
    ref,
    wrapperClassName: cn(wrapperClassName, isOn && AUTO_FOCUS_RING),
    'data-auto-focus-ring': isOn ? 'true' : undefined,
    onBlur: () => {
      setOn(false);
      onBlur();
    },
  } as const;
}
