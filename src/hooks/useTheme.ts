import { useEffect } from 'react';
import { useStore } from '../store';
import type { ThemeMode } from '../store/uiSlice';

const THEME_KEY = 'app-theme-mode';

export function useTheme() {
  const theme = useStore(state => state.theme);
  const setTheme = useStore(state => state.setTheme);

  // Initial load
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY) as ThemeMode | null;
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored);
    }
  }, [setTheme]);

  // Sync to DOM and localStorage
  // Đọc store tại chỗ chứ không dùng `theme` của lượt render: ở lượt mount, effect trên vừa
  // `setTheme(stored)` mà `theme` còn là giá trị cũ — ghi nó sẽ đè khoá đã lưu (StrictMode
  // chạy effect hai lần nên đọc lại đúng giá trị bị đè).
  useEffect(() => {
    const current = useStore.getState().theme;
    localStorage.setItem(THEME_KEY, current);
    if (current === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

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
