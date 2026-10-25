/**
 * View thuần của màn huấn luyện (`/admin/training/jobs`, F-12) — mục D: mọi dữ liệu qua
 * `TrainingJobsProps`, không chạm store hay mạng.
 *
 * Ba câu của màn (NGUYEN-TAC-BO-CUC §1, ngoài dự án nên không có FlowGate): `PageHead` nói
 * làm gì, trạng thái (Badge lượt hỏng/đang chạy + câu có số lượt đã tải), và MỘT nút chính
 * "Tạo lượt huấn luyện" ở `next` — bị khoá thì lý do đứng ngay cạnh nút, không nút chết.
 * Đầu trang, `Tabs` và nút ấy giữ nguyên ở mọi trạng thái trừ `forbidden`; danh sách lượt
 * nằm trong MỘT `Section` có bộ lọc ở đầu khung, chỉ thân khung đổi theo trạng thái.
 */

import { Lock } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Drawer } from '@/components/overlay/Drawer';
import { PageHead } from '@/components/shell/PageHead';
import { Section } from '@/components/shell/Section';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';

import { TrainingDatasetsTab } from './TrainingDatasetsTab';
import { TrainingJobCancelDialog, TrainingJobDetail } from './TrainingJobDetail';
import { TrainingJobForm } from './TrainingJobForm';
import { TrainingJobsTable } from './TrainingJobsTable';
import type { TrainingJobsProps, TrainingJobsViewModel, TrainingTabId } from './types';

const TEXT = {
  eyebrow: 'Quản trị',
  title: 'Theo dõi huấn luyện',
  tabsLabel: 'Phần của trang huấn luyện',
  tabJobs: 'Lượt huấn luyện',
  tabDatasets: 'Bộ dữ liệu',
  familyFilter: 'Lọc theo họ',
  statusFilter: 'Lọc theo trạng thái',
  create: 'Tạo lượt huấn luyện',
  forbiddenTitle: 'Không có quyền truy cập',
  forbiddenBody: 'Chỉ quản trị viên hệ thống xem được trang huấn luyện.',
  detailPanel: 'Chi tiết lượt huấn luyện',
  errorBadge: 'Không đọc được',
  idleBadge: 'Không có lượt đang chạy',
} as const;

const PANEL = 'rounded-xl bg-bg-surface p-5 shadow-panel';

/** Trạng thái: Badge nói việc cần để ý nhất (hỏng > đang chạy), câu nói số lượt đã tải — mỗi số một chỗ. */
function JobsStatus({ model }: { readonly model: TrainingJobsViewModel }) {
  if (model.state === 'loading') return null;
  if (model.state === 'error') return <Badge variant="violation">{TEXT.errorBadge}</Badge>;

  const failed = model.rows.filter((row) => row.statusVariant === 'violation').length;
  const running = model.rows.filter((row) => row.statusVariant === 'attention').length;
  const badge =
    failed > 0 ? (
      <Badge variant="violation">{`${String(failed)} lượt hỏng`}</Badge>
    ) : running > 0 ? (
      <Badge variant="attention">{`${String(running)} lượt đang chạy`}</Badge>
    ) : (
      <Badge variant="neutral">{TEXT.idleBadge}</Badge>
    );
  const runningTail = failed > 0 && running > 0 ? `, ${String(running)} lượt đang chạy` : '';
  // Rỗng: EmptyState bên dưới đã nói "Chưa có lượt huấn luyện", dòng trạng thái chỉ giữ Badge.
  if (model.rows.length === 0) return badge;
  const sentence = `${String(model.rows.length)} lượt huấn luyện${model.hasMore ? ' đã tải' : ''}${runningTail}.`;

  return (
    <>
      {badge}
      <span className="tabular-nums">{sentence}</span>
    </>
  );
}

function Head({ actions, model }: TrainingJobsProps) {
  const forbidden = model.state === 'forbidden';
  return (
    <PageHead
      className="mb-0"
      eyebrow={TEXT.eyebrow}
      title={TEXT.title}
      status={forbidden ? undefined : <JobsStatus model={model} />}
      next={
        <>
          {/* Không có bộ dữ liệu thì không có nút chết: ô trống bên dưới nói lý do. */}
          {!forbidden && model.createDisabledReason === null && (
            <Button
              onClick={actions.onOpenForm}
              variant="primary"
            >
              {TEXT.create}
            </Button>
          )}
        </>
      }
    />
  );
}

function Filters({ actions, model }: TrainingJobsProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-border-default px-5 py-4">
      <SegmentedControl
        aria-label={TEXT.familyFilter}
        className="shrink-0 whitespace-nowrap [&>button]:flex-auto"
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
        <Select.Label className="text-[12px] text-text-secondary">{TEXT.statusFilter}</Select.Label>
        <Select.Trigger options={[...model.statusFilters]} />
        <Select.Content>
          {model.statusFilters.map((option, index) => (
            <Select.Item index={index} key={option.value} value={option.value}>
              {option.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </div>
  );
}

function LoadingRows({ rowCount }: { readonly rowCount: number }) {
  return (
    <div aria-busy="true" className="p-5">
      {Array.from({ length: rowCount }, (_unused, index) => (
        <Skeleton key={index} preset="table-row" />
      ))}
    </div>
  );
}

function JobsPanel({ actions, model }: TrainingJobsProps) {
  // Như V-05 của ModelRegistry: panel chỉ mở khi đã chọn lượt — chưa chọn thì bảng lấy đủ bề rộng, không cắt cột.
  const showsSidePanel =
    !model.isCollapsed && model.state !== 'loading' && model.rows.length > 0 && model.detail !== null;

  return (
    <div className="flex items-start gap-6">
      <Section className="min-w-0 flex-1" flush>
        <Filters actions={actions} model={model} />
        {model.state === 'loading' ? (
          <LoadingRows rowCount={model.skeletonRowCount} />
        ) : (
          <TrainingJobsTable actions={actions} model={model} />
        )}
      </Section>
      {showsSidePanel && (
        <aside aria-label={TEXT.detailPanel} className={`${PANEL} w-[400px] shrink-0 min-[120rem]:w-[480px]`}>
          <TrainingJobDetail actions={actions} detail={model.detail} />
        </aside>
      )}
    </div>
  );
}

export function TrainingJobs({ actions, model }: TrainingJobsProps) {
  const shell = 'mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-8 py-8 min-[120rem]:max-w-[1440px]';

  if (model.state === 'forbidden') {
    return (
      <div className={shell}>
        <Head actions={actions} model={model} />
        <EmptyState description={TEXT.forbiddenBody} icon={<Lock aria-hidden="true" />} title={TEXT.forbiddenTitle} />
      </div>
    );
  }

  return (
    <div className={shell}>
      <Head actions={actions} model={model} />
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
              <Section flush>
                <LoadingRows rowCount={model.skeletonRowCount} />
              </Section>
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
