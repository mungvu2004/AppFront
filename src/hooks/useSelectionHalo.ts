import { useState, useCallback, useEffect, useRef } from 'react';

export type SelectionVariant = 'selected' | 'hover';

export interface SelectionHaloState {
  isVisible: boolean;
  variant: SelectionVariant;
  hasEntered: boolean;
  select: () => void;
  hover: () => void;
  deselect: () => void;
}

/**
 * Hook thuần — quản lý trạng thái selection halo.
 * Phân biệt hover / selected, theo dõi 120ms enter animation.
 */
export function useSelectionHalo(): SelectionHaloState {
  const [isVisible, setIsVisible] = useState(false);
  const [variant, setVariant] = useState<SelectionVariant>('selected');
  const [hasEntered, setHasEntered] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  const triggerEnter = useCallback((v: SelectionVariant) => {
    setIsVisible(true);
    setVariant(v);
    setHasEntered(false);
    clearTimer();
    timerRef.current = setTimeout(() => setHasEntered(true), 120);
  }, []);

  const select = useCallback(() => triggerEnter('selected'), [triggerEnter]);
  const hover = useCallback(() => triggerEnter('hover'), [triggerEnter]);

  const deselect = useCallback(() => {
    setIsVisible(false);
    setHasEntered(false);
    clearTimer();
  }, []);

  useEffect(() => () => clearTimer(), []);

  return { isVisible, variant, hasEntered, select, hover, deselect };
}
