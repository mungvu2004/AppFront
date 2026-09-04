/**
 * Panel thanh tra bên phải, rộng 344.
 *
 * View thuần (R-60). Khi chưa chọn gì thì hiện đúng câu dạy đặc tả yêu cầu —
 * không phải một panel trắng, vì màn trắng là thất bại duy nhất A11 tồn tại để
 * chặn.
 *
 * ## S-11: hàng tương ứng cuộn vào tầm nhìn
 *
 * `scrollToEntityId` đổi là dấu hiệu "3D vừa chọn một đối tượng"; hiệu ứng ở
 * đây cuộn hàng ấy vào tầm nhìn. Chiều ngược lại — bấm ở panel thì mô hình
 * sáng lên — đi qua `onSelectRow`, do vỏ nối vào kho chọn dùng chung.
 */

import { useEffect, useRef } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { cn } from '@/lib/utils';

import type { ViewerScreenState, ViewerSelectionViewModel } from './viewerShellTypes';

export interface ViewerInspectorProps {
  readonly state: ViewerScreenState;
  readonly selection: ViewerSelectionViewModel | null;
  readonly inspectorHint: string;
  readonly scrollToEntityId: string | null;
  readonly errorMessage: string | null;
  readonly onRetry: () => void;
}

export function ViewerInspector({
  state,
  selection,
  inspectorHint,
  scrollToEntityId,
  errorMessage,
  onRetry,
}: ViewerInspectorProps) {
  const rowsRef = useRef<HTMLDListElement | null>(null);

  useEffect(() => {
    if (scrollToEntityId === null) {
      return;
    }

    rowsRef.current?.scrollIntoView({ block: 'nearest' });
  }, [scrollToEntityId]);

  return (
    <aside
      aria-label="Thanh tra đối tượng"
      className={cn(
        'flex w-[344px] shrink-0 flex-col overflow-hidden rounded-[12px]',
        'bg-bg-surface shadow-panel',
      )}
    >
      <h2 className="flex h-14 shrink-0 items-center px-5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
        Thuộc tính
      </h2>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        {errorMessage !== null && (
          <InlineAlert
            action={{ label: 'Thử lại', onClick: onRetry }}
            className="mb-4"
            level="violation"
            message={errorMessage}
            title="Không đọc được dữ liệu"
          />
        )}

        {state === 'loading' && (
          <div className="flex flex-col gap-3">
            <Skeleton preset="property-panel" />
          </div>
        )}

        {state === 'forbidden' && (
          <InlineAlert
            className="mb-4"
            level="attention"
            message="Bạn đang xem ở vai Người xem nên không sửa được mô hình."
            title="Chỉ xem"
          />
        )}

        {state !== 'loading' && selection === null && (
          <EmptyState
            description={inspectorHint}
            icon={
              <div
                aria-hidden="true"
                className="h-8 w-8 rounded-[8px] border border-border-default"
              />
            }
            title="Chưa chọn đối tượng"
          />
        )}

        {selection !== null && (
          <section aria-label={selection.title}>
            <h3 className="mb-3 text-[15px] font-medium text-text-primary">{selection.title}</h3>
            <dl className="flex flex-col gap-2" ref={rowsRef}>
              {selection.rows.map((row) => (
                <div className="flex items-baseline justify-between gap-4" key={row.id}>
                  <dt className="text-[13px] text-text-secondary">{row.label}</dt>
                  <dd className="text-[13px] tabular-nums text-text-primary">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </aside>
  );
}
