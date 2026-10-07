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
import { useParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ProjectSpatialGate } from '@/components/feedback/ProjectSpatialGate';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { denormalizeSpatial } from '@/domain/spatial/normalize';
import type { SpatialGraph } from '@/domain/spatial/types';
// Nhập THẲNG module, KHÔNG qua barrel `index.ts` của màn kia: đi qua barrel là
// kéo cả cụm màn ấy vào chunk của route này, và cổng "chi phí thêm cho một màn"
// đo được đúng điều đó — 282,1 / 280 KiB, vượt 2,1.
//
// Và luật nhà mẫu nhập từ ĐÚNG module giữ `VIEWER_FIXTURE_SPATIAL`, không từ
// `Viewer3D/useViewer3DSource`: hai màn cùng nhập module thứ hai ấy thì Rollup
// tách nó ra một chunk dùng chung 507 byte và cổng lại đỏ vì 39 byte.
import { selectViewerSpatial } from '@/screens/viewer/ViewerShell/viewerShellGateway';
import { useStore } from '@/store';

import { PascalViewer } from './PascalViewer';
import { usePascalViewer, type UsePascalViewerOptions } from './usePascalViewer';

export interface PascalViewerContainerProps {
  readonly graph: SpatialGraph | null;
  readonly collapsed?: boolean | undefined;
  /**
   * Cửa nạp gói vách ngăn, tách ra để bài kiểm chạy qua **cây component thật**.
   *
   * Không phải chỗ tiêm cho vui: một vòng chết từng sống sót qua 41 bài kiểm
   * đơn vị vì bộ dựng thử của hook gắn `canvasRef` vào một `div` vô điều kiện,
   * đi vòng qua nhánh điều kiện của view. Có chỗ tiêm này thì bài kiểm dựng
   * đúng `PascalViewerContainer` → `PascalViewer` → `usePascalViewer` như lúc
   * chạy thật, và bắt được vòng chết ấy mà không cần WebGL.
   */
  readonly loadMount?: UsePascalViewerOptions['loadMount'] | undefined;
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

function PascalViewerBody({ graph, collapsed, loadMount }: PascalViewerContainerProps) {
  const { viewModel, canvasRef, onRetry, onExpand } = usePascalViewer({
    graph,
    ...(collapsed === undefined ? {} : { collapsed }),
    ...(loadMount === undefined ? {} : { loadMount }),
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

export function PascalViewerContainer({
  graph,
  collapsed,
  loadMount,
}: PascalViewerContainerProps) {
  return (
    <ScreenErrorBoundary
      key={graph === null ? 'trong' : graph.building.name}
      screenId="pascal-viewer"
      renderFallback={(fallback) => <CrashFallback {...fallback} />}
    >
      <PascalViewerBody graph={graph} collapsed={collapsed} loadMount={loadMount} />
    </ScreenErrorBoundary>
  );
}

/**
 * Cửa vào của router.
 *
 * ## Vì sao không đọc thẳng `store.spatial`
 *
 * Bản đầu của màn này làm thế, và nó **kẹt ở "đang nạp" mãi**: không ai nạp kho.
 * Nay cổng `ProjectSpatialGate` nạp kho theo `:projectId` (B-V12-01), và màn đọc
 * qua `selectViewerSpatial` — cùng luật nhà mẫu với `/3d` (mock + kho chưa có
 * tường thì nhà mẫu; nối BE thật thì kho rỗng là kho rỗng), cộng một chốt: cổng
 * đang nạp thì `null`, để kho của dự án trước không hiện dưới tên dự án này.
 */
export function PascalViewerRoute() {
  const { projectId } = useParams<{ projectId: string }>();
  const spatial = useStore(selectViewerSpatial);

  // `null` đẩy màn sang "đang nạp" chứ không dựng một đồ thị rỗng giả.
  const graph = useMemo(() => (spatial === null ? null : denormalizeSpatial(spatial)), [spatial]);

  /* Màn đứng một mình dưới router, không vỏ nào cấp chiều cao: thiếu `h-screen`
     thì `h-full` của khung ra 0 và cả màn co về `min-h-[24rem]` — đo 1440×900:
     trang 384 px, hộp dựng 192 px (B-V10-02). Bọc ở đây chứ không ở `Frame`, để
     chỗ nhúng màn vào bố cục khác vẫn tự quyết chiều cao. */
  return (
    <div className="h-screen">
      <ProjectSpatialGate projectId={projectId}>
        <PascalViewerContainer graph={graph} />
      </ProjectSpatialGate>
    </div>
  );
}
