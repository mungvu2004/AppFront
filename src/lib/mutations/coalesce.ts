export const COALESCE_WINDOW_MS = 400;

export interface Command<TValue> {
  kind: string;
  previousValue: TValue;
  targetId: string;
  timestamp: number;
  value: TValue;
}

export interface CoalescedCommand<TValue> {
  kind: string;
  mergedCount: number;
  previousValue: TValue;
  targetId: string;
  timestamp: number;
  value: TValue;
}

const isCoalescible = <TValue>(
  run: CoalescedCommand<TValue>,
  next: Command<TValue>,
  windowMs: number,
): boolean =>
  run.kind === next.kind && run.targetId === next.targetId && next.timestamp - run.timestamp < windowMs;

/**
 * Merges consecutive same-kind, same-target commands into one command per
 * run, keeping the run's first `previousValue` (the state before the run
 * started, so it stays undoable back to that exact state) and the run's
 * last `value` (what actually needs to reach the server). A gap of
 * `windowMs` or more, or a change of kind/targetId, ends the current run and
 * starts a new one — a delete command never merges with an edit command
 * because they differ in `kind`.
 */
export function coalesce<TValue>(
  commands: readonly Command<TValue>[],
  windowMs: number = COALESCE_WINDOW_MS,
): CoalescedCommand<TValue>[] {
  const merged: CoalescedCommand<TValue>[] = [];

  for (const command of commands) {
    const run = merged[merged.length - 1];

    if (run && isCoalescible(run, command, windowMs)) {
      merged[merged.length - 1] = {
        ...run,
        mergedCount: run.mergedCount + 1,
        timestamp: command.timestamp,
        value: command.value,
      };
      continue;
    }

    merged.push({
      kind: command.kind,
      mergedCount: 1,
      previousValue: command.previousValue,
      targetId: command.targetId,
      timestamp: command.timestamp,
      value: command.value,
    });
  }

  return merged;
}
