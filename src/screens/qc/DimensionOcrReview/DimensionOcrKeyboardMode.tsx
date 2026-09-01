/**
 * Chế độ duyệt bàn phím — đường nhanh nhất của màn, và đặc tả bắt buộc có một
 * caption chỉ ra điều đó.
 *
 * View THUẦN của mục D (R-60): mọi thứ vào bằng props, không `@/api`, không
 * `@/store`, không `@/domain`, không `@/lib/http`.
 *
 * ## Cả màn thu về MỘT ảnh cắt và MỘT ô nhập
 *
 * Khi bật, thứ duy nhất còn lại là ảnh cắt vùng gốc của chuỗi đang duyệt và ô
 * nhập giá trị của nó. Không danh sách, không canvas, không thanh công cụ —
 * file này không vẽ ba thứ đó, và vỏ màn (T8) là nơi thôi vẽ chúng khi
 * `isActive`.
 *
 * ## Đúng hai lần gõ phím cho một chuỗi: số, rồi Enter
 *
 * Không có bước xác nhận, không có nút phải bấm. Enter chốt con số vừa gõ rồi
 * gọi `onApprove`; hook T5 là nơi nhảy sang chuỗi kế tiếp. Ảnh cắt mới HOÀ TAN
 * vào trong 180 ms — khe `'fast'` của `MOTION_DURATIONS_MS`, lấy qua
 * `useTransition` chứ không viết số thô (R-71), và tự tắt khi người dùng đặt
 * giảm chuyển động.
 *
 * ## View không tự đăng ký phím
 *
 * `R` bật chế độ này, `Esc` đóng lớp trên cùng — cả hai đăng ký ở
 * `shortcutRegistry` trong hook T5 (I-01, A12). File này chỉ NHẬN handler qua
 * props và gắn trình xử lý lên chính phần tử đang giữ tiêu điểm; nó không tự
 * đăng ký một trình nghe sự kiện nào trên `window` hay `document` (R-72).
 */

import { Kbd } from '@/components/ui/Kbd';
import { useTransition } from '@/hooks/useTransition';
import { cn } from '@/lib/utils';

import { DIMENSION_OCR_TEXT } from './dimensionOcrText';
import { DimensionOcrCrop, DimensionOcrOutlierNotice, DimensionValueField } from './DimensionOcrRow';
import type { DimensionOcrKeyboardModeProps, DimensionRowViewModel } from './dimensionOcrTypes';

/**
 * Props của chế độ duyệt bàn phím — mở rộng THUẦN CỘNG hợp đồng đóng băng của
 * T3 (QĐ-7). `isActive` và `onToggle` một mình không đủ để vẽ một ảnh cắt và
 * một ô nhập. `dimensionOcrTypes.ts` không bị chạm tới.
 */
export interface DimensionOcrKeyboardModeViewProps extends DimensionOcrKeyboardModeProps {
  /** Chuỗi kích thước đang duyệt. `null` khi không còn chuỗi nào để đi tiếp. */
  readonly row: DimensionRowViewModel | null;
  /** Câu cảnh báo giá trị vô lý, đã ghép sẵn ở hook. `null` khi giá trị hợp lý. */
  readonly outlierMessage: string | null;
  readonly onEdit: (dimensionId: string, valueMm: number) => void;
  /** Enter: lưu rồi nhảy hàng sau. Việc nhảy hàng là của hook. */
  readonly onApprove: (dimensionId: string) => void;
  readonly onCancelEdit: () => void;
}

/** Bốn phím của nửa phải, đúng thứ tự đặc tả liệt kê. */
const KEY_LEGEND = [
  DIMENSION_OCR_TEXT.keyboard.keys.enter,
  DIMENSION_OCR_TEXT.keyboard.keys.tab,
  DIMENSION_OCR_TEXT.keyboard.keys.esc,
  DIMENSION_OCR_TEXT.keyboard.keys.r,
] as const;

