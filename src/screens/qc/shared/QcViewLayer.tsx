import type { SyntheticEvent } from 'react';

import { useShortcut } from '@/hooks/useShortcut';
import { cn } from '@/lib/utils';

import { toggleQcViewMode, useQcViewMode, type QcPin } from './qcViewMode';

/**
 * Lớp chế độ nhìn trên bản vẽ L23 (`qcViewMode.ts`), đặt trong khung bản vẽ của màn:
 * ghim số trên các mục còn cần xem (Tổng thể). Từng việc không phủ gì: viền chọn và thẻ đã chỉ mục đang chọn. Màn tự lo phóng/vừa khung theo chế độ. Nút đổi chế độ
 * nằm trong danh sách phóng của bản vẽ (`QcZoomMenu`); phím F vẫn ở đây.
 */
export interface QcViewLayerProps {
  /** Mục còn cần xem; số trên ghim là `pin.n` (cùng số với dòng hàng đợi). */
  readonly pins: readonly QcPin[];
  readonly selectedId: string | null;
  readonly onPick: (id: string) => void;
  /** `false` khi đang dùng công cụ vẽ/đo: ghim số không chặn con trỏ (pointer-events none). Mặc định `true`. */
  readonly pinsInteractive?: boolean;
}

const SHORTCUT_DESCRIPTION = 'Đổi chế độ nhìn Từng việc / Tổng thể';

/** Khung bản vẽ không nhận cú bấm/kéo bắt đầu trên chrome này (kéo nền, bỏ chọn). */
const stop = (event: SyntheticEvent) => event.stopPropagation();

export function QcViewLayer({ pins, selectedId, onPick, pinsInteractive = true }: QcViewLayerProps) {
  const mode = useQcViewMode();
  useShortcut({ id: 'qc.viewMode', combo: 'F', description: SHORTCUT_DESCRIPTION, scope: 'canvas', onTrigger: toggleQcViewMode });

  return (
    <>
      {mode === 'overview'
        ? pins.map((pin) => (
            <button
              aria-label={`Mục cần xem số ${pin.n}`}
              aria-pressed={pin.id === selectedId}
              className={cn(
                'absolute z-10 -ml-3 -mt-3 grid h-6 w-6 place-items-center rounded-full border-2 text-[12px] font-bold tabular-nums shadow-float',
                'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                pin.id === selectedId ? 'border-bg-surface bg-accent text-white' : 'border-state-attention bg-bg-surface text-state-attention-text',
                !pinsInteractive && 'pointer-events-none',
              )}
              key={pin.id}
              onClick={(event) => {
                event.stopPropagation();
                onPick(pin.id);
              }}
              onPointerDown={stop}
              style={{ left: pin.x, top: pin.y }}
              type="button"
            >
              {pin.n}
            </button>
          ))
        : null}
    </>
  );
}
