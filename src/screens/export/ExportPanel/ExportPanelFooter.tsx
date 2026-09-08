/**
 * Chân trang — nút "Xuất" bình thường, hoặc thanh tiến độ THẬT tại chỗ khi
 * `progress !== null`.
 *
 * Không phải overlay chặn màn: đặc tả cấm tuyệt đối chặn giao diện khi xuất,
 * nên tiến độ hiện ngay trong chân trang chứ không phải hộp thoại modal
 * (`ProgressOverlay` có `aria-modal="true"`, không dùng ở đây vì lý do đó).
 * `progress.ratio` là số thật từ worker — không nội suy, không đoán.
 */

import { Button } from '@/components/ui/Button';

import type { ExportProgressView } from './types';

export interface ExportPanelFooterProps {
  readonly progress: ExportProgressView | null;
  readonly destinationCaption: string;
  readonly onExport: () => void;
  readonly onCancel: () => void;
}

export function ExportPanelFooter({ progress, destinationCaption, onExport, onCancel }: ExportPanelFooterProps) {
  if (progress !== null) {
    return (
      <footer className="sticky bottom-0 flex flex-col gap-2 border-t border-border-default bg-bg-surface px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-sm font-medium text-text-primary">{progress.stepLabel}</p>
            <p className="text-xs text-text-secondary">{progress.countLabel}</p>
          </div>
          <Button variant="secondary" onClick={onCancel}>
            huỷ
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
    <footer className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-border-default bg-bg-surface px-6 py-4">
      <p className="text-sm text-text-secondary">{destinationCaption}</p>
      <Button variant="primary" onClick={onExport}>
        xuất
      </Button>
    </footer>
  );
}
