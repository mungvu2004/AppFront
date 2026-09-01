/**
 * Một hàng của danh sách duyệt kích thước: ảnh cắt vùng gốc bên trái, số đọc
 * được bên phải.
 *
 * View THUẦN của mục D (R-60): mọi thứ vào bằng props, không `@/api`, không
 * `@/store`, không `@/domain`, không `@/lib/http`.
 *
 * ## [CẤM TUYỆT ĐỐI] mỗi số đọc được phải có ảnh cắt gốc nằm cạnh
 *
 * `DimensionRowViewModel.crop` KHÔNG tuỳ chọn — hợp đồng của T3 đã đóng cửa đó
 * lại ở tầng kiểu, nên file này không cần (và không được) vẽ một hàng thiếu
 * ảnh. Ảnh cắt dựng bằng `background-position` trên một ô `overflow-hidden`,
 * đúng kết luận mục F của `.orca-notes/S14-T2-components.contract.md`: không
 * tạo component mới, không tải một tấm ảnh thứ hai cho mỗi hàng.
 *
 * ## Đơn vị "mm" là NHÃN, không phải ô nhập
 *
 * `NumericField` nhận `unit` rồi chuyển thẳng xuống `suffix` của `Input`
 * (`NumericField.tsx:63`) — một nhãn tĩnh bên phải ô. Đây là câu trả lời Q1 của
 * ghi chú T2, và là lý do màn này KHÔNG dựng ô nhập thứ hai cho đơn vị.
 *
 * ## Gợi ý "giá trị vô lý" đến từ hook, không từ view
 *
 * `outlierMessage` là câu đã ghép sẵn bằng `outlierHint()` của T4. View chỉ
 * hiển thị nó: so ngưỡng ở đây là đúng thứ [CẤM TUYỆT ĐỐI] và A15 cấm. Nó hiện
 * NGAY KHI GÕ vì `NumericField` tự chốt giá trị sau một nhịp gõ ngắn
 * (`useNumericField.ts`, `COMMIT_DEBOUNCE_MS`) rồi gọi `onEdit`, và hook trả
 * `outlierMessage` mới về ngay lượt render sau.
 *
 * ## Bàn phím (A12, R-72)
 *
 * View KHÔNG tự đăng ký phím trên `window` hay `document` — việc đó của
 * `shortcutRegistry` ở hook T5. Ở đây chỉ có trình xử lý gắn trên chính phần tử
 * đang giữ tiêu điểm, đúng khuôn `ObjectLayerList.tsx:74-80`: Enter/Space trên
 * hàng để chọn, Enter trong ô nhập để lưu và đi tiếp, Esc để bỏ sửa.
 */

import type { CSSProperties, KeyboardEvent } from 'react';

import { ConfidenceMeter } from '@/components/ui/ConfidenceMeter';
import { NumericField } from '@/components/ui/NumericField';
import { cn } from '@/lib/utils';

import { DIMENSION_OCR_TEXT } from './dimensionOcrText';
import type {
  DimensionCropViewModel,
  DimensionOcrRowProps,
  DimensionRowViewModel,
} from './dimensionOcrTypes';

/**
 * Props của hàng — mở rộng THUẦN CỘNG hợp đồng đóng băng của T3.
 *
 * Điều phối viên duyệt cách mở rộng này ở QĐ-7, đúng tiền lệ đã duyệt của màn
 * anh em (`objectLayerSymbols.ts` — `ObjectLayerListViewProps extends
 * ObjectLayerListProps`). `dimensionOcrTypes.ts` không bị chạm tới.
 */
export interface DimensionOcrRowViewProps extends DimensionOcrRowProps {
  /**
   * Câu cảnh báo giá trị vô lý, đã ghép sẵn bằng `outlierHint()` của T4.
   * `null` khi giá trị hợp lý. Hook so ngưỡng, view chỉ hiển thị.
   */
  readonly outlierMessage: string | null;
}

/* -------------------------------------------------------------------------- */
/* Ba màu trạng thái của A4 — không có màu thứ tư.                             */
/* -------------------------------------------------------------------------- */

/**
 * `verified` CHỈ tới nơi khi người duyệt đã đánh dấu (A5) — hợp đồng của T3 nói
 * rõ điều đó, nên bảng này không phải đoán lại.
 */
const STATUS_DOT_TOKEN = {
  verified: 'bg-state-verified',
  attention: 'bg-state-attention',
  violation: 'bg-state-violation',
  neutral: 'bg-text-muted',
} as const;

