/**
 * Ba khối chỉ-đọc của thanh tra phòng: số đo, độ tin cậy kèm ảnh cắt gốc, và
 * các dòng nhắc công năng. Tách khỏi `RoomLabelInspector.tsx` để cả hai file
 * ở dưới trần 400 dòng của R-22 mà không phải nhét component vào
 * `src/components/**` (chỗ đó bị cấm).
 *
 * View THUẦN (R-60): mọi chuỗi số tới nơi đã định dạng sẵn ở viewmodel
 * (`areaText`, `perimeterText`, `clearHeightText`) — không một phép làm tròn
 * hay đổi đơn vị nào ở đây (A15).
 *
 * ## Hai nhánh "không có dữ liệu" nói thật, không bịa
 *
 * - `clearHeightText === null`: đồ thị KHÔNG lưu chiều cao thông thuỷ riêng
 *   cho từng phòng, nên trường này hiện đúng một câu nói ra điều đó. Không
 *   hiện "0", không hiện "—" trống nghĩa.
 * - `crop === null`: không có gì để cắt (tên không tới từ OCR, hoặc tới từ
 *   OCR mà chưa có ảnh nguồn). Hiện một câu nói rõ vì sao, KHÔNG khung rỗng
 *   và KHÔNG một thẻ ảnh hỏng.
 *
 * ## Nhắc công năng KHÔNG BAO GIỜ chặn
 *
 * Khối nhắc dựng bằng danh sách thường, không phải `InlineAlert`
 * (`role="alert"`) và không phải một `error` của ô nhập: một dòng nhắc không
 * được đọc như lỗi và không khoá bất kỳ nút nào. Mỗi dòng mang một liên kết
 * sang màn luật không gian — đường dẫn đã ghép sẵn ở hook
 * (`RoomLabelNoticeViewModel.ruleRouteHref`, R-65).
 */

import type { CSSProperties } from 'react';

import { ConfidenceMeter } from '@/components/ui/ConfidenceMeter';
import { FieldRow } from '@/components/ui/FieldRow';

import type { RoomLabelCropViewModel, RoomLabelNoticeViewModel } from './roomLabelTypes';

const AREA_LABEL = 'diện tích';
/*
 * "chu vi" một mình là một chuỗi tiếng Việt KHÔNG có dấu nào, và
 * `expectVietnamese` bắt đúng ca đó (hai âm tiết hình dạng tiếng Việt, không
 * một dấu). Nhãn đầy đủ "chu vi phòng" vừa đúng nghĩa hơn vừa mang dấu.
 */
const PERIMETER_LABEL = 'chu vi phòng';
const CLEAR_HEIGHT_LABEL = 'chiều cao thông thuỷ';
const CLEAR_HEIGHT_MISSING =
  'Chưa có số đo chiều cao thông thuỷ cho phòng này.';
const CONFIDENCE_LABEL = 'độ tin cậy';
const CROP_TITLE = 'Ảnh cắt gốc';
const CROP_MISSING_OCR = 'Tên do máy đọc nhưng chưa có ảnh bản vẽ để cắt vùng ghi tên.';
const CROP_MISSING_HUMAN = 'Tên do người duyệt đặt nên không có ảnh cắt gốc để đối chiếu.';
const NOTICES_TITLE = 'Nhắc công năng';
const NOTICE_LINK_LABEL = 'Xem luật không gian';

/* -------------------------------------------------------------------------- */
/* Số đo.                                                                      */
/* -------------------------------------------------------------------------- */

export interface RoomLabelMeasureRowsProps {
  readonly areaText: string;
  readonly perimeterText: string;
  readonly clearHeightText: string | null;
  /** Chú giải cách tính diện tích, ví dụ "tính theo mép trong tường" — do hook sinh. */
  readonly areaCaption: string;
}

