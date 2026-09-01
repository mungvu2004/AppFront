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
import { FieldRow } from '@/components/ui/FieldRow';
import { Select } from '@/components/ui/Select';

import type { AxisGridManagerProps, OriginPanelViewModel } from './axisGridTypes';

export interface AxisGridOriginPanelProps extends Pick<AxisGridManagerProps, 'onAnchorChange'> {
  readonly origin: OriginPanelViewModel;
}

const PANEL_TITLE = 'Gốc toạ độ';
const SELECT_LABEL = 'Chọn giao trục neo';
const SELECT_DESCRIPTION =
  'Gốc toạ độ sẽ tính từ giao điểm trục này, khi di chuyển tầng để căn lên tầng gốc.';
const OFFSET_X_PX_LABEL = 'lệch X (pixel)';
const OFFSET_Y_PX_LABEL = 'lệch Y (pixel)';
const OFFSET_X_MM_LABEL = 'lệch X (mm)';
const OFFSET_Y_MM_LABEL = 'lệch Y (mm)';
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
    <FieldRow isLast={isLast} label={label}>
      <span className="flex h-9 items-center gap-0.5 font-mono text-[14px] tabular-nums text-text-primary">
        <span>{text}</span>
        <span className="text-text-secondary">{suffix}</span>
      </span>
    </FieldRow>
  );
}

export function AxisGridOriginPanel({ origin, onAnchorChange }: AxisGridOriginPanelProps) {
  const offsetXPx = useCountUp(origin.offsetXPx);
  const offsetYPx = useCountUp(origin.offsetYPx);
  const offsetXMm = useCountUp(origin.offsetXMm, { format: { fractionDigits: MM_FRACTION_DIGITS } });
  const offsetYMm = useCountUp(origin.offsetYMm, { format: { fractionDigits: MM_FRACTION_DIGITS } });

  return (
    <div className="flex w-[344px] shrink-0 flex-col gap-4 rounded-[12px] bg-bg-surface p-5 shadow-panel">
      <h3 className="text-[16px] font-semibold text-text-primary">{PANEL_TITLE}</h3>

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
        <OffsetFieldRow label={OFFSET_X_PX_LABEL} suffix={PX_SUFFIX} text={offsetXPx.text} />
        <OffsetFieldRow label={OFFSET_Y_PX_LABEL} suffix={PX_SUFFIX} text={offsetYPx.text} />
        <OffsetFieldRow label={OFFSET_X_MM_LABEL} suffix={MM_SUFFIX} text={offsetXMm.text} />
        <OffsetFieldRow isLast label={OFFSET_Y_MM_LABEL} suffix={MM_SUFFIX} text={offsetYMm.text} />
      </div>
    </div>
  );
}
