import { describe, expect, it } from 'vitest';

import type { AutosaveState } from '../createAutosave';
import { toSaveIndicatorState } from '../toSaveIndicatorState';

describe('toSaveIndicatorState', () => {
  it('maps dirty to pending — a change is waiting to sync', () => {
    expect(toSaveIndicatorState('dirty')).toBe('pending');
  });

  it('maps saving to saving', () => {
    expect(toSaveIndicatorState('saving')).toBe('saving');
  });

  it('maps saved to saved', () => {
    expect(toSaveIndicatorState('saved')).toBe('saved');
  });

  it('maps failed to error', () => {
    expect(toSaveIndicatorState('failed')).toBe('error');
  });

  it('maps offline to pending, not error or saved — neither would be true', () => {
    expect(toSaveIndicatorState('offline')).toBe('pending');
  });

  it('covers every AutosaveState with no fallthrough', () => {
    const allStates: readonly AutosaveState[] = ['dirty', 'failed', 'offline', 'saved', 'saving'];

    for (const state of allStates) {
      expect(() => toSaveIndicatorState(state)).not.toThrow();
    }
  });
});
