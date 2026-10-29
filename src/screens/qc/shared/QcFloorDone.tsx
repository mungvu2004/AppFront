import { ArrowRight, Check } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { getButtonStyles } from '@/components/ui/buttonVariants';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import { useShortcut } from '@/hooks/useShortcut';
import { keyCapLabels } from '@/lib/input/shortcutRegistry';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/routes/paths';

import { floorDoneSummaryOf, reopenFloor, useFloorDone, useFloorLabel } from './floorDoneModel';
import { useNextFloor } from './useFloorReview';

/**
 * Các mảnh của màn Xong tầng (bố cục L23, `floorDoneModel.ts`): tổng kết trong cột việc, cổng
 * "Dựng mô hình 3D" ở đáy cột và thẻ "Tầng … đã duyệt" nổi góc trên phải bản vẽ.
 */
const SUMMARY_TITLE = 'Bạn đã duyệt những gì';
const BUILD_HINT = 'Mọi bước đã xong. Dựng mô hình 3D từ tầng này.';
const BUILD_LABEL = 'Dựng mô hình 3D';
const BUILD_COMBO = 'Mod+Enter';
const REOPEN_LABEL = 'Mở lại bước Phòng';
const CARD_LABEL = 'Tầng đã duyệt xong';

export function QcFloorDoneSummary({ graph, floorId }: { readonly graph: NormalizedSpatial; readonly floorId: string }) {
  const summary = useMemo(() => floorDoneSummaryOf(graph, floorId), [floorId, graph]);
  const rows = [
    ['Tường', summary.walls],
    ['Cửa và nội thất', summary.objects],
    ['Phòng', summary.rooms],
  ] as const;
  return (
    <section aria-label={SUMMARY_TITLE} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      <h2 className="text-body font-medium text-text-primary">{SUMMARY_TITLE}</h2>
      <dl className="mt-2 flex flex-col gap-2.5 text-body-sm">
        {rows.map(([title, text]) => (
          <div key={title}>
            <dt className="font-medium text-text-primary">{title}</dt>
            <dd className="text-text-secondary [text-wrap:pretty]">{text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function QcFloorDoneGate({ projectId }: { readonly projectId: string }) {
  const navigate = useNavigate();
  const viewer = ROUTES.project.viewer(projectId);
  useShortcut({ id: 'qc.floorDone.build', combo: BUILD_COMBO, description: BUILD_LABEL, scope: 'global', onTrigger: () => navigate(viewer) });
  return (
    <div className="flex flex-col gap-2">
      <p className="text-body-sm text-text-secondary">{BUILD_HINT}</p>
      <Link className={cn(getButtonStyles({ variant: 'primary', size: 'md' }), 'w-full justify-between gap-2')} to={viewer}>
        {BUILD_LABEL}
        <kbd className="font-mono text-[13px]">{keyCapLabels(BUILD_COMBO).join(' ')}</kbd>
      </Link>
    </div>
  );
}

/** Thẻ nổi trên bản vẽ của bước Phòng khi tầng xong; tự ẩn khi chưa xong hoặc đã mở lại. */
export function QcFloorDoneCard({ projectId, floorId }: { readonly projectId: string; readonly floorId: string }) {
  const { done, graph } = useFloorDone(projectId, floorId);
  const label = useFloorLabel(projectId, floorId);
  const nextFloor = useNextFloor(projectId, floorId);
  if (!done || graph === null) return null;
  const area = floorDoneSummaryOf(graph, floorId).area;
  const linkClass = 'inline-flex items-center gap-1 text-body-sm font-medium text-accent hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-accent';

  return (
    <section aria-label={CARD_LABEL} className="absolute right-3 top-3 z-20 flex w-[300px] flex-col gap-1 rounded-xl border border-border-default bg-bg-surface p-5 shadow-overlay">
      <span aria-hidden="true" className="mb-2 grid h-9 w-9 place-items-center rounded-full bg-state-verified-tint text-state-verified-text">
        <Check className="h-4 w-4" strokeWidth={3} />
      </span>
      <h2 className="text-[18px] font-medium text-text-primary">{`Tầng ${label} đã duyệt`}</h2>
      <p className="text-body-sm text-text-secondary">{`Máy và bạn đã kiểm xong cả 4 bước. Sàn ≈ ${area}.`}</p>
      <div className="mt-2 flex flex-col items-start gap-1.5">
        {nextFloor === null ? null : (
          <Link className={linkClass} to={ROUTES.project.walls(projectId, nextFloor.id)}>
            {`Tầng kế còn việc: ${nextFloor.label}`}
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        )}
        <button className={linkClass} onClick={() => reopenFloor(floorId)} type="button">
          {REOPEN_LABEL}
        </button>
      </div>
    </section>
  );
}
