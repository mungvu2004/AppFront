import { describe, expect, it, vi } from 'vitest';

import { guardBeforeUnload } from '../beforeUnload';

interface FakeWindow {
  addEventListener: (type: string, listener: (event: BeforeUnloadEvent) => void) => void;
  removeEventListener: (type: string, listener: (event: BeforeUnloadEvent) => void) => void;
}

const createFakeWindow = (): FakeWindow & { dispatch: (event: BeforeUnloadEvent) => void } => {
  const listeners = new Set<(event: BeforeUnloadEvent) => void>();

  return {
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    dispatch: (event) => {
      listeners.forEach((listener) => listener(event));
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
  };
};

const createFakeBeforeUnloadEvent = (): BeforeUnloadEvent & { returnValue: string } => {
  let returnValue = '';

  return {
    preventDefault: vi.fn(),
    get returnValue() {
      return returnValue;
    },
    set returnValue(value: string) {
      returnValue = value;
    },
  } as unknown as BeforeUnloadEvent & { returnValue: string };
};

describe('guardBeforeUnload', () => {
  it('does not block leaving the page when there are no unsaved changes', () => {
    const windowObject = createFakeWindow();
    const sendBeacon = vi.fn();
    guardBeforeUnload({ hasUnsavedChanges: () => false, sendBeacon, windowObject });

    const event = createFakeBeforeUnloadEvent();
    windowObject.dispatch(event);

    expect(sendBeacon).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.returnValue).toBe('');
  });

  it('sends a beacon and triggers the native leave-site warning when there are unsaved changes', () => {
    const windowObject = createFakeWindow();
    const sendBeacon = vi.fn();
    guardBeforeUnload({ hasUnsavedChanges: () => true, sendBeacon, windowObject });

    const event = createFakeBeforeUnloadEvent();
    windowObject.dispatch(event);

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.returnValue).toBe('');
  });

  it('stops guarding once the returned cleanup runs', () => {
    const windowObject = createFakeWindow();
    const sendBeacon = vi.fn();
    const stop = guardBeforeUnload({ hasUnsavedChanges: () => true, sendBeacon, windowObject });

    stop();
    windowObject.dispatch(createFakeBeforeUnloadEvent());

    expect(sendBeacon).not.toHaveBeenCalled();
  });
});
