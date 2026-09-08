/**
 * Vỏ S-33: bố cục hai cột (trái 360 = danh sách, phải = vùng so sánh). View thuần (R-60,
 * mục D) — mọi dữ liệu tới từ `VersionHistoryProps`, không chạm store/mạng.
 *
 * `VersionCompare` (vùng so sánh) do worker khác dựng, CHƯA tồn tại trong worktree này —
 * import thẳng, lớp gộp sẽ rấp lại. Typecheck báo thiếu `./VersionCompare` là bình thường.
 *
 * Quyết định lệch khỏi đặc tả, ghi lại vì đặc tả không nói rõ:
 *  - "Phiên bản này" ở chân màn (nút phục hồi + nút xuất) trỏ vào
 *    `model.compare.rightVersionId` — phiên bản đang được xem ở vùng so sánh. Đặc tả không
 *    nói phiên bản mục tiêu lấy từ đâu; đây là lựa chọn hợp lý nhất vì đó là phiên bản người
 *    dùng đang nhìn, không phải phiên bản gốc bên trái.
 *  - Dưới 1024, TOÀN BỘ cột trái được thay bằng một `Select` duy nhất (không chỉ thu nhỏ danh
 *    sách), gắn vào `actions.selectRightVersion` — cùng lý do trên.
 *  - `<VersionCompare model={model.compare} actions={actions} />`: hợp đồng chỉ ghi
 *    "props: { model, actions }" chứ không định rõ `model` là toàn bộ `VersionHistoryModel`
 *    hay riêng `CompareModel`. Chọn `CompareModel` vì tên gọi khớp phạm vi của component.
 */
import { AlertTriangle, History, Lock } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

import { VersionCompare } from './VersionCompare';
import { VersionList } from './VersionList';
import type { VersionHistoryProps } from './types';

export function VersionHistory({ model, actions }: VersionHistoryProps) {
  const reviewedVersionId = model.compare.rightVersionId;

  if (model.state === 'loading') {
    return (
      <div className="flex h-full gap-4 p-4">
        <Skeleton preset="table-row" className="w-[360px]" />
        <Skeleton preset="property-panel" className="flex-1" />
      </div>
    );
  }

  if (model.state === 'empty') {
    return (
      <EmptyState
        icon={<History aria-hidden="true" />}
        title="chưa có phiên bản nào"
        description="Chưa có phiên bản nào được lưu cho bản vẽ này."
      />
    );
  }

  if (model.state === 'forbidden') {
    return (
      <EmptyState
        icon={<Lock aria-hidden="true" />}
        title="không đủ quyền xem"
        description="Bạn không có quyền xem lịch sử phiên bản của bản vẽ này."
      />
    );
  }

  if (model.state === 'error') {
    return (
      <InlineAlert
        level="violation"
        title="không tải được lịch sử phiên bản"
        message={model.errorMessage ?? 'Đã có lỗi xảy ra.'}
      />
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      {model.savedAtLabel !== null && <p className="text-[13px] text-text-secondary">{model.savedAtLabel}</p>}

      {model.conflict !== null && (
        <InlineAlert
          level="violation"
          title={model.conflict.actorName}
          message={model.conflict.message}
          action={{ label: model.conflict.dismissLabel, onClick: actions.dismissConflict, variant: 'secondary' }}
        />
      )}

      <div className={model.isNarrow ? 'flex flex-1 flex-col gap-4 overflow-hidden' : 'flex flex-1 gap-4 overflow-hidden'}>
        {model.isNarrow ? (
          <Select
            label="phiên bản"
            options={model.rows.map((row) => ({ label: `${row.label} — ${row.description}`, value: row.id }))}
            {...(reviewedVersionId !== null ? { value: reviewedVersionId } : {})}
            onChange={actions.selectRightVersion}
          />
        ) : (
          <div className="w-[360px] shrink-0 border-r border-border-default">
            <VersionList groups={model.groups} onToggleCompareSelection={actions.toggleCompareSelection} />
          </div>
        )}

        <div className="min-w-0 flex-1 overflow-hidden">
          <VersionCompare model={model.compare} actions={actions} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-border-default pt-3">
        <div className="flex flex-col gap-1">
          <p className="text-[13px] text-text-secondary">{model.restoreCaption}</p>
          {!model.canRestore && model.restoreHiddenReason !== null && (
            <p className="flex items-center gap-1.5 text-[13px] text-text-tertiary">
              <AlertTriangle size={14} aria-hidden="true" />
              {model.restoreHiddenReason}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {reviewedVersionId !== null && (
            <Button variant="ghost" onClick={() => actions.exportVersion(reviewedVersionId)}>
              xuất phiên bản này
            </Button>
          )}
          {model.canRestore && (
            <Button
              variant="secondary"
              disabled={reviewedVersionId === null}
              onClick={() => {
                if (reviewedVersionId !== null) {
                  actions.requestRestore(reviewedVersionId);
                }
              }}
            >
              khôi phục phiên bản này
            </Button>
          )}
        </div>
      </div>

      <Modal.Root isOpen={model.restoreConfirm.isOpen} onClose={actions.cancelRestore} width={480}>
        <Modal.Header>{model.restoreConfirm.title}</Modal.Header>
        <Modal.Body className="flex flex-col gap-2 pb-6">
          <p>{model.restoreConfirm.reassurance}</p>
          {model.restoreConfirm.targetVersionLabel !== null && (
            <p className="tabular-nums text-text-secondary">{model.restoreConfirm.targetVersionLabel}</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={actions.cancelRestore}>
            {model.restoreConfirm.cancelLabel}
          </Button>
          <Button variant="primary" onClick={actions.confirmRestore}>
            {model.restoreConfirm.confirmLabel}
          </Button>
        </Modal.Footer>
      </Modal.Root>
    </div>
  );
}
