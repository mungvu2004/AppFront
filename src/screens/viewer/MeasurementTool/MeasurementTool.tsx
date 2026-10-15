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
 * | `empty` | Lời mời đo, trên nền đệm ngay dưới cụm điều khiển |
 * | `measuring` | Lớp phủ vẽ bản nháp; nhãn bám con trỏ, chữ đều, KHÔNG chạy số |
 * | `partial` | Câu nhắc chuỗi đo chưa đóng; hàng hết neo mang chấm cần chú ý |
 * | `error` | `errorMessage` + nút gọi `onRetry` |
 * | `ready` | Lớp phủ vẽ các phép đo đã ghim |
 * | `forbidden` | **Vẫn đo được**; chỉ chặn ghim và xoá, và nói ra `pinBlockedCaption` |
 * | `collapsed` | Danh sách thành chip đếm trong cụm trôi |
 *
 * Không trạng thái nào tháo viên thuốc chế độ hay chip bắt điểm đi. Chip đặc
 * biệt: đặc tả bắt **loại bắt điểm hiện tại luôn phải được gọi tên trên màn**,
 * nên nó không có nhánh nào ẩn — kể cả lúc lỗi, lúc rỗng, lúc không có quyền.
 *
 * ## `forbidden` không phải là một màn chặn
 *
 * Đây là chỗ dễ đọc sai nhất của bảng trên. Người xem không ghim được, nhưng
 * vẫn kéo được thước ra đọc số — nên `canPin` chỉ chặn ghim và xoá, thêm một
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
 * Nút ghim chỉ hiện khi có gì để ghim (`draftComplete`: đủ điểm), và vô hiệu khi
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
import { VIEWER_LAYOUT } from '@/screens/viewer/ViewerShell/viewerShellTypes';

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
const EMPTY_INVITATION = 'Chưa có phép đo nào. Nhấn M rồi chọn hai điểm trên mô hình.';

/** Thay lời mời đo khi dự án chưa có tầng nào — không có mô hình để chấm điểm. */
const NO_MODEL_MESSAGE = 'Chưa có mô hình để đo: dự án chưa có tầng nào được dựng.';

/** Câu nhắc của trạng thái một phần: chuỗi đo còn dở (chỉ diện tích mặt sàn nhận thêm điểm). */
const PARTIAL_HINT = 'Chuỗi đo chưa đóng. Chọn thêm điểm để đóng chuỗi, hoặc nhấn Esc để bỏ.';

/** Chế độ hai điểm đã đủ điểm: không còn điểm nào để chọn, chỉ còn ghim hoặc bỏ (25-C-023). */
const PIN_HINT = 'Đã đủ hai điểm. Nhấn Enter để ghim phép đo, hoặc nhấn Esc để bỏ.';

/** Dải góc trên phải của vỏ: bản đồ nhỏ 160 (`MiniMap.tsx`) + lề `right-2` 8 + khe 8. */
const CORNER_COLUMN_PX = 160 + 16;

/** Đáy bản đồ nhỏ + khe: `top-2` 8 + ViewCube + khe 8 + bản đồ 120 + khe 8. */
const BELOW_CORNER_PX = 8 + VIEWER_LAYOUT.cubePx + 8 + 120 + 8;

/**
 * Dưới bề rộng khung nhìn này, bên trái dải góc (khung − 176 − 12) hẹp hơn viên
 * thuốc Ghim/Esc/M (~230 px) nên cột xuống dưới bản đồ nhỏ thay vì chen cạnh nó.
 */
const CORNER_SPLIT_PX = 420;

/** Nền chung của mọi mảnh chữ trôi trên canvas: đủ mờ để đọc được trên mọi nền. */
const FLOATING_SURFACE = 'rounded-full bg-bg-surface-90 shadow-float';

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

