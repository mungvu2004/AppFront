/**
 * `MeasurementTool` — view thuần của màn đo, nằm ở đầu kia khe `renderScene`
 * của `ViewerShell`.
 *
 * Màn đo KHÔNG dựng canvas mới và KHÔNG dựng một mảnh vỏ nào: ray tầng, thanh
 * công cụ, panel phải và camera đều là của `ViewerShell`, và mục "Phép đo" ở
 * panel phải đi qua khe `inspectorSections` chứ không qua đây. Cái file này vẽ
 * là **lớp nổi trên canvas** — viên thuốc chế độ, chip bắt điểm, và lớp phủ số
 * đo — nên gốc của nó là `pointer-events-none` phủ kín khung nhìn, còn từng
 * điều khiển bật lại `pointer-events-auto` cho riêng mình. Không có lớp nào
 * nuốt cú kéo chuột xoay cảnh.
 *
 * View thuần R-60: không nhập `@/api`, `@/store`, `@/domain`, `@/lib/http`.
 * Không tự tính số đo, không tự quy đổi đơn vị, không ghi gì vào mô hình — mọi
 * chuỗi số tới đây đã định dạng xong trong {@link MeasurementToolProps} (A15).
 *
 * ## Bảy trạng thái (A11, R-63) — ánh xạ theo bảng đã chốt của hợp đồng
 *
 * | `state` | Màn hiện gì |
 * |---|---|
 * | `empty` | Lời mời đo, giữa khung nhìn |
 * | `measuring` | Lớp phủ vẽ bản nháp; nhãn bám con trỏ, chữ đều, KHÔNG chạy số |
 * | `partial` | Câu nhắc chuỗi đo chưa đóng; hàng hết neo mang chấm cần chú ý |
 * | `error` | `errorMessage` + nút gọi `onRetry` |
 * | `ready` | Lớp phủ vẽ các phép đo đã ghim |
 * | `forbidden` | **Vẫn đo được**; chỉ chặn ghim, và nói ra `pinBlockedCaption` |
 * | `collapsed` | Danh sách thành chip đếm trong cụm trôi |
 *
 * Không trạng thái nào tháo viên thuốc chế độ hay chip bắt điểm đi. Chip đặc
 * biệt: đặc tả bắt **loại bắt điểm hiện tại luôn phải được gọi tên trên màn**,
 * nên nó không có nhánh nào ẩn — kể cả lúc lỗi, lúc rỗng, lúc không có quyền.
 *
 * ## `forbidden` không phải là một màn chặn
 *
 * Đây là chỗ dễ đọc sai nhất của bảng trên. Người xem không ghim được, nhưng
 * vẫn kéo được thước ra đọc số — nên `canPin` chỉ tắt đường ghim và thêm một
 * câu giải thích, chứ không tắt viên thuốc, không tắt lớp phủ, và không thay
 * khung nhìn bằng một tấm bảng "không có quyền".
 *
 * ## Bàn phím, và con trỏ đi cùng đường với nó
 *
 * `M` · `Esc` · `Enter` · `Delete` đăng ký qua `src/lib/input/shortcutRegistry`
 * ở tầng hook (A12, R-72). File này KHÔNG gắn `addEventListener('keydown')`, và
 * do đó không có đường nào cho nó cướp mất lời hứa "Esc đóng lớp trên cùng".
 *
 * Nhưng A12 nói bàn phím là đường đi hạng nhất, **không phải đường duy nhất**:
 * một hành động chỉ tới được bằng phím là một hành động người dùng chuột không
 * có. Nên `onToggleTool` (`M`), `onEscape` (`Esc`) và `onPin` (`Enter`) đi
 * xuống view thành ba prop, và mỗi prop có đúng một nút gọi tới — xem
 * {@link KeyAction}. Hai đường chung một hàm, nên chúng không thể lệch nhau về
 * sau. `Delete` đã có đường chuột sẵn ở mục "Phép đo" của panel phải.
 *
 * Nút ghim chỉ hiện khi có gì để ghim (`draft` khác `null`), và vô hiệu khi
 * `canPin` là `false` — lúc ấy `pinBlockedCaption` ngay bên dưới nói ra vì sao,
 * vì một nút mờ đi mà không giải thích là một nút bắt người dùng đoán.
 */
import { Pin, Ruler, X } from 'lucide-react';
import type { ReactNode } from 'react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { IconButton } from '@/components/ui/IconButton';
import { Kbd } from '@/components/ui/Kbd';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui/SegmentedControl';
import { cn } from '@/lib/utils';

import { MeasurementOverlay } from './MeasurementOverlay';
import { MeasurementSnapChip } from './MeasurementSnapChip';
import {
  MEASURE_MODES,
  MEASURE_MODE_LABELS,
  type MeasureMode,
  type MeasurementToolProps,
} from './measurementToolTypes';

/** Bốn chế độ, theo đúng thứ tự hợp đồng khai chúng. */
const MODE_OPTIONS: SegmentedControlOption<MeasureMode>[] = MEASURE_MODES.map((mode) => ({
  label: MEASURE_MODE_LABELS[mode],
  value: mode,
}));

/** Lời mời của trạng thái rỗng — nguyên văn bảng bảy trạng thái của hợp đồng. */
const EMPTY_INVITATION = 'chưa có phép đo nào. nhấn M rồi chọn hai điểm trên mô hình.';

