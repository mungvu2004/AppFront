/**
 * Áo (chrome) của trang 3D theo sáng/tối của AppFront. AppFront giữ lựa chọn ở
 * `localStorage['app-theme-mode']` ('light' | 'dark' | 'system', `src/hooks/useTheme.ts`) và gắn
 * lớp `dark` lên `<html>`; trang này làm y vậy. Pascal tự gắn `dark` lên `<body>` và nhiều khung
 * con, nên `pascal-theme.css` đổi sang token sáng khi `<html>` KHÔNG có `dark`.
 * Đổi ở tab app khác → sự kiện `storage`; 'system' theo hệ điều hành, đổi tức thì.
 */

/** = `THEME_KEY` của `src/hooks/useTheme.ts` (không nhập: hook đó kéo cả store của app). */
export const APP_THEME_KEY = 'app-theme-mode';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Như `setThemeChoice` của uiSlice: chưa lưu gì = sáng (mặc định của app). */
export function isChromeDark(stored: string | null, osDark: boolean): boolean {
  return stored === 'dark' || (stored === 'system' && osDark);
}

/** Áp ngay và theo dõi thay đổi; trả về hàm gỡ. */
export function syncChromeTheme(win: Window = window): () => void {
  const os = typeof win.matchMedia === 'function' ? win.matchMedia(DARK_QUERY) : null;
  const apply = () => {
    let stored: string | null = null;
    try {
      stored = win.localStorage.getItem(APP_THEME_KEY);
    } catch {
      // Bộ nhớ bị chặn: theo mặc định sáng của app.
    }
    win.document.documentElement.classList.toggle('dark', isChromeDark(stored, os?.matches ?? false));
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === APP_THEME_KEY) apply();
  };
  apply();
  win.addEventListener('storage', onStorage);
  os?.addEventListener('change', apply);
  return () => {
    win.removeEventListener('storage', onStorage);
    os?.removeEventListener('change', apply);
  };
}
