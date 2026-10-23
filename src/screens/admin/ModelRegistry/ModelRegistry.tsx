/**
 * View thuần của màn registry model (`/admin/training/models`, F-11) — mục D: mọi dữ liệu qua
 * `ModelRegistryProps`, không chạm store hay mạng.
 *
 * Đầu trang và ô chọn họ giữ nguyên ở mọi trạng thái trừ `forbidden`; chỉ vùng thẻ và bảng
 * đổi. Dải 409 phủ lên trạng thái đang có, không là trạng thái thứ tám.
 */

import { Boxes, Lock } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

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
  title: 'Mô hình AI của chuỗi xử lý',
  familyPicker: 'Loại mô hình',
  activeTitle: 'Đang dùng',
  revert: 'Tắt AI, dùng thuật toán cũ',
  revertHint: 'Bỏ mô hình AI, chuỗi xử lý dùng lại thuật toán không học máy cho loại này.',
  reload: 'Tải lại',
  retry: 'Thử lại',
  errorTitle: 'Không đọc được danh sách model',
  loadMore: 'Xem thêm',
  emptyTitle: 'Chưa có phiên bản',
  forbiddenTitle: 'Không có quyền truy cập',
  forbiddenBody: 'Chỉ quản trị viên hệ thống xem được model AI.',
  detailPanel: 'Chi tiết phiên bản',
} as const;

const PANEL = 'rounded-xl border border-border-default bg-bg-surface p-5';
const FOCUS_RING =
  'outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface';

function Header({ model }: { readonly model: ModelRegistryViewModel }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        {/* Không breadcrumb: thanh tab quản trị đã chỉ đúng mục này. */}
        <h1 className="text-title text-text-primary">{TEXT.title}</h1>
      </div>
      {model.relatedLink !== null && (
        <Link className="text-[13px] font-medium text-accent underline-offset-2 hover:underline" to={model.relatedLink.href}>
          {model.relatedLink.label}
        </Link>
      )}
    </div>
  );
}

interface ActiveCardProps {
  readonly card: ActiveCardModel;
  readonly focusKey: number;
  readonly actions: ModelRegistryActions;
}

function ActiveCard({ actions, card, focusKey }: ActiveCardProps) {
  const facts = [card.formatLabel, card.metricLabel, card.createdLabel].filter((fact): fact is string => fact !== null);
  const sectionRef = useRef<HTMLElement>(null);
  /** Khoá lúc gắn: thẻ gắn lại (đổi họ, Thử lại) không được cướp tiêu điểm (A12). */
  const seenKeyRef = useRef(focusKey);

  // Sau một lượt kích hoạt, nút đã mở hộp thoại biến mất khỏi bảng; tiêu điểm về đây thay
  // vì rơi về `body`. Chỉ khi khoá ĐỔI trong lúc thẻ đang gắn.
  useEffect(() => {
    if (focusKey === seenKeyRef.current) return;
    seenKeyRef.current = focusKey;
    sectionRef.current?.focus();
  }, [focusKey]);

  return (
    <section
      aria-label={TEXT.activeTitle}
      className={cn(PANEL, FOCUS_RING, 'flex items-center justify-between gap-4')}
      ref={sectionRef}
      tabIndex={-1}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-[12px] text-text-secondary">{TEXT.activeTitle}</p>
        <p className="truncate text-base font-semibold text-text-primary">{card.label}</p>
        {facts.length > 0 && <p className="tabular-nums text-[13px] text-text-secondary">{facts.join(' · ')}</p>}
        {card.betterNote != null && <p className="text-[13px] text-state-attention-text">{card.betterNote}</p>}
      </div>
      {card.canRevert && (
        <div className="flex max-w-[280px] flex-col items-end gap-1">
          <Button onClick={actions.onRequestRevert} size="sm" variant="secondary">
            {TEXT.revert}
          </Button>
          <p className="text-right text-[12px] text-text-secondary">{TEXT.revertHint}</p>
        </div>
      )}
    </section>
  );
}

function VersionsArea({ actions, model }: ModelRegistryProps) {
  if (model.state === 'loading') {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className={cn(PANEL, 'h-24 animate-pulse bg-border-default motion-reduce:animate-none')} />
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
      {model.activeCard !== null && (
        <ActiveCard actions={actions} card={model.activeCard} focusKey={model.activeCardFocusKey} />
      )}
      {model.refreshError !== null && (
        <InlineAlert
          action={{ label: TEXT.retry, onClick: actions.onRetry }}
          level="violation"
          message={model.refreshError}
        />
      )}
      {model.partialNotice !== null && <InlineAlert level="attention" message={model.partialNotice} />}
      {model.rows.length === 0 ? (
        <EmptyState description={model.emptyMessage} icon={<Boxes aria-hidden="true" />} title={TEXT.emptyTitle} />
      ) : (
        <div className={PANEL}>
          <ModelRegistryVersionTable actions={actions} isCollapsed={model.isCollapsed} rows={model.rows} />
        </div>
      )}
      {model.loadMoreError !== null && <InlineAlert level="violation" message={model.loadMoreError} />}
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
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-8 py-8 min-[120rem]:max-w-[1440px]">
        <Header model={model} />
        <EmptyState description={TEXT.forbiddenBody} icon={<Lock aria-hidden="true" />} title={TEXT.forbiddenTitle} />
      </div>
    );
  }

  /* V-05: panel chi tiết chỉ mở khi đã chọn bản — chưa chọn thì bảng lấy đủ bề rộng, cột "Thao tác" không bị cắt. */
  const showsSidePanel =
    !model.isCollapsed && model.state !== 'loading' && model.state !== 'error' && model.detail !== null;

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-8 py-8 min-[120rem]:max-w-[1440px]">
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
        <div className="min-w-0 flex-1">
          <VersionsArea actions={actions} model={model} />
        </div>
        {showsSidePanel && (
          <aside aria-label={TEXT.detailPanel} className={cn(PANEL, 'w-[344px] shrink-0 min-[120rem]:w-[400px]')}>
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
