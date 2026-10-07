/**
 * Vùng bảng của tab "Lượt huấn luyện": lỗi, rỗng, dải "một phần", bảng dòng 40 (dưới 1024 là
 * một cột thẻ), "Xem thêm". Hàng mở chi tiết bằng nút trên họ (Enter/Space là của nút).
 */

import { History } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { cn } from '@/lib/utils';

import type { JobRowModel, TrainingJobsActions, TrainingJobsProps } from './types';

const TEXT = {
  retry: 'Thử lại',
  errorTitle: 'Không đọc được dữ liệu huấn luyện',
  emptyTitle: 'Chưa có lượt huấn luyện',
  loadMore: 'Xem thêm',
} as const;

const HEADERS = ['Họ', 'Model nền', 'Phiên bản bộ dữ liệu', 'Vòng', 'Trạng thái', 'Bắt đầu', 'Kết thúc'] as const;
const PANEL = 'rounded-[12px] border border-border-default bg-bg-surface p-5';
const FOCUS_RING =
  'rounded outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface';

function OpenButton({ actions, row }: { readonly actions: TrainingJobsActions; readonly row: JobRowModel }) {
  return (
    <button
      aria-pressed={row.isSelected}
      className={cn('truncate text-left font-medium text-text-primary', FOCUS_RING)}
      onClick={() => actions.onSelectJob(row.id)}
      type="button"
    >
      {row.familyLabel}
    </button>
  );
}

function Cards({ actions, rows }: { readonly actions: TrainingJobsActions; readonly rows: readonly JobRowModel[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li
          className={cn('flex flex-col gap-3 rounded-[8px] border border-border-default p-3', row.isSelected && 'bg-bg-selected')}
          key={row.id}
        >
          <div className="flex items-center justify-between gap-3">
            <OpenButton actions={actions} row={row} />
            <Badge variant={row.statusVariant}>{row.statusLabel}</Badge>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
            {[
              [HEADERS[1], row.baseModelLabel],
              [HEADERS[3], row.epochLabel],
              [HEADERS[5], row.startedLabel],
              [HEADERS[6], row.endedLabel],
            ].map(([term, value]) => (
              <div className="flex justify-between gap-2" key={term}>
                <dt className="text-text-secondary">{term}</dt>
                <dd className="tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}

function Rows({ actions, rows }: { readonly actions: TrainingJobsActions; readonly rows: readonly JobRowModel[] }) {
  return (
    <Table.Root>
      <Table.Header>
        <Table.Row>
          {HEADERS.map((header) => (
            <Table.Head key={header}>{header}</Table.Head>
          ))}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((row) => (
          <Table.Row className="h-10" key={row.id} selected={row.isSelected}>
            <Table.Cell>
              <OpenButton actions={actions} row={row} />
            </Table.Cell>
            <Table.Cell>{row.baseModelLabel}</Table.Cell>
            <Table.Cell>
              <code className="font-mono text-[13px]">{row.datasetVersionLabel}</code>
            </Table.Cell>
            <Table.Cell className="tabular-nums">{row.epochLabel}</Table.Cell>
            <Table.Cell>
              <Badge variant={row.statusVariant}>{row.statusLabel}</Badge>
            </Table.Cell>
            <Table.Cell className="text-text-secondary">{row.startedLabel}</Table.Cell>
            <Table.Cell className="text-text-secondary">{row.endedLabel}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

export function TrainingJobsTable({ actions, model }: TrainingJobsProps) {
  if (model.state === 'error') {
    return (
      <InlineAlert
        action={{ label: TEXT.retry, onClick: actions.onRetry }}
        level="violation"
        message={model.errorMessage ?? TEXT.errorTitle}
        title={TEXT.errorTitle}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {model.partialNotice !== null && <InlineAlert level="attention" message={model.partialNotice} />}
      {model.rows.length === 0 ? (
        <EmptyState description={model.emptyMessage} icon={<History aria-hidden="true" />} title={TEXT.emptyTitle} />
      ) : (
        <div className={PANEL}>
          {model.isCollapsed ? <Cards actions={actions} rows={model.rows} /> : <Rows actions={actions} rows={model.rows} />}
        </div>
      )}
      {model.loadMoreError !== null && <InlineAlert level="violation" message={model.loadMoreError} />}
      {model.hasMore && (
        <Button className="self-start" loading={model.isLoadingMore} onClick={actions.onLoadMore} size="sm" variant="ghost">
          {TEXT.loadMore}
        </Button>
      )}
    </div>
  );
}
