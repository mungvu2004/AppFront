import viMessages from '@/i18n/vi.json';
import { createUuid } from '@/lib/http/ids';

import { createUndoTicket, type UndoTicket } from './undoTicket';

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

const buildGroupedTicket = (entries: readonly NotificationInput[], now: () => number): UndoTicket | undefined => {
  const tickets = entries
    .map((entry) => entry.undoTicket)
    .filter((ticket): ticket is UndoTicket => ticket !== undefined);

  if (tickets.length === 0) {
    return undefined;
  }

  if (tickets.length === 1) {
    return tickets[0];
  }

  return createUndoTicket({
    description: formatUndoGroupLabel(tickets.length),
    now,
    undo: () => {
      for (const ticket of [...tickets].reverse()) {
        ticket.undo();
      }
    },
  });
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

      const isGrouped = pending.entries.length > 1;
      const groupedTicket = buildGroupedTicket(pending.entries, now);
      const label = isGrouped ? formatUndoGroupLabel(pending.entries.length) : undefined;

      upsertNotification(pending.notificationId, pending.firstAt, {
        description: label ?? input.description,
        title: label ?? input.title,
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
