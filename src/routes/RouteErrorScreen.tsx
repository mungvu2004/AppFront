import { AlertTriangle } from 'lucide-react';
import { useRouteError } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { describeScreenError } from '@/lib/screen-state/screenErrorBoundary';

/** Trình duyệt báo chunk tải muộn không về được (mạng chập chờn, hoặc bản dựng vừa đổi tên tệp). */
const CHUNK_LOAD_ERROR = /dynamically imported module|Importing a module script failed|ChunkLoadError/iu;

export const CHUNK_LOAD_TITLE = 'Chưa tải được trang';
export const CHUNK_LOAD_DESCRIPTION =
  'Một phần của ứng dụng chưa tải về được, thường do mạng chập chờn hoặc ứng dụng vừa được cập nhật. Tải lại trang để thử lại.';
export const RELOAD_PAGE_LABEL = 'Tải lại trang';

/**
 * `errorElement` của route gốc (BUG-106). Thiếu nó, react-router vẽ trang lỗi mặc định
 * tiếng Anh "Unexpected Application Error!" — màn trắng mà A11 tồn tại để chặn.
 * Lỗi tải chunk chỉ chữa được bằng tải lại trang, nên nút luôn là "Tải lại trang".
 */
export function RouteErrorScreen() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : String(error);
  const isChunkLoad = CHUNK_LOAD_ERROR.test(message);
  const { description } = describeScreenError(error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-app p-6">
      <EmptyState
        headingLevel="h1"
        icon={<AlertTriangle aria-hidden="true" />}
        title={isChunkLoad ? CHUNK_LOAD_TITLE : description.title}
        description={isChunkLoad ? CHUNK_LOAD_DESCRIPTION : description.description}
        action={{ label: RELOAD_PAGE_LABEL, onClick: () => window.location.reload() }}
      />
    </main>
  );
}
