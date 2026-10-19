/**
 * "Về dự án" quay về màn vừa rời (N1-01, N5-13, N3-09) thay vì luôn về Quản lý tầng.
 *
 * Nguồn, theo thứ tự: tham số `?returnTo=` của trang 3D, rồi đường cuối cùng của app
 * mà SPA ghi vào `sessionStorage` (cùng tab, cùng nguồn nên trang 3D đọc được).
 * Không có hoặc không hợp lệ → Quản lý tầng.
 */
import { ROUTES } from '@/routes/paths';

export const RETURN_TO_PARAM = 'returnTo';
export const LAST_APP_PATH_KEY = 'appfront:last-app-path';

/** Chỉ đường nội bộ, và không phải chính trang 3D (tránh vòng lặp `/3d` → editor). */
export function isSafeReturnPath(path: string | null | undefined): path is string {
  // Trình duyệt bỏ tab/xuống dòng trong URL (WHATWG): `/\t/evil.test` sẽ thành `//evil.test`.
  if (!path || !path.startsWith('/') || path.startsWith('//') || /[\\\s\p{Cc}]/u.test(path)) return false;
  try {
    if (new URL(path, window.location.origin).origin !== window.location.origin) return false;
  } catch {
    return false;
  }

  const pathname = path.split(/[?#]/, 1)[0] ?? '';
  return !pathname.startsWith('/editor3d.html') && !/^\/projects\/[^/]+\/3d(\/|$)/.test(pathname);
}

/** SPA gọi mỗi lần đổi route; đường 3D bị bỏ qua để giữ màn trước nó. */
export function rememberAppPath(path: string): void {
  if (!isSafeReturnPath(path)) return;
  try {
    window.sessionStorage.setItem(LAST_APP_PATH_KEY, path);
  } catch {
    // Trình duyệt chặn lưu trữ: "Về dự án" rơi về Quản lý tầng.
  }
}

function readLastAppPath(): string | null {
  try {
    return window.sessionStorage.getItem(LAST_APP_PATH_KEY);
  } catch {
    return null;
  }
}

export function resolveBackHref(projectId: string, search: string = window.location.search): string {
  const fromQuery = new URLSearchParams(search).get(RETURN_TO_PARAM);
  if (isSafeReturnPath(fromQuery)) return fromQuery;

  // Đường đã ghi có thể thuộc dự án khác (mở 3D bằng địa chỉ gõ tay): chỉ nhận khi không trỏ vào dự án nào khác.
  const fromSession = readLastAppPath();
  const otherProject = fromSession?.match(/^\/projects\/([^/?#]+)/)?.[1];
  if (isSafeReturnPath(fromSession) && (otherProject === undefined || otherProject === projectId)) return fromSession;

  return ROUTES.project.floors(projectId);
}