export function RoomLabelMeasureRows({
  areaText,
  perimeterText,
  clearHeightText,
  areaCaption,
}: RoomLabelMeasureRowsProps) {
  return (
    <div className="flex flex-col">
      <FieldRow label={AREA_LABEL}>
        <span className="flex flex-col justify-center">
          <span className="font-mono text-[14px] text-text-primary">{areaText}</span>
          <small className="text-[12px] text-text-secondary">{areaCaption}</small>
        </span>
      </FieldRow>
      <FieldRow label={PERIMETER_LABEL}>
        <span className="flex h-9 items-center font-mono text-[14px] text-text-primary">{perimeterText}</span>
      </FieldRow>
      <FieldRow isLast label={CLEAR_HEIGHT_LABEL}>
        {clearHeightText === null ? (
          <span className="flex items-center py-1 text-[13px] text-text-secondary">{CLEAR_HEIGHT_MISSING}</span>
        ) : (
          <span className="flex h-9 items-center font-mono text-[14px] text-text-primary">{clearHeightText}</span>
        )}
      </FieldRow>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Độ tin cậy + ảnh cắt gốc.                                                   */
/* -------------------------------------------------------------------------- */

export interface RoomLabelConfidenceBlockProps {
  readonly confidence: number;
  readonly confidenceLabel: string;
  readonly nameFromOcr: boolean;
  readonly crop: RoomLabelCropViewModel | null;
}

/**
 * Ảnh cắt vẽ ở TỶ LỆ GỐC rồi dịch đi bằng `background-position` âm đúng bằng
 * toạ độ khung cắt — một pixel bản vẽ là một pixel màn hình, thứ cần thiết để
 * đọc lại đúng chữ mà máy đã đọc. Không một phép tính hình học nào ở view:
 * `sourcePx` tới nơi đã là khung cắt, `displayWidthPx`/`displayHeightPx` tới
 * nơi đã là kích thước ô hiển thị (R-71). Cùng kỹ thuật `DimensionOcrRow.tsx`
 * đã chạy thật — chép cách bày, không nhập chéo giữa hai màn.
 */
export function RoomLabelConfidenceBlock({
  confidence,
  confidenceLabel,
  nameFromOcr,
  crop,
}: RoomLabelConfidenceBlockProps) {
  return (
    <section aria-label={CROP_TITLE} className="flex items-start gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-[13px] text-text-secondary">{CONFIDENCE_LABEL}</span>
        <ConfidenceMeter value={confidence} />
        <span className="text-[13px] text-text-primary">{confidenceLabel}</span>
      </div>

      {crop === null ? (
        <p className="w-[45%] shrink-0 text-[12px] text-text-secondary">
          {nameFromOcr ? CROP_MISSING_OCR : CROP_MISSING_HUMAN}
        </p>
      ) : (
        <div
          aria-label={crop.alt}
          className="shrink-0 overflow-hidden rounded-[8px] border border-border-default bg-bg-sunken"
          role="img"
          style={
            {
              width: `${crop.displayWidthPx}px`,
              height: `${crop.displayHeightPx}px`,
              backgroundImage: `url(${crop.imageUrl})`,
              backgroundPosition: `-${crop.sourcePx.x}px -${crop.sourcePx.y}px`,
              backgroundRepeat: 'no-repeat',
            } as CSSProperties
          }
        />
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Nhắc công năng.                                                             */
/* -------------------------------------------------------------------------- */

export interface RoomLabelNoticeListProps {
  readonly notices: readonly RoomLabelNoticeViewModel[];
}

export function RoomLabelNoticeList({ notices }: RoomLabelNoticeListProps) {
  if (notices.length === 0) {
    return null;
  }

  return (
    <section aria-label={NOTICES_TITLE} className="flex flex-col gap-2">
      <h4 className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">{NOTICES_TITLE}</h4>
      <ul className="flex flex-col gap-2">
        {notices.map((notice) => (
          <li className="flex flex-col gap-1 rounded-[8px] bg-bg-sunken px-2.5 py-2" key={notice.ruleCode}>
            <span className="font-mono text-[12px] text-text-secondary">{notice.ruleCode}</span>
            <p className="text-[13px] text-text-primary">{notice.message}</p>
            <p className="text-[13px] text-text-secondary">{notice.suggestion}</p>
            <a
              className="w-fit rounded-[4px] text-[13px] text-accent underline outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              href={notice.ruleRouteHref}
            >
              {NOTICE_LINK_LABEL}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