const TOGGLE_CLASS_NAME = cn(
  'self-start rounded-[6px] px-1.5 py-0.5 text-[13px] text-accent',
  'transition-colors duration-120 hover:bg-accent-wash',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
);

/* -------------------------------------------------------------------------- */
/* Ảnh cắt duy nhất, hoà tan khi sang chuỗi kế tiếp.                            */
/* -------------------------------------------------------------------------- */

/**
 * Ảnh cắt của chuỗi đang duyệt.
 *
 * Nơi gọi đặt `key={row.id}`, nên sang chuỗi mới là gắn lại phần tử này từ đầu
 * và `useTransition` chạy lại từ 0 — đó là cách hoà tan 180 ms xảy ra mà không
 * cần một vòng lặp khung hình tự viết nào.
 */
function KeyboardModeCrop({ row }: { readonly row: DimensionRowViewModel }) {
  const fade = useTransition('fast', { active: true, easing: 'enter' });

  return (
    <div style={{ opacity: fade.value }}>
      <DimensionOcrCrop crop={row.crop} isMagnified />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Chế độ duyệt bàn phím.                                                      */
/* -------------------------------------------------------------------------- */

export function DimensionOcrKeyboardMode({
  isActive,
  onToggle,
  row,
  outlierMessage,
  onEdit,
  onApprove,
  onCancelEdit,
}: DimensionOcrKeyboardModeViewProps) {
  if (!isActive) {
    /*
      Cửa vào. Bấm được bằng chuột, tới được bằng Tab, và caption nói ra phím
      tắt tương đương — A12 đòi bàn phím là đường đi hạng nhất, không phải
      phương án dự phòng.
    */
    return (
      <div className="flex items-center gap-2">
        <button className={TOGGLE_CLASS_NAME} onClick={onToggle} type="button">
          {DIMENSION_OCR_TEXT.keyboard.toggleOnLabel}
        </button>
        <span className="flex items-center gap-1.5 text-[12px] text-text-muted">
          {DIMENSION_OCR_TEXT.keyboard.shortcutHint}
          <Kbd>{DIMENSION_OCR_TEXT.keyboard.keys.r.label}</Kbd>
        </span>
      </div>
    );
  }

  return (
    <section
      aria-label={DIMENSION_OCR_TEXT.keyboard.caption}
      className="flex h-full flex-col items-center justify-center gap-5 p-6"
    >
      <p className="text-[13px] text-text-secondary">{DIMENSION_OCR_TEXT.keyboard.caption}</p>

      {row === null ? null : (
        <>
          {/* MỘT ảnh cắt. [CẤM TUYỆT ĐỐI]: số đọc được không bao giờ đứng một mình. */}
          <KeyboardModeCrop key={row.id} row={row} />

          <span className="font-mono text-[16px] leading-[24px] text-text-primary">
            {row.codeLabel}
          </span>

          {/*
            MỘT ô nhập. `isViewerRole={false}` không phải một giả định: vai chỉ
            được xem không có gì để duyệt, nên vỏ màn không bật chế độ này cho
            nó — ô ở đây luôn là ô sửa được.
          */}
          <DimensionValueField
            hasAutoFocus
            isViewerRole={false}
            onCancelEdit={onCancelEdit}
            onCommit={() => onApprove(row.id)}
            onEdit={onEdit}
            row={row}
          />

          <DimensionOcrOutlierNotice message={outlierMessage} />
        </>
      )}

      <dl className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {KEY_LEGEND.map((key) => (
          <div className="flex items-center gap-1.5" key={key.label}>
            <dt>
              <Kbd>{key.label}</Kbd>
            </dt>
            <dd className="text-[12px] text-text-muted">{key.description}</dd>
          </div>
        ))}
      </dl>

      <button className={TOGGLE_CLASS_NAME} onClick={onToggle} type="button">
        {DIMENSION_OCR_TEXT.keyboard.toggleOffLabel}
      </button>
    </section>
  );
}
