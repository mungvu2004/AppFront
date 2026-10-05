/**
 * View thuần của màn registry model (`/admin/training/models`, F-11) — mục D: mọi dữ liệu qua
 * `ModelRegistryProps`, không chạm store hay mạng.
 *
 * Đầu trang và ô chọn họ giữ nguyên ở mọi trạng thái trừ `forbidden`; chỉ vùng thẻ và bảng
 * đổi. Dải 409 phủ lên trạng thái đang có, không là trạng thái thứ tám.
 */

import { Boxes, Lock } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Drawer } from '@/components/overlay/Drawer';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { cn } from '@/lib/utils';

import { ModelRegistryActivateDialog } from './ModelRegistryActivateDialog';
import { ModelRegistryDetail } from './ModelRegistryDetail';
import { ModelRegistryVersionTable } from './ModelRegistryVersionTable';
import type { ActiveCardModel, ModelFamilyId, ModelRegistryActions, ModelRegistryProps, ModelRegistryViewModel } from './types';

const TEXT = {
  breadcrumbNav: 'Đường dẫn trang',
  breadcrumbAdmin: 'Quản trị',
  breadcrumbHere: 'model AI',
  title: 'Model AI của chuỗi xử lý',
  familyPicker: 'Họ model',
  activeTitle: 'Đang dùng',
  revert: 'Quay về đường cổ điển',
  reload: 'Tải lại',
  retry: 'Thử lại',
  errorTitle: 'Không đọc được danh sách model',
  loadMore: 'Xem thêm',
  emptyTitle: 'Chưa có phiên bản',
  forbiddenTitle: 'Không có quyền truy cập',
  forbiddenBody: 'Chỉ quản trị viên hệ thống xem được model AI.',
  detailPanel: 'Chi tiết phiên bản',
} as const;

const PANEL = 'rounded-[12px] border border-border-default bg-bg-surface p-5';

function Header({ model }: { readonly model: ModelRegistryViewModel }) {
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
      {model.relatedLink !== null && (
        <a className="text-[13px] text-accent hover:underline" href={model.relatedLink.href}>
          {model.relatedLink.label}
        </a>
      )}
    </div>
  );
}

function ActiveCard({ actions, card }: { readonly card: ActiveCardModel; readonly actions: ModelRegistryActions }) {
  const facts = [card.formatLabel, card.metricLabel, card.createdLabel].filter((fact): fact is string => fact !== null);

  return (
    <section aria-label={TEXT.activeTitle} className={cn(PANEL, 'flex items-center justify-between gap-4')}>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-[12px] text-text-secondary">{TEXT.activeTitle}</p>
        <p className="truncate text-base font-semibold text-text-primary">{card.label}</p>
        {facts.length > 0 && <p className="font-mono text-[13px] text-text-secondary">{facts.join(' · ')}</p>}
      </div>
      {card.canRevert && (
        <Button onClick={actions.onRequestRevert} size="sm" variant="secondary">
          {TEXT.revert}
        </Button>
      )}
    </section>
  );
}

function VersionsArea({ actions, model }: ModelRegistryProps) {
  if (model.state === 'loading') {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className={cn(PANEL, 'h-24 animate-pulse bg-bg-sunken motion-reduce:animate-none')} />
        <div className={PANEL}>
          {Array.from({ length: model.skeletonRowCount }, (_unused, index) => (
            <Skeleton key={index} preset="table-row" />
          ))}
        </div>
      </div>
    );
  }

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
      {model.activeCard !== null && <ActiveCard actions={actions} card={model.activeCard} />}
      {model.partialNotice !== null && <InlineAlert level="attention" message={model.partialNotice} />}
      {model.rows.length === 0 ? (
        <EmptyState description={model.emptyMessage} icon={<Boxes aria-hidden="true" />} title={TEXT.emptyTitle} />
      ) : (
        <div className={PANEL}>
          <ModelRegistryVersionTable actions={actions} isCollapsed={model.isCollapsed} rows={model.rows} />
        </div>
      )}
      {model.hasMore && (
        <Button
          className="self-start"
          loading={model.isLoadingMore}
          onClick={actions.onLoadMore}
          size="sm"
          variant="ghost"
        >
          {TEXT.loadMore}
        </Button>
      )}
    </div>
  );
}

export function ModelRegistry({ actions, model }: ModelRegistryProps) {
  if (model.state === 'forbidden') {
    return (
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-8 py-8">
        <Header model={model} />
        <EmptyState description={TEXT.forbiddenBody} icon={<Lock aria-hidden="true" />} title={TEXT.forbiddenTitle} />
      </div>
    );
  }

  const showsSidePanel = !model.isCollapsed && model.state !== 'loading' && model.state !== 'error';

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-8 py-8 min-[1920px]:max-w-[1440px]">
      <Header model={model} />

      <SegmentedControl<ModelFamilyId>
        aria-label={TEXT.familyPicker}
        className="self-start"
        onChange={actions.onSelectFamily}
        options={[...model.families]}
        value={model.selectedFamily}
      />

      {model.conflictNotice !== null && (
        <InlineAlert
          action={{ label: TEXT.reload, onClick: actions.onReloadAfterConflict }}
          level="attention"
          message={model.conflictNotice}
        />
      )}

      <div className="flex items-start gap-6">
        <div className={cn('flex-1', model.isCollapsed ? 'min-w-0' : 'min-w-[640px]')}>
          <VersionsArea actions={actions} model={model} />
        </div>
        {showsSidePanel && (
          <aside aria-label={TEXT.detailPanel} className={cn(PANEL, 'w-[344px] shrink-0 min-[1920px]:w-[400px]')}>
            <ModelRegistryDetail detail={model.detail} />
          </aside>
        )}
      </div>

      {model.isCollapsed && (
        <Drawer.Root isOpen={model.detail !== null} label={TEXT.detailPanel} onClose={() => actions.onSelectVersion(null)}>
          <Drawer.Body>
            <div className="p-6">
              <ModelRegistryDetail detail={model.detail} />
            </div>
          </Drawer.Body>
        </Drawer.Root>
      )}

      <ModelRegistryActivateDialog actions={actions} dialog={model.dialog} />
    </div>
  );
}
