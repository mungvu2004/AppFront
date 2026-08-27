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

import type { FloorUploadBlockNotice, FloorUploadFooterModel } from './types';

/** Mã cho test bám vào danh sách lý do. */
export const BLOCK_NOTICE_TEST_ID = 'floor-upload-block-notice';

export interface FloorUploadFooterProps {
  readonly footer: FloorUploadFooterModel;
  readonly blockNotice: FloorUploadBlockNotice | null;
  readonly onSubmit: () => void;
}

export function FloorUploadFooter({ footer, blockNotice, onSubmit }: FloorUploadFooterProps) {
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
        <p className="text-[14px] text-text-secondary" role="status">
          {footer.counterLabel}
        </p>

        <Button loading={footer.isSubmitting} onClick={onSubmit} type="button" variant="primary">
          {footer.submitLabel}
        </Button>
      </div>
    </div>
  );
}
