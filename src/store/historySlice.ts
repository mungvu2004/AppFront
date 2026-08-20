import type { StateCreator } from 'zustand';

export interface HistoryEvent {
  id: string;
  label: string;
  timestamp: number;
}

export interface HistorySlice {
  lastCommitLabel: string | null;
  lastCommitTimestamp: number | null;
  setLastCommit: (label: string, timestamp: number) => void;
}

export const createHistorySlice: StateCreator<HistorySlice> = (set) => ({
  lastCommitLabel: null,
  lastCommitTimestamp: null,
  setLastCommit: (label, timestamp) => set({ lastCommitLabel: label, lastCommitTimestamp: timestamp }),
});
