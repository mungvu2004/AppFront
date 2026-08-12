import type { Progress } from '@/api/schemas';

export interface ProgressPatchEvent<TPatch extends object = Progress> {
  eventId: string;
  patch: Partial<TPatch>;
  sequence: number;
}

export interface AppliedProgressPatchEvent<TPatch extends object = Progress> extends ProgressPatchEvent<TPatch> {
  snapshot: Partial<TPatch>;
}

export interface MergeEventsInput<TPatch extends object = Progress> {
  appliedEventIds?: Iterable<string>;
  current?: Partial<TPatch>;
  incoming: readonly ProgressPatchEvent<TPatch>[];
  lastAppliedSequence?: number;
}

export interface MergeEventsResult<TPatch extends object = Progress> {
  appliedEventIds: Set<string>;
  current: Partial<TPatch>;
  events: AppliedProgressPatchEvent<TPatch>[];
  lastAppliedSequence: number;
}

export function mergeEvents<TPatch extends object = Progress>({
  appliedEventIds = [],
  current = {},
  incoming,
  lastAppliedSequence = -1,
}: MergeEventsInput<TPatch>): MergeEventsResult<TPatch> {
  const nextAppliedEventIds = new Set(appliedEventIds);
  const eligibleEvents: ProgressPatchEvent<TPatch>[] = [];

  incoming.forEach((event) => {
    if (nextAppliedEventIds.has(event.eventId) || event.sequence <= lastAppliedSequence) {
      return;
    }

    nextAppliedEventIds.add(event.eventId);
    eligibleEvents.push(event);
  });

  const sortedEvents = [...eligibleEvents].sort((left, right) => left.sequence - right.sequence);
  const events: AppliedProgressPatchEvent<TPatch>[] = [];
  let nextCurrent: Partial<TPatch> = { ...current };
  let nextLastAppliedSequence = lastAppliedSequence;

  sortedEvents.forEach((event) => {
    nextCurrent = { ...nextCurrent, ...event.patch };
    nextLastAppliedSequence = Math.max(nextLastAppliedSequence, event.sequence);
    events.push({
      eventId: event.eventId,
      patch: event.patch,
      sequence: event.sequence,
      snapshot: nextCurrent,
    });
  });

  return {
    appliedEventIds: nextAppliedEventIds,
    current: nextCurrent,
    events,
    lastAppliedSequence: nextLastAppliedSequence,
  };
}
