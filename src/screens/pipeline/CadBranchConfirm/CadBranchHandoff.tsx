/**
 * Khối bàn giao nhánh AI và trang giải thích khi tầng không có CAD
 * (tách khỏi `CadBranchConfirm.tsx` cho trần 400 dòng).
 */

import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Section } from '@/components/shell/Section';
import { Button } from '@/components/ui/Button';

import { AI_BRANCH_NOTICE, CAD_BRANCH_CONFIRM_TEXT } from './cadBranchConfirmText';
import { CadFloorAvailabilityTable } from './CadFloorAvailability';
import type { CadBranchConfirmActions, CadFloorAvailability } from './types';

const PHASE_1_TEXT = CAD_BRANCH_CONFIRM_TEXT.phase1;

const AI_HANDOFF_TITLE = 'Chuyển sang nhánh nhận dạng ảnh';

const NO_CAD_REGION_LABEL = 'Tầng chưa có tệp CAD';
const NO_CAD_NOTICE =
  'Chưa hỗ trợ tệp CAD (.dwg). Hãy xuất bản vẽ sang PDF rồi tải lại ở bước Tải bản vẽ.';

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
 * Tầng chỉ có ảnh: app chưa nhận tệp CAD (.dwg), nên không mời tải CAD. MỘT thông báo ngắn và
 * MỘT nút chính; danh sách tầng có/không có CAD chỉ hiện khi cổng trả về.
 */
export function NoCadFileActions({
  floors,
  onChooseBranch,
}: {
  readonly floors: readonly CadFloorAvailability[];
  readonly onChooseBranch: CadBranchConfirmActions['onChooseBranch'];
}) {
  return (
    <Section aria-label={NO_CAD_REGION_LABEL} flush>
      <div className="flex flex-col items-start gap-3 p-6">
        <p className="flex items-center gap-2 text-body text-state-attention-text">
          <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
          {NO_CAD_NOTICE}
        </p>
        <Button onClick={() => onChooseBranch('ai')} variant="primary">
          {PHASE_1_TEXT.buttons.secondary}
        </Button>
        {floors.length > 0 && (
          <div className="mt-3 w-full">
            <CadFloorAvailabilityTable floors={floors} />
          </div>
        )}
      </div>
    </Section>
  );
}