const STATUS_BORDER_TOKEN = {
  verified: 'border-state-verified',
  attention: 'border-state-attention',
  violation: 'border-state-violation',
  neutral: 'border-border-default',
} as const;

/* -------------------------------------------------------------------------- */
/* Ảnh cắt vùng gốc.                                                           */
/* -------------------------------------------------------------------------- */

/** Hệ số phóng của ảnh cắt trong chế độ duyệt bàn phím — ở đó chỉ còn MỘT ảnh. */
const MAGNIFIED_CROP_SCALE = 2;

interface DimensionOcrCropProps {
  readonly crop: DimensionCropViewModel;
  /** Chế độ duyệt bàn phím phóng to ảnh cắt duy nhất của nó. */
  readonly isMagnified?: boolean;
}

/**
 * Ô ảnh cắt 1:1 của vùng gốc.
 *
 * Ảnh vẽ ở TỶ LỆ GỐC — `background-size` để mặc định là kích thước thật của
 * tệp — rồi dịch đi bằng `background-position` âm đúng bằng toạ độ khung cắt,
 * nên một pixel của bản vẽ là một pixel trên màn: thứ cần thiết để đọc lại đúng
 * chữ số mà OCR đã đọc. Không một phép tính hình học nào ở đây: `sourcePx` tới
 * nơi đã là khung cắt, `displayWidthPx`/`displayHeightPx` tới nơi đã là kích
 * thước ô hiển thị.
 *
 * Bề rộng ô thu về `displayHeightPx` (ô vuông) dưới 1024px và bung ra
 * `displayWidthPx` từ `lg:` trở lên. Hai con số đó lấy từ view model chứ không
 * viết thô (R-71), và đi vào CSS qua biến để lớp Tailwind bắt được điểm ngắt —
 * một `style` thẳng không có media query.
 */
