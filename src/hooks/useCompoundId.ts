import { useId } from 'react';

/**
 * Tạo cặp IDs nhất quán cho compound components (trigger ↔ content).
 * Dùng chung cho Select, Combobox, Tabs, ContextMenu.
 */
export function useCompoundId(prefix: string) {
  const base = useId();
  return {
    triggerId: `${prefix}-trigger-${base}`,
    contentId: `${prefix}-content-${base}`,
  };
}