/** Câu nhắc của trạng thái một phần: chuỗi đo còn dở. */
const PARTIAL_HINT = 'chuỗi đo chưa đóng. chọn thêm điểm để đóng chuỗi, hoặc nhấn Esc để bỏ.';

/** Nền chung của mọi mảnh chữ trôi trên canvas: đủ mờ để đọc được trên mọi nền. */
const FLOATING_SURFACE = 'rounded-full bg-bg-surface/90 shadow-float';

interface KeyActionProps {
  readonly icon: ReactNode;
  /** `aria-label` của nút, đã gồm cả tên phím. */
  readonly label: string;
  /** Tên phím in ra trong `Kbd` — chữ hoa, ngoại lệ mà A6 cho phép. */
  readonly hint: string;
  readonly onClick: () => void;
  readonly disabled?: boolean | undefined;
}

/**
 * Một hành động tới được bằng CẢ HAI đường: phím tắt, và cú bấm.
 *
 * A12 nói bàn phím là đường đi hạng nhất, không phải đường duy nhất — nên mỗi
 * hành động mà hook đăng ký trong `shortcutRegistry` có đúng một nút ở đây gọi
 * cùng hàm ấy. Hai đường, một `onClick`; không có nhánh nào để hai đường lệch
 * nhau về sau.
 *
 * Tên phím nằm trong `aria-label` chứ không chỉ nằm trong `Kbd`: `Kbd` là chữ
 * nhìn thấy, và nếu để nó là chỗ duy nhất nói ra phím tắt thì người dùng trình
 * đọc màn hình — đúng những người cần phím tắt nhất — là những người không được
 * nghe nó. `Kbd` do đó `aria-hidden`, vì nếu không nó sẽ được đọc lên lần thứ
 * hai, tách rời khỏi câu đã giải thích nó.
 */
function KeyAction({ icon, label, hint, onClick, disabled }: KeyActionProps) {
  return (
    <span className="flex items-center gap-1">
      <IconButton
        aria-label={label}
        disabled={disabled ?? false}
        icon={icon}
        onClick={onClick}
        size="sm"
      />
      <span aria-hidden="true">
        <Kbd>{hint}</Kbd>
      </span>
    </span>
  );
}

function EmptyInvitation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
      <p className="max-w-sm text-[14px] leading-relaxed text-text-secondary">{EMPTY_INVITATION}</p>
    </div>
  );
}

export function MeasurementTool(props: MeasurementToolProps) {
  const { state } = props;

  const isCollapsed = props.collapsed || state === 'collapsed';

  return (
    <div
      aria-label="Lớp phủ công cụ đo"
      className="pointer-events-none absolute inset-0"
      role="region"
    >
      {state === 'empty' && <EmptyInvitation />}

      <MeasurementOverlay
        draft={props.draft}
        highlightedId={props.highlightedId}
        measurements={props.measurements}
        unitJustChanged={props.unitJustChanged}
      />

      <div className="absolute left-1/2 top-3 flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-3">
        <div className={cn('pointer-events-auto p-1', FLOATING_SURFACE)}>
          <SegmentedControl
            aria-label="Chọn chế độ đo"
            className="rounded-full bg-transparent"
            onChange={props.onModeChange}
            options={MODE_OPTIONS}
            value={props.mode}
          />
        </div>

        <div className={cn('pointer-events-auto flex items-center gap-2 px-1.5 py-1', FLOATING_SURFACE)}>
          {props.draft !== null && (
            <KeyAction
              disabled={!props.canPin}
              hint="Enter"
              icon={<Pin aria-hidden="true" className="h-[18px] w-[18px]" />}
              label="ghim phép đo (phím Enter)"
              onClick={props.onPin}
            />
          )}

          <KeyAction
            hint="Esc"
            icon={<X aria-hidden="true" className="h-[18px] w-[18px]" />}
            label="thoát chế độ đo (phím Esc)"
            onClick={props.onEscape}
          />

          <KeyAction
            hint="M"
            icon={<Ruler aria-hidden="true" className="h-[18px] w-[18px]" />}
            label="bật tắt công cụ đo (phím M)"
            onClick={props.onToggleTool}
          />
        </div>

        <MeasurementSnapChip snap={props.snap} />

        {isCollapsed && (
          <button
            className={cn(
              'pointer-events-auto px-3 py-1.5 text-[12px] leading-none text-text-secondary',
              'transition-colors duration-instant hover:text-text-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app',
              FLOATING_SURFACE,
            )}
            onClick={props.onToggleCollapsed}
            type="button"
          >
            {props.countLabel}
            <span className="sr-only"> — mở lại danh sách phép đo</span>
          </button>
        )}

        {state === 'partial' && (
          <p className={cn('px-3 py-1.5 text-[12px] leading-none text-text-secondary', FLOATING_SURFACE)}>
            {PARTIAL_HINT}
          </p>
        )}

        {!props.canPin && props.pinBlockedCaption !== null && (
          <div className="pointer-events-auto w-full">
            <InlineAlert level="attention" message={props.pinBlockedCaption} />
          </div>
        )}

        {state === 'error' && props.errorMessage !== null && (
          <div className="pointer-events-auto w-full">
            <InlineAlert
              action={{ label: 'Thử lại', onClick: props.onRetry }}
              level="violation"
              message={props.errorMessage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
