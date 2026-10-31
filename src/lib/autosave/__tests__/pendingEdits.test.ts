import { describe, expect, it, vi } from 'vitest';

import { clearPendingEdits, getPendingEdits, notePendingEdit, subscribePendingEdits } from '../pendingEdits';

describe('pendingEdits (UX-40)', () => {
  it('đếm thao tác chờ gửi, về 0 khi đã lưu hết, và báo người nghe', () => {
    clearPendingEdits();
    const listener = vi.fn();
    const stop = subscribePendingEdits(listener);

    notePendingEdit();
    notePendingEdit();
    expect(getPendingEdits()).toBe(2);

    clearPendingEdits();
    expect(getPendingEdits()).toBe(0);
    expect(listener).toHaveBeenCalledTimes(3);

    stop();
    notePendingEdit();
    expect(listener).toHaveBeenCalledTimes(3);
    clearPendingEdits();
  });
});