export function MeasurementTool(props: MeasurementToolProps) {
  const { state } = props;

  const isCollapsed = props.collapsed || state === 'collapsed';

  return (
    <div
      aria-label="Lớp phủ công cụ đo"
      className="pointer-events-none absolute inset-0"
      role="region"
    >
      <MeasurementOverlay
        draft={props.draft}
        highlightedId={props.highlightedId}
        measurements={props.measurements}
        unitJustChanged={props.unitJustChanged}
      />

      {/* Cột giữa chừa CẢ dải góc trên phải của vỏ — ViewCube 72 VÀ bản đồ nhỏ 160×120
          ngay dưới nó — chứ không chỉ ViewCube: cột cao hơn ViewCube nên thanh báo lỗi
          và nút "Thử lại" từng nằm dưới bản đồ nhỏ (BUG-474), và ở 375 thanh chế độ
          xuống ba dòng chạm bản đồ nhỏ (BUG-375). Khung hẹp hơn CORNER_SPLIT_PX thì
          bên trái dải góc không đủ chỗ cho một nút chế độ, nên cả cột xuống dưới bản đồ
          nhỏ và dùng hết bề ngang. Phần trăm của padding tính theo BỀ RỘNG khung, nên
          `clamp((ngưỡng - 100%) * 100)` là một công tắc theo bề rộng không cần lớp CSS. */}
      <div
        className="absolute inset-x-0 top-0 flex flex-col items-center gap-2 pl-3"
        style={{
          paddingTop: `clamp(12px, (${String(CORNER_SPLIT_PX)}px - 100%) * 100, ${String(BELOW_CORNER_PX)}px)`,
          paddingRight: `clamp(12px, (100% - ${String(CORNER_SPLIT_PX)}px) * 100, ${String(CORNER_COLUMN_PX)}px)`,
        }}
      >
        <div className={cn('pointer-events-auto p-1', FLOATING_SURFACE, 'rounded-2xl')}>
          <SegmentedControl
            aria-label="Chọn chế độ đo"
            className="h-auto flex-wrap justify-center bg-transparent [&>button]:h-7"
            onChange={props.onModeChange}
            options={MODE_OPTIONS}
            value={props.mode}
          />
        </div>

        {/* Viên thuốc phím và chip bắt điểm chung một hàng (xuống dòng khi hẹp): ở 375
            cột chỉ còn ~180 px dọc dưới bản đồ nhỏ, và lời mời đo phải vừa trên chú giải. */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div
            className={cn(
              'pointer-events-auto flex items-center gap-2 px-1.5 py-1',
              FLOATING_SURFACE,
            )}
          >
            {props.draft !== null && props.draftComplete && (
              <KeyAction
                disabled={!props.canPin}
                hint="Enter"
                icon={<Pin aria-hidden="true" className="h-[18px] w-[18px]" />}
                label="Ghim phép đo (phím Enter)"
                onClick={props.onPin}
              />
            )}

            <KeyAction
              hint="Esc"
              icon={<X aria-hidden="true" className="h-[18px] w-[18px]" />}
              label="Bỏ phần đo dở (phím Esc)"
              onClick={props.onEscape}
            />

            <KeyAction
              hint="M"
              icon={<Ruler aria-hidden="true" className="h-[18px] w-[18px]" />}
              label="Bật tắt công cụ đo (phím M)"
              onClick={props.onToggleTool}
            />
          </div>

          <MeasurementSnapChip snap={props.snap} />
        </div>

        {/* Lời mời đo nằm trong cột, trên nền đệm như mọi chữ nổi khác: chữ trần trên
            canvas tối không đạt 4,5:1 (BUG-483), và giữa khung nhìn thì ở 375 nó đè
            lên cột điều khiển. */}
        {state === 'empty' && (
          <p
            className={cn(
              'max-w-sm px-3 py-1.5 text-center text-[13px] leading-snug text-text-secondary',
              FLOATING_SURFACE,
              'rounded-2xl',
            )}
          >
            {props.noModel ? NO_MODEL_MESSAGE : EMPTY_INVITATION}
          </p>
        )}

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
          <p
            className={cn(
              'px-3 py-1.5 text-[12px] leading-none text-text-secondary',
              FLOATING_SURFACE,
            )}
          >
            {props.mode === 'floorArea' ? PARTIAL_HINT : PIN_HINT}
          </p>
        )}

        {!props.canPin && props.pinBlockedCaption !== null && (
          <div className="pointer-events-auto w-full">
            <InlineAlert level="attention" message={props.pinBlockedCaption} />
          </div>
        )}

        {/* `relative z-10`: ở 375 khung nhìn cao ~490 px, cột dưới bản đồ nhỏ không vừa
            nên thanh lỗi chạm dải đáy; nút "Thử lại" phải nằm TRÊN cụm thu phóng và chú
            giải của vỏ chứ không bị chúng đè (BUG-474 hồi quy, 25-F-011). */}
        {state === 'error' && props.errorMessage !== null && (
          <div className="pointer-events-auto relative z-10 w-full">
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
