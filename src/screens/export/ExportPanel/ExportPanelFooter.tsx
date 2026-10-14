/**
 * Chân trang — nút "Xuất" bình thường, hoặc thanh tiến độ THẬT tại chỗ khi
 * `progress !== null`.
 *
 * Không phải overlay chặn màn: đặc tả cấm tuyệt đối chặn giao diện khi xuất,
 * nên tiến độ hiện ngay trong chân trang chứ không phải hộp thoại modal
 * (`ProgressOverlay` có `aria-modal="true"`, không dùng ở đây vì lý do đó).
 * `progress.ratio` là số thật từ worker — không nội suy, không đoán.
 */

import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/Button';

import type { ExportProgressView } from './types';

export interface ExportPanelFooterProps {
  readonly progress: ExportProgressView | null;
  /** Định dạng đang chọn có sinh ra được một tệp thật không. */
  readonly canExportSelected: boolean;
  readonly destinationCaption: string;
  /** Mô hình còn đang tải: chưa có gì để xuất (30-C-028). */
  readonly isLoading?: boolean;
  readonly onExport: () => void;
  readonly onCancel: () => void;
}

export function ExportPanelFooter({
  progress,
  canExportSelected,
  destinationCaption,
  isLoading = false,
  onExport,
  onCancel,
}: ExportPanelFooterProps) {
  const footerRef = useRef<HTMLElement>(null);
  const isRunning = progress !== null;
  const isFirstRender = useRef(true);

  // Nút vừa bấm bị thay bằng nút khác khi chân trang đổi: nếu focus rơi về
  // `<body>` thì đưa nó sang nút mới (30-E-013).
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const active = document.activeElement;

    if (active === null || active === document.body) {
      footerRef.current?.querySelector('button')?.focus();
    }
  }, [isRunning]);

  if (progress !== null) {
    return (
      <footer ref={footerRef} data-sticky-footer="" className="sticky bottom-0 flex flex-col gap-2 border-t border-border-default bg-bg-surface p-4 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-sm font-medium text-text-primary">{progress.stepLabel}</p>
            <p className="text-xs text-text-secondary">{progress.countLabel}</p>
          </div>
          <Button variant="secondary" onClick={onCancel}>
            Huỷ
          </Button>
        </div>

        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={progress.ratio}
          aria-label={progress.stepLabel}
          className="h-2 w-full overflow-hidden rounded-full bg-bg-sunken"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-standard"
            style={{ width: `${progress.ratio * 100}%` }}
          />
        </div>
      </footer>
    );
  }

  return (
    <footer ref={footerRef} data-sticky-footer="" className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-border-default bg-bg-surface p-4 sm:px-6">
      <p className="text-sm text-text-secondary">{destinationCaption}</p>
      {canExportSelected && (
        // `data-tour-anchor`: móc neo cho lớp dạy việc (`screens/system/EditorTour`).
        // Nút này không có `aria-label`/`id` nào ổn định để bám, và tên khẳng định
        // của nó là chính chữ hiện trên nút — thứ `querySelector` không chọn được.
        <Button data-tour-anchor="exportResult" variant="primary" disabled={isLoading} onClick={onExport}>
          Xuất
        </Button>
      )}
    </footer>
  );
}
