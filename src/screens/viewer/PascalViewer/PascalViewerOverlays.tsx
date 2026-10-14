/**
 * Các mảnh nạp lười và hộp thoại của `PascalViewer.container` — tách ra để
 * container nằm dưới trần R-22. Không mảnh nào chạm store hay mạng: state ở
 * container, ở đây chỉ dựng.
 */

import { AlertCircle } from 'lucide-react';
import { lazy, Suspense } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import type { HistoryStack } from '@/lib/commands/history';

import type { PascalMassDeleteRequest } from './usePascalEdits';

/*
 * Bảng lịch sử nạp muộn, và đó là một phép đo chứ không phải thói quen: ngân
 * sách `routeChunk` là 280 KiB, `HistoryPanel` là ~4 000 dòng, còn bảng chỉ
 * dựng khi người dùng mở nó. Nhập tĩnh là bắt mọi lượt mở `/3d` trả tiền cho
 * một bảng phần lớn phiên không ai bấm tới.
 */
const LazyHistoryPanel = lazy(() =>
  import('@/screens/viewer/HistoryPanel').then((module) => ({
    default: module.HistoryPanelContainer,
  })),
);

/* Hộp thoại A9 của 409 khi còn sửa chưa lưu — cùng hộp màn QC, nạp lười như ở đó
   (`Modal` chỉ cần khi có xung đột, không phải mỗi lượt mở `/3d`). */
export const LazyFloorLayerSaveConfirm = lazy(() => import('@/screens/qc/WallLayerReview/FloorLayerSaveConfirm'));

/* Hộp xác nhận xoá hàng loạt (A9, 23-A-026) — nạp lười cùng lý do trên. */
const LazyModal = lazy(() => import('@/components/overlay/Modal').then((module) => ({ default: module.Modal })));

/** Tiêu đề hộp xác nhận xoá hàng loạt; lý do của cổng đi vào thân hộp. */
export const PASCAL_MASS_DELETE_TITLE = 'Xoá nhiều đối tượng khỏi tầng?';

/** Thứ người dùng thấy thay cho màn đã sập. Chữ lấy thẳng từ `report.description`. */
export function CrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="flex h-full items-center justify-center bg-bg-app">
      <EmptyState
        icon={<AlertCircle aria-hidden="true" />}
        title={report.description.title}
        description={report.description.description}
        {...(report.retryable
          ? { action: { label: report.description.primaryButtonLabel, onClick: retry } }
          : {})}
      />
    </div>
  );
}

/** Cột bảng "Lịch sử thao tác" — nạp lười, có ranh giới lỗi riêng. */
export function PascalHistoryPanelSlot({ history }: { readonly history: HistoryStack }) {
  return (
    /* Ranh giới riêng của cột bảng (23H-B-011): chunk bảng tải hỏng thì chỉ
       cột này báo lỗi, màn 3D và khung dựng vẫn đứng. */
    <ScreenErrorBoundary
      renderFallback={(fallback) => <CrashFallback {...fallback} />}
      screenId="pascal-viewer.history-panel"
    >
      <Suspense fallback={<p className="p-3 text-sm text-text-muted">Đang mở bảng…</p>}>
        {/* Vỏ `panel` cố định: vùng bảng của `PascalViewer` tự làm tấm trượt dưới
            `lg`, nên vỏ `sheet` riêng của bảng sẽ thoát khỏi vùng ấy (23H-F-002). */}
        <LazyHistoryPanel history={history} layout="panel" />
      </Suspense>
    </ScreenErrorBoundary>
  );
}

export interface PascalMassDeleteDialogProps {
  readonly request: PascalMassDeleteRequest;
  readonly onClose: () => void;
  readonly onConfirm: (nodeIds: PascalMassDeleteRequest['nodeIds']) => void;
}

/** Hộp xác nhận lượt xoá hàng loạt cổng vừa chặn (23-A-026). */
export function PascalMassDeleteDialog({ request, onClose, onConfirm }: PascalMassDeleteDialogProps) {
  return (
    <Suspense fallback={null}>
      <LazyModal
        isOpen
        onClose={onClose}
        primaryAction={{ label: 'Xoá', onClick: () => onConfirm(request.nodeIds) }}
        secondaryAction={{ label: 'Huỷ', onClick: onClose }}
        title={PASCAL_MASS_DELETE_TITLE}
      >
        <p>{request.reason}</p>
        <p className="mt-2">Bấm "Xoá" để xoá thật; hoàn tác được bằng Ctrl+Z.</p>
      </LazyModal>
    </Suspense>
  );
}
