import { useState, useCallback } from 'react';

export function useAppShell() {
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

  return {
    leftCollapsed,
    rightCollapsed,
    toggleLeft,
    toggleRight,
  };
}
