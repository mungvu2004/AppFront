/**
 * Chân trang dính đáy: bộ đếm bên trái, nút chính bên phải.
 *
 * ## Nút chính không bao giờ bị vô hiệu hoá âm thầm
 *
 * `footer.canSubmit === false` **không** làm nút xám đi. Nút bấm được ở mọi lúc;
 * bấm lúc còn thiếu thì `blockNotice` hiện ra và nêu đúng tầng nào thiếu gì. Một
 * nút xám không giải thích gì là lỗi mà điều cấm "không vô hiệu nút chính mà
 * không nêu lý do" sinh ra để chặn, và cũng là lý do `disabled` không xuất hiện
 * ở file này.
 *
 * `isSubmitting` là chuyện khác: lúc lượt xử lý đã bắt đầu, nút bấm nữa cũng
 * không thêm nghĩa, nên nó chuyển sang trạng thái chờ của chính `Button`.
 */

import { Button } from '@/components/ui/Button';
import { useCountUp, type UseCountUpOptions } from '@/hooks/useCountUp';

import type { FloorUploadBlockNotice, FloorUploadFooterModel } from './types';

/** Mã cho test bám vào danh sách lý do. */
export const BLOCK_NOTICE_TEST_ID = 'floor-upload-block-notice';

/** Mã cho test bám vào con số đang chạy. */
export const COUNTER_NUMBER_TEST_ID = 'floor-upload-counter-number';

/**
 * Một tầng là một tầng: không phần lẻ, không dấu chấm nhóm nghìn.
 *
 * Cùng bộ tuỳ chọn mà `useFloorUploadScreen` dựng `counterLabel`, nên khung
 * cuối của lượt chạy trùng từng ký tự với chuỗi trình đọc màn hình đọc lên.
 * `fractionDigits: 0` là phần bắt buộc: để trống thì mặc định của
 * `formatNumber` là ba số lẻ và khung giữa chừng đọc thành `1,734`.
 */
const COUNTER_FORMAT: UseCountUpOptions = Object.freeze({
  format: { fractionDigits: 0, grouping: false },
});

/** Chỗ cắt `"3 / 4 tầng đã có bản vẽ"` thành con số chạy và phần đứng yên. */
const COUNTER_SEPARATOR = ' / ';

export interface FloorUploadFooterProps {
  readonly footer: FloorUploadFooterModel;
  readonly blockNotice: FloorUploadBlockNotice | null;
  readonly onSubmit: () => void;
}

export function FloorUploadFooter({ footer, blockNotice, onSubmit }: FloorUploadFooterProps) {
  // Chỉ vế `đã xong` chạy số. Phần đuôi — dấu gạch, tổng số tầng, và chữ — cắt
  // ra từ chính `counterLabel` mà hook đã dựng, nên không có bản thứ hai của
  // con số hay của câu chữ ở tầng giao diện: `formatNumber` vẫn là nơi duy nhất
  // viết ra tổng (A15), và `.notes/copy.md` vẫn là nơi duy nhất giữ câu.
  //
  // Tổng cố tình KHÔNG chạy số. Một lượt chạy thứ hai vẽ lại chân trang mỗi
  // khung hình suốt lúc tải tệp, và trần "≤ 4 lần cập nhật mỗi giây" của tiêu
  // chí b đo đúng số lần vẽ ấy.
  //
  // Bộ đếm chạy khi ĐỔI, không chạy lúc HIỆN RA. Trong lượt đọc danh sách tầng
  // thì `totalCount` còn là 0 và chưa có bộ đếm nào để chạy; lúc dữ liệu về,
  // `Number.NaN` đã xoá giá trị đang hiện nên hook lấy `from` của lời gọi và
  // con số đầu tiên hiện thẳng — đúng ghi chú của chính hook: "sau một giá trị
  // trống, đích kế tiếp chỉ đơn giản là được hiện ra". Mỗi lần đổi sau đó mới
  // chạy, từ con số người đọc đang nhìn.
  const hasCounter = footer.totalCount > 0;
  const done = useCountUp(hasCounter ? footer.doneCount : Number.NaN, {
    ...COUNTER_FORMAT,
    from: footer.doneCount,
  });
  const counterTail = footer.counterLabel.slice(footer.counterLabel.indexOf(COUNTER_SEPARATOR));

  return (
    <div className="sticky bottom-0 z-20 flex flex-col gap-3 rounded-[12px] border border-border-default bg-bg-surface p-5">
      {blockNotice !== null && (
        <div
          className="flex flex-col gap-1 rounded-[8px] bg-state-attention-tint p-3"
          data-testid={BLOCK_NOTICE_TEST_ID}
          role="alert"
        >
          <p className="text-[13px] font-medium text-state-attention-text">{blockNotice.title}</p>
          <ul className="flex flex-col gap-1">
            {blockNotice.reasons.map((reason) => (
              <li className="text-[13px] text-text-secondary" key={`${reason.floorId}-${reason.kind}`}>
                {reason.sentence}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/*
          Con số chạy nằm ngoài vùng sống, và vùng sống nằm ngoài lượt chạy.
          Trình đọc màn hình nghe `counterLabel` — giá trị CUỐI, đọc đúng một
          lần — chứ không nghe từng khung hình của lượt đếm. Chữ vẫn là chữ của
          `.notes/copy.md`, chỉ tách ra để riêng con số động được.
        */}
        <p className="text-[14px] text-text-secondary">
          <span aria-hidden="true" data-testid={COUNTER_NUMBER_TEST_ID}>
            {hasCounter ? (
              <>
                {done.text}
                {counterTail}
              </>
            ) : (
              footer.counterLabel
            )}
          </span>
          <span className="sr-only" role="status">
            {footer.counterLabel}
          </span>
        </p>

        <Button loading={footer.isSubmitting} onClick={onSubmit} type="button" variant="primary">
          {footer.submitLabel}
        </Button>
      </div>
    </div>
  );
}
