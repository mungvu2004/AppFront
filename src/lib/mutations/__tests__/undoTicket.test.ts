import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createNotificationBus, type NotificationInput } from '../notificationBus';
import { UNDO_WINDOW_MS, createUndoTicket } from '../undoTicket';

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
    expect(notifications[0]?.title).toBe('Hoàn tác 3 thay đổi');

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
