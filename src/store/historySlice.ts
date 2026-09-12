import type { StateCreator } from 'zustand';

export interface HistoryEvent {
  id: string;
  label: string;
  timestamp: number;
}

export interface HistorySlice {
  lastCommitLabel: string | null;
  lastCommitTimestamp: number | null;
  /**
   * How to take back the commit `lastCommitLabel` names, or `null` when the last
   * write left nothing to take back.
   *
   * It is recorded here because the label alone does not say which stack the
   * write landed on, and the toast that offers the undo reads only this slice.
   * `commit` writes spatial data and its undo is zundo's `temporal.undo()`;
   * `commitRuleConfig` writes rule configuration, which is deliberately outside
   * zundo's `partialize` (see `ruleConfigSlice`), and its undo is a closure over
   * the configuration as it stood before. Reading a label and then guessing
   * `temporal.undo()` is how opening the rule settings screen came to roll back
   * the user's last wall edit instead — invariant A8 says every change is
   * undoable, not that every change is undone by the same button.
   */
  lastCommitUndo: (() => void) | null;
  setLastCommit: (label: string, timestamp: number, undo: () => void) => void;
}

export const createHistorySlice: StateCreator<HistorySlice> = (set) => ({
  lastCommitLabel: null,
  lastCommitTimestamp: null,
  lastCommitUndo: null,
  setLastCommit: (label, timestamp, undo) =>
    set({ lastCommitLabel: label, lastCommitTimestamp: timestamp, lastCommitUndo: undo }),
});
