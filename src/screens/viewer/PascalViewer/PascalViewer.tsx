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
  PASCAL_NEXT_LABEL,
  PASCAL_REPROCESS_LABEL,
  PASCAL_SAVE_RELOAD_LABEL,
  PASCAL_SIDE_PANEL_RAIL_LABEL,
  PASCAL_VIEWER_TITLE,
  type PascalSidePanel,
  type PascalSidePanelId,
  type PascalViewerProps,
} from './pascalViewerTypes';

/**
 * Khung chứa, dùng chung cho cả bảy nhánh để không nhánh nào lạc ra ngoài bố cục.
 *
 * Màn chiếm trọn khung nhìn: một thanh mảnh 48 px trên cùng (lối ra BUG-487, số
 * liệu tóm tắt, khe hiện diện, nút bảng phụ, nút sang bước kế), phần còn lại cho
 * khung dựng. Tiêu đề và dòng trạng thái chỉ còn cho trình đọc màn hình
 * (`sr-only`), vẫn là `h2` và `role="status"`.
 */
function Frame({
  barCenter,
  barEnd,
  caption,
  children,
  headerSlotRef,
  onLeave,
  onNext,
}: {
  barCenter?: React.ReactNode;
  barEnd?: React.ReactNode;
  caption: string;
  children: React.ReactNode;
  headerSlotRef?: React.Ref<HTMLDivElement> | undefined;
  onLeave?: (() => void) | undefined;
  onNext?: (() => void) | undefined;
}) {
  return (
    <section aria-label={PASCAL_VIEWER_TITLE} className="flex h-full min-h-96 flex-col bg-bg-app">
      <h2 className="sr-only">{PASCAL_VIEWER_TITLE}</h2>
      <p className="sr-only" role="status">
        {caption}
      </p>
      <div
        className="flex h-12 shrink-0 items-center gap-3 border-b border-border-default bg-bg-surface px-3"
        data-testid="pascal-top-bar"
      >
        {onLeave !== undefined && (
          <Button onClick={onLeave} size="sm" variant="ghost">
            <span aria-hidden="true">←</span> {PASCAL_LEAVE_LABEL}
          </Button>
        )}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
          {barCenter}
          {/* Khe thanh hiện diện: nằm trên thanh chứ không nổi trên canvas (23R-F-002). */}
          {headerSlotRef !== undefined && (
            <div ref={headerSlotRef} className="flex" data-testid="pascal-header-slot" />
          )}
        </div>
        {barEnd}
        {onNext !== undefined && (
          <Button onClick={onNext} size="sm" variant="primary">
            {PASCAL_NEXT_LABEL}
          </Button>
        )}
      </div>
      <div className="relative min-h-0 flex-1">{children}</div>
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
 * Nút bảng phụ trên thanh trên cùng (#45).
 *
 * Loại trừ nhau là **cấu tạo**, không phải quy ước: `activePanel` là một giá
 * trị, nên hai bảng cùng mở không biểu diễn được.
 */
function SidePanelRail({
  panels,
  activePanel,
  onPanelChange,
}: {
  panels: readonly PascalSidePanel[];
  activePanel: PascalSidePanelId | null;
  onPanelChange: (panel: PascalSidePanelId | null) => void;
}) {
  return (
    <div aria-label={PASCAL_SIDE_PANEL_RAIL_LABEL} className="flex gap-1" role="group">
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
  );
}

/**
 * Bảng đang mở: phủ lên mép phải khung dựng, rộng 344 px, không bóp thanh trên
 * cũng không bóp khung dựng. Dưới `lg` (1024, cùng ngưỡng vỏ `sheet` của
 * `HistoryPanel`) nó là tấm trượt đáy cố định, rộng hết màn (23-F-007, 23H-F-002).
 * Vùng là cột flex để bảng con (`min-h-0`) co vừa và tự cuộn bên trong; hoạt cảnh
 * bị `motion-reduce` tắt (#33).
 */
function SidePanelRegion({ panel }: { panel: PascalSidePanel }) {
  return (
    <div
      aria-label={panel.label}
      className={
        'fixed inset-x-0 bottom-0 z-10 flex max-h-[70vh] w-full flex-col overflow-y-auto rounded-t-2xl ' +
        'border-t border-border-default bg-bg-surface shadow-overlay ' +
        'lg:absolute lg:inset-x-auto lg:inset-y-0 lg:right-0 lg:max-h-none lg:w-[344px] lg:rounded-none ' +
        'lg:border-l lg:border-t-0 transition-[width] duration-standard motion-reduce:transition-none'
      }
      role="region"
    >
      {panel.render()}
    </div>
  );
}

export function PascalViewer({
  viewModel,
  canvasRef,
  onRetry,
  onExpand,
  onLeave,
  onNext,
  onReprocess,
  panels,
  activePanel,
  onPanelChange,
  sceneOverlay,
  headerSlotRef,
  onSaveReload,
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

  const openPanel = panels?.find((panel) => panel.id === activePanel) ?? null;

  return (
    <Frame
      barCenter={
        summary !== null && (
          <dl className="flex items-center gap-1.5 truncate text-sm text-text-muted">
            <dt className="sr-only">Tầng</dt>
            <dd className="font-medium text-text-primary">{summary.levelLabel} tầng</dd>
            <dt className="sr-only">Tường</dt>
            <dd>· {summary.wallLabel} tường</dd>
            <dt className="sr-only">Ô mở</dt>
            <dd>· {summary.openingLabel} ô mở</dd>
            <dt className="sr-only">Phòng</dt>
            <dd>· {summary.roomLabel} phòng</dd>
          </dl>
        )
      }
      barEnd={
        panels !== undefined &&
        panels.length > 0 && (
          <SidePanelRail
            activePanel={activePanel ?? null}
            onPanelChange={onPanelChange ?? (() => undefined)}
            panels={panels}
          />
        )
      }
      caption={caption}
      headerSlotRef={headerSlotRef}
      onLeave={onLeave}
      onNext={onNext}
    >
      {/* `contain:layout`: hộp `fixed` của Pascal neo vào khung này; `container-type:size`: `cqh`/`cqw` trong vendor đo khung chứ không đo viewport. */}
      <div
        ref={canvasRef}
        data-testid="pascal-canvas"
        aria-label="Khung dựng mô hình 3D"
        className="absolute inset-0 overflow-hidden bg-bg-sunken [contain:layout] [container-type:size]"
      />
      {sceneOverlay}
      {isBooting && (
        <div className="absolute inset-0">
          <Skeleton />
        </div>
      )}
      {openPanel !== null && <SidePanelRegion panel={openPanel} />}

      {/* A7 — không có nút lưu, nên dòng này là chỗ duy nhất nói ra việc lưu; nổi ở góc dưới trái khung dựng. */}
      {(saveLabel !== null || onSaveReload !== undefined || skipped.length > 0) && (
        <div className="absolute bottom-3 left-3 flex max-w-md flex-col items-start gap-2">
          {saveLabel !== null && (
            <p aria-live="polite" className="rounded-md bg-bg-surface px-2 py-1 text-sm text-text-muted" role="status">
              {saveLabel}
            </p>
          )}
          {/* Anh em của câu lưu, không nằm trong nó: câu giữ đúng chữ cho trình đọc màn hình. */}
          {onSaveReload !== undefined && (
            <Button onClick={onSaveReload} size="sm" variant="secondary">
              {PASCAL_SAVE_RELOAD_LABEL}
            </Button>
          )}
          {skipped.length > 0 && (
            <div className="rounded-md border border-border-default bg-bg-surface p-3">
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
      )}
    </Frame>
  );
}
