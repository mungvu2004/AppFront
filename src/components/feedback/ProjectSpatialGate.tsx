import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { useProjectSpatial, type ProjectSpatialApi } from '@/hooks/useProjectSpatial';
import { ROUTES } from '@/routes/paths';

import { EmptyState } from './EmptyState';
import { InlineAlert } from './InlineAlert';

/**
 * Cổng nạp kho dự án — B-V12-01. Bọc một route đọc `store.spatial`/`floors`
 * (luật, xuất, dữ liệu, 3D, điện thoại) để kho được nạp từ máy chủ khi người
 * dùng đi bằng đường sản phẩm.
 *
 * Không vẽ `loading` của riêng nó: màn con đọc `spatialLoading` và vẽ trạng thái
 * tải của chính mình. Cổng chỉ thay màn con khi #24 hỏng, hoặc N15 hỏng mà kho chưa
 * có đồ thị — khi ấy màn con sẽ nói "chưa có mô hình", và đó là câu sai (A11). N15
 * hỏng khi kho đã có đồ thị thì màn con còn, kèm dải "Thử lại" trên nó (F-04x-2).
 */
export interface ProjectSpatialGateProps {
  /** Vắng (route thiếu mã) thì cổng không làm gì; màn con tự nói thiếu mã. */
  readonly projectId: string | undefined;
  readonly children: ReactNode;
  readonly api?: ProjectSpatialApi;
}

/**
 * 404 của dự án — B-V1-43. Một câu cố định cho mọi 404 (K08: không tiết lộ là
 * "không có" hay "không có quyền") và một lối ra. Nhãn nút cố ý trùng
 * `useNotFound.ts` (`dashboardLabel`). `useNavigate` chỉ sống ở đây để cổng vẫn
 * dựng được không cần router khi không có 404.
 */
function ProjectNotFound() {
  const navigate = useNavigate();

  return (
    <div role="alert" className="flex h-full w-full items-center justify-center bg-bg-app p-6">
      <EmptyState
        icon={<div className="w-8 h-8 rounded-full bg-state-violation-tint" aria-hidden="true" />}
        title="Không tìm thấy dự án này"
        description="Dự án có thể đã bị xoá, đường dẫn chưa đúng, hoặc bạn chưa được thêm vào dự án."
        action={{ label: 'Về danh sách dự án', onClick: () => navigate(ROUTES.dashboard) }}
      />
    </div>
  );
}

export function ProjectSpatialGate({ api, children, projectId }: ProjectSpatialGateProps) {
  const { refreshFailed, report, retry, status } = useProjectSpatial({ api, projectId });

  if (status === 'notFound') {
    return <ProjectNotFound />;
  }

  if (status === 'error' && report !== null) {
    return (
      <div role="alert" className="flex h-full w-full items-center justify-center bg-bg-app p-6">
        <EmptyState
          icon={<div className="w-8 h-8 rounded-full bg-state-violation-tint" aria-hidden="true" />}
          title={report.description.title}
          description={report.description.description}
          {...(report.retryable ? { action: { label: report.description.primaryButtonLabel, onClick: retry } } : {})}
        />
      </div>
    );
  }

  /* Một lối trả, vị trí cố định: dải hiện/mất không gỡ rồi gắn lại màn con (review-1 P1-1). */
  return (
    <>
      {refreshFailed ? (
        <InlineAlert
          level="violation"
          message="Không tải lại được mô hình."
          action={{ label: 'Thử lại', onClick: retry }}
        />
      ) : null}
      {children}
    </>
  );
}
