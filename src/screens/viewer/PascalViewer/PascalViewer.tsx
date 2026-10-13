/**
 * Màn xem 3D dựng bằng Pascal — phần view, thuần.
 *
 * Không chạm store, không chạm mạng, không nhập `@pascal-app/*`. Mọi thứ nó
 * cần nằm trong `props.viewModel`, nên bài kiểm bảy trạng thái dựng được cả
 * bảy mà không cần WebGL — và đó là điểm của mục D.
 *
 * Luật riêng của màn này: **cả bảy nhánh đều trả về một cây có nội dung.**
 * Pascal thì không như vậy — `viewer/src/components/viewer/render-error.tsx:29-45`
 * dựng `fallback={null}`, tức lỗi render ra màn trắng thật. Đó chính là thất
 * bại duy nhất mà A11 tồn tại để chặn, nên khung nhúng nằm dưới nhánh
 * `success`/`partial` và không bao giờ là thứ duy nhất trên màn.
 */

import { AlertTriangle, Box, EyeOff, Lock, MonitorOff } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';

import {
  PASCAL_LEAVE_LABEL,
  PASCAL_REPROCESS_LABEL,
  PASCAL_SIDE_PANEL_RAIL_LABEL,
  PASCAL_VIEWER_TITLE,
  type PascalSidePanel,
  type PascalSidePanelId,
  type PascalViewerProps,
} from './pascalViewerTypes';

/**
 * Khung chứa, dùng chung cho cả bảy nhánh để không nhánh nào lạc ra ngoài bố cục.
 *
 * Đầu màn có tiêu đề và lối ra (BUG-487). Dòng trạng thái chỉ HIỆN khi có khung
 * dựng (`showCaption`); ở các nhánh `EmptyState` nó lặp đúng ý của khối giữa
 * trang nên chỉ còn cho trình đọc màn hình (`sr-only`), vẫn là `role="status"`.
 */
