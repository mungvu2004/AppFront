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
  /** Nhãn nút chính, nói rõ định dạng: "Xuất .glb", "Xuất .json". */
  readonly exportLabel?: string;
  /** Vì sao nút "Xuất" đang mờ (định dạng chưa xuất được), `null` khi không có lý do riêng. */
  readonly blockedReason?: string | null;
  readonly destinationCaption: string;
  /** Mô hình còn đang tải: chưa có gì để xuất (30-C-028). */
  readonly isLoading?: boolean;
  readonly onExport: () => void;
  readonly onCancel: () => void;
  readonly onBackToProject?: () => void;
}

export function ExportPanelFooter({
  progress,
  canExportSelected,
  exportLabel = 'Xuất',
  blockedReason = null,
  destinationCaption,
  isLoading = false,
  onExport,
  onCancel,
  onBackToProject,
}: ExportPanelFooterProps) {
  const footerRef = useRef<HTMLElement>(null);
  const isRunning = progress !== null;
  // So với lần trước thay vì cờ "lần đầu": StrictMode chạy effect hai lần lúc mount,
  // cờ cũ để lần hai cướp focus vào nút phụ "Về dự án" ngay khi mở màn.
  const wasRunning = useRef(isRunning);

  // Nút vừa bấm bị thay bằng nút khác khi chân trang đổi: nếu focus rơi về
  // `<body>` thì đưa nó sang nút mới (30-E-013).
  useEffect(() => {
    if (wasRunning.current === isRunning) {
      return;
    }

    wasRunning.current = isRunning;

    const active = document.activeElement;

    if (active === null || active === document.body) {
      footerRef.current?.querySelector('button')?.focus();
    }
  }, [isRunning]);

  if (progress !== null) {
    return (
      <footer ref={footerRef} data-sticky-footer="" className="sticky bottom-0 flex flex-col gap-2 border-t border-border-default bg-bg-surface p-4 sm:px-6 xl:px-[max(2rem,calc((100%_-_1280px)/2))]">
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
            className="h-full w-full origin-left rounded-full bg-accent transition-transform duration-standard"
            style={{ transform: `scaleX(${String(progress.ratio)})` }}
          />
        </div>
      </footer>
    );
  }

  return (
    <footer ref={footerRef} data-sticky-footer="" className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-border-default bg-bg-surface p-4 sm:px-6 xl:px-[max(2rem,calc((100%_-_1280px)/2))]">
      {/* Nút chính tắt thì câu bên cạnh nói vì sao (không nút chết). */}
      <p className="text-sm text-text-secondary">{canExportSelected ? destinationCaption : (blockedReason ?? destinationCaption)}</p>
      <div className="flex shrink-0 items-center gap-2">
        {onBackToProject !== undefined && (
          <Button variant="secondary" onClick={onBackToProject}>
            Về dự án
          </Button>
        )}
        {/* Nút luôn có mặt: mờ khi định dạng chưa xuất được, để người dùng thấy lý do thay vì tưởng nút hỏng.
            `data-tour-anchor`: móc neo cho lớp dạy việc (`screens/system/EditorTour`). */}
        <Button data-tour-anchor="exportResult" variant="primary" disabled={isLoading || !canExportSelected} onClick={onExport}>
          {exportLabel}
        </Button>
      </div>
    </footer>
  );
}
