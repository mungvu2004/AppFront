/**
 * Lối quay về mà app nhớ trong `sessionStorage` của thẻ: dự án vừa rời, màn tầng gần
 * nhất của từng dự án, đường cuối cùng cho trang 3D. Chúng thuộc về người đang đăng
 * nhập, nên phiên kết thúc (đăng xuất, hết phiên, thẻ khác đăng xuất) là xoá (RV5 #1):
 * người sau dùng cùng thẻ không thấy tên hay đường của dự án người trước.
 */
export const LAST_PROJECT_KEY = 'appfront.lastProject';
export const LAST_FLOOR_PATH_PREFIX = 'appfront.lastFloorPath.';
/** Trùng `LAST_APP_PATH_KEY` của `src/pascal-page/bridge/backHref.ts` (trang 3D đọc khoá này). */
const LAST_APP_PATH_KEY = 'appfront:last-app-path';

export const lastFloorPathKey = (projectId: string): string => `${LAST_FLOOR_PATH_PREFIX}${projectId}`;

export function clearNavigationMemory(): void {
  try {
    const storage = window.sessionStorage;
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
    for (const key of keys) {
      if (key !== null && (key === LAST_PROJECT_KEY || key === LAST_APP_PATH_KEY || key.startsWith(LAST_FLOOR_PATH_PREFIX))) {
        storage.removeItem(key);
      }
    }
  } catch {
    /* sessionStorage bị chặn: không có gì đã lưu để xoá. */
  }
}
