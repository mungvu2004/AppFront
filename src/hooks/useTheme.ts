import { useEffect } from 'react';
import { useStore } from '../store';
import type { ThemeChoice } from '../store/uiSlice';

const THEME_KEY = 'app-theme-mode';
const DARK_QUERY = '(prefers-color-scheme: dark)';

const osQuery = (): MediaQueryList | null =>
  typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null;

export function useTheme() {
  const theme = useStore(state => state.theme);
  const choice = useStore(state => state.themeChoice);
  const setTheme = useStore(state => state.setTheme);
  const setThemeChoice = useStore(state => state.setThemeChoice);

  // Initial load
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY) as ThemeChoice | null;
    if (stored === 'dark' || stored === 'light' || stored === 'system') {
      setThemeChoice(stored, osQuery()?.matches ?? false);
    }
  }, [setThemeChoice]);

  // Sync to DOM and localStorage; 'system' (Q2, 33R-C-001) follows the OS, live.
  // Đọc store tại chỗ chứ không dùng `theme` của lượt render: ở lượt mount, effect trên vừa
  // đặt giá trị đã lưu mà `theme` còn là giá trị cũ — ghi nó sẽ đè khoá đã lưu (StrictMode
  // chạy effect hai lần nên đọc lại đúng giá trị bị đè).
  useEffect(() => {
    const os = osQuery();
    const apply = () => {
      const state = useStore.getState();
      if (state.themeChoice === 'system') {
        state.setThemeChoice('system', os?.matches ?? false);
      }
      const current = useStore.getState();
      localStorage.setItem(THEME_KEY, current.themeChoice === 'system' ? 'system' : current.theme);
      document.documentElement.classList.toggle('dark', current.theme === 'dark');
    };
    apply();
    if (choice !== 'system' || os === null) return undefined;
    os.addEventListener('change', apply);
    return () => os.removeEventListener('change', apply);
  }, [theme, choice]);

  const toggle = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return { theme, toggle };
}

/**
 * Gắn ở gốc app (`main.tsx`): áp chủ đề đã lưu lên `<html>` ở MỌI route khi tải đầy đủ, không
 * chỉ khi `/tai-khoan` đang mount (BUG-P07-006, 33R-A-024).
 */
export function ThemeSync(): null {
  useTheme();
  return null;
}
