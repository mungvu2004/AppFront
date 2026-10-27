/**
 * K19 — câu hỏi "tầng hay căn riêng" và danh sách dự án vừa tạo. Chỉ vẽ; chữ và trạng
 * thái đến sẵn từ `useApartmentSplit.ts`.
 */

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

import type { FloorUploadActions, FloorUploadApartmentsModel, FloorUploadSplitPromptModel } from './types';

export interface FloorUploadSplitPanelProps {
  readonly splitPrompt: FloorUploadSplitPromptModel | null | undefined;
  readonly apartments: FloorUploadApartmentsModel | null | undefined;
  readonly actions: Pick<
    FloorUploadActions,
    'onSplitAsFloors' | 'onSplitAsApartments' | 'onOpenApartment' | 'onDismissApartments'
  >;
}

export function FloorUploadSplitPanel({ actions, apartments, splitPrompt }: FloorUploadSplitPanelProps) {
  return (
    <>
      {splitPrompt != null && (
        <section
          aria-labelledby="floor-upload-split-question"
          className="flex flex-col gap-3 rounded-lg border border-border-default bg-bg-sunken p-4"
          data-testid="floor-upload-split-prompt"
        >
          <h3 className="text-heading text-text-primary" id="floor-upload-split-question">
            {splitPrompt.question}
          </h3>
          <p className="text-body-sm text-text-secondary">{splitPrompt.detail}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={actions.onSplitAsFloors} type="button" variant="primary">
              {splitPrompt.floorsLabel}
            </Button>
            <Button onClick={actions.onSplitAsApartments} type="button" variant="secondary">
              {splitPrompt.apartmentsLabel}
            </Button>
          </div>
        </section>
      )}

      {apartments != null && (
        <section
          aria-labelledby="floor-upload-apartments-title"
          className="flex flex-col gap-3 rounded-lg border border-border-default p-4"
          data-testid="floor-upload-apartments"
        >
          <header className="flex flex-wrap items-baseline gap-2">
            <h3 className="text-heading text-text-primary" id="floor-upload-apartments-title">
              {apartments.title}
            </h3>
            <span className="text-body-sm text-text-secondary" role="status">
              {apartments.summary}
            </span>
            {actions.onDismissApartments !== undefined && (
              <Button className="ml-auto" onClick={actions.onDismissApartments} size="sm" type="button" variant="ghost">
                {apartments.dismissLabel}
              </Button>
            )}
          </header>
          <ul className="flex flex-col divide-y divide-border-default">
            {apartments.rows.map((row) => (
              <li className="flex flex-wrap items-center gap-3 py-2" key={row.id}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body text-text-primary">{row.projectName}</p>
                  <p className="truncate text-body-sm text-text-secondary">{row.problem ?? row.fileName}</p>
                  {row.note != null && <p className="text-body-sm text-text-secondary">{row.note}</p>}
                </div>
                <Badge variant={row.statusVariant}>{row.statusLabel}</Badge>
                {row.canOpen && actions.onOpenApartment !== undefined && (
                  <Button
                    aria-label={`${apartments.openLabel} ${row.projectName}`}
                    onClick={() => actions.onOpenApartment?.(row.id)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    {apartments.openLabel}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
