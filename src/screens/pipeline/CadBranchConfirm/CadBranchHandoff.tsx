/**
 * Khối bàn giao nhánh AI và trang giải thích khi tầng không có CAD
 * (tách khỏi `CadBranchConfirm.tsx` cho trần 400 dòng).
 */

import { useEffect, useRef } from 'react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Button } from '@/components/ui/Button';

import { AI_BRANCH_NOTICE, CAD_BRANCH_CONFIRM_TEXT } from './cadBranchConfirmText';
import type { CadBranchConfirmActions } from './types';

const PHASE_1_TEXT = CAD_BRANCH_CONFIRM_TEXT.phase1;

const AI_HANDOFF_TITLE = 'Chuyển sang nhánh nhận dạng ảnh';
const BACK_TO_LAYER_REVIEW_LABEL = 'Về duyệt lớp';

/* -------------------------------------------------------------------------- */
/* Khối bàn giao nhánh AI — hoà tan 340 ms.                                     */
/* -------------------------------------------------------------------------- */

interface CadBranchHandoffProps {
  readonly isCadChoiceDisabled: boolean;
  readonly onChooseBranch: CadBranchConfirmActions['onChooseBranch'];
}

/**
 * Chỗ hộp thoại vừa đóng.
 *
 * Caption mức "cần chú ý" nói trước điều nhánh AI đòi: sẽ phải hiệu chỉnh tỷ lệ.
 * Hai nút là đúng hai lựa chọn chính của đặc tả; nút AI KHÔNG bao giờ bị khoá.
 */
export function CadBranchHandoff({ isCadChoiceDisabled, onChooseBranch }: CadBranchHandoffProps) {
  const sectionRef = useRef<HTMLElement>(null);

  // Khối này chỉ dựng khi hộp thoại vừa đóng. Hộp thoại mở lúc vào màn thường không có nút mở, nên
  // bẫy trả tiêu điểm về `body`: khi đó khối nhận tiêu điểm vào nút đầu tiên bấm được (BUG-559). Có
  // nút mở thật thì để tiêu điểm ở đó (A12). Effect gắn chạy sau effect dọn của `Modal`.
  useEffect(() => {
    if (document.activeElement === null || document.activeElement === document.body) {
      sectionRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    }
  }, []);

  return (
    <section className="animate-panel-rise px-4 pb-2 motion-reduce:animate-none" ref={sectionRef}>
      <InlineAlert level="attention" message={AI_BRANCH_NOTICE} title={AI_HANDOFF_TITLE} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          disabled={isCadChoiceDisabled}
          onClick={() => onChooseBranch('cad')}
          size="sm"
          variant="secondary"
        >
          {PHASE_1_TEXT.buttons.primary}
        </Button>
        <Button onClick={() => onChooseBranch('ai')} size="sm" variant="ghost">
          {PHASE_1_TEXT.buttons.secondary}
        </Button>
      </div>
    </section>
  );
}

/**
 * Tầng chỉ có ảnh: không bật hộp thoại, trang đã tự nói "Chưa có tệp CAD" ở tiêu đề.
 * Một câu hệ quả của nhánh AI, một lối về duyệt lớp, một nút đi tiếp bằng AI — không
 * lặp lại cảnh báo (trước đây 3 khối nói cùng một ý).
 */
export function NoCadFileActions({
  onBackToLayerReview,
  onChooseBranch,
}: {
  readonly onBackToLayerReview: (() => void) | undefined;
  readonly onChooseBranch: CadBranchConfirmActions['onChooseBranch'];
}) {
  return (
    <section className="flex flex-col gap-3 px-4 pb-2">
      <p className="text-[13px] text-text-secondary">{AI_BRANCH_NOTICE}</p>
      <div className="flex flex-wrap items-center gap-2">
        {onBackToLayerReview !== undefined && (
          <Button onClick={onBackToLayerReview} size="sm" variant="primary">
            {BACK_TO_LAYER_REVIEW_LABEL}
          </Button>
        )}
        <Button onClick={() => onChooseBranch('ai')} size="sm" variant="secondary">
          {PHASE_1_TEXT.buttons.secondary}
        </Button>
      </div>
    </section>
  );
}
