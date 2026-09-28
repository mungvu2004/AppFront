/**
 * Nối hook vào view. Đây là chỗ DUY NHẤT của màn biết cả hai nửa tồn tại.
 *
 * `ScreenErrorBoundary` bọc ở đây và bắt được lỗi của **cây này**. Lỗi ở
 * **gốc React thứ hai** của Pascal thì nó KHÔNG với tới — đường báo cho chúng
 * là `onFatal` trong `usePascalViewer`, đẩy màn sang trạng thái `error`. Hai
 * đường khác nhau cho hai loại lỗi khác nhau, và đó là hệ quả bắt buộc của
 * việc Pascal dựng gốc riêng.
 *
 * `key` đổi theo bản vẽ để ranh giới gắn lại mỗi lần đổi bản vẽ — cùng khuôn
 * `src/App.tsx` dùng.
 */

import { useMemo } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { denormalizeSpatial } from '@/domain/spatial/normalize';
import type { SpatialGraph } from '@/domain/spatial/types';
import { useStore } from '@/store';

import { PascalViewer } from './PascalViewer';
import { usePascalViewer } from './usePascalViewer';

export interface PascalViewerContainerProps {
  readonly graph: SpatialGraph | null;
  readonly collapsed?: boolean | undefined;
}

/** Thứ người dùng thấy thay cho màn đã sập. Chữ lấy thẳng từ `report.description`. */
function CrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="flex h-full items-center justify-center bg-bg-app">
      <EmptyState
        icon={<div className="h-8 w-8 rounded-full bg-state-violation-tint" aria-hidden="true" />}
        title={report.description.title}
        description={report.description.description}
        {...(report.retryable
          ? { action: { label: report.description.primaryButtonLabel, onClick: retry } }
          : {})}
      />
    </div>
  );
}

function PascalViewerBody({ graph, collapsed }: PascalViewerContainerProps) {
  const { viewModel, canvasRef, onRetry, onExpand } = usePascalViewer({
    graph,
    ...(collapsed === undefined ? {} : { collapsed }),
  });

  return (
    <PascalViewer
      viewModel={viewModel}
      canvasRef={canvasRef}
      onRetry={onRetry}
      onExpand={onExpand}
    />
  );
}

export function PascalViewerContainer({ graph, collapsed }: PascalViewerContainerProps) {
  return (
    <ScreenErrorBoundary
      key={graph === null ? 'trong' : graph.building.name}
      screenId="pascal-viewer"
      renderFallback={(fallback) => <CrashFallback {...fallback} />}
    >
      <PascalViewerBody graph={graph} collapsed={collapsed} />
    </ScreenErrorBoundary>
  );
}

/**
 * Cửa vào của router.
 *
 * Bản vẽ lấy từ chính store của AppFront — `spatial` giữ dạng đã chuẩn hoá,
 * `denormalizeSpatial` trả nó về đồ thị mà bộ đổi dữ liệu nhận. Không có dữ
 * liệu giả ở đây: màn này dựng đúng bản vẽ người dùng đang mở.
 */
export function PascalViewerRoute() {
  const spatial = useStore((state) => state.spatial);
  // `spatial` là `null` khi chưa nạp xong bản vẽ; `graph = null` đẩy màn sang
  // trạng thái "đang nạp" chứ không dựng một đồ thị rỗng giả.
  const graph = useMemo(() => (spatial === null ? null : denormalizeSpatial(spatial)), [spatial]);

  return <PascalViewerContainer graph={graph} />;
}
