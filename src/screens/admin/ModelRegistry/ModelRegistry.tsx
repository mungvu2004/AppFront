/**
 * View thuần của màn registry model (`/admin/training/models`, F-11) — mục D: mọi dữ liệu qua
 * `ModelRegistryProps`, không chạm store hay mạng.
 *
 * Ba câu của màn (NGUYEN-TAC-BO-CUC §1, ngoài dự án nên không có FlowGate): `PageHead` nói
 * làm gì, trạng thái (Badge mô hình đang dùng + câu có số phiên bản), và ô chọn họ ở `next`
 * (như ô "Tầng" của VersionHistory). Không có nút chính cấp trang: việc chính là "Kích hoạt"
 * trên từng hàng. Thẻ "Đang dùng" là khối nổi bật tách khỏi danh sách; danh sách phiên bản
 * nằm trong MỘT `Section`. Dải 409 phủ lên trạng thái đang có, không là trạng thái thứ tám.
 */

import { Boxes, Lock } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Drawer } from '@/components/overlay/Drawer';
import { PageHead } from '@/components/shell/PageHead';
import { Section } from '@/components/shell/Section';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { cn } from '@/lib/utils';

import { ModelRegistryActivateDialog } from './ModelRegistryActivateDialog';
import { ModelRegistryDetail } from './ModelRegistryDetail';
import { ModelRegistryVersionTable } from './ModelRegistryVersionTable';
import type { ActiveCardModel, ModelFamilyId, ModelRegistryActions, ModelRegistryProps, ModelRegistryViewModel } from './types';

const TEXT = {
  eyebrow: 'Quản trị',
  title: 'Chọn mô hình AI đang dùng',
  familyPicker: 'Loại mô hình',
  activeTitle: 'Đang dùng',
  versionsTitle: 'Phiên bản',
  revert: 'Tắt AI, dùng thuật toán cũ',
  revertHint: 'Bỏ mô hình AI, chuỗi xử lý dùng lại thuật toán không học máy cho loại này.',
  revertZoneTitle: 'Tắt AI tách lớp tường cho cả hệ thống',
  revertZoneBody:
    'Mọi lượt xử lý mới của mọi người dùng sẽ tách tường bằng thuật toán cũ, không dùng mô hình AI. Chỉ làm khi mô hình đang dùng hỏng; bật lại bằng Kích hoạt một phiên bản.',
  reload: 'Tải lại',
  retry: 'Thử lại',
  errorTitle: 'Không đọc được danh sách model',
  errorBadge: 'Không đọc được',
  betterBadge: 'Có bản tốt hơn',
  aiBadge: 'Đang dùng mô hình AI',
  noAiBadge: 'Chưa dùng mô hình AI',
  loadMore: 'Xem thêm',
  emptyTitle: 'Chưa có phiên bản',
  forbiddenTitle: 'Không có quyền truy cập',
  forbiddenBody: 'Chỉ quản trị viên hệ thống xem được model AI.',
  detailPanel: 'Chi tiết phiên bản',
} as const;

const PANEL = 'rounded-xl bg-bg-surface p-5 shadow-panel';
const FOCUS_RING =
  'outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface';

/** Badge nói mô hình nào đang chạy (hoặc có bản tốt hơn), câu nói số phiên bản — mỗi số một chỗ. */
function RegistryStatus({ model }: { readonly model: ModelRegistryViewModel }) {
  if (model.state === 'loading') return null;
  if (model.state === 'error') return <Badge variant="violation">{TEXT.errorBadge}</Badge>;

  const card = model.activeCard;
  const badge =
    card?.betterNote != null ? (
      <Badge variant="attention">{TEXT.betterBadge}</Badge>
    ) : (
      <Badge variant="neutral">{card?.hasVersion === true ? TEXT.aiBadge : TEXT.noAiBadge}</Badge>
    );
  // Rỗng: EmptyState bên dưới đã nói "Chưa có phiên bản", dòng trạng thái chỉ giữ Badge.
  if (model.rows.length === 0) return badge;

  return (
    <>
      {badge}
      <span className="tabular-nums">{`${String(model.rows.length)} phiên bản${model.hasMore ? ' đã tải' : ''}.`}</span>
    </>
  );
}

