/**
 * View thuần của màn huấn luyện (`/admin/training/jobs`, F-12) — mục D: mọi dữ liệu qua
 * `TrainingJobsProps`, không chạm store hay mạng.
 *
 * Đầu trang, `Tabs`, bộ lọc và nút "Tạo lượt huấn luyện" giữ nguyên ở mọi trạng thái trừ
 * `forbidden`; chỉ vùng bảng đổi.
 */

import { Lock } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Drawer } from '@/components/overlay/Drawer';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';
import { cn } from '@/lib/utils';

import { TrainingDatasetsTab } from './TrainingDatasetsTab';
import { TrainingJobCancelDialog, TrainingJobDetail } from './TrainingJobDetail';
import { TrainingJobForm } from './TrainingJobForm';
import { TrainingJobsTable } from './TrainingJobsTable';
import type { TrainingJobsProps, TrainingJobsViewModel, TrainingTabId } from './types';

const TEXT = {
  breadcrumbNav: 'Đường dẫn trang',
  breadcrumbAdmin: 'Quản trị',
  breadcrumbHere: 'Huấn luyện model',
  title: 'Huấn luyện model AI',
  tabsLabel: 'Phần của trang huấn luyện',
  tabJobs: 'Lượt huấn luyện',
  tabDatasets: 'Bộ dữ liệu',
  familyFilter: 'Lọc theo họ',
  statusFilter: 'Lọc theo trạng thái',
  create: 'Tạo lượt huấn luyện',
  forbiddenTitle: 'Không có quyền truy cập',
  forbiddenBody: 'Chỉ quản trị viên hệ thống xem được trang huấn luyện.',
  detailPanel: 'Chi tiết lượt huấn luyện',
} as const;

const PANEL = 'rounded-[12px] border border-border-default bg-bg-surface p-5';

function Header({ model }: { readonly model: TrainingJobsViewModel }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <nav aria-label={TEXT.breadcrumbNav} className="text-[13px] text-text-secondary">
          <ol className="flex items-center gap-1.5">
            <li>{TEXT.breadcrumbAdmin}</li>
            <li aria-hidden="true">›</li>
            <li aria-current="page">{TEXT.breadcrumbHere}</li>
          </ol>
        </nav>
        <h1 className="text-[20px] font-semibold text-text-primary">{TEXT.title}</h1>
      </div>
      <a className="text-[13px] text-accent hover:underline" href={model.relatedLink.href}>
        {model.relatedLink.label}
      </a>
    </div>
  );
}

function Toolbar({ actions, model }: TrainingJobsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SegmentedControl
        aria-label={TEXT.familyFilter}
        onChange={actions.onFilterFamily}
        options={[...model.familyFilters]}
        value={model.familyFilter}
      />
      <Select.Root
        className="w-[180px]"
        onChange={actions.onFilterStatus}
        options={[...model.statusFilters]}
        value={model.statusFilter}
      >
        <Select.Label className="sr-only">{TEXT.statusFilter}</Select.Label>
        <Select.Trigger options={[...model.statusFilters]} />
        <Select.Content>
          {model.statusFilters.map((option, index) => (
            <Select.Item index={index} key={option.value} value={option.value}>
              {option.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
      <Button className="ml-auto" onClick={actions.onOpenForm} variant="primary">
        {TEXT.create}
      </Button>
    </div>
  );
}

function LoadingArea({ rowCount }: { readonly rowCount: number }) {
  return (
    <div aria-busy="true" className={PANEL}>
      {Array.from({ length: rowCount }, (_unused, index) => (
        <Skeleton key={index} preset="table-row" />
      ))}
    </div>
  );
}

function JobsPanel({ actions, model }: TrainingJobsProps) {
  const showsSidePanel = !model.isCollapsed && model.detail !== null && model.state !== 'loading';

  return (
    <div className="flex flex-col gap-4">
      <Toolbar actions={actions} model={model} />
      <div className="flex items-start gap-6">
        <div className={cn('flex-1', model.isCollapsed ? 'min-w-0' : 'min-w-[640px]')}>
          {model.state === 'loading' ? (
            <LoadingArea rowCount={model.skeletonRowCount} />
          ) : (
            <TrainingJobsTable actions={actions} model={model} />
          )}
        </div>
        {showsSidePanel && (
          <aside aria-label={TEXT.detailPanel} className={cn(PANEL, 'w-[400px] shrink-0 min-[1920px]:w-[480px]')}>
            <TrainingJobDetail actions={actions} detail={model.detail} />
          </aside>
        )}
      </div>
    </div>
  );
}

export function TrainingJobs({ actions, model }: TrainingJobsProps) {
  const shell = 'mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-8 py-8 min-[1920px]:max-w-[1440px]';

  if (model.state === 'forbidden') {
    return (
      <div className={shell}>
        <Header model={model} />
        <EmptyState description={TEXT.forbiddenBody} icon={<Lock aria-hidden="true" />} title={TEXT.forbiddenTitle} />
      </div>
    );
  }

  return (
    <div className={shell}>
      <Header model={model} />
      <Tabs.Root activeId={model.activeTab} onChange={(id) => actions.onSelectTab(id as TrainingTabId)}>
        <Tabs.List aria-label={TEXT.tabsLabel}>
          <Tabs.Tab id="jobs">{TEXT.tabJobs}</Tabs.Tab>
          <Tabs.Tab id="datasets">{TEXT.tabDatasets}</Tabs.Tab>
        </Tabs.List>
        <div className="relative pt-4">
          <Tabs.Panel id="jobs">
            <JobsPanel actions={actions} model={model} />
          </Tabs.Panel>
          <Tabs.Panel id="datasets">
            {model.state === 'loading' ? (
              <LoadingArea rowCount={model.skeletonRowCount} />
            ) : (
              <TrainingDatasetsTab actions={actions} model={model} />
            )}
          </Tabs.Panel>
        </div>
      </Tabs.Root>

      {model.isCollapsed && model.activeTab === 'jobs' && (
        <Drawer.Root isOpen={model.detail !== null} label={TEXT.detailPanel} onClose={() => actions.onSelectJob(null)}>
          <Drawer.Body>
            <div className="p-6">
              <TrainingJobDetail actions={actions} detail={model.detail} />
            </div>
          </Drawer.Body>
        </Drawer.Root>
      )}

      <TrainingJobForm actions={actions} form={model.form} />
      <TrainingJobCancelDialog actions={actions} dialog={model.cancelDialog} />
    </div>
  );
}