export function DimensionOcrCrop({ crop, isMagnified = false }: DimensionOcrCropProps) {
  const box = (
    <div
      aria-label={crop.alt}
      className={cn(
        'shrink-0 overflow-hidden rounded-[8px] border border-border-default bg-bg-sunken',
        'h-[var(--dim-crop-h)] w-[var(--dim-crop-h)] lg:w-[var(--dim-crop-w)]',
      )}
      role="img"
      style={
        {
          '--dim-crop-w': `${crop.displayWidthPx}px`,
          '--dim-crop-h': `${crop.displayHeightPx}px`,
          backgroundImage: `url(${crop.imageUrl})`,
          backgroundPosition: `-${crop.sourcePx.x}px -${crop.sourcePx.y}px`,
          backgroundRepeat: 'no-repeat',
        } as CSSProperties
      }
    />
  );

  if (!isMagnified) {
    return box;
  }

  return (
    <div
      className="flex items-center justify-center overflow-hidden"
      style={{ height: `${crop.displayHeightPx * MAGNIFIED_CROP_SCALE}px` }}
    >
      <div style={{ transform: `scale(${MAGNIFIED_CROP_SCALE})` }}>{box}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Câu cảnh báo giá trị vô lý.                                                 */
/* -------------------------------------------------------------------------- */

interface DimensionOcrOutlierNoticeProps {
  readonly message: string | null;
}

/**
 * Vùng `role="status"` để trình đọc màn hình đọc câu cảnh báo ngay khi nó hiện,
 * mà không cướp tiêu điểm khỏi ô nhập đang gõ (R-72).
 */
export function DimensionOcrOutlierNotice({ message }: DimensionOcrOutlierNoticeProps) {
  if (message === null) {
    return null;
  }

  return (
    <p
      className="rounded-[6px] bg-state-attention-tint px-2 py-1 text-[13px] text-state-attention-text"
      role="status"
    >
      {message}
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* Ô nhập số + đơn vị cố định.                                                 */
/* -------------------------------------------------------------------------- */

interface DimensionValueFieldProps {
  readonly row: DimensionRowViewModel;
  readonly isViewerRole: boolean;
  readonly onEdit: DimensionOcrRowProps['onEdit'];
  /** Enter: lưu con số vừa gõ rồi đi tiếp. Việc "đi tiếp" là của hook. */
  readonly onCommit: () => void;
  readonly onCancelEdit: () => void;
  readonly hasAutoFocus?: boolean;
}

/**
 * Ô nhập giá trị đọc được, chữ mono 16px, đơn vị "mm" là nhãn tĩnh bên phải.
 *
 * Trình xử lý phím gắn trên phần tử BỌC chứ không truyền xuống `NumericField`:
 * `NumericField` trải `...props` SAU `onKeyDown` của chính nó
 * (`NumericField.tsx:57-66`), nên truyền thẳng xuống sẽ đè mất phím mũi tên và
 * phím Esc dựng sẵn của nó. Sự kiện nổi từ `<input>` lên đây, nên cả hai cùng
 * chạy và không bên nào mất phần của mình.
 */
export function DimensionValueField({
  row,
  isViewerRole,
  onEdit,
  onCommit,
  onCancelEdit,
  hasAutoFocus = false,
}: DimensionValueFieldProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter') {
      /*
        Đúng hai lần gõ phím cho một chuỗi: số, rồi Enter. `NumericField` chốt
        giá trị lúc mất tiêu điểm, nên `blur()` ở đây là cách đẩy con số vừa gõ
        đi TRƯỚC khi duyệt — không phải một bước xác nhận thêm, người dùng không
        bấm gì cả.
      */
      event.preventDefault();
      event.stopPropagation();

      if (event.target instanceof HTMLInputElement) {
        event.target.blur();
      }

      onCommit();
      return;
    }

    if (event.key === 'Escape') {
      onCancelEdit();
    }
  };

  return (
    <div className="flex items-center gap-3" onKeyDown={handleKeyDown}>
      <NumericField
        aria-label={`${DIMENSION_OCR_TEXT.row.inputAriaLabelPrefix}${row.codeLabel}`}
        autoFocus={hasAutoFocus}
        className="text-right font-mono text-[16px] leading-[24px]"
        disabled={isViewerRole}
        onChange={(next) => {
          if (next === undefined) {
            return;
          }

          onEdit(row.id, next);
        }}
        unit={DIMENSION_OCR_TEXT.panel.unitLabel}
        value={row.valueMm}
      />
      <ConfidenceMeter value={row.confidence} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hàng.                                                                       */
/* -------------------------------------------------------------------------- */

export function DimensionOcrRow({
  row,
  isSelected,
  isViewerRole,
  onSelect,
  onEdit,
  onApprove,
  onCancelEdit,
  outlierMessage,
}: DimensionOcrRowViewProps) {
  return (
    <div
      aria-label={row.codeLabel}
      aria-selected={isSelected}
      className={cn(
        'flex cursor-pointer gap-4 rounded-[12px] border bg-bg-surface p-4 outline-none',
        'transition-colors duration-120 hover:bg-bg-hover',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        STATUS_BORDER_TOKEN[row.statusCode],
        isSelected && 'border-2 border-accent',
      )}
      data-dimension-id={row.id}
      onClick={() => onSelect(row.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(row.id);
        }
      }}
      role="option"
      tabIndex={0}
    >
      {/* [CẤM TUYỆT ĐỐI]: số đọc được không bao giờ đứng một mình. */}
      <DimensionOcrCrop crop={row.crop} />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[16px] leading-[24px] text-text-primary">
            {row.codeLabel}
          </span>
          <span
            aria-hidden="true"
            className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOT_TOKEN[row.statusCode])}
          />
        </div>

        <DimensionValueField
          isViewerRole={isViewerRole}
          onCancelEdit={onCancelEdit}
          onCommit={() => onApprove(row.id)}
          onEdit={onEdit}
          row={row}
        />

        {/* Caption liên kết suy ra — "Gắn với #W-014". `null` khi không suy ra được. */}
        {row.hostWallLabel === null ? null : (
          <span className="font-mono text-[12px] text-text-muted">{row.hostWallLabel}</span>
        )}

        <DimensionOcrOutlierNotice message={outlierMessage} />

        {/*
          A7: không có nút lưu ở bất cứ đâu. Nút dưới đây DUYỆT — việc của người
          duyệt, và chỉ của người duyệt (A5) — nên nó biến mất khi hàng đã duyệt
          hoặc khi vai chỉ được xem.
        */}
        {isViewerRole || row.isReviewed ? null : (
          <button
            aria-label={`${DIMENSION_OCR_TEXT.row.approveButtonAriaLabelPrefix}${row.codeLabel}`}
            className={cn(
              'self-start rounded-[6px] px-1.5 py-0.5 text-[13px] text-accent',
              'transition-colors duration-120 hover:bg-accent-wash',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            )}
            onClick={(event) => {
              /* Bấm hành động KHÔNG kéo theo một lượt chọn hàng ngoài ý muốn. */
              event.stopPropagation();
              onApprove(row.id);
            }}
            type="button"
          >
            {DIMENSION_OCR_TEXT.row.approveLabel}
          </button>
        )}
      </div>
    </div>
  );
}