function Head({ actions, model }: ModelRegistryProps) {
  const forbidden = model.state === 'forbidden';
  return (
    <PageHead
      className="mb-0"
      eyebrow={TEXT.eyebrow}
      title={TEXT.title}
      status={forbidden ? undefined : <RegistryStatus model={model} />}
      next={
        <>
          {model.relatedLink !== null && (
            <Link className="text-[13px] font-medium text-accent underline-offset-2 hover:underline" to={model.relatedLink.href}>
              {model.relatedLink.label}
            </Link>
          )}
          {!forbidden && (
            <SegmentedControl<ModelFamilyId>
              aria-label={TEXT.familyPicker}
              className="shrink-0 whitespace-nowrap [&>button]:flex-auto"
              onChange={actions.onSelectFamily}
              options={[...model.families]}
              value={model.selectedFamily}
            />
          )}
        </>
      }
    />
  );
}

interface ActiveCardProps {
  readonly card: ActiveCardModel;
  readonly focusKey: number;
}

function ActiveCard({ card, focusKey }: ActiveCardProps) {
  const facts = [card.metricLabel, card.createdLabel].filter((fact): fact is string => fact !== null);
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
        {card.metricNote != null && <p className="text-[13px] text-text-secondary">{card.metricNote}</p>}
      </div>
    </section>
  );
}

/**
 * U24: "Tắt AI" đổi cả hệ thống nên không nằm cạnh tên mô hình đang dùng (dễ bấm nhầm): khối riêng
 * cuối trang, có câu cảnh báo; bấm vẫn qua hộp xác nhận.
 */
function RevertZone({ actions }: { readonly actions: ModelRegistryActions }) {
  return (
    <section
      aria-label={TEXT.revertZoneTitle}
      className={cn(PANEL, 'flex items-center justify-between gap-4 border border-state-violation')}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm font-semibold text-text-primary">{TEXT.revertZoneTitle}</p>
        <p className="text-[13px] text-text-secondary">{TEXT.revertZoneBody}</p>
      </div>
      <Button className="shrink-0" onClick={actions.onRequestRevert} size="sm" title={TEXT.revertHint} variant="secondary">
        {TEXT.revert}
      </Button>
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
        <ActiveCard card={model.activeCard} focusKey={model.activeCardFocusKey} />
      )}
      {model.refreshError !== null && (
        <InlineAlert
          action={{ label: TEXT.retry, onClick: actions.onRetry }}
          level="violation"
          message={model.refreshError}
        />
      )}
      {model.partialNotice !== null && <InlineAlert level="attention" message={model.partialNotice} />}
      <Section flush title={TEXT.versionsTitle}>
        {model.rows.length === 0 ? (
          <div className="p-5">
            <EmptyState description={model.emptyMessage} icon={<Boxes aria-hidden="true" />} title={TEXT.emptyTitle} />
          </div>
        ) : (
          <div className={model.isCollapsed ? 'p-5' : undefined}>
            <ModelRegistryVersionTable actions={actions} isCollapsed={model.isCollapsed} rows={model.rows} />
          </div>
        )}
        {(model.loadMoreError !== null || model.hasMore) && (
          <div className="flex flex-col gap-3 border-t border-border-default px-5 py-3">
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
        )}
      </Section>
      {model.activeCard?.canRevert === true && <RevertZone actions={actions} />}
    </div>
  );
}

export function ModelRegistry({ actions, model }: ModelRegistryProps) {
  const shell = 'mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-8 py-8 min-[120rem]:max-w-[1440px]';

  if (model.state === 'forbidden') {
    return (
      <div className={shell}>
        <Head actions={actions} model={model} />
        <EmptyState description={TEXT.forbiddenBody} icon={<Lock aria-hidden="true" />} title={TEXT.forbiddenTitle} />
      </div>
    );
  }

  /* V-05: panel chi tiết chỉ mở khi đã chọn bản — chưa chọn thì bảng lấy đủ bề rộng, cột "Thao tác" không bị cắt. */
  const showsSidePanel =
    !model.isCollapsed && model.state !== 'loading' && model.state !== 'error' && model.detail !== null;

  return (
    <div className={shell}>
      <Head actions={actions} model={model} />

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
