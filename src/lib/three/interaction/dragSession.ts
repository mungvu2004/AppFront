/**
 * One drag, from the moment the handle is grabbed to the moment it is let go,
 * and the two promises that make direct editing in 3D safe to offer at all.
 *
 * **Two hundred frames of dragging produce one command.** Not two hundred, not
 * one per frame coalesced afterwards — one, built once, at the release. This is
 * not an optimisation. A command is the unit of undo (`lib/commands/types`), so
 * a drag that emitted a command per pointer move would put two hundred entries
 * in the history and ask the user to press Ctrl+Z two hundred times to put back
 * one wall. The session simply has no path from `move` to the command builder:
 * `move` computes, previews and validates, and `drop` is the only method that
 * can build. That is a structural guarantee rather than a rule anybody has to
 * keep.
 *
 * **Nothing real is written until the release.** While the drag is live the
 * session emits a {@link DragPreview} and nothing else — no store, no
 * `commit()`, no patch. The saved drawing is the thing being validated *against*
 * throughout, which is exactly why validating on every move is both cheap and
 * correct: `context.graph` cannot have moved under the drag, because the drag
 * has not touched it. A consumer stages the preview on `draftOperations` and
 * the saved data underneath stays as it was.
 *
 * Those two together are what makes **Esc** trivial. Cancelling is not a rollback
 * and undoes nothing, because nothing was done: the session emits a preview with
 * no delta in it, the consumer drops the draft, and the saved data is already
 * the original. A cancel that had to reverse anything would be a design that had
 * already written too early.
 *
 * **A refusal is visible before the drop, not after it.** Every move runs the
 * business `validate…` for the edit being dragged, so a wall dragged down to
 * 40 mm long shows the violation outline *while the pointer is still down* and
 * the release does nothing. The alternative — let go, then read a toast
 * explaining why it did not work — is the interaction this file exists to avoid.
 *
 * What a drag *means* is `gizmo.ts`. This file owns only what a drag *does*.
 */

import type { Millimetres, Degrees } from '@/domain/units/types';
import type { CommandContext, CommandResult } from '@/lib/commands/business/shared';
import type { Command } from '@/lib/commands/types';
import type { ViewStatusCode } from '@/lib/viewmodel/types';

import {
  describeDelta,
  gizmoStatus,
  isZeroDelta,
  measureDrag,
  type GizmoAnchor,
  type GizmoDelta,
  type GizmoHandle,
  type PickRay,
} from './gizmo';

/* -------------------------------------------------------------------------- */
/* Vocabulary.                                                                 */
/* -------------------------------------------------------------------------- */

/** Where a session has got to. `dragging` is the only state that accepts input. */
export type DragPhase = 'dragging' | 'committed' | 'cancelled';

/**
 * Everything the screen needs while the drag is live, and nothing it does not.
 *
 * `delta` is `null` for the two ends of the story — a pointer that gives no
 * reading, and a cancelled drag — which is the same thing to a consumer: show
 * the saved data, stage nothing.
 */
export interface DragPreview {
  readonly phase: DragPhase;
  /** The pending edit, or `null` when there is none to show. */
  readonly delta: GizmoDelta | null;
  /** The provisional reading, already formatted. `null` when there is no delta. */
  readonly measurement: string | null;
  /** Which of the three state colours the outline should take. */
  readonly status: ViewStatusCode;
  /** Whether letting go now would be refused. */
  readonly blocked: boolean;
  /** Vietnamese sentences saying why, in the words the interface shows. */
  readonly reasons: readonly string[];
}

/** What the release came to. */
export type DragOutcome =
  /** The one command this drag produces. Dispatching it is the caller's job. */
  | { readonly kind: 'committed'; readonly command: Command; readonly delta: GizmoDelta }
  /** The edit was not allowed; the same sentences the outline was showing. */
  | { readonly kind: 'refused'; readonly reasons: readonly string[] }
  /** Nothing to do: no reading, no movement, or the session was already over. */
  | { readonly kind: 'nothingToDo' };

/**
 * How a measured drag becomes a business command.
 *
 * The three functions are the shape every builder in `lib/commands/business`
 * already has, so binding one is naming it twice:
 *
 * ```ts
 * {
 *   context,
 *   toInput: (delta) =>
 *     delta.mode === 'translate' ? { furnitureId, to: shifted(item, delta) } : null,
 *   validate: validateMoveFurniture,
 *   build: createMoveFurnitureCommand,
 * }
 * ```
 *
 * `toInput` returning `null` says this handle cannot express itself as this
 * command — a rotate drag bound to a move, say — and the drag is blocked rather
 * than quietly doing something else.
 */
export interface CommandBinding<TInput> {
  /** The drawing as saved, read on every move and never written to. */
  readonly context: CommandContext;
  readonly toInput: (delta: GizmoDelta) => TInput | null;
  readonly validate: (input: TInput, context: CommandContext) => readonly string[];
  readonly build: (input: TInput, context: CommandContext) => CommandResult;
}

export interface DragSessionOptions<TInput> {
  readonly handle: GizmoHandle;
  readonly anchor: GizmoAnchor;
  /** The ray the pointer was on when the handle was grabbed. */
  readonly startRay: PickRay;
  readonly binding: CommandBinding<TInput>;
  /** Called for every preview, including the last one. */
  readonly onPreview?: (preview: DragPreview) => void;
  readonly gridStepMm?: Millimetres;
  readonly angleStepDeg?: Degrees;
}

