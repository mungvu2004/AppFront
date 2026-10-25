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
const BACK_TO_LAYER_REVIEW_LABEL = 'Về duyệt lớp';

const NO_CAD_REGION_LABEL = 'Hai lối đi tiếp khi tầng chưa có tệp CAD';
const CAD_ROUTE_EYEBROW = 'Lối 1 · Chính xác hơn';
const CAD_ROUTE_TITLE = 'Tải tệp CAD của tầng này';
const CAD_ROUTE_BODY =
  'Đường hình học lấy thẳng từ tệp, sai số bằng sai số người vẽ, chỉ cần gán lớp. Tải tệp .dwg của tầng ở bước Tải bản vẽ rồi quay lại đây.';
const AI_ROUTE_EYEBROW = 'Lối 2 · Không cần tệp mới';
const AI_ROUTE_TITLE = 'Vẫn dùng nhánh AI cho tầng này';
const AI_ROUTE_BODY = 'AI đọc ảnh bản vẽ qua sáu bước rồi bạn duyệt từng tường. Lâu hơn và soát kỹ hơn.';

const ROUTE_EYEBROW_CLASS = 'text-caption font-medium uppercase tracking-[0.06em] text-text-muted';

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
 * Tầng chỉ có ảnh: không bật hộp thoại, chip "Chưa có tệp CAD" của PageHead đã nói trạng thái.
 * MỘT khung, hai lối ra cạnh nhau (Z/S-13 empty): Lối 1 tải CAD, Lối 2 vẫn dùng AI — nút
 * chính duy nhất của trang. Danh sách tầng có/không có CAD chỉ hiện khi cổng trả về.
 */
export function NoCadFileActions({
  floors,
  onBackToLayerReview,
  onChooseBranch,
}: {
  readonly floors: readonly CadFloorAvailability[];
  readonly onBackToLayerReview: (() => void) | undefined;
  readonly onChooseBranch: CadBranchConfirmActions['onChooseBranch'];
}) {
  return (
    <Section aria-label={NO_CAD_REGION_LABEL} flush>
      <div className="grid md:grid-cols-2">
        <div className="flex flex-col items-start gap-3 p-6">
          <p className={ROUTE_EYEBROW_CLASS}>{CAD_ROUTE_EYEBROW}</p>
          <h2 className="text-heading text-text-primary">{CAD_ROUTE_TITLE}</h2>
          <p className="text-body text-text-secondary">{CAD_ROUTE_BODY}</p>
          {onBackToLayerReview !== undefined && (
            <Button onClick={onBackToLayerReview} size="sm" variant="ghost">
              {BACK_TO_LAYER_REVIEW_LABEL}
            </Button>
          )}
        </div>

        <div className="flex flex-col items-start gap-3 border-t border-border-default p-6 md:border-l md:border-t-0">
          <p className={ROUTE_EYEBROW_CLASS}>{AI_ROUTE_EYEBROW}</p>
          <h2 className="text-heading text-text-primary">{AI_ROUTE_TITLE}</h2>
          <p className="text-body text-text-secondary">{AI_ROUTE_BODY}</p>
          <p className="flex items-center gap-2 text-body text-state-attention-text">
            <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
            {AI_BRANCH_NOTICE}
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
      </div>
    </Section>
  );
}
