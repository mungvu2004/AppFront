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
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Modal } from '@/components/overlay/Modal';
import { Breadcrumb } from '@/components/shell/Breadcrumb';
import { PageHead } from '@/components/shell/PageHead';
import { Section } from '@/components/shell/Section';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';

import { InlineSelect } from './InlineSelect';
import { VersionCompare, VersionPairSelects } from './VersionCompare';
import { VersionLabelDialog } from './VersionLabelDialog';
import { VersionList } from './VersionList';
import type { VersionHistoryProps } from './types';

export function VersionHistory({ model, actions, breadcrumb }: VersionHistoryProps) {
  // Bản bên phải; chỉ tích một bản thì chính bản ấy, nút phục hồi không tắt vô cớ (BUG-470).
  const reviewedVersionId = model.compare.rightVersionId ?? model.compare.leftVersionId;
  const rowOf = (id: string | null) => model.rows.find((row) => row.id === id) ?? null;
  const reviewedRow = rowOf(reviewedVersionId);
  const { entityTotals: totals, leftVersionId, rightVersionId } = model.compare;
  // G5-23: hai bản được tích mà bản bên phải là "Hiện tại" → phục hồi nhắm bản còn lại, nút không biến mất.
  const otherRow = reviewedVersionId === rightVersionId ? rowOf(leftVersionId) : null;
  const restoreRow =
    reviewedRow?.isCurrent === true && otherRow !== null && otherRow.isCurrent !== true && !otherRow.isMetadataOnly
      ? otherRow
      : reviewedRow;
  const restoreVersionId = restoreRow?.id ?? null;
  // G5-19: khi bản kia là "Hiện tại", vùng so sánh chính là bản xem trước của lượt phục hồi.
  const comparedWithCurrent = [leftVersionId, rightVersionId].some(
    (id) => id !== restoreVersionId && rowOf(id)?.isCurrent === true,
  );
  const restoreImpact =
    !comparedWithCurrent || restoreVersionId === null
      ? null
      : restoreVersionId === rightVersionId
        ? { added: totals.added, removed: totals.removed, changed: totals.changed }
        : { added: totals.removed, removed: totals.added, changed: totals.changed };
  const [isLabelOpen, setIsLabelOpen] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);
  const awaitingRestoreFocus = useRef(false);

  // E-014: sau khi xác nhận phục hồi, nút "Phục hồi phiên bản này" rời DOM kéo theo tiêu điểm về `body`;
  // đưa tiêu điểm sang một điều khiển của thanh chân màn (hoặc chính thanh) khi hộp xác nhận đã đóng.
  useEffect(() => {
    const footer = footerRef.current;
    const lost = document.activeElement === null || document.activeElement === document.body;

    if (awaitingRestoreFocus.current && !model.restoreConfirm.isOpen && lost && footer !== null) {
      awaitingRestoreFocus.current = false;
      (footer.querySelector<HTMLElement>('button') ?? footer).focus();
    }
  });

  // Tiêu đề trang (h1) ở mọi trạng thái, như các màn có h1 sẵn (BUG-454).
  // Ô "Tầng" đứng trên mọi nhánh trả sớm (trừ `forbidden`): đổi tầng được cả khi tầng này rỗng/lỗi.
  // Rộng tới 672 (không phải 320): tên tầng dài 65 ký tự không bị cắt ở khổ rộng (BUG-455).
  const loadMore = model.canLoadMoreVersions && (
    <Button variant="ghost" onClick={actions.loadMoreVersions}>
      Xem thêm phiên bản
    </Button>
  );

  // Ba câu của màn (bản Z S-37): làm gì (H1), trạng thái (chip + câu có số + đã lưu), tầng ở bên phải.
  // Mọi số trong câu trạng thái đọc từ `model.rows`/`versionCount` — cùng nguồn với danh sách.
  const floorName =
    model.floorSelect?.options.find((option) => option.id === model.floorSelect?.selectedId)?.label ?? null;
  const currentRow = model.rows.find((row) => row.isCurrent) ?? null;
  const newestRow = model.rows[0] ?? null;
  const status =
    model.state === 'empty' ? (
      <Badge variant="neutral">Chưa có phiên bản</Badge>
    ) : model.state === 'loading' || model.state === 'error' || model.state === 'forbidden' ? null : (
      <>
        {currentRow !== null && <Badge variant="verified">{`Đang dùng ${currentRow.label}`}</Badge>}
        {newestRow !== null && (
          <span className="tabular-nums">
            {`${String(model.versionCount)} phiên bản, mới nhất lúc ${newestRow.absoluteTimeLabel} do ${newestRow.authorName} tạo.`}
          </span>
        )}
        {model.savedAtLabel !== null && <span className="text-[13px] text-text-muted">{model.savedAtLabel}</span>}
      </>
    );

  const withHeader = (content: ReactNode) => (
    // Khổ hẹp: trang tự cao theo nội dung và khung cuộn của app cuộn nó (V1b vòng 1). Khổ rộng giữ
    // khung cố định, hai khung `Section` tự cuộn bên trong để nút phục hồi luôn trên màn.
    <div className={model.isNarrow ? 'flex min-h-full flex-col' : 'flex h-full flex-col'}>
      {breadcrumb === undefined ? null : (
        <div className="px-4 pt-4">
          <Breadcrumb items={breadcrumb} />
        </div>
      )}
      <div className={cn('mx-auto flex min-h-0 w-full max-w-[1344px] flex-1 flex-col px-4 pb-6 pt-6 xl:px-8', model.isNarrow && 'flex-none')}>
        <PageHead
          eyebrow={`${floorName === null ? '' : `${floorName} · `}Lịch sử phiên bản`}
          title={`So sánh và phục hồi phiên bản${floorName === null ? '' : ` của ${floorName}`}`}
          status={status}
          next={
            model.floorSelect !== null && model.state !== 'forbidden' ? (
              <InlineSelect
                label={model.floorSelect.label}
                prefix={model.floorSelect.label}
                options={model.floorSelect.options.map((option) => ({ label: option.label, value: option.id }))}
                value={model.floorSelect.selectedId}
                onChange={actions.selectFloor}
              />
            ) : undefined
          }
        />
        {content}
      </div>
    </div>
  );

  if (model.state === 'loading') {
    return withHeader(
      <div className="flex h-full gap-6">
        <Skeleton preset="table-row" className="w-[360px]" />
        <Skeleton preset="property-panel" className="flex-1" />
      </div>,
    );
  }

  if (model.state === 'empty') {
    return withHeader(
      <EmptyState
        icon={<History aria-hidden="true" />}
        title={model.emptyTitle}
        description="Phiên bản được lưu khi AI ghi kết quả và khi phục hồi một bản cũ."
      />,
    );
  }

  if (model.state === 'forbidden') {
    return withHeader(
      <EmptyState
        icon={<Lock aria-hidden="true" />}
        title="Không đủ quyền xem"
        description="Bạn không có quyền xem lịch sử phiên bản của bản vẽ này."
      />,
    );
  }

  if (model.state === 'error') {
    // Có lối ra ngay trên cảnh báo (BUG-468) và lề 16 px như ô "Tầng" phía trên.
    return withHeader(
      <div>
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

  // Tiêu đề khung so sánh nói đúng cặp đang so ("So sánh v4 với v5"); thiếu một bản thì chỉ "So sánh".
  const leftRow = rowOf(leftVersionId);
  const rightRow = rowOf(rightVersionId);
  const compareTitle =
    leftRow !== null && rightRow !== null ? `So sánh ${leftRow.label} với ${rightRow.label}` : 'So sánh';
  // Khung `Section` bọc thân trong một <div> trơn; lớp này cho thân ấy giãn hết khung và cuộn bên trong.
  // Chỉ thân khung (con cuối) giãn; đầu khung giữ 56 px (lỗi P1: `[&>div]` từng kéo giãn cả đầu khung).
  const fillBody =
    'flex min-h-0 flex-col [&>div:last-child]:flex [&>div:last-child]:min-h-0 [&>div:last-child]:flex-1 [&>div:last-child]:flex-col';

  return withHeader(
    <div className={model.isNarrow ? 'flex flex-1 flex-col gap-4' : 'flex min-h-0 flex-1 flex-col gap-4'}>
      {model.conflict !== null && (
        <InlineAlert
          level="violation"
          title={model.conflict.actorName}
          message={model.conflict.message}
          action={{ label: model.conflict.dismissLabel, onClick: actions.dismissConflict, variant: 'secondary' }}
        />
      )}

      <div className={model.isNarrow ? 'flex flex-1 flex-col gap-4' : 'flex min-h-0 flex-1 gap-6'}>
        {model.isNarrow ? (
          <Select
            label="Phiên bản"
            options={model.rows
              .filter((row) => !row.isMetadataOnly)
              .map((row) => ({ label: `${row.label} — ${row.description}`, value: row.id }))}
            {...(reviewedVersionId !== null ? { value: reviewedVersionId } : {})}
            onChange={actions.selectRightVersion}
          />
        ) : (
          <Section
            flush
            title="Phiên bản"
            actions={<span className="text-[13px] text-text-secondary">Tích hai bản để so</span>}
            className={cn('w-[360px] shrink-0', fillBody)}
          >
            {/* N3-03: luật "tối đa hai bản" phải nói ra, không để ô xám tự giải thích. */}
            <p className="sr-only">Tích hai phiên bản để so sánh. Đã đủ hai thì bỏ tích một bản để chọn bản khác.</p>
            <VersionList
              groups={model.groups}
              onToggleCompareSelection={actions.toggleCompareSelection}
              onRetrySnapshot={actions.retrySnapshot}
            />
            {loadMore}
          </Section>
        )}
        {model.isNarrow && loadMore}

        {/* Khổ hẹp: khung so sánh cao 70% màn (≥ 60%, V1b vòng 1); bên trong vẫn tự cuộn như khổ rộng. */}
        <Section
          flush
          title={<span className="sr-only xl:not-sr-only">{compareTitle}</span>}
          actions={<VersionPairSelects model={model.compare} actions={actions} />}
          className={cn('min-w-0 overflow-hidden', fillBody, model.isNarrow ? 'h-[70vh] min-h-[420px] flex-none' : 'flex-1')}
        >
          <div className="flex min-h-0 flex-1 flex-col px-5 pt-4">
            <VersionCompare model={model.compare} actions={actions} />
          </div>

          {/* Chân khung so sánh: câu "không xoá gì" sát nút phục hồi, luôn trong khung (vùng so sánh tự cuộn).
              Dưới `lg` ghi chú nằm trên nút, nhóm nút xuống dòng thay vì đẩy trang cuộn ngang (BUG-437). */}
          <div ref={footerRef} tabIndex={-1} data-sticky-footer="" className="flex flex-col gap-3 border-t border-border-default px-5 py-4 lg:flex-row lg:items-center">
            <div className="flex flex-1 flex-col gap-1">
              <p className="text-[13px] text-text-secondary">{model.restoreCaption}</p>
              {reviewedRow !== null && restoreRow !== null && restoreRow.id !== reviewedRow.id && (
                <p className="text-[13px] tabular-nums text-text-primary">
                  {`Gắn nhãn và xuất áp dụng cho ${reviewedRow.label}, phục hồi về ${restoreRow.label}.`}
                </p>
              )}
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
              {/* R-69: không có `onExportVersion` ⇒ nút RỜI KHỎI DOM, không bị tắt. */}
              {model.canTagVersion && reviewedRow !== null && (
                <Button variant="ghost" onClick={() => setIsLabelOpen(true)}>
                  {`Gắn nhãn ${reviewedRow.label}`}
                </Button>
              )}
              {model.canExportVersion && reviewedVersionId !== null && (
                <Button variant="ghost" onClick={() => actions.exportVersion(reviewedVersionId)}>
                  {reviewedRow === null ? 'Xuất phiên bản này' : `Xuất ${reviewedRow.label}`}
                </Button>
              )}
              {model.canRestore && restoreRow?.isCurrent !== true && restoreRow?.isMetadataOnly !== true && (
                <Button
                  variant="secondary"
                  disabled={restoreVersionId === null}
                  onClick={() => {
                    if (restoreVersionId !== null) {
                      actions.requestRestore(restoreVersionId);
                    }
                  }}
                >
                  {restoreRow === null ? 'Phục hồi phiên bản này' : `Phục hồi về ${restoreRow.label}`}
                </Button>
              )}
            </div>
          </div>
        </Section>
      </div>

      <Modal.Root isOpen={model.restoreConfirm.isOpen} onClose={actions.cancelRestore} width={480}>
        <Modal.Header>{model.restoreConfirm.title}</Modal.Header>
        <Modal.Body className="flex flex-col gap-2 pb-6">
          <p>{model.restoreConfirm.reassurance}</p>
          {model.restoreConfirm.targetVersionLabel !== null && (
            <p className="tabular-nums text-text-secondary">{model.restoreConfirm.targetVersionLabel}</p>
          )}
          {restoreImpact === null ? (
            <p className="text-[13px] text-text-secondary">
              Chưa xem trước thay đổi: tích thêm bản "Hiện tại" để so sánh trước khi phục hồi.
            </p>
          ) : (
            <p className="flex items-center gap-1.5 tabular-nums text-text-primary">
              {restoreImpact.removed > 0 && <AlertTriangle size={14} aria-hidden="true" />}
              {`So với hiện tại: thêm ${String(restoreImpact.added)}, xoá ${String(restoreImpact.removed)}, sửa ${String(restoreImpact.changed)} đối tượng.`}
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={actions.cancelRestore}>
            {model.restoreConfirm.cancelLabel}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              awaitingRestoreFocus.current = true;
              actions.confirmRestore();
            }}
          >
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
