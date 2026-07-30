import { useEffect } from 'react';
import { useStore } from '../store';
import { ThemeMode } from '../store/uiSlice';

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
  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    if (theme === 'dark') {
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
