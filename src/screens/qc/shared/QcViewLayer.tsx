import { useId, type SyntheticEvent } from 'react';

import { Kbd } from '@/components/ui/Kbd';
import { useShortcut } from '@/hooks/useShortcut';
import { cn } from '@/lib/utils';

import type { QcAskRect } from './qcAsk';
import { setQcViewMode, toggleQcViewMode, useQcViewMode, type QcPin, type QcViewMode } from './qcViewMode';

/**
 * Lớp chế độ nhìn trên bản vẽ L23 (`qcViewMode.ts`), đặt trong khung bản vẽ của màn:
 * nút đổi "Từng việc | Tổng thể" ở góc trên trái, phủ mờ quanh mục đang chọn (Từng việc),
 * ghim số trên các mục còn cần xem (Tổng thể). Màn tự lo phóng/vừa khung theo chế độ.
 */
export interface QcViewLayerProps {
  /** Hộp của mục đang chọn, pixel khung — cùng hộp đưa cho `QcAskAnchor`. */
  readonly focus: QcAskRect | null;
  /** Mục còn cần xem; số trên ghim là `pin.n` (cùng số với dòng hàng đợi). */
  readonly pins: readonly QcPin[];
  readonly selectedId: string | null;
  readonly onPick: (id: string) => void;
}

const MODES: readonly { readonly key: QcViewMode; readonly label: string }[] = [
  { key: 'task', label: 'Từng việc' },
  { key: 'overview', label: 'Tổng thể' },
];
const SWITCH_LABEL = 'Chế độ nhìn';
const SHORTCUT_DESCRIPTION = 'Đổi chế độ nhìn Từng việc / Tổng thể';
/** Phủ mờ bằng token lớp phủ (28 % ở nền sáng, mock: ≤ 35 %): vẫn đọc được bản vẽ quanh mục. */
const DIM_FILL = 'var(--bg-overlay)';
const FOCUS_PAD = 12;

/** Khung bản vẽ không nhận cú bấm/kéo bắt đầu trên chrome này (kéo nền, bỏ chọn). */
const stop = (event: SyntheticEvent) => event.stopPropagation();

export function QcViewLayer({ focus, pins, selectedId, onPick }: QcViewLayerProps) {
  const mode = useQcViewMode();
  const maskId = useId();
  useShortcut({ id: 'qc.viewMode', combo: 'F', description: SHORTCUT_DESCRIPTION, scope: 'canvas', onTrigger: toggleQcViewMode });

  return (
    <>
      {mode === 'task' && focus !== null ? (
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 h-full w-full">
          <mask id={maskId}>
            <rect fill="white" height="100%" width="100%" />
            <rect
              fill="black"
              height={focus.height + FOCUS_PAD * 2}
              rx={8}
              width={focus.width + FOCUS_PAD * 2}
              x={focus.x - FOCUS_PAD}
              y={focus.y - FOCUS_PAD}
            />
          </mask>
          <rect fill={DIM_FILL} height="100%" mask={`url(#${maskId})`} width="100%" />
        </svg>
      ) : null}
      {mode === 'overview'
        ? pins.map((pin) => (
            <button
              aria-label={`Mục cần xem số ${pin.n}`}
              aria-pressed={pin.id === selectedId}
              className={cn(
                'absolute z-10 -ml-3 -mt-3 grid h-6 w-6 place-items-center rounded-full border-2 text-[12px] font-bold tabular-nums shadow-float',
                'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                pin.id === selectedId ? 'border-bg-surface bg-accent text-white' : 'border-state-attention bg-bg-surface text-state-attention-text',
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
      <div
        aria-label={SWITCH_LABEL}
        className="absolute left-3 top-3 z-30 flex items-center gap-1 rounded-lg bg-bg-surface p-1 shadow-float"
        onPointerDown={stop}
        role="group"
      >
        {MODES.map((item) => (
          <button
            aria-pressed={mode === item.key}
            className={cn(
              'h-7 rounded-md px-2.5 text-body-sm',
              'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-accent',
              mode === item.key ? 'bg-bg-sunken font-medium text-text-primary' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
            )}
            key={item.key}
            onClick={() => setQcViewMode(item.key)}
            title={`${item.label} (F)`}
            type="button"
          >
            {item.label}
          </button>
        ))}
        <Kbd className="mx-1">F</Kbd>
      </div>
    </>
  );
}
