/**
 * Vỏ S-33: bố cục hai cột (trái 360 = danh sách, phải = vùng so sánh). View thuần (R-60,
 * mục D) — mọi dữ liệu tới từ `VersionHistoryProps`, không chạm store/mạng.
 *
 * `VersionCompare` (vùng so sánh) do worker khác dựng trên nhánh riêng; lớp gộp đã ghép nó
 * vào, nên lệnh nhập dưới đây phân giải bình thường.
 *
 * Quyết định lệch khỏi đặc tả, ghi lại vì đặc tả không nói rõ:
 *  - "Phiên bản này" ở chân màn (nút phục hồi + nút xuất) trỏ vào
 *    `model.compare.rightVersionId` (vắng thì `leftVersionId` — bản duy nhất còn tích) — phiên
 *    bản đang được xem ở vùng so sánh. Đặc tả không
 *    nói phiên bản mục tiêu lấy từ đâu; đây là lựa chọn hợp lý nhất vì đó là phiên bản người
 *    dùng đang nhìn, không phải phiên bản gốc bên trái.
 *  - Dưới 1024, TOÀN BỘ cột trái được thay bằng một `Select` duy nhất (không chỉ thu nhỏ danh
 *    sách), gắn vào `actions.selectRightVersion` — cùng lý do trên.
 *  - `<VersionCompare model={model.compare} actions={actions} />`: hợp đồng chỉ ghi
 *    "props: { model, actions }" chứ không định rõ `model` là toàn bộ `VersionHistoryModel`
 *    hay riêng `CompareModel`. Chọn `CompareModel` vì tên gọi khớp phạm vi của component.
 */
import { AlertTriangle, History, Lock } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

import { VersionCompare } from './VersionCompare';
import { VersionLabelDialog } from './VersionLabelDialog';
import { VersionList } from './VersionList';
import type { VersionHistoryProps } from './types';

