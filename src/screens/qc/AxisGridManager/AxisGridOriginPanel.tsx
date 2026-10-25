/**
 * Mục "Gốc toạ độ" — Select chọn giao trục neo, và bốn FieldRow chỉ đọc hiện
 * độ lệch (pixel + milimét) chạy số khi đổi neo.
 *
 * View THUẦN (R-60). Props dùng `Pick<AxisGridManagerProps, 'onAnchorChange'>`
 * — cùng chữ ký với hook lớp sau, không tự khai lại.
 *
 * ## Chạy số mà vẫn không định dạng số trong view (A15)
 *
 * `OriginPanelViewModel` mang cả chuỗi đã định dạng (`offset*Text`, nguồn sự
 * thật lúc nghỉ) LẪN số thô (`offset*Px`/`offset*Mm`, CHỈ để nạp cho
 * `useCountUp` — xem JSDoc của chính hai trường đó trong `axisGridTypes.ts`).
 * `useCountUp(to, { format })` tự gọi `formatNumber(value, format)` ở MỌI khung
 * hình bằng `formatNumber`/`formatLength` — không phải view tự làm tròn hay tự
 * chọn dấu phẩy. Hai `format` dưới đây được chọn để khung hình lúc NGHỈ trùng
 * khít phần số của `offset*Text`:
 * - Pixel: gọi `useCountUp` không truyền `format` — đúng cách
 *   `axisGridManagerScenarios.ts#pixelText()` gọi `formatNumber(valuePx)` không
 *   tham số.
 * - Milimét: `{ fractionDigits: 0 }` — đúng `MILLIMETRE_FRACTION_DIGITS` của
 *   `src/lib/format/measure.ts` (hằng nội bộ, không xuất khẩu; giá trị `0` khớp
 *   tiền lệ `useCountUp(reviewCounter.reviewed, { format: { fractionDigits: 0
 *   } })` đã dùng ở `WallLayerLeftPanel.tsx`/`ObjectLayerLeftPanel.tsx`).
 *
 * Đơn vị (" px"/" mm") là hậu tố TĨNH nối vào `sample.text`, không phải một
 * lượt định dạng số khác — cùng kỹ thuật `REVIEWED_SUFFIX` của hai panel anh
 * em kia (tách phần chạy số khỏi phần chữ tĩnh đứng sau nó).
 */

import { useCountUp } from '@/hooks/useCountUp';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';

import type { AxisGridManagerProps, OriginPanelViewModel } from './axisGridTypes';

export interface AxisGridOriginPanelProps extends Pick<AxisGridManagerProps, 'onAnchorChange'> {
  readonly origin: OriginPanelViewModel;
  /** Tầng chưa có trục (rỗng/lỗi): nói ra thay cho ô neo trống và bốn số 0 giả (BUG-330, BUG-336). */
  readonly unavailableNotice: string | null;
}

/** Vòng 6 (Z/S-18): khối cố định thứ nhất của cột chi tiết — cao độ ±0.000 đặt tại giao trục neo. */
const PANEL_TITLE = 'Gốc ±0.000';
const SELECT_LABEL = 'Chọn giao trục neo';
const SELECT_DESCRIPTION =
  'Gốc toạ độ sẽ tính từ giao điểm trục này, khi di chuyển tầng để căn lên tầng gốc.';
const OFFSET_X_PX_LABEL = 'Lệch ngang trên ảnh';
const OFFSET_Y_PX_LABEL = 'Lệch dọc trên ảnh';
const OFFSET_X_MM_LABEL = 'Lệch X (mm)';
const OFFSET_Y_MM_LABEL = 'Lệch Y (mm)';
const PX_SUFFIX = ' px';
const MM_SUFFIX = ' mm';
/** Khớp `MILLIMETRE_FRACTION_DIGITS` (nội bộ, không xuất khẩu) của `src/lib/format/measure.ts`. */
const MM_FRACTION_DIGITS = 0;

interface OffsetFieldRowProps {
  readonly label: string;
  readonly text: string;
  readonly suffix: string;
  readonly isLast?: boolean;
}

function OffsetFieldRow({ label, text, suffix, isLast = false }: OffsetFieldRowProps) {
  return (
    /* BUG-613: nhãn và số chung một dòng chữ. Vòng 6: hàng tự dựng thay `FieldRow` — cột nhãn của nó
       quá hẹp trong cột chi tiết 344 nên "Lệch ngang trên ảnh" xuống hai dòng. */
    <div className={cn('flex items-baseline justify-between gap-3 py-2 text-body-sm', !isLast && 'border-b border-border-default')}>
      <span className="text-text-secondary">{label}</span>
      <span className="flex shrink-0 items-center gap-0.5 font-mono tabular-nums text-text-primary">
        <span>{text}</span>
        <span className="text-text-secondary">{suffix}</span>
      </span>
    </div>
  );
}

export function AxisGridOriginPanel({
  origin,
  onAnchorChange,
  unavailableNotice,
}: AxisGridOriginPanelProps) {
  const offsetXPx = useCountUp(origin.offsetXPx);
  const offsetYPx = useCountUp(origin.offsetYPx);
  const offsetXMm = useCountUp(origin.offsetXMm, { format: { fractionDigits: MM_FRACTION_DIGITS } });
  const offsetYMm = useCountUp(origin.offsetYMm, { format: { fractionDigits: MM_FRACTION_DIGITS } });
  /* Chưa có giao trục để neo thì chưa đo được gì: đọc "—" của hook, không số 0 của count-up (G20, BUG-330). */
  const isUnmeasured = origin.anchorOptions.length === 0;

  return (
    <div className="flex flex-col gap-4 p-5">
      <h2 className="text-heading text-text-primary">{PANEL_TITLE}</h2>

      {unavailableNotice !== null ? (
        <p className="text-[13px] text-text-secondary">{unavailableNotice}</p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <Select
              disabled={origin.anchorOptions.length === 0}
              label={SELECT_LABEL}
              onChange={onAnchorChange}
              options={[...origin.anchorOptions]}
              {...(origin.selectedAnchor !== null ? { value: origin.selectedAnchor } : {})}
            />
            <p className="text-[13px] text-text-secondary">{SELECT_DESCRIPTION}</p>
          </div>

          <div className="flex flex-col">
            <OffsetFieldRow label={OFFSET_X_PX_LABEL} suffix={PX_SUFFIX} text={isUnmeasured ? origin.offsetXPxText : offsetXPx.text} />
            <OffsetFieldRow label={OFFSET_Y_PX_LABEL} suffix={PX_SUFFIX} text={isUnmeasured ? origin.offsetYPxText : offsetYPx.text} />
            <OffsetFieldRow label={OFFSET_X_MM_LABEL} suffix={MM_SUFFIX} text={isUnmeasured ? origin.offsetXMmText : offsetXMm.text} />
            <OffsetFieldRow
              isLast
              label={OFFSET_Y_MM_LABEL}
              suffix={MM_SUFFIX}
              text={isUnmeasured ? origin.offsetYMmText : offsetYMm.text}
            />
          </div>
        </>
      )}
    </div>
  );
}
