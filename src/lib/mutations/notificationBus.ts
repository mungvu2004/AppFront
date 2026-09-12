import viMessages from '@/i18n/vi.json';
import { createUuid } from '@/lib/http/ids';

import { combineUndoTickets, type UndoTicket } from './undoTicket';

const DEFAULT_GROUP_WINDOW_MS = 5000;
const DEFAULT_MAX_VISIBLE = 3;

export interface NotificationInput {
  description: string;
  title: string;
  type: string;
  undoTicket?: UndoTicket | undefined;
}

export interface Notification {
  createdAt: number;
  description: string;
  id: string;
  title: string;
  type: string;
  undoTicket?: UndoTicket | undefined;
}

export type NotificationListener = (notifications: readonly Notification[]) => void;

export interface CreateNotificationBusOptions {
  groupWindowMs?: number;
  maxVisible?: number;
  now?: () => number;
}

export interface NotificationBus {
  list: () => readonly Notification[];
  publish: (input: NotificationInput) => void;
  subscribe: (listener: NotificationListener) => () => void;
}

interface PendingGroup {
  entries: NotificationInput[];
  firstAt: number;
  notificationId: string;
}

const formatUndoGroupLabel = (count: number): string =>
  viMessages.common.undo_group.replace('{{count}}', String(count));

/** The tickets among these entries, oldest first; entries without one are skipped. */
const ticketsOf = (entries: readonly NotificationInput[]): readonly UndoTicket[] =>
  entries
    .map((entry) => entry.undoTicket)
    .filter((ticket): ticket is UndoTicket => ticket !== undefined);

/**
 * The one ticket a grouped notification offers.
 *
 * `combineUndoTickets` is what makes it safe: the group dies with the first of
 * its children rather than outliving them on a window of its own, and a child
 * that can no longer be undone fails the whole press instead of being thrown
 * away. Both used to go the other way, and a change could disappear from a
 * grouped toast that reported success — see `undoTicket`.
 */
const buildGroupedTicket = (entries: readonly NotificationInput[], now: () => number): UndoTicket | undefined => {
  const tickets = ticketsOf(entries);

  return combineUndoTickets(tickets, { description: formatUndoGroupLabel(tickets.length), now });
};

/**
 * Pure notification state store: no toast library, no rendering. Same-type
 * publishes within `groupWindowMs` of the first one collapse into a single
 * notification whose ticket undoes every grouped change. Notifications
 * self-remove once their undo ticket expires, and only `maxVisible` are kept
 * at once, oldest evicted first.
 */
export function createNotificationBus(options: CreateNotificationBusOptions = {}): NotificationBus {
  const now = options.now ?? Date.now;
  const groupWindowMs = options.groupWindowMs ?? DEFAULT_GROUP_WINDOW_MS;
  const maxVisible = options.maxVisible ?? DEFAULT_MAX_VISIBLE;

  let notifications: Notification[] = [];
  const listeners = new Set<NotificationListener>();
  const pendingByType = new Map<string, PendingGroup>();
  const removalTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const emit = (): void => {
    const snapshot = [...notifications];
    listeners.forEach((listener) => listener(snapshot));
  };

  const cancelRemoval = (id: string): void => {
    const timer = removalTimers.get(id);

    if (timer !== undefined) {
      clearTimeout(timer);
      removalTimers.delete(id);
    }
  };

  const removeNotification = (id: string): void => {
    cancelRemoval(id);
    notifications = notifications.filter((item) => item.id !== id);
    emit();
  };

  const scheduleRemoval = (notification: Notification): void => {
    const ticket = notification.undoTicket;

    if (!ticket) {
      return;
    }

    const delayMs = Math.max(0, ticket.expiresAt - now());
    const timer = setTimeout(() => removeNotification(notification.id), delayMs);

    removalTimers.set(notification.id, timer);
  };

  const upsertNotification = (id: string, createdAt: number, fields: NotificationInput): Notification => {
    cancelRemoval(id);

    const notification: Notification = { createdAt, id, ...fields };
    const index = notifications.findIndex((item) => item.id === id);

    if (index === -1) {
      notifications = [...notifications, notification];

      if (notifications.length > maxVisible) {
        const evictCount = notifications.length - maxVisible;

        for (const evicted of notifications.slice(0, evictCount)) {
          cancelRemoval(evicted.id);
        }

        notifications = notifications.slice(evictCount);
      }
    } else {
      notifications = notifications.map((item, itemIndex) => (itemIndex === index ? notification : item));
    }

    scheduleRemoval(notification);
    emit();

    return notification;
  };

  const publish = (input: NotificationInput): void => {
    const currentTime = now();
    const pending = pendingByType.get(input.type);

    if (pending && currentTime - pending.firstAt < groupWindowMs) {
      pending.entries.push(input);

      const groupedTicket = buildGroupedTicket(pending.entries, now);
      // Counted over the tickets, not the entries: `notifyFailure` publishes
      // messages carrying no ticket at all, and two failed writes inside the
      // window used to collapse into "Hoàn tác 2 thay đổi" — over BOTH the title
      // and the description, with no ticket behind it. Two real error messages
      // destroyed, and an invitation to undo two things that cannot be undone.
      const undoableCount = ticketsOf(pending.entries).length;
      // The title stays the message. Only the sentence under it gives way to the
      // count, and only when there is really more than one thing to take back.
      const groupLabel = undoableCount > 1 ? formatUndoGroupLabel(undoableCount) : undefined;

      upsertNotification(pending.notificationId, pending.firstAt, {
        description: groupLabel ?? input.description,
        title: input.title,
        type: input.type,
        undoTicket: groupedTicket,
      });

      return;
    }

    const notificationId = createUuid();
    pendingByType.set(input.type, { entries: [input], firstAt: currentTime, notificationId });
    upsertNotification(notificationId, currentTime, input);
  };

  const subscribe = (listener: NotificationListener): (() => void) => {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  };

  return {
    list: () => notifications,
    publish,
    subscribe,
  };
}
