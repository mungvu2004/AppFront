/**
 * Cột phải: chi tiết bản đang chọn (N27). Dưới 1024 nó nằm trong `Drawer` — nơi ráp quyết
 * định chỗ đặt, file này chỉ vẽ nội dung.
 */

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

import type { VersionDetailModel } from './types';

const PLACEHOLDER = 'Chọn một phiên bản để xem chi tiết.';

export function ModelRegistryDetail({ detail }: { readonly detail: VersionDetailModel | null }) {
  if (detail === null) {
    return <p className="text-[13px] text-text-secondary">{PLACEHOLDER}</p>;
  }

  if (detail.errorMessage !== null && detail.fields.length === 0) {
    return <InlineAlert level="violation" message={detail.errorMessage} />;
  }

  if (detail.fields.length === 0) {
    return <Skeleton preset="property-panel" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 flex-1 break-words text-base font-semibold text-text-primary">{detail.title}</h2>
        {detail.evaluationLabel !== null && <Badge variant={detail.evaluationVariant}>{detail.evaluationLabel}</Badge>}
      </div>
      {detail.failureNote !== null && <InlineAlert level="violation" message={detail.failureNote} />}
      <dl className="flex flex-col gap-3 text-[13px]">
        {detail.fields.map((field) => (
          <div className="flex flex-col gap-1" key={field.label}>
            <dt className="text-text-secondary">{field.label}</dt>
            <dd className={cn('text-text-primary', field.isCode && 'break-all font-mono')}>
              {field.isCode ? <code>{field.value}</code> : field.value}
            </dd>
          </div>
        ))}
      </dl>
      {detail.seedNote !== null && <p className="text-[12px] text-text-secondary">{detail.seedNote}</p>}
    </div>
  );
}
