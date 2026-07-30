import { useEffect, useState, useRef } from 'react';
import { useStore, RootState } from '../store';
import { formatTime } from '../lib/format';

/**
 * Debounces spatial data changes and auto-saves.
 * Triggers after 800ms of inactivity.
 * Returns a localized label like "Đã lưu lúc 14:32".
 */
export function useAutosave(onSave: (data: RootState['spatial']) => Promise<void>) {
  const spatial = useStore((state) => state.spatial);
  const [saveLabel, setSaveLabel] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!spatial) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        await onSave(spatial);
        const now = new Date();
        setSaveLabel(`Đã lưu lúc ${formatTime(now)}`);
      } catch (err) {
        console.error('Autosave failed', err);
        setSaveLabel('Lưu thất bại');
      }
    }, 800);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [spatial, onSave]);

  return saveLabel;
}
