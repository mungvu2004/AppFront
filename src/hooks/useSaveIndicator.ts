import { useEffect, useState, useSyncExternalStore } from 'react';

import type { Autosave, AutosaveState } from '@/lib/autosave/createAutosave';
import { formatTime } from '@/lib/format';
import viMessages from '@/i18n/vi.json';

export interface SaveIndicatorResult {
  detail: string;
  label: string;
  state: AutosaveState;
}

export interface UseSaveIndicatorOptions {
  now?: () => number;
  tickIntervalMs?: number;
}

const SAVED_RELATIVE_THRESHOLD_MS = 60_000;
const DEFAULT_TICK_INTERVAL_MS = 30_000;

const interpolate = (template: string, values: Record<string, string>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => values[key] ?? '');

const buildSavedResult = (lastSavedAt: number | undefined, now: number): SaveIndicatorResult => {
  if (lastSavedAt === undefined) {
    return { detail: viMessages.autosave.idle, label: viMessages.autosave.idle, state: 'saved' };
  }

  const absoluteLabel = interpolate(viMessages.common.saved_at, { time: formatTime(new Date(lastSavedAt)) });
  const elapsedMs = now - lastSavedAt;

  if (elapsedMs <= SAVED_RELATIVE_THRESHOLD_MS) {
    return { detail: absoluteLabel, label: absoluteLabel, state: 'saved' };
  }

  const minutes = Math.floor(elapsedMs / 60_000);
  const relativeLabel = interpolate(viMessages.autosave.savedRelative, { minutes: String(minutes) });

  return { detail: absoluteLabel, label: relativeLabel, state: 'saved' };
};

const buildSaveIndicatorResult = (
  state: AutosaveState,
  lastSavedAt: number | undefined,
  now: number,
): SaveIndicatorResult => {
  switch (state) {
    case 'dirty':
      return { detail: viMessages.autosave.dirty, label: viMessages.autosave.dirty, state };
    case 'saving':
      return { detail: viMessages.autosave.saving, label: viMessages.autosave.saving, state };
    case 'failed':
      return { detail: viMessages.autosave.failed, label: viMessages.autosave.failed, state };
    case 'offline':
      return { detail: viMessages.autosave.offline, label: viMessages.autosave.offline, state };
    case 'saved':
      return buildSavedResult(lastSavedAt, now);
  }
};

/**
 * Read-only view onto an `Autosave` instance: never calls `notifyChange`,
 * `saveNow`, or any API itself. Re-renders on every autosave state change
 * and, independently, every `tickIntervalMs` (default 30s) so a "saved"
 * label already on screen can age from an absolute time ("Đã lưu lúc 14:32")
 * into a relative one ("Đã lưu 2 phút trước") past `SAVED_RELATIVE_THRESHOLD_MS`
 * without requiring a state change to trigger the re-render.
 */
export function useSaveIndicator(autosave: Autosave, options: UseSaveIndicatorOptions = {}): SaveIndicatorResult {
  const now = options.now ?? Date.now;
  const tickIntervalMs = options.tickIntervalMs ?? DEFAULT_TICK_INTERVAL_MS;
  const state = useSyncExternalStore(autosave.subscribe, autosave.getState, autosave.getState);
  const [, forceTick] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      forceTick((tick) => tick + 1);
    }, tickIntervalMs);

    return () => clearInterval(intervalId);
  }, [tickIntervalMs]);

  return buildSaveIndicatorResult(state, autosave.getLastSavedAt(), now());
}
