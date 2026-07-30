import { useEffect, useState } from 'react';
import { useStore } from '../store';

export interface UndoableToastState {
  isVisible: boolean;
  label: string;
  onUndo: () => void;
}

/**
 * Listens for new commits and shows an undoable toast for 8 seconds.
 */
export function useUndoableToast(): UndoableToastState | null {
  const lastCommitLabel = useStore((state) => state.lastCommitLabel);
  const lastCommitTimestamp = useStore((state) => state.lastCommitTimestamp);
  
  const [toast, setToast] = useState<UndoableToastState | null>(null);

  useEffect(() => {
    if (lastCommitLabel && lastCommitTimestamp) {
      setToast({
        isVisible: true,
        label: lastCommitLabel,
        onUndo: () => {
          useStore.temporal.getState().undo();
          setToast(null); // hide on undo
        },
      });

      const timer = setTimeout(() => {
        setToast((current) => current?.label === lastCommitLabel ? { ...current, isVisible: false } : current);
      }, 8000);

      return () => clearTimeout(timer);
    }
  }, [lastCommitLabel, lastCommitTimestamp]);

  return toast;
}
