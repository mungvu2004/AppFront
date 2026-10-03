import type { ReactNode } from 'react';

import type { ApiClient } from '@/api/client';
import { useProjectSpatial } from '@/hooks/useProjectSpatial';

import { EmptyState } from './EmptyState';

/**
 * Cổng nạp kho dự án — B-V12-01. Bọc một route đọc `store.spatial`/`floors`
 * (luật, xuất, dữ liệu, 3D, điện thoại) để kho được nạp từ máy chủ khi người
 * dùng đi bằng đường sản phẩm.
 *
 * Không vẽ `loading` của riêng nó: màn con đọc `spatialLoading` và vẽ trạng thái
 * tải của chính mình. Cổng chỉ thay màn con khi lượt nạp HỎNG — khi ấy màn con
 * sẽ nói "chưa có mô hình", và đó là câu sai (A11).
 */
export interface ProjectSpatialGateProps {
  /** Vắng (route thiếu mã) thì cổng không làm gì; màn con tự nói thiếu mã. */
  readonly projectId: string | undefined;
  readonly children: ReactNode;
  readonly api?: Pick<ApiClient, 'projects' | 'spatial'>;
}

export function ProjectSpatialGate({ api, children, projectId }: ProjectSpatialGateProps) {
  const { report, retry, status } = useProjectSpatial({ api, projectId });

  if (status !== 'error' || report === null) {
    return <>{children}</>;
  }

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
