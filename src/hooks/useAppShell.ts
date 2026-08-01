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
    const saved = localStorage.getItem('appshell:left-collapsed');
    return saved === 'true';
  });

  const [rightCollapsed, setRightCollapsed] = useState(() => {
    const saved = localStorage.getItem('appshell:right-collapsed');
    return saved === 'true';
  });

  const toggleLeft = useCallback(() => {
    setLeftCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('appshell:left-collapsed', String(next));
      return next;
    });
  }, []);

  const toggleRight = useCallback(() => {
    setRightCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('appshell:right-collapsed', String(next));
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
