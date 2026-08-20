import { useState, useCallback, useEffect } from 'react';

// ─── Breakpoint hook (private) ─────────────────────────────────────────────

function useBreakpoint(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);
  return matches;
}

// ─── useAppShell ─────────────────────────────────────────────────────────────

/** localStorage key for the left panel's collapsed state. */
export const APPSHELL_LEFT_COLLAPSED_STORAGE_KEY = 'appshell:left-collapsed';
/** localStorage key for the right panel's collapsed state. */
export const APPSHELL_RIGHT_COLLAPSED_STORAGE_KEY = 'appshell:right-collapsed';

export interface AppShellState {
  /** Panel trái đang thu gọn */
  leftCollapsed: boolean;
  /** Panel phải đang thu gọn */
  rightCollapsed: boolean;
  toggleLeft: () => void;
  toggleRight: () => void;
  /** < 1280px: panel phải hiển như overlay slide-in */
  rightAsOverlay: boolean;
  /** < 1024px: panel trái hiển như drawer */
  leftAsDrawer: boolean;
  /** < 1024px: chế độ chỉ xem canvas */
  viewOnly: boolean;
}

export function useAppShell(): AppShellState {
  const [leftCollapsed, setLeftCollapsed] = useState(() => {
    const saved = localStorage.getItem(APPSHELL_LEFT_COLLAPSED_STORAGE_KEY);
    return saved === 'true';
  });

  const [rightCollapsed, setRightCollapsed] = useState(() => {
    const saved = localStorage.getItem(APPSHELL_RIGHT_COLLAPSED_STORAGE_KEY);
    return saved === 'true';
  });

  const toggleLeft = useCallback(() => {
    setLeftCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(APPSHELL_LEFT_COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const toggleRight = useCallback(() => {
    setRightCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(APPSHELL_RIGHT_COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  // Breakpoints
  const isBelowMd   = useBreakpoint('(max-width: 1023px)');
  const isBelowLg   = useBreakpoint('(max-width: 1279px)');

  return {
    leftCollapsed,
    rightCollapsed,
    toggleLeft,
    toggleRight,
    rightAsOverlay: isBelowLg,
    leftAsDrawer:   isBelowMd,
    viewOnly:       isBelowMd,
  };
}