export function VersionHistory({ model, actions }: VersionHistoryProps) {
  // Bản bên phải; chỉ tích một bản thì chính bản ấy, nút phục hồi không tắt vô cớ (BUG-470).
  const reviewedVersionId = model.compare.rightVersionId ?? model.compare.leftVersionId;
  const reviewedRow = model.rows.find((row) => row.id === reviewedVersionId) ?? null;
  const [isLabelOpen, setIsLabelOpen] = useState(false);

  // Ô "Tầng" đứng trên mọi nhánh trả sớm (trừ `forbidden`): đổi tầng được cả khi tầng này rỗng/lỗi.
  // Rộng tới 672 (không phải 320): tên tầng dài 65 ký tự không bị cắt ở khổ rộng (BUG-455).
  const withFloorSelect = (content: ReactNode) => (
    <div className="flex h-full flex-col gap-3">
      {model.floorSelect !== null && (
        <div className="max-w-2xl px-4 pt-4">
          <Select
            label={model.floorSelect.label}
            options={model.floorSelect.options.map((option) => ({ label: option.label, value: option.id }))}
            value={model.floorSelect.selectedId}
            onChange={actions.selectFloor}
          />
        </div>
      )}
      {content}
    </div>
  );

  if (model.state === 'loading') {
    return withFloorSelect(
      <div className="flex h-full gap-4 p-4">
        <Skeleton preset="table-row" className="w-[360px]" />
        <Skeleton preset="property-panel" className="flex-1" />
      </div>,
    );
  }

  if (model.state === 'empty') {
    return withFloorSelect(
      <EmptyState
        icon={<History aria-hidden="true" />}
        title={model.emptyTitle}
        description="Phiên bản được lưu khi AI ghi kết quả và khi phục hồi một bản cũ."
      />,
    );
  }

  if (model.state === 'forbidden') {
    return (
      <EmptyState
        icon={<Lock aria-hidden="true" />}
        title="Không đủ quyền xem"
        description="Bạn không có quyền xem lịch sử phiên bản của bản vẽ này."
      />
    );
  }

  if (model.state === 'error') {
    // Có lối ra ngay trên cảnh báo (BUG-468) và lề 16 px như ô "Tầng" phía trên.
    return withFloorSelect(
      <div className="px-4">
        <InlineAlert
          level="violation"
          title="Không tải được lịch sử phiên bản"
          message={model.errorMessage ?? 'Đã có lỗi xảy ra.'}
          {...(actions.retryVersions !== undefined
            ? { action: { label: 'Thử lại', onClick: actions.retryVersions } }
            : {})}
        />
      </div>,
    );
  }

  return withFloorSelect(
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
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
            label="Phiên bản"
            options={model.rows.map((row) => ({ label: `${row.label} — ${row.description}`, value: row.id }))}
            {...(reviewedVersionId !== null ? { value: reviewedVersionId } : {})}
            onChange={actions.selectRightVersion}
          />
        ) : (
          <div className="flex w-[360px] shrink-0 flex-col border-r border-border-default">
            <VersionList
              groups={model.groups}
              onToggleCompareSelection={actions.toggleCompareSelection}
              onRetrySnapshot={actions.retrySnapshot}
            />
            {model.canLoadMoreVersions && (
              <Button variant="ghost" onClick={actions.loadMoreVersions}>
                Xem thêm phiên bản
              </Button>
            )}
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <VersionCompare model={model.compare} actions={actions} />
        </div>
      </div>

      {/* Dính đáy: diff dài thì trang cuộn, thanh phục hồi vẫn trong khung. Dưới `lg` ghi chú nằm trên
          nút (xếp chồng), nhóm nút xuống dòng thay vì đẩy trang cuộn ngang (BUG-437). */}
      <div className="sticky bottom-0 flex flex-col gap-3 border-t border-border-default bg-bg-app pt-3 lg:flex-row lg:items-center">
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-[13px] text-text-secondary">{model.restoreCaption}</p>
          {model.canRestore && reviewedVersionId === null && (
            <p className="text-[13px] text-text-tertiary">Chọn một phiên bản để phục hồi.</p>
          )}
          {!model.canRestore && model.restoreHiddenReason !== null && (
            <p className="flex items-center gap-1.5 text-[13px] text-text-tertiary">
              <AlertTriangle size={14} aria-hidden="true" />
              {model.restoreHiddenReason}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
          {/*
            R-69: `canExportVersion` sai ⇒ nút RỜI KHỎI DOM, không phải bị tắt. Xuất một
            phiên bản là điều hướng sang S-34 và khả năng ấy đúng bằng "nơi gọi có cấp
            `onExportVersion` Không" — không có thì nút này gọi vào chỗ trống.
          */}
          {model.canExportVersion && reviewedVersionId !== null && (
            <Button variant="ghost" onClick={() => actions.exportVersion(reviewedVersionId)}>
              Xuất phiên bản này
            </Button>
          )}
          {model.canTagVersion && reviewedRow !== null && (
            <Button variant="ghost" onClick={() => setIsLabelOpen(true)}>
              Gắn nhãn phiên bản này
            </Button>
          )}
          {model.canRestore && reviewedRow?.isCurrent !== true && (
            <Button
              variant="secondary"
              disabled={reviewedVersionId === null}
              onClick={() => {
                if (reviewedVersionId !== null) {
                  actions.requestRestore(reviewedVersionId);
                }
              }}
            >
              Phục hồi phiên bản này
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

      {reviewedRow !== null && (
        <VersionLabelDialog
          isOpen={isLabelOpen}
          versionLabel={reviewedRow.label}
          initialValue={reviewedRow.tagLabel ?? ''}
          onClose={() => setIsLabelOpen(false)}
          onSubmit={(label) => {
            setIsLabelOpen(false);
            actions.tagVersion(reviewedRow.id, label);
          }}
        />
      )}
    </div>,
  );
}
