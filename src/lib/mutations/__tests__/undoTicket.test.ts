import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createNotificationBus, type NotificationInput } from '../notificationBus';
import { UNDO_WINDOW_MS, combineUndoTickets, createUndoTicket } from '../undoTicket';

/**
 * Invariant A8 is a number three modules read, so it is pinned here rather than
 * only implied by the timing tests below. It was written out four separate times
 * before — once in this module, once in `useUndoableToast`, and three times over
 * in `components/feedback/Toast` — so a change in one place could have left the
 * countdown bar emptying at a speed that no longer matched when the undo really
 * stopped working.
 */
describe('the undo window', () => {
  it('is invariant A8’s eight seconds, in one place', () => {
    expect(UNDO_WINDOW_MS).toBe(8000);
  });

  it('is what an undo ticket expires by when nobody says otherwise', () => {
    vi.useFakeTimers();
    const ticket = createUndoTicket({ description: 'Xoá tường', undo: vi.fn() });

    vi.advanceTimersByTime(UNDO_WINDOW_MS - 1);
    expect(ticket.getStatus()).toBe('active');

    vi.advanceTimersByTime(1);
    expect(ticket.getStatus()).toBe('expired');
    vi.useRealTimers();
  });
});

describe('createUndoTicket', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays active right up to 8000ms and expires exactly at 8000ms', () => {
    const ticket = createUndoTicket({ description: 'Xoá tường', undo: vi.fn() });

    vi.advanceTimersByTime(7999);
    expect(ticket.getStatus()).toBe('active');

    vi.advanceTimersByTime(1);
    expect(ticket.getStatus()).toBe('expired');
  });

  it('runs the undo action and marks the ticket used while still active', () => {
    const undo = vi.fn();
    const ticket = createUndoTicket({ description: 'Xoá tường', undo });

    const result = ticket.undo();

    expect(undo).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ data: undefined, ok: true });
    expect(ticket.getStatus()).toBe('used');
  });

  it('returns the expired error and never calls undo once the ticket has expired', () => {
    const undo = vi.fn();
    const ticket = createUndoTicket({ description: 'Xoá tường', undo });

    vi.advanceTimersByTime(8000);
    const result = ticket.undo();

    expect(result).toEqual({ error: 'expired', ok: false });
    expect(undo).not.toHaveBeenCalled();
  });

  it('a second undo after the ticket was already used also fails, without calling undo again', () => {
    const undo = vi.fn();
    const ticket = createUndoTicket({ description: 'Xoá tường', undo });

    expect(ticket.undo()).toEqual({ data: undefined, ok: true });
    expect(ticket.undo()).toEqual({ error: 'expired', ok: false });
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('respects a custom ttlMs', () => {
    const ticket = createUndoTicket({ description: 'Xoá tường', ttlMs: 1000, undo: () => {} });

    vi.advanceTimersByTime(999);
    expect(ticket.getStatus()).toBe('active');

    vi.advanceTimersByTime(1);
    expect(ticket.getStatus()).toBe('expired');
  });
});

