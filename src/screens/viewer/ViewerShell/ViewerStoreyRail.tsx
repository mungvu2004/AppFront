/**
 * Ray tầng trái, rộng 56: bốn tầng bấm chọn, giữ Shift chọn nhiều, mỗi tầng một
 * con mắt ẩn hiện, và thanh trượt "Độ tách" ở đáy.
 *
 * View thuần (R-60).
 *
 * ## Vì sao thanh trượt là `input type="range"` chứ không phải `Slider` dùng chung
 *
 * `src/components/ui/Slider.tsx:143-155` đặt `outline-none` vô điều kiện rồi vẽ
 * viền tiêu điểm từ STATE của React (`onFocus`/`onBlur` → `isFocused &&
 * 'ring-2'`) thay vì dùng biến thể `focus-visible:`. `expectAccessible` bắt
 * đúng lỗi đó, nên một màn đặt `Slider` lên bề mặt tới được bằng bàn phím
 * không qua nổi R-72 — đã dựng lại và xác nhận khi làm `ProjectSettings`
 * (màn ấy đổi sang `NumericField` để đi tiếp).
 *
 * R-68 cấm sửa `src/components/**` trong lúc dựng màn, nên nước đi hợp lệ là
 * chọn điều khiển khác. Ở đây không thể đổi sang `NumericField`: độ tách là
 * thứ người dùng KÉO và xem mô hình giãn ra theo tay, một ô nhập số làm hỏng
 * đúng cái nó tồn tại để làm. Nên đây là `<input type="range">` gốc — bản thân
 * nó đã đúng vai trò `slider`, đã có phím mũi tên, Home/End, và viền tiêu điểm
 * đi theo `focus-visible` của trình duyệt.
 */

import { Eye, EyeOff } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { ViewerStoreyViewModel } from './viewerShellTypes';
import { MAX_SEPARATION, MIN_SEPARATION } from './viewerStoreyStack';

/** Bước kéo của thanh trượt. Một phần trăm — đủ mịn để mô hình giãn liền tay. */
const SEPARATION_STEP_VALUE = 0.01;

export interface ViewerStoreyRailProps {
  readonly storeys: readonly ViewerStoreyViewModel[];
  readonly onStoreyActivate: (id: string, additive: boolean) => void;
  readonly onStoreyVisibilityToggle: (id: string) => void;
  readonly separation: number;
  readonly onSeparationChange: (value: number) => void;
  readonly separationLabel: string;
}

export function ViewerStoreyRail({
  storeys,
  onStoreyActivate,
  onStoreyVisibilityToggle,
  separation,
  onSeparationChange,
  separationLabel,
}: ViewerStoreyRailProps) {
  return (
    <div
      aria-label="Tầng"
      className="flex w-[56px] shrink-0 flex-col items-center gap-1 py-2"
    >
      <ul className="flex w-full flex-col items-center gap-1" role="listbox" aria-multiselectable>
        {storeys.map((storey) => (
          <li className="w-full" key={storey.id}>
            <div className="flex flex-col items-center">
              <button
                aria-label={`${storey.name}, cao độ ${storey.elevationLabel}`}
                aria-selected={storey.isActive}
                className={cn(
                  'flex h-8 w-10 items-center justify-center rounded-[8px] text-[12px] font-medium',
                  'transition-colors duration-120',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app',
                  storey.isActive
                    ? 'bg-accent-wash text-text-primary'
                    : 'text-text-secondary hover:bg-bg-hover',
                  !storey.isReady && 'opacity-50',
                )}
                onClick={(event): void => {
                  onStoreyActivate(storey.id, event.shiftKey);
                }}
                role="option"
                type="button"
              >
                {storey.code}
              </button>

              <button
                aria-label={
                  storey.isVisible ? `Ẩn ${storey.name}` : `Hiện ${storey.name}`
                }
                aria-pressed={storey.isVisible}
                className={cn(
                  'mt-0.5 flex h-6 w-6 items-center justify-center rounded-[6px]',
                  'text-text-muted transition-colors duration-120 hover:bg-bg-hover',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app',
                )}
                onClick={(): void => {
                  onStoreyVisibilityToggle(storey.id);
                }}
                type="button"
              >
                {storey.isVisible ? (
                  <Eye aria-hidden="true" className="h-[14px] w-[14px]" />
                ) : (
                  <EyeOff aria-hidden="true" className="h-[14px] w-[14px]" />
                )}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div aria-hidden="true" className="flex-1" />

      <label className="flex flex-col items-center gap-2 pb-1">
        <span className="text-[10px] leading-none text-text-muted">{separationLabel}</span>
        <input
          className={cn(
            'h-24 w-6 cursor-pointer accent-accent',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app',
          )}
          max={MAX_SEPARATION}
          min={MIN_SEPARATION}
          onChange={(event): void => {
            onSeparationChange(Number(event.target.value));
          }}
          step={SEPARATION_STEP_VALUE}
          style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
          type="range"
          value={separation}
        />
      </label>
    </div>
  );
}
