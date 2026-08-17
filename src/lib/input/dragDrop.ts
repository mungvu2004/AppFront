/**
 * One drag from the library to the drawing, pointer or keyboard.
 *
 * The 3D gizmo session (lib/three/interaction/dragSession.ts) already
 * established the two promises a drag must keep in this product, and this
 * module keeps them for the 2D library drop:
 *
 * - **One drag, one command.** However many moves the session sees, the only
 *   path to a `FurnitureDropRequest` is the successful `drop` transition,
 *   and it ends the session as it fires. There is no way to emit twice,
 *   because after the drop there is no session left to drop again.
 * - **A refusal is visible before the release.** Every `start`, `move` and
 *   `nudge` runs the injected `validateDrop`, so `dropAllowed` and the
 *   Vietnamese `blockReasons` are current *while the pointer is still
 *   down* — the ghost turns forbidden mid-air, it never waits for the
 *   release to disappoint. A `drop` on an illegal point emits nothing.
 *
 * Browser drag-and-drop is deliberately absent: native DnD owns the cursor,
 * hides the pointer position during the drag and fires nothing a canvas can
 * snap with. The session is a pure reducer over pointer/keyboard events the
 * consumer wires up; nothing here touches the DOM.
 *
 * The keyboard is a first-class pilot, not a fallback (invariant A12):
 * Enter picks the selected library item up, the arrow keys carry it in
 * `KEYBOARD_STEP_MM` steps on a grid the pickup snapped it to, Enter sets
 * it down. A keyboard drop on an illegal point keeps the session alive so
 * the user can keep steering; a pointer drop cannot, because the button is
 * already up.
 *
 * Like the tool machine, the session never writes: it emits a command
 * request naming the `furniture.add` builder, and minting the one id it
 * needs arrives through `nextId`, called once per session.
 */

import type {
  BoundingBox,
  FurnitureId,
  FurnitureKind,
  LevelId,
  Point,
} from '@/domain/spatial/types';
import type { AddFurnitureInput } from '@/lib/commands/business/openingCommands';
import { OPENING_COMMAND_TYPES } from '@/lib/commands/business/openingCommands';
import type { ToolPreview } from '../tools/toolMachine';

/* -------------------------------------------------------------------------- */
/* What is being dragged.                                                      */
/* -------------------------------------------------------------------------- */

/** One entry of the furniture library, as much of it as a drag reads. */
export interface DragLibraryItem {
  readonly kind: FurnitureKind;
  readonly widthMm: number;
  readonly depthMm: number;
  /** Vietnamese name, for the status bar and the screen reader. */
  readonly label: string;
}

/** Who is steering the session. */
export type DragMode = 'pointer' | 'keyboard';

/** One arrow-key step, in plan millimetres. */
export const KEYBOARD_STEP_MM = 50;

export type NudgeDirection = 'left' | 'right' | 'up' | 'down';

/** A drag in flight. */
export interface DragSession {
  readonly item: DragLibraryItem;
  /** Minted once at pickup; the id the drop will create. */
  readonly id: FurnitureId;
  /** Where the item's centre is right now, in plan millimetres. */
  readonly centre: Point;
  readonly mode: DragMode;
  /** Current verdict for this exact spot — never stale, never deferred. */
  readonly dropAllowed: boolean;
  /** Vietnamese sentences; empty exactly when `dropAllowed`. */
  readonly blockReasons: readonly string[];
}

export type DragDropState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'dragging'; readonly session: DragSession };

export const IDLE_DRAG_STATE: DragDropState = { phase: 'idle' };

/* -------------------------------------------------------------------------- */
/* Events, deps, transitions.                                                  */
/* -------------------------------------------------------------------------- */

export type DragDropEvent =
  | {
      readonly type: 'start';
      readonly item: DragLibraryItem;
      readonly at: Point;
      readonly mode: DragMode;
    }
  | { readonly type: 'move'; readonly at: Point }
  | { readonly type: 'nudge'; readonly direction: NudgeDirection }
  | { readonly type: 'drop' }
  | { readonly type: 'cancel' };

/** The one thing a successful drop emits. */
export interface FurnitureDropRequest {
  readonly type: typeof OPENING_COMMAND_TYPES.addFurniture;
  readonly input: AddFurnitureInput;
}

export interface DragDropDeps {
  /** The storey being dropped onto. */
  readonly levelId: LevelId;
  /** Mints the furniture id. Called once per session, at pickup. */
  readonly nextId: () => FurnitureId;
  /**
   * Everything wrong with dropping here; empty means allowed. Runs on every
   * start, move and nudge — validating on release only is the interaction
   * this module exists to avoid.
   */
  readonly validateDrop: (input: AddFurnitureInput) => readonly string[];
}

export interface DragDropTransition {
  readonly state: DragDropState;
  /** Emitted exactly once, by the successful drop, and by nothing else. */
  readonly request: FurnitureDropRequest | null;
}

/* -------------------------------------------------------------------------- */
/* Geometry helpers.                                                           */
/* -------------------------------------------------------------------------- */

/** The axis-aligned box of an item centred at a point. */
export const boxAround = (centre: Point, widthMm: number, depthMm: number): BoundingBox => ({
  min: { x: centre.x - widthMm / 2, y: centre.y - depthMm / 2 },
  max: { x: centre.x + widthMm / 2, y: centre.y + depthMm / 2 },
});

/** The nearest multiple of the keyboard step. */
export const snapToStepMm = (value: number, stepMm: number = KEYBOARD_STEP_MM): number =>
  Math.round(value / stepMm) * stepMm;

