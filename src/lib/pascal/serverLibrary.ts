import type { LibraryApi } from '@/api/client';

import { registerServerLibrary } from './furnitureCatalog';

/**
 * Nạp thư viện nội thất máy chủ (`GET /api/library`) vào danh mục Pascal trước khi dựng cảnh.
 * Lỗi API / mất mạng / quá `timeoutMs` → 0 và danh mục đóng gói giữ nguyên làm dự phòng; không bao giờ ném.
 */
export async function loadServerLibrary(api: Pick<LibraryApi, 'list'>, timeoutMs = 3000): Promise<number> {
  const listed = api
    .list()
    .then((result) => (result.ok ? registerServerLibrary(result.data) : 0))
    .catch(() => 0);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<number>((resolve) => {
    timer = setTimeout(() => resolve(0), timeoutMs);
  });
  try {
    return await Promise.race([listed, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
