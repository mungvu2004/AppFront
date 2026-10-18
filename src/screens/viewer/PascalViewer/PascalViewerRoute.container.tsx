/**
 * Cửa vào của router cho màn Mô hình 3D — tách khỏi `PascalViewer.container.tsx` để file ấy dưới trần 400 dòng.
 */

import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ProjectSpatialGate } from '@/components/feedback/ProjectSpatialGate';
import { denormalizeSpatial } from '@/domain/spatial/normalize';
import { ROUTES } from '@/routes/paths';
import { selectViewerSpatial } from '@/screens/viewer/ViewerShell/viewerShellGateway';
import { useStore } from '@/store';

import { PascalViewerContainer } from './PascalViewer.container';

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
  const navigate = useNavigate();
  const spatial = useStore(selectViewerSpatial);

  // `null` đẩy màn sang "đang nạp" chứ không dựng một đồ thị rỗng giả.
  const graph = useMemo(() => (spatial === null ? null : denormalizeSpatial(spatial)), [spatial]);

  /* Màn đứng một mình dưới router, không vỏ nào cấp chiều cao: thiếu `h-dvh`
     thì `h-full` của khung ra 0 và cả màn co về `min-h-96` — đo 1440×900:
     trang 384 px, hộp dựng 192 px (B-V10-02). Bọc ở đây chứ không ở `Frame`, để
     chỗ nhúng màn vào bố cục khác vẫn tự quyết chiều cao. */
  return (
    <div className="h-dvh">
      <ProjectSpatialGate projectId={projectId}>
        {/* Lối ra về quản lý tầng của dự án, để `/3d` không là ngõ cụt (BUG-487). */}
        <PascalViewerContainer
          graph={graph}
          projectId={projectId}
          onLeave={
            projectId === undefined ? undefined : () => navigate(ROUTES.project.floors(projectId))
          }
          onNext={
            projectId === undefined ? undefined : () => navigate(ROUTES.project.rules(projectId))
          }
          onReprocess={
            projectId === undefined ? undefined : () => navigate(ROUTES.project.pipeline(projectId))
          }
        />
      </ProjectSpatialGate>
    </div>
  );
}