describe('createNotificationBus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const buildInput = (description: string, undo: () => void, type = 'editWall'): NotificationInput => ({
    description,
    title: description,
    type,
    undoTicket: createUndoTicket({ description, undo }),
  });

  it('merges 3 same-type notifications within 5 seconds into a single one, and undoes all 3', () => {
    const bus = createNotificationBus();
    const calls: string[] = [];

    bus.publish(buildInput('Sửa tường 1', () => calls.push('undo-1')));
    vi.advanceTimersByTime(1000);
    bus.publish(buildInput('Sửa tường 2', () => calls.push('undo-2')));
    vi.advanceTimersByTime(1000);
    bus.publish(buildInput('Sửa tường 3', () => calls.push('undo-3')));

    const notifications = bus.list();
    expect(notifications).toHaveLength(1);
    // The count goes in the sentence under the headline, and the headline stays
    // the message. It used to replace both, which destroyed the real text of
    // every grouped notification — see `notificationBus`.
    expect(notifications[0]?.title).toBe('Sửa tường 3');
    expect(notifications[0]?.description).toBe('Hoàn tác 3 thay đổi');

    const result = notifications[0]?.undoTicket?.undo();

    expect(result).toEqual({ data: undefined, ok: true });
    expect(calls).toEqual(['undo-3', 'undo-2', 'undo-1']);
  });

  it('keeps notifications of different types separate', () => {
    const bus = createNotificationBus();

    bus.publish(buildInput('Sửa tường', () => {}));
    bus.publish(buildInput('Di chuyển đồ đạc', () => {}, 'moveFurniture'));

    expect(bus.list()).toHaveLength(2);
  });

  it('starts a fresh notification once the group window has elapsed', () => {
    const bus = createNotificationBus();

    bus.publish(buildInput('Sửa tường 1', () => {}));
    vi.advanceTimersByTime(5000);
    bus.publish(buildInput('Sửa tường 2', () => {}));

    expect(bus.list()).toHaveLength(2);
  });

  it('removes a notification automatically once its undo ticket expires', () => {
    const bus = createNotificationBus();
    bus.publish(buildInput('Sửa tường', () => {}));

    expect(bus.list()).toHaveLength(1);

    vi.advanceTimersByTime(8000);
    expect(bus.list()).toHaveLength(0);
  });

  it('keeps at most 3 notifications visible, evicting the oldest first', () => {
    const bus = createNotificationBus();

    bus.publish(buildInput('A', () => {}, 'a'));
    bus.publish(buildInput('B', () => {}, 'b'));
    bus.publish(buildInput('C', () => {}, 'c'));
    bus.publish(buildInput('D', () => {}, 'd'));

    const notifications = bus.list();

    expect(notifications).toHaveLength(3);
    expect(notifications.map((item) => item.type)).toEqual(['b', 'c', 'd']);
  });

  it('notifies subscribers whenever the notification list changes', () => {
    const bus = createNotificationBus();
    const listener = vi.fn();
    bus.subscribe(listener);

    bus.publish(buildInput('Sửa tường', () => {}));

    expect(listener).toHaveBeenCalledWith([expect.objectContaining({ type: 'editWall' })]);
  });

  it('a listener that unsubscribed stops receiving further updates', () => {
    const bus = createNotificationBus();
    const listener = vi.fn();
    const unsubscribe = bus.subscribe(listener);

    unsubscribe();
    bus.publish(buildInput('Sửa tường', () => {}));

    expect(listener).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* A grouped ticket, and the two ways it used to lose a change.                */
/* -------------------------------------------------------------------------- */

describe('combineUndoTickets', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('has nothing to combine for an empty list, and returns the one ticket of a single', () => {
    const only = createUndoTicket({ description: 'Xoá tường', undo: () => {} });

    expect(combineUndoTickets([], { description: 'Hoàn tác 0 thay đổi' })).toBeUndefined();
    expect(combineUndoTickets([only], { description: 'Hoàn tác 1 thay đổi' })).toBe(only);
  });

  it('expires with the first of its children, not on a fresh window of its own', () => {
    const older = createUndoTicket({ description: 'Sửa tường 1', undo: () => {} });

    vi.advanceTimersByTime(4900);

    const newer = createUndoTicket({ description: 'Sửa tường 2', undo: () => {} });
    const group = combineUndoTickets([older, newer], { description: 'Hoàn tác 2 thay đổi' });

    // The older child dies at t=8.000; a fresh default window would have run to
    // t=12.900 and kept the toast on screen for every millisecond of it.
    expect(group?.expiresAt).toBe(older.expiresAt);
    expect(group?.expiresAt).toBeLessThan(newer.expiresAt);

    vi.advanceTimersByTime(3099);
    expect(group?.getStatus()).toBe('active');

    vi.advanceTimersByTime(1);
    expect(group?.getStatus()).toBe('expired');
  });

  it('reports failure when a child can no longer be undone, instead of answering ok', () => {
    const calls: string[] = [];
    const older = createUndoTicket({
      description: 'Sửa tường 1',
      ttlMs: 1000,
      undo: () => {
        calls.push('undo-1');
      },
    });
    const newer = createUndoTicket({
      description: 'Sửa tường 2',
      ttlMs: 9000,
      undo: () => {
        calls.push('undo-2');
      },
    });
    // A group built from children of unequal life, then asked to undo after the
    // shorter one has gone. The group used to carry its own window, answer `ok`
    // and let the toast leave — with change 1 never taken back and nothing said.
    const group = combineUndoTickets([older, newer], { description: 'Hoàn tác 2 thay đổi' });

    expect(group?.expiresAt).toBe(older.expiresAt);

    vi.advanceTimersByTime(1000);

    expect(group?.undo()).toEqual({ error: 'expired', ok: false });
    expect(calls).toEqual([]);
  });

  it('attempts every child even after one of them refuses', () => {
    const calls: string[] = [];
    const spent = createUndoTicket({
      description: 'Sửa tường 1',
      undo: () => {
        calls.push('undo-1');
      },
    });
    const live = createUndoTicket({
      description: 'Sửa tường 2',
      undo: () => {
        calls.push('undo-2');
      },
    });

    // Somebody already pressed Undo on the first change on its own.
    expect(spent.undo()).toEqual({ data: undefined, ok: true });
    calls.length = 0;

    const group = combineUndoTickets([spent, live], { description: 'Hoàn tác 2 thay đổi' });
    const outcome = group?.undo();

    expect(outcome).toEqual({ error: 'expired', ok: false });
    // The one that still could be undone was, rather than being skipped because
    // its neighbour refused.
    expect(calls).toEqual(['undo-2']);
  });

  it('is spent after one press, like any other ticket', () => {
    const calls: string[] = [];
    const group = combineUndoTickets(
      [
        createUndoTicket({ description: 'Sửa tường 1', undo: () => calls.push('undo-1') }),
        createUndoTicket({ description: 'Sửa tường 2', undo: () => calls.push('undo-2') }),
      ],
      { description: 'Hoàn tác 2 thay đổi' },
    );

    expect(group?.undo()).toEqual({ data: undefined, ok: true });
    expect(group?.getStatus()).toBe('used');
    expect(group?.undo()).toEqual({ error: 'expired', ok: false });
    expect(calls).toEqual(['undo-2', 'undo-1']);
  });
});

/* -------------------------------------------------------------------------- */
/* Grouping a notification that carries no ticket at all.                      */
/* -------------------------------------------------------------------------- */

describe('createNotificationBus — grouping messages with nothing to undo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** The shape `notifyFailure` publishes: a real error, and no way back. */
  const failure = (title: string, description: string): NotificationInput => ({
    description,
    title,
    type: 'saveFailed',
  });

  it('keeps both real messages when two failures collapse into one notification', () => {
    const bus = createNotificationBus();

    bus.publish(failure('Không lưu được tường W-1', 'Máy chủ trả lỗi 409.'));
    vi.advanceTimersByTime(1000);
    bus.publish(failure('Không lưu được tường W-2', 'Máy chủ trả lỗi 500.'));

    const [notification] = bus.list();

    expect(bus.list()).toHaveLength(1);
    // Neither field may be replaced by "Hoàn tác 2 thay đổi": there is nothing to
    // undo, and overwriting them destroyed two real error messages while
    // inviting the user to take back two things that cannot be taken back.
    expect(notification?.title).toBe('Không lưu được tường W-2');
    expect(notification?.description).toBe('Máy chủ trả lỗi 500.');
    expect(notification?.undoTicket).toBeUndefined();
  });

  it('counts what can be undone, not how many messages arrived', () => {
    const bus = createNotificationBus();
    const undoable: NotificationInput = {
      description: 'Đã xoá tường W-3.',
      title: 'Đã xoá tường W-3',
      type: 'saveFailed',
      undoTicket: createUndoTicket({ description: 'Hoàn tác xoá tường', undo: () => {} }),
    };

    bus.publish(failure('Không lưu được tường W-1', 'Máy chủ trả lỗi 409.'));
    bus.publish(undoable);

    const [notification] = bus.list();

    // Two entries, one ticket: a single thing to undo, so no group label and the
    // ticket is the child's own.
    expect(notification?.description).toBe('Đã xoá tường W-3.');
    expect(notification?.undoTicket).toBe(undoable.undoTicket);
  });
});
