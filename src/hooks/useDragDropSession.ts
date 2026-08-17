/**
 * The React seat of the library drag (lib/input/dragDrop).
 *
 * The reducer owns what a drag *is*; this hook owns its lifetime in a
 * screen: one session at a time, the single drop command handed to the
 * caller exactly once, the verdict spoken through the announcer as it
 * changes, and the cursor answer for whichever tool the canvas holds.
 *
 * Keyboard keys the drag owns (arrows, Enter, Escape) are handled at the
 * element through `handleKeyDown` — it stops propagation, so the shortcut
 * arbiter never sees them while an item is in hand, the same division of
 * labour every layer in this codebase uses.
 *
 * The state lives in a ref beside React state: dispatch reads the ref, so
 * two events in one tick cannot both act on a stale drag, and no side
 * effect ever runs inside a state updater (Strict Mode replays updaters,
 * and a replayed drop would emit the one command twice).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Point } from '@/domain/spatial/types';
import { getAppAnnouncer, type Announcer } from '@/lib/input/announcer';
import { cursorCssFor } from '@/lib/input/cursors';
import {
  dragEventForKey,
  dragGhost,
  dragStatusText,
  IDLE_DRAG_STATE,
  reduceDragDrop,
  type DragDropDeps,
  type DragDropEvent,
  type DragDropState,
  type DragLibraryItem,
  type DragMode,
  type FurnitureDropRequest,
} from '@/lib/input/dragDrop';
import type { ToolId, ToolPreview } from '@/lib/tools/toolMachine';

export interface UseDragDropSessionOptions {
  readonly deps: DragDropDeps;
  /** Receives the one command request of a successful drop. */
  onDrop(request: FurnitureDropRequest): void;
  /** Screen-reader announcer; defaults to the application's shared one. */
  readonly announcer?: Announcer;
}

/** As much of a keyboard event as the drag reads; React's satisfies it. */
export interface DragKeyEventLike {
  readonly key: string;
  preventDefault?(): void;
  stopPropagation?(): void;
}

export interface DragDropSessionApi {
  readonly state: DragDropState;
  /** The ghost for the draft layer; null when nothing is in hand. */
  readonly ghost: ToolPreview | null;
  /** Vietnamese verdict for the status bar; null when nothing is in hand. */
  readonly statusText: string | null;
  pickUp(item: DragLibraryItem, at: Point, mode?: DragMode): void;
  moveTo(at: Point): void;
  drop(): void;
  cancel(): void;
  /**
   * Element-level keydown for the canvas: consumes the keys the drag owns
   * while a session is live and reports whether it did.
   */
  handleKeyDown(event: DragKeyEventLike): boolean;
  /** The CSS cursor for the canvas right now, given the tool in hand. */
  cursorCss(tool: ToolId): string;
}

export function useDragDropSession(options: UseDragDropSessionOptions): DragDropSessionApi {
  const [state, setState] = useState<DragDropState>(IDLE_DRAG_STATE);
  const stateRef = useRef(state);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  const dispatch = useCallback((event: DragDropEvent): void => {
    const current = optionsRef.current;
    const previous = stateRef.current;
    const { state: next, request } = reduceDragDrop(previous, event, current.deps);

    stateRef.current = next;
    setState(next);

    if (request !== null) {
      current.onDrop(request);
    }

    const announcer = current.announcer ?? getAppAnnouncer();

    if (request !== null && previous.phase === 'dragging') {
      announcer.announce(`đã đặt ${previous.session.item.label} vào bản vẽ`);

      return;
    }

    const previousText = dragStatusText(previous);
    const nextText = dragStatusText(next);

    if (nextText !== null && nextText !== previousText) {
      const refused = next.phase === 'dragging' && !next.session.dropAllowed;

      announcer.announce(nextText, refused ? 'assertive' : 'polite');
    }
  }, []);

  const pickUp = useCallback(
    (item: DragLibraryItem, at: Point, mode: DragMode = 'pointer'): void =>
      dispatch({ type: 'start', item, at, mode }),
    [dispatch],
  );
  const moveTo = useCallback((at: Point): void => dispatch({ type: 'move', at }), [dispatch]);
  const drop = useCallback((): void => dispatch({ type: 'drop' }), [dispatch]);
  const cancel = useCallback((): void => dispatch({ type: 'cancel' }), [dispatch]);

  const handleKeyDown = useCallback(
    (event: DragKeyEventLike): boolean => {
      if (stateRef.current.phase !== 'dragging') {
        return false;
      }

      const dragEvent = dragEventForKey(event.key);

      if (dragEvent === null) {
        return false;
      }

      event.preventDefault?.();
      event.stopPropagation?.();
      dispatch(dragEvent);

      return true;
    },
    [dispatch],
  );

  const cursorCss = (tool: ToolId): string =>
    cursorCssFor({
      tool,
      dragging: state.phase === 'dragging',
      dropAllowed: state.phase === 'dragging' ? state.session.dropAllowed : true,
    });

  return {
    state,
    ghost: dragGhost(state),
    statusText: dragStatusText(state),
    pickUp,
    moveTo,
    drop,
    cancel,
    handleKeyDown,
    cursorCss,
  };
}