export interface DragSession {
  readonly handle: GizmoHandle;
  /** Feed a pointer ray in; returns what the screen should now show. */
  move: (ray: PickRay) => DragPreview;
  /** Let go. Builds at most one command, and ends the session either way. */
  drop: () => DragOutcome;
  /** Esc. Ends the session with nothing built and nothing to undo. */
  cancel: () => DragPreview;
  /** The most recent preview, for a consumer that missed the callback. */
  current: () => DragPreview;
  /** Once true, `move` is inert and `drop` can only report `nothingToDo`. */
  isFinished: () => boolean;
}

/** Said when a handle is bound to a command that cannot express it. */
const UNSUPPORTED_REASON = 'Thao tác kéo này không dựng được thành một lệnh tương ứng.';

/* -------------------------------------------------------------------------- */
/* Internals.                                                                  */
/* -------------------------------------------------------------------------- */

/** A preview carrying no pending edit: the start, and both endings. */
function emptyPreview(phase: DragPhase): DragPreview {
  return {
    blocked: false,
    delta: null,
    measurement: null,
    phase,
    reasons: [],
    status: gizmoStatus(phase === 'dragging' ? 'dragging' : 'idle'),
  };
}

/* -------------------------------------------------------------------------- */
/* The session.                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Begin a drag on one handle.
 *
 * The session starts in `dragging` with an empty preview: the handle has been
 * grabbed but the pointer has not moved, so there is a session and no edit.
 * Nothing is emitted until the first `move`.
 */
export function createDragSession<TInput>(options: DragSessionOptions<TInput>): DragSession {
  const { anchor, binding, handle, startRay } = options;
  const snapOptions = {
    ...(options.gridStepMm === undefined ? {} : { gridStepMm: options.gridStepMm }),
    ...(options.angleStepDeg === undefined ? {} : { angleStepDeg: options.angleStepDeg }),
  };

  let phase: DragPhase = 'dragging';
  let preview: DragPreview = emptyPreview('dragging');
  /** The last reading, kept so `drop` builds from what the screen last showed. */
  let pending: { readonly delta: GizmoDelta; readonly input: TInput } | null = null;

  const publish = (next: DragPreview): DragPreview => {
    preview = next;
    options.onPreview?.(next);

    return next;
  };

  const finish = (ending: DragPhase): void => {
    phase = ending;
    pending = null;
  };

  const move = (ray: PickRay): DragPreview => {
    if (phase !== 'dragging') {
      return preview;
    }

    const delta = measureDrag(handle, anchor, startRay, ray, snapOptions);

    if (delta === null) {
      pending = null;

      return publish(emptyPreview('dragging'));
    }

    const measurement = describeDelta(delta);
    const input = binding.toInput(delta);

    if (input === null) {
      pending = null;

      return publish({
        blocked: true,
        delta,
        measurement,
        phase: 'dragging',
        reasons: [UNSUPPORTED_REASON],
        status: gizmoStatus('blocked'),
      });
    }

    // A drag that has come back to where it started is not an edit and is not a
    // fault either: the reading is shown, the outline stays calm, and the
    // release will simply do nothing. Running the business validation on it
    // would report "nothing has changed" as though it were a problem.
    const reasons = isZeroDelta(delta) ? [] : binding.validate(input, binding.context);
    const blocked = reasons.length > 0;

    pending = blocked ? null : { delta, input };

    return publish({
      blocked,
      delta,
      measurement,
      phase: 'dragging',
      reasons,
      status: gizmoStatus(blocked ? 'blocked' : 'dragging'),
    });
  };

  const drop = (): DragOutcome => {
    if (phase !== 'dragging') {
      return { kind: 'nothingToDo' };
    }

    // Whatever happens below, this session is over. Setting it here rather than
    // on each path is what makes a second `drop` unable to build a second
    // command, however it is reached.
    const settled = pending;
    const blockedReasons = preview.reasons;
    const wasBlocked = preview.blocked;

    finish('committed');

    if (wasBlocked) {
      publish({ ...emptyPreview('committed'), reasons: blockedReasons });

      return { kind: 'refused', reasons: blockedReasons };
    }

    if (settled === null || isZeroDelta(settled.delta)) {
      publish(emptyPreview('committed'));

      return { kind: 'nothingToDo' };
    }

    const built = binding.build(settled.input, binding.context);

    if (!built.ok) {
      publish({ ...emptyPreview('committed'), reasons: built.error.reasons });

      return { kind: 'refused', reasons: built.error.reasons };
    }

    publish(emptyPreview('committed'));

    return { command: built.data, delta: settled.delta, kind: 'committed' };
  };

  const cancel = (): DragPreview => {
    if (phase !== 'dragging') {
      return preview;
    }

    finish('cancelled');

    // No command, no rollback, nothing to undo. The saved drawing was never
    // touched, so dropping the preview *is* the restoration.
    return publish(emptyPreview('cancelled'));
  };

  return {
    cancel,
    current: () => preview,
    drop,
    handle,
    isFinished: () => phase !== 'dragging',
    move,
  };
}
