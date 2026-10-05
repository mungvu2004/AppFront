/**
 * Tab "Bộ dữ liệu" — chỉ xem. Trái 360: chọn họ + danh sách bộ dữ liệu; phải: bảng phiên
 * bản. Dưới 1024 danh sách lên trên. Không giao diện dựng hay tạo (N29, N31 là của CLI).
 */

import { Database } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Table } from '@/components/ui/Table';
import { cn } from '@/lib/utils';

import type { DatasetFamilyId, TrainingJobsProps } from './types';

const TEXT = {
  family: 'Họ model',
  list: 'Danh sách bộ dữ liệu',
  versions: 'Phiên bản',
  note: 'Trang này chỉ xem; bộ dữ liệu dựng bằng công cụ dòng lệnh.',
  retry: 'Thử lại',
  errorTitle: 'Không đọc được dữ liệu huấn luyện',
  emptyTitle: 'Chưa có bộ dữ liệu',
  noVersions: 'Bộ dữ liệu này chưa có phiên bản nào.',
} as const;

const HEADERS = ['Số thứ tự', 'Trạng thái', 'Nguồn', 'Huấn luyện / kiểm định / kiểm tra', 'Ngày tạo', 'Ghi chú'] as const;
const PANEL = 'rounded-[12px] border border-border-default bg-bg-surface p-5';
const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface';

function VersionsTable({ model }: Pick<TrainingJobsProps, 'model'>) {
  const tab = model.datasets;

  if (tab.versionsError !== null) return <InlineAlert level="violation" message={tab.versionsError} />;
  if (tab.isLoadingVersions) return <Skeleton preset="table-row" />;
  if (tab.versionRows.length === 0) return <p className="text-[13px] text-text-secondary">{TEXT.noVersions}</p>;

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
        {tab.versionRows.map((row) => (
          <Table.Row className="h-10" key={row.id}>
            <Table.Cell className="tabular-nums">{row.sequenceLabel}</Table.Cell>
            <Table.Cell>
              <Badge variant={row.statusVariant}>{row.statusLabel}</Badge>
            </Table.Cell>
            <Table.Cell>{row.sourceLabel}</Table.Cell>
            <Table.Cell className="tabular-nums">{row.splitLabel}</Table.Cell>
            <Table.Cell className="text-text-secondary">{row.createdLabel}</Table.Cell>
            <Table.Cell className="text-text-secondary">{row.failureText ?? ''}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

function Body({ actions, model }: TrainingJobsProps) {
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

  // Xét dữ liệu, không xét `state`: màn hẹp (`collapsed`) rỗng vẫn phải nói câu rỗng của [8].
  if (model.datasets.datasets.length === 0) {
    return <EmptyState description={model.emptyMessage} icon={<Database aria-hidden="true" />} title={TEXT.emptyTitle} />;
  }

  return (
    <div className={cn('flex gap-6', model.isCollapsed ? 'flex-col' : 'items-start')}>
      <nav aria-label={TEXT.list} className={cn(PANEL, model.isCollapsed ? 'w-full' : 'w-[360px] shrink-0')}>
        <ul className="flex flex-col gap-1">
          {model.datasets.datasets.map((dataset) => (
            <li key={dataset.value}>
              <button
                aria-pressed={dataset.isSelected}
                className={cn('w-full rounded-[8px] px-3 py-2 text-left text-text-primary', FOCUS_RING, dataset.isSelected && 'bg-bg-selected')}
                onClick={() => actions.onSelectDataset(dataset.value)}
                type="button"
              >
                {dataset.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <section aria-label={TEXT.versions} className={cn(PANEL, 'min-w-0 flex-1')}>
        <VersionsTable model={model} />
      </section>
    </div>
  );
}

export function TrainingDatasetsTab({ actions, model }: TrainingJobsProps) {
  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl<DatasetFamilyId>
        aria-label={TEXT.family}
        className="self-start"
        onChange={actions.onSelectDatasetFamily}
        options={[...model.datasets.families]}
        value={model.datasets.family}
      />
      <p className="text-[13px] text-text-secondary">{TEXT.note}</p>
      <Body actions={actions} model={model} />
    </div>
  );
}