const NUDGE_VECTORS: Readonly<Record<NudgeDirection, Point>> = {
  left: { x: -KEYBOARD_STEP_MM, y: 0 },
  right: { x: KEYBOARD_STEP_MM, y: 0 },
  // Screen sense: up is towards the top of the plan as drawn.
  up: { x: 0, y: -KEYBOARD_STEP_MM },
  down: { x: 0, y: KEYBOARD_STEP_MM },
};

/* -------------------------------------------------------------------------- */
/* The reducer.                                                                */
/* -------------------------------------------------------------------------- */

const dropInputOf = (session: DragSession, levelId: LevelId): AddFurnitureInput => ({
  id: session.id,
  levelId,
  kind: session.item.kind,
  centre: session.centre,
  boundingBox: boxAround(session.centre, session.item.widthMm, session.item.depthMm),
  rotationDeg: 0,
});

/** A session at a spot, with the verdict for that exact spot computed. */
const sessionAt = (
  item: DragLibraryItem,
  id: FurnitureId,
  centre: Point,
  mode: DragMode,
  deps: DragDropDeps,
): DragSession => {
  const probe: DragSession = { item, id, centre, mode, dropAllowed: true, blockReasons: [] };
  const blockReasons = deps.validateDrop(dropInputOf(probe, deps.levelId));

  return { ...probe, dropAllowed: blockReasons.length === 0, blockReasons };
};

const stay = (state: DragDropState): DragDropTransition => ({ state, request: null });

/**
 * One transition of the drag. Total: every event is answered in every phase,
 * and an event that means nothing where it arrived returns the state it was
 * given.
 */
export function reduceDragDrop(
  state: DragDropState,
  event: DragDropEvent,
  deps: DragDropDeps,
): DragDropTransition {
  switch (event.type) {
    case 'start': {
      // The keyboard pickup lands on the step grid, so every later nudge
      // stays a multiple of the step; the pointer follows the hand exactly.
      const centre =
        event.mode === 'keyboard'
          ? { x: snapToStepMm(event.at.x), y: snapToStepMm(event.at.y) }
          : event.at;

      return {
        state: {
          phase: 'dragging',
          session: sessionAt(event.item, deps.nextId(), centre, event.mode, deps),
        },
        request: null,
      };
    }

    case 'move': {
      if (state.phase !== 'dragging') {
        return stay(state);
      }

      const { item, id, mode } = state.session;

      return {
        state: { phase: 'dragging', session: sessionAt(item, id, event.at, mode, deps) },
        request: null,
      };
    }

    case 'nudge': {
      if (state.phase !== 'dragging') {
        return stay(state);
      }

      const { item, id, centre, mode } = state.session;
      const vector = NUDGE_VECTORS[event.direction];
      const moved = { x: centre.x + vector.x, y: centre.y + vector.y };

      return {
        state: { phase: 'dragging', session: sessionAt(item, id, moved, mode, deps) },
        request: null,
      };
    }

    case 'drop': {
      if (state.phase !== 'dragging') {
        return stay(state);
      }

      if (!state.session.dropAllowed) {
        // A pointer release cannot be kept alive — the button is up — so it
        // ends with nothing. The keyboard keeps the item in hand so the
        // user steers on; the reasons are already on screen either way.
        return state.session.mode === 'keyboard'
          ? stay(state)
          : { state: IDLE_DRAG_STATE, request: null };
      }

      return {
        state: IDLE_DRAG_STATE,
        request: {
          type: OPENING_COMMAND_TYPES.addFurniture,
          input: dropInputOf(state.session, deps.levelId),
        },
      };
    }

    case 'cancel':
      return { state: IDLE_DRAG_STATE, request: null };
  }
}

/* -------------------------------------------------------------------------- */
/* What the rest of the interface reads off a session.                         */
/* -------------------------------------------------------------------------- */

/**
 * The ghost the draft layer draws for the drag, in the tool machine's own
 * preview vocabulary — the canvas needs no second renderer for it. Null when
 * nothing is in hand.
 */
export const dragGhost = (state: DragDropState): ToolPreview | null => {
  if (state.phase !== 'dragging') {
    return null;
  }

  const { item, centre } = state.session;

  return {
    kind: 'furnitureGhost',
    centre,
    boundingBox: boxAround(centre, item.widthMm, item.depthMm),
    furnitureKind: item.kind,
    rotationDeg: 0,
  };
};

/**
 * The keyboard wiring, as data: which drag event a key means while a
 * session is live. Null for keys the drag does not own. The consumer stops
 * propagation on the keys this answers, so the shortcut arbiter never sees
 * them while an item is in hand.
 */
export function dragEventForKey(key: string): DragDropEvent | null {
  switch (key) {
    case 'Enter':
      return { type: 'drop' };
    case 'Escape':
      return { type: 'cancel' };
    case 'ArrowLeft':
      return { type: 'nudge', direction: 'left' };
    case 'ArrowRight':
      return { type: 'nudge', direction: 'right' };
    case 'ArrowUp':
      return { type: 'nudge', direction: 'up' };
    case 'ArrowDown':
      return { type: 'nudge', direction: 'down' };
    default:
      return null;
  }
}

/**
 * One Vietnamese sentence for the status bar and the screen reader: what is
 * in hand and whether this spot takes it. Null when nothing is in hand.
 */
export function dragStatusText(state: DragDropState): string | null {
  if (state.phase !== 'dragging') {
    return null;
  }

  const { item, dropAllowed, blockReasons } = state.session;

  if (dropAllowed) {
    return `đang kéo ${item.label} — thả được ở vị trí này`;
  }

  return `đang kéo ${item.label} — không thả được: ${blockReasons.join(' ')}`;
}
