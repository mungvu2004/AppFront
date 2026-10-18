/** Hai địa chỉ 3D cũ chuyển về `/3d` của Pascal — tách khỏi `router.tsx` để bảng route dưới trần R-22 (F-15 M2). */
import { useEffect } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';

import { editor3dHref, ROUTE_PATTERNS } from './paths';
import { PendingShell } from './SessionBootstrap';

/**
 * `/3d/pascal` giờ chỉ là địa chỉ cũ của `/3d` (F-15).
 *
 * Màn Pascal đã là màn 3D duy nhất, nên route riêng của nó không còn việc gì —
 * nhưng liên kết cũ thì vẫn nằm trong lịch sử trình duyệt và trong dấu trang.
 * `replace` để nút Lùi không kẹt lại ở địa chỉ cũ, và `search` đi theo vì tham
 * số truy vấn (ví dụ `?v=` của một phiên bản) thuộc về màn chứ không về đường.
 */
export function PascalViewerRedirect() {
  const { projectId } = useParams<{ projectId: string }>();
  const { search, hash } = useLocation();

  return (
    <Navigate
      replace
      to={`${ROUTE_PATTERNS.projectViewer.replace(':projectId', projectId ?? '')}${search}${hash}`}
    />
  );
}

/**
 * `/3d/exploded` cũ → `/3d?view=exploded`: tách tầng nay là chế độ của Pascal (F-15 W2-C2).
 * Query và hash cũ đi theo như ở `/3d/pascal` (24-A-003), `view` ghi đè.
 */
export function ExplodedViewRedirect() {
  const { projectId } = useParams<{ projectId: string }>();
  const { search, hash } = useLocation();
  const query = new URLSearchParams(search);

  query.set('view', 'exploded');

  return (
    <Navigate
      replace
      to={`${ROUTE_PATTERNS.projectViewer.replace(':projectId', projectId ?? '')}?${query.toString()}${hash}`}
    />
  );
}

/** `/3d/measure` cũ → `/3d?tool=measure`: màn 3D tự lo công cụ đo. Query và hash cũ đi theo, `tool` ghi đè. */
export function MeasureViewRedirect() {
  const { projectId } = useParams<{ projectId: string }>();
  const { search, hash } = useLocation();
  const query = new URLSearchParams(search);

  query.set('tool', 'measure');

  return (
    <Navigate
      replace
      to={`${ROUTE_PATTERNS.projectViewer.replace(':projectId', projectId ?? '')}?${query.toString()}${hash}`}
    />
  );
}

/**
 * `/3d` → trang Pascal riêng `public/editor3d.html` — tài liệu HTML khác, nên
 * điều hướng cả trang chứ không qua router. `replace` để nút Lùi không quay về
 * `/3d` rồi bị đẩy đi lần nữa.
 */
export function Pascal3dPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { search } = useLocation();

  useEffect(() => {
    window.location.replace(editor3dHref(projectId ?? '', search));
  }, [projectId, search]);

  // Trang mới nạp cả tài liệu, mất vài giây: có chữ chờ thay cho màn trắng (P05 · G5-02, G5-42).
  return <PendingShell label="Đang mở mô hình 3D" />;
}