function Frame({
  caption,
  children,
  onLeave,
  showCaption = false,
}: {
  caption: string;
  children: React.ReactNode;
  onLeave?: (() => void) | undefined;
  showCaption?: boolean;
}) {
  return (
    <section
      aria-label={PASCAL_VIEWER_TITLE}
      className="flex h-full min-h-[24rem] flex-col gap-3 bg-bg-app p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold text-text-primary">{PASCAL_VIEWER_TITLE}</h2>
        {onLeave !== undefined && (
          <Button onClick={onLeave} size="sm" variant="secondary">
            {PASCAL_LEAVE_LABEL}
          </Button>
        )}
      </div>
      <p className={showCaption ? 'text-sm text-text-muted' : 'sr-only'} role="status">
        {caption}
      </p>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

/** Khối khung xương lúc nạp: hộp rỗng có nhịp thở, không chữ. */
function Skeleton() {
  return (
    <div
      aria-hidden="true"
      className="h-full w-full animate-pulse rounded-md motion-reduce:animate-none bg-border-default"
    />
  );
}

/**
 * Cột bảng phụ: hàng tab trên, bảng đang mở dưới (#45).
 *
 * Loại trừ nhau là **cấu tạo**, không phải quy ước: `activePanel` là một giá
 * trị, nên hai bảng cùng mở không biểu diễn được. Bề ngang 344 px cố định;
 * chỉ cột trượt vào trượt ra có hoạt cảnh, và `motion-reduce` tắt nó (#33).
 */
function SidePanelColumn({
  panels,
  activePanel,
  onPanelChange,
}: {
  panels: readonly PascalSidePanel[];
  activePanel: PascalSidePanelId | null;
  onPanelChange: (panel: PascalSidePanelId | null) => void;
}) {
  const open = panels.find((panel) => panel.id === activePanel) ?? null;

  return (
    <div className="flex min-h-0 gap-2">
      <div
        aria-label={PASCAL_SIDE_PANEL_RAIL_LABEL}
        className="flex flex-col gap-1"
        role="group"
      >
        {panels.map((panel) => {
          const isOpen = panel.id === activePanel;
          return (
            <Button
              key={panel.id}
              aria-expanded={isOpen}
              onClick={() => onPanelChange(isOpen ? null : panel.id)}
              size="sm"
              variant={isOpen ? 'primary' : 'secondary'}
            >
              {panel.label}
            </Button>
          );
        })}
      </div>

      {open !== null && (
        <div
          aria-label={open.label}
          className="min-h-0 w-[344px] shrink-0 overflow-y-auto rounded-md border border-border-default bg-bg-surface transition-[width] duration-standard motion-reduce:transition-none"
          role="region"
        >
          {open.render()}
        </div>
      )}
    </div>
  );
}

export function PascalViewer({
  viewModel,
  canvasRef,
  onRetry,
  onExpand,
  onLeave,
  onReprocess,
  panels,
  activePanel,
  onPanelChange,
  sceneOverlay,
}: PascalViewerProps) {
  const { state, caption, summary, skipped, errorCode, saveLabel } = viewModel;

  if (state === 'forbidden') {
    return (
      <Frame caption={caption} onLeave={onLeave}>
        <EmptyState
          icon={<Lock aria-hidden="true" />}
          title="Chưa bật cho tài khoản này"
          description="Vai của bạn chưa được xem mô hình 3D của dự án này. Người quản trị dự án có thể mở quyền."
        />
      </Frame>
    );
  }

  if (state === 'empty') {
    return (
      <Frame caption={caption} onLeave={onLeave}>
        <EmptyState
          icon={<Box aria-hidden="true" />}
          title="Chưa có gì để dựng"
          description="Bản vẽ này chưa có tường, phòng hay ô mở nào. Dò lại bản vẽ rồi quay lại đây."
          {...(onReprocess === undefined
            ? {}
            : { action: { label: PASCAL_REPROCESS_LABEL, onClick: onReprocess } })}
        />
      </Frame>
    );
  }

  /*
   * Máy không dựng được 3D: cùng trạng thái `error`, **khác hẳn đường đi tiếp**.
   *
   * Không có nút "thử lại" ở nhánh này, và đó là chủ ý: thử lại bao nhiêu lần
   * thì máy vẫn không có tăng tốc phần cứng, nên một cái nút ở đây là một lời
   * nói dối đội lốt lối thoát. Việc phải làm nằm ngoài trang, nên màn nói ra
   * việc ấy thay vì bày một cái nút.
   *
   * Nhánh này tồn tại vì Pascal có sẵn thẻ dự phòng của riêng nó — chữ tiếng
   * Anh, màu viết cứng — và `onRendererUnavailable` tắt thẻ ấy đi để màn chủ
   * nói bằng tiếng của mình.
   */
  if (state === 'error' && errorCode === 'PASCAL-03') {
    return (
      <Frame caption={caption} onLeave={onLeave}>
        <EmptyState
          icon={<MonitorOff aria-hidden="true" />}
          title="Máy này chưa dựng được mô hình 3D"
          description={
            'Trình duyệt không bật được tăng tốc phần cứng, nên không có gì vẽ ' +
            'ra hình được. Bật tăng tốc phần cứng trong cài đặt trình duyệt rồi ' +
            'tải lại trang; nếu vẫn vậy thì mở bằng máy khác. Mã PASCAL-03.'
          }
        />
      </Frame>
    );
  }

  if (state === 'error') {
    return (
      <Frame caption={caption} onLeave={onLeave}>
        <EmptyState
          icon={<AlertTriangle aria-hidden="true" />}
          title="Không nạp được khung dựng hình"
          description={
            errorCode === null
              ? 'Thử lại một lần; nếu vẫn vậy thì báo người trực.'
              : `Thử lại một lần; nếu vẫn vậy thì báo người trực kèm mã ${errorCode}.`
          }
          action={{ label: 'Thử lại', onClick: onRetry }}
        />
      </Frame>
    );
  }

  if (state === 'collapsed') {
    return (
      <Frame caption={caption} onLeave={onLeave}>
        <EmptyState
          icon={<EyeOff aria-hidden="true" />}
          title="Khung xem đang thu gọn"
          description="Mô hình 3D không chạy khi thu gọn, để đỡ tốn máy."
          action={{ label: 'Mở khung xem', onClick: onExpand }}
        />
      </Frame>
    );
  }

  /*
   * `loading`, `success` và `partial` — cả ba đều dựng hộp cho Pascal cắm vào.
   *
   * **`loading` PHẢI có hộp, và đây là chỗ từng có một vòng chết.** Bản đầu chỉ
   * dựng hộp ở `success`/`partial`, nên: hook cần `canvasRef.current` mới nạp
   * gói → nhưng muốn tới `success` thì phải nạp xong → mà hộp chưa có nên hook
   * không bao giờ nạp. Màn kẹt ở `loading` vĩnh viễn, và không request nào tới
   * `/assets/pascal/pascal-mount.js` được gửi đi.
   *
   * Bốn mươi mốt bài kiểm đơn vị KHÔNG bắt được, vì bộ dựng thử của hook gắn ref
   * vào một `div` vô điều kiện — đi vòng qua đúng nhánh điều kiện này. Bài e2e
   * `e2e/pascal-viewer.spec.ts` là thứ đầu tiên chạy qua cây component thật.
   *
   * Đừng "dọn" nhánh `loading` khỏi đây.
   */
  const isBooting = state === 'loading';

  return (
    <Frame caption={caption} onLeave={onLeave} showCaption>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex min-h-0 flex-1 gap-3">
          <div className="relative min-h-[12rem] min-w-0 flex-1">
            <div
              ref={canvasRef}
              data-testid="pascal-canvas"
              aria-label="Khung dựng mô hình 3D"
              className="absolute inset-0 overflow-hidden rounded-md border border-border-default bg-bg-sunken"
            />
            {sceneOverlay}
            {isBooting && (
              <div className="absolute inset-0">
                <Skeleton />
              </div>
            )}
          </div>

          {panels !== undefined && panels.length > 0 && (
            <SidePanelColumn
              activePanel={activePanel ?? null}
              onPanelChange={onPanelChange ?? (() => undefined)}
              panels={panels}
            />
          )}
        </div>

        {/* A7 — không có nút lưu, nên dòng này là chỗ duy nhất nói ra việc lưu. */}
        {saveLabel !== null && (
          <p aria-live="polite" className="text-sm text-text-muted" role="status">
            {saveLabel}
          </p>
        )}

        {summary !== null && (
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-text-muted">
            <div className="flex gap-1.5">
              <dt>Tầng</dt>
              <dd className="font-medium text-text-primary">{summary.levelLabel}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Tường</dt>
              <dd className="font-medium text-text-primary">{summary.wallLabel}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Ô mở</dt>
              <dd className="font-medium text-text-primary">{summary.openingLabel}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Phòng</dt>
              <dd className="font-medium text-text-primary">{summary.roomLabel}</dd>
            </div>
          </dl>
        )}

        {skipped.length > 0 && (
          <div className="rounded-md border border-border-default bg-bg-sunken p-3">
            <p className="text-sm font-medium text-text-primary">Chưa chuyển sang được</p>
            <ul className="mt-2 flex flex-col gap-1">
              {skipped.map((item) => (
                <li key={item.kind} className="text-sm text-text-muted">
                  <span className="font-medium text-text-primary">
                    {item.countLabel} {item.kind}
                  </span>{' '}
                  — {item.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Frame>
  );
}
