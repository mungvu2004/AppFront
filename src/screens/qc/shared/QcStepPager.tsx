import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { getButtonStyles } from '@/components/ui/buttonVariants';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/routes/paths';

import { QC_LAYERS, type QcLayerKey } from './qcLayers';
import { useFloorReview } from './useFloorReview';
import { useFloorNextTarget } from './useFloorNextTarget';

const PREV_LABEL = 'Bước trước';
const NEXT_LABEL = 'Bước tiếp';
const PIPELINE_NAME = 'Xử lý';
const STEPS = QC_LAYERS.filter((layer) => layer.group === 'step');

export interface QcStepPagerProps {
  readonly projectId: string;
  readonly floorId: string;
  readonly activeStep: QcLayerKey;
  /** Bước đang làm đã đủ điều kiện: "Bước tiếp" thành nút chính. */
  readonly stepDone: boolean;
  /** Bước còn việc: câu "Còn 22 đoạn chưa duyệt." */
  readonly remaining: string | null;
  /** Màn đã có nút chính khác (Xong tầng): cặp nút này luôn là nút phụ. */
  readonly quiet?: boolean;
  /** Bản nổi trên bản vẽ dưới 1024 (cột việc là ngăn kéo đóng): chỉ hai nút, câu nhắc ở `title`. */
  readonly compact?: boolean;
}

/**
 * Cặp nút đổi bước, cùng một chỗ ở cả bốn bước. Đích của "Bước tiếp" là đúng đích của cổng (`useFloorNextTarget`), không
 * thêm luật: chưa xong vẫn sang được (trừ khi thiếu tỷ lệ) và câu trên nút nói còn gì. Thiếu tỷ lệ ở màn Tỷ lệ: nút không
 * chết, bấm đưa tiêu điểm tới ô nhập đầu tiên của bước, câu trên nút nói cần gì. Bước đầu: "Bước trước" về bước Xử lý của dự án.
 */
export function QcStepPager({ projectId, floorId, activeStep, stepDone, remaining, quiet = false, compact = false }: QcStepPagerProps) {
  const here = STEPS.findIndex((step) => step.key === activeStep);
  const previous = STEPS[here - 1];
  const { scale } = useFloorReview(projectId, floorId);
  const pathname = (STEPS[here] ?? STEPS[0]!).route(projectId, floorId);
  const target = useFloorNextTarget(projectId, floorId, pathname);
  const previousName = previous?.label ?? PIPELINE_NAME;
  /* Tầng thiếu tỷ lệ: bước trước của Cửa/Phòng cũng khoá, nên về thẳng bước Tỷ lệ. */
  const previousTo =
    previous === undefined ? ROUTES.project.pipeline(projectId) : scale === 'missing' ? ROUTES.project.scale(projectId, floorId) : previous.route(projectId, floorId);
  const isPrimary = stepDone && !quiet && target.kind === 'go' && target.reason === null;
  const pagerClass = (variant: 'primary' | 'secondary') =>
    cn(getButtonStyles({ variant, size: 'sm' }), compact ? 'shrink-0 shadow-float' : 'min-w-0 flex-1 !px-2', 'gap-1.5 whitespace-nowrap');
  const pending = target.kind === 'go' ? target.pending : null;
  const line = target.reason ?? pending ?? [remaining, `Bước sau: ${target.name}.`].filter(Boolean).join(' ');
  const nextName = `${NEXT_LABEL}: ${target.name}`;
  const nextContent = (
    <>
      {NEXT_LABEL}
      <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
    </>
  );

  return (
    <div className="flex flex-col gap-1.5" data-testid={compact ? 'qc-step-pager-compact' : 'qc-step-pager'}>
      {compact ? null : (
        <p className={cn('text-caption', target.reason === null ? 'text-text-secondary' : 'text-state-violation-text')} role="status">
          {line}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Link aria-label={`${PREV_LABEL}: ${previousName}`} className={pagerClass('secondary')} title={`${PREV_LABEL}: ${previousName}`} to={previousTo}>
          <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
          {PREV_LABEL}
        </Link>
        {target.kind === 'blocked' ? (
          <button
            aria-label={nextName}
            className={pagerClass('secondary')}
            onClick={() => document.querySelector<HTMLElement>('[aria-current="step"] input:not([disabled])')?.focus()}
            title={target.reason}
            type="button"
          >
            {nextContent}
          </button>
        ) : (
          <Link aria-label={nextName} className={pagerClass(isPrimary ? 'primary' : 'secondary')} title={line} to={target.to}>
            {nextContent}
          </Link>
        )}
      </div>
    </div>
  );
}
