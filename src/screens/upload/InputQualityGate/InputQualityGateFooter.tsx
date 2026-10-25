/**
 * Chân khung kết quả của Cổng chất lượng đầu vào — nút chính, câu đồng ý, nút phụ.
 *
 * ## Ảnh kém là cảnh báo, không chặn (chủ dự án duyệt, demo Z/S-09)
 *
 * Không còn ô tích bắt buộc: ô chưa tích biến nút chính thành nút chết. Thay vào
 * đó nút chính nói thẳng "Xử lý dù ảnh mờ" và câu đồng ý nằm ngay dưới nút
 * (`summary.consent`), nối vào nút bằng `aria-describedby` — bấm là đồng ý.
 * Nhãn và câu đến từ `summarizeQualityGate`, cùng nguồn với chip đầu màn.
 *
 * Ngoại lệ duy nhất: `footer.continueDisabledReason` (đang đọc, lỗi đọc, chưa có
 * bản vẽ) chặn hẳn lượt bấm — không có gì để đi tiếp. Chặn bằng `aria-disabled`
 * cộng bỏ `onClick`, KHÔNG bằng `disabled`: nút `disabled` rơi khỏi thứ tự Tab,
 * nên người dùng bàn phím không nghe được câu lý do.
 *
 * ## `areActionsHidden` ẩn hẳn, không mờ đi
 *
 * Không quyền (`'forbidden'`) hoặc lỗi đọc: hai nút biến mất khỏi cây DOM — dải
 * lỗi đã mang lối ra của nó (BUG-074).
 */

import { ArrowRight, TriangleAlert, Upload } from 'lucide-react';

import { Button } from '@/components/ui/Button';

import type { InputQualityFooterProps } from './types';

const CONTINUE_NOTE_ID = 'input-quality-gate-continue-note';

export function InputQualityGateFooter({ actions, footer, summary }: InputQualityFooterProps) {
  if (footer.areActionsHidden) {
    return null;
  }

  const disabledReason = footer.continueDisabledReason ?? null;
  const isDisabled = disabledReason !== null;
  const note = disabledReason ?? summary.consent;
  const warns = summary.consent !== null;

  return (
    // Đứng ở đầu trang (PageHead `next`). Ảnh kém (có câu đồng ý): nút chính là "Tải ảnh nét hơn",
    // "Vẫn xử lý" là nút phụ; ảnh đạt: nút chính là "Bắt đầu xử lý".
    <footer aria-label="Hành động tiếp theo" className="flex flex-wrap items-start justify-end gap-2">
      <div className="flex max-w-[260px] flex-col items-end gap-1.5">
        <Button
          {...(note !== null ? { 'aria-describedby': CONTINUE_NOTE_ID } : {})}
          {...(isDisabled ? { 'aria-disabled': true } : {})}
          iconAfter={<ArrowRight aria-hidden="true" />}
          onClick={isDisabled ? undefined : actions.onContinue}
          variant={warns ? 'secondary' : 'primary'}
        >
          {summary.primaryLabel}
        </Button>
        {note !== null && (
          <p className="flex items-start gap-1.5 text-[13px] text-text-secondary" id={CONTINUE_NOTE_ID}>
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-state-attention-text" />
            <span>{note}</span>
          </p>
        )}
      </div>
      <Button
        iconBefore={<Upload aria-hidden="true" />}
        onClick={actions.onUploadAnother}
        variant={warns ? 'primary' : 'secondary'}
      >
        {summary.secondaryLabel}
      </Button>
    </footer>
  );
}
