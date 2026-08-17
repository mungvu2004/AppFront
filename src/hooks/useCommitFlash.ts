import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { durationMs } from '../lib/motion';

/**
 * Provides a transient boolean that is true for 400ms after any commit.
 * Useful for UI flash effects.
 */
export function useCommitFlash(): boolean {
  const lastCommitTimestamp = useStore((state) => state.lastCommitTimestamp);
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    if (lastCommitTimestamp) {
      setIsFlashing(true);
      const timer = setTimeout(() => {
        setIsFlashing(false);
      }, durationMs('slow'));

      return () => clearTimeout(timer);
    }
  }, [lastCommitTimestamp]);

  return isFlashing;
}
