/**
 * The one lifecycle every canvas tool runs on.
 *
 * A CAD toolbar goes wrong in exactly two ways, and both are avoided here by
 * construction rather than by discipline:
 *
 * - **Two tools half-active at once.** The machine holds a single `tool` field,
 *   so there is no representable state in which two tools are running. Picking
 *   another tool is a transition, and that transition throws the gesture in
 *   flight away — there is no path that carries picks from one tool into
 *   another.
 * - **A cancelled gesture leaving rubbish behind.** Every phase but `ready`
 *   lives entirely inside this state object: the picks, the ghost the draft
 *   layer shows, the outcome waiting to be emitted. `cancel` replaces the whole
 *   object with a fresh `ready` state, so cancelling cannot leave a half-drawn
 *   anything anywhere, because there was nowhere else for it to be.
 *
 * Three phases, always in this order:
 *
 * | phase        | Vietnamese  | meaning                                        |
 * |--------------|-------------|------------------------------------------------|
 * | `ready`      | sẵn sàng    | nothing picked, nothing staged                 |
 * | `drawing`    | đang vẽ     | some input taken, more wanted; ghost is live   |
 * | `confirming` | xác nhận    | every step filled, outcome computed, unsent    |
 *
 * `commit` sends the outcome and returns to `ready`; `cancel` — the Esc key —
 * returns to `ready` from anywhere and discards the draft. A tool with a single
 * input step and no ghost to hover (`select`, `pan`) has no `drawing` phase to
 * pass through: there is nothing to draw between picking and confirming. The
 * other six reach `drawing` either on their first pick or on the first hover,
 * whichever the tool's own preview answers to.
 *
 * **The machine never writes.** It computes a `ToolOutcome` and hands it back;
 * the only outcome that can reach the drawing is a `ToolCommandRequest`, which
 * names a builder in `lib/commands/business` and the input to give it. Nothing
 * here imports the store, patches the graph, or knows that `spatialSlice`
 * exists — invariant A10 holds because the tool layer has no other road.
 *
 * **The preview is never real data.** `ToolPreview` is a ghost: enough to draw
 * with and deliberately not an entity. A wall ghost carries no id and no review
 * metadata, an opening ghost carries no host wall — the host is decided by
 * `attachToWall` when the command is built, not by the cursor. The coordinator
 * stages the ghost in `draftSlice` and the spatial data never sees it.
 *
 * The machine is pure: `reduceTool` is a function of `(state, event, deps)` and
 * the one impure thing a gesture needs — a fresh entity id — arrives through
 * `ToolContext.nextId`, minted once when the gesture starts and reused until it
 * ends. That is also what lets every test below run without a store or a DOM.
 */

import type { EntityKind, IdByKind } from '@/domain/spatial/ids';
import type { Measurement } from '@/domain/measure/measure';
import type {
  BoundingBox,
  EntityId,
  FurnitureKind,
  LevelId,
  OpeningKind,
  Point,
  Segment,
  SwingDirection,
  WallId,
  WallKind,
} from '@/domain/spatial/types';
import type {
  AddFurnitureInput,
  AddOpeningInput,
} from '@/lib/commands/business/openingCommands';
import type { OPENING_COMMAND_TYPES } from '@/lib/commands/business/openingCommands';
import type { DrawWallInput, SplitWallInput } from '@/lib/commands/business/wallCommands';
import type { WALL_COMMAND_TYPES } from '@/lib/commands/business/wallCommands';

/* -------------------------------------------------------------------------- */
/* The roster.                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The eight tools of the toolbar.
 *
 * English identifiers with Vietnamese labels supplied by each definition, as
 * every other name in the codebase is. The first six match the ids the tool
 * slice already stores, so switching a session between the two costs no
 * translation; `splitWall` and `annotate` are new here.
 */
export type ToolId =
  | 'select'
  | 'pan'
  | 'drawWall'
  | 'placeOpening'
  | 'placeFurniture'
  | 'measure'
  | 'splitWall'
  | 'annotate';

/** Every tool, in the order the toolbar lists them. */
export const TOOL_IDS = [
  'select',
  'pan',
  'drawWall',
  'placeOpening',
  'placeFurniture',
  'measure',
  'splitWall',
  'annotate',
] as const satisfies readonly ToolId[];

/* -------------------------------------------------------------------------- */
/* Phases.                                                                     */
/* -------------------------------------------------------------------------- */

/** Where a gesture is in its lifecycle. */
export type ToolPhase = 'ready' | 'drawing' | 'confirming';

/** The phases, in the only order a gesture visits them. */
export const TOOL_PHASES = ['ready', 'drawing', 'confirming'] as const satisfies readonly ToolPhase[];

/**
 * What the status bar calls each phase.
 *
 * Lower case, sentence style, as invariant A6 requires of every interface label
 * that is not an axis code or an error code.
 */
export const TOOL_PHASE_LABELS: Readonly<Record<ToolPhase, string>> = {
  ready: 'sẵn sàng',
  drawing: 'đang vẽ',
  confirming: 'xác nhận',
};

/* -------------------------------------------------------------------------- */
/* Input steps.                                                                */
/* -------------------------------------------------------------------------- */

/** The kinds of input a step can ask for. */
export type ToolStepKind = 'point' | 'entity' | 'drag' | 'text';

/** One thing a tool needs before it can finish. */
export interface ToolStep {
  readonly kind: ToolStepKind;
  /** Vietnamese sentence shown while this step is the one being waited for. */
  readonly hint: string;
}

/**
 * One filled-in step.
 *
 * Tagged with the same vocabulary as `ToolStep.kind`, which is what lets the
 * machine reject an input that does not answer the question actually being
 * asked instead of quietly storing it in the wrong slot.
 */
export type ToolInputValue =
  | { readonly kind: 'point'; readonly at: Point }
  | { readonly kind: 'entity'; readonly id: EntityId }
  | { readonly kind: 'drag'; readonly byMm: Point }
  | { readonly kind: 'text'; readonly text: string };

/* -------------------------------------------------------------------------- */
/* What a tool shows while it works.                                           */
/* -------------------------------------------------------------------------- */

/**
 * The ghost the draft layer draws for a gesture in flight.
 *
 * Deliberately not an entity. A wall ghost has no id, no review metadata and no
 * opening list; an opening ghost names no host wall, because which wall a door
 * belongs to is `attachToWall`'s answer at command time and not the cursor's.
 * Nothing in this union can be mistaken for something the drawing holds, which
 * is the point: preview data lives in `draftSlice`, never in `spatialSlice`.
 */
export type ToolPreview =
  | { readonly kind: 'highlight'; readonly ids: readonly EntityId[] }
  | { readonly kind: 'pan'; readonly byMm: Point }
  | {
      readonly kind: 'wallGhost';
      readonly centreline: Segment;
      readonly thicknessMm: number;
      readonly heightMm: number;
      readonly wallKind: WallKind;
    }
  | {
      readonly kind: 'openingGhost';
      readonly centre: Point;
      readonly openingKind: OpeningKind;
      readonly widthMm: number;
      readonly heightMm: number;
      readonly sillHeightMm: number;
    }
  | {
      readonly kind: 'furnitureGhost';
      readonly centre: Point;
      readonly boundingBox: BoundingBox;
      readonly furnitureKind: FurnitureKind;
      readonly rotationDeg: number;
    }
  | {
      readonly kind: 'tape';
      readonly points: readonly Point[];
      /** The reading so far; `null` until there are two points to read between. */
      readonly measurement: Measurement | null;
    }
  | { readonly kind: 'cutMarker'; readonly wallId: WallId; readonly at: Point | null }
  | { readonly kind: 'noteDraft'; readonly entityId: EntityId; readonly body: string };

/* -------------------------------------------------------------------------- */
/* What a tool emits when it finishes.                                         */
/* -------------------------------------------------------------------------- */

/**
 * A business command a tool asks for, named by type and given its input.
 *
 * A request is not a `Command`: building one reads the drawing, and a tool has
 * no drawing to read. The coordinator hands the request to the matching builder
 * in `lib/commands/business`, which validates against the graph and answers with
 * a command or with Vietnamese sentences, and only then does `dispatch` write.
 * This is the single road from the toolbar to the data.
 */
export type ToolCommandRequest =
  | { readonly type: typeof WALL_COMMAND_TYPES.draw; readonly input: DrawWallInput }
  | { readonly type: typeof WALL_COMMAND_TYPES.split; readonly input: SplitWallInput }
  | { readonly type: typeof OPENING_COMMAND_TYPES.addOpening; readonly input: AddOpeningInput }
  | { readonly type: typeof OPENING_COMMAND_TYPES.addFurniture; readonly input: AddFurnitureInput };

/** A note a person wrote against an entity, before it is saved. */
export interface PendingNote {
  readonly entityId: EntityId;
  readonly body: string;
}

/**
 * What a finished gesture hands back.
 *
 * Only `command` reaches the drawing. The other four are outcomes that change
 * nothing a person would undo: what is selected, where the viewport looks, a
 * tape reading taken off the plan, and a note waiting for the coordinator to
 * save it. Keeping them apart from `command` is what makes "a tool only emits
 * commands" a statement the type system can enforce rather than a convention.
 */
export type ToolOutcome =
  | { readonly kind: 'command'; readonly request: ToolCommandRequest }
  | { readonly kind: 'selection'; readonly ids: readonly EntityId[] }
  | { readonly kind: 'viewport'; readonly panByMm: Point }
  | { readonly kind: 'measurement'; readonly measurement: Measurement }
  | { readonly kind: 'note'; readonly note: PendingNote };

/* -------------------------------------------------------------------------- */
/* What the tools read.                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The sizes a tool draws with until the user says otherwise.
 *
 * The tool layer owns this rather than reading the tool slice, because
 * `src/lib` may not import `src/store`; the coordinator maps one onto the other
 * in the store composition.
 */
export interface ToolSettings {
  readonly wallThicknessMm: number;
  readonly wallHeightMm: number;
  readonly wallKind: WallKind;
  readonly openingKind: OpeningKind;
  readonly openingWidthMm: number;
  readonly openingHeightMm: number;
  readonly openingSillHeightMm: number;
  readonly openingSwing: SwingDirection;
  readonly furnitureKind: FurnitureKind;
  readonly furnitureWidthMm: number;
  readonly furnitureDepthMm: number;
  readonly furnitureRotationDeg: number;
}

/** Sizes a tool starts with: an interior partition, a single door, a table. */
export const DEFAULT_TOOL_SETTINGS: ToolSettings = {
  wallThicknessMm: 110,
  wallHeightMm: 2800,
  wallKind: 'partition',
  openingKind: 'door',
  openingWidthMm: 900,
  openingHeightMm: 2200,
  openingSillHeightMm: 0,
  openingSwing: 'left',
  furnitureKind: 'table',
  furnitureWidthMm: 1200,
  furnitureDepthMm: 700,
  furnitureRotationDeg: 0,
};

/**
 * Everything a tool reads that is not part of the gesture itself.
 *
 * `nextId` is a port for the same reason `dispatch` takes ports: minting an id
 * is the one thing a gesture needs that is not a pure function of its picks, so
 * it arrives from outside and a test supplies a counting one.
 */
export interface ToolContext {
  /** The storey being drawn on. */
  readonly levelId: LevelId;
  readonly settings: ToolSettings;
  /** A fresh id for an entity kind. Called once per gesture, never per frame. */
  readonly nextId: <K extends EntityKind>(kind: K) => IdByKind[K];
}

/* -------------------------------------------------------------------------- */
/* What a tool is.                                                             */
/* -------------------------------------------------------------------------- */

/** The gesture so far, as the two tool functions are given it. */
export interface ToolBuild {
  /** Steps filled so far, in the order they were asked for. */
  readonly values: readonly ToolInputValue[];
  /** Where the pointer is now, so the ghost can follow it. `null` when unknown. */
  readonly hoverAt: Point | null;
  /** The id minted for the entity this gesture creates; `null` when it creates none. */
  readonly draftId: EntityId | null;
  readonly context: ToolContext;
}

/**
 * One tool, declared rather than coded: what it asks for, what it shows, and
 * what it emits.
 *
 * `preview` must not read `draftId` — it runs on every pointer move, and a
 * preview that needed an id would mint one per frame. `complete` is the only
 * function that may, and it runs once.
 */
export interface ToolDefinition {
  readonly id: ToolId;
  /** Vietnamese name, lower case sentence style (invariant A6). */
  readonly label: string;
  /** One Vietnamese sentence saying what the tool is for. */
  readonly description: string;
  /** The input steps this tool needs, in the order it asks for them. */
  readonly steps: readonly ToolStep[];
  /** The entity kind the tool creates, so the machine mints one id per gesture. */
  readonly creates: EntityKind | null;
  /** The ghost for the gesture so far; `null` when there is nothing to show yet. */
  readonly preview: (build: ToolBuild) => ToolPreview | null;
  /** What the tool emits once every step is filled; `null` when the input is unusable. */
  readonly complete: (build: ToolBuild) => ToolOutcome | null;
}

/** The eight tools, by id. A complete record, so a new id fails the build. */
export type ToolRegistry = Readonly<Record<ToolId, ToolDefinition>>;

/* -------------------------------------------------------------------------- */
/* The state.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The whole of the toolbar's state, and the whole of a gesture.
 *
 * Plain, serialisable data with exactly one active tool. Nothing about a
 * gesture is kept anywhere else, which is what makes `cancel` complete: there is
 * no second place for a half-drawn wall to hide.
 */
export interface ToolMachineState {
  readonly tool: ToolId;
  readonly phase: ToolPhase;
  /** Steps filled so far; `values[i]` answers `steps[i]`. */
  readonly values: readonly ToolInputValue[];
  /** Last known pointer position while drawing; `null` when the tool is idle. */
  readonly hoverAt: Point | null;
  /** Id for the entity this gesture will create; `null` until the gesture starts. */
  readonly draftId: EntityId | null;
  /** What the draft layer shows; `null` when nothing is staged. */
  readonly preview: ToolPreview | null;
  /** The outcome waiting for `commit`; `null` in every phase but `confirming`. */
  readonly pending: ToolOutcome | null;
}

/** The idle state of one tool: no picks, no ghost, nothing pending. */
export const createToolState = (tool: ToolId): ToolMachineState => ({
  tool,
  phase: 'ready',
  values: [],
  hoverAt: null,
  draftId: null,
  preview: null,
  pending: null,
});

/* -------------------------------------------------------------------------- */
/* Events and transitions.                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Everything that can happen to a tool.
 *
 * `cancel` is the Esc key and nothing else needs to be said about it: it is
 * accepted in every phase and always lands on `ready`.
 */
export type ToolEvent =
  | { readonly type: 'activate'; readonly tool: ToolId }
  | { readonly type: 'input'; readonly value: ToolInputValue }
  | { readonly type: 'hover'; readonly at: Point }
  | { readonly type: 'commit' }
  | { readonly type: 'cancel' };

/** What one transition produced. */
export interface ToolTransition {
  readonly state: ToolMachineState;
  /** Emitted by this transition only; `null` on every transition but a commit. */
  readonly outcome: ToolOutcome | null;
  /**
   * True when this transition threw a staged draft away, so the coordinator
   * knows to clear `draftSlice`. Set by `cancel`, by switching tool, and by
   * `commit` — a committed gesture's ghost is replaced by the real entity.
   */
  readonly discarded: boolean;
}

/** The registry and the context the transitions are resolved against. */
export interface ToolDeps {
  readonly tools: ToolRegistry;
  readonly context: ToolContext;
}

/** Is there anything staged that cancelling would throw away? */
const isDrafting = (state: ToolMachineState): boolean =>
  state.phase !== 'ready' ||
  state.values.length > 0 ||
  state.hoverAt !== null ||
  state.draftId !== null ||
  state.preview !== null ||
  state.pending !== null;

/** Nothing happened; the same state object comes back, so nothing re-renders. */
const stay = (state: ToolMachineState): ToolTransition => ({
  state,
  outcome: null,
  discarded: false,
});

/**
 * Back to `ready` on the named tool, with whatever was staged thrown away.
 *
 * Serves both `cancel` (same tool) and `activate` (another tool), because the
 * two differ only in which tool is left standing afterwards.
 */
const resetTo = (state: ToolMachineState, tool: ToolId): ToolTransition => {
  const discarded = isDrafting(state);

  if (!discarded && tool === state.tool) {
    return stay(state);
  }

  return { state: createToolState(tool), outcome: null, discarded };
};

/** The step this tool is waiting for, or `null` when it is waiting for none. */
export const pendingStep = (state: ToolMachineState, tools: ToolRegistry): ToolStep | null =>
  tools[state.tool].steps[state.values.length] ?? null;

/**
 * Takes one filled step.
 *
 * An input that does not answer the step actually being asked for is refused
 * rather than stored, and so is a final input the tool cannot turn into an
 * outcome — a pick on nothing leaves the gesture where it was, ready to be
 * picked again, instead of stranding it in `confirming` with nothing to send.
 */
const applyInput = (
  state: ToolMachineState,
  value: ToolInputValue,
  deps: ToolDeps,
): ToolTransition => {
  if (state.phase === 'confirming') {
    return stay(state);
  }

  const definition = deps.tools[state.tool];
  const step = definition.steps[state.values.length];

  if (step === undefined || step.kind !== value.kind) {
    return stay(state);
  }

  const values = [...state.values, value];
  const filled = values.length === definition.steps.length;
  const hoverAt = filled ? null : state.hoverAt;
  const draftId =
    state.draftId ?? (definition.creates === null ? null : deps.context.nextId(definition.creates));
  const build: ToolBuild = { values, hoverAt, draftId, context: deps.context };
  const pending = filled ? definition.complete(build) : null;

  if (filled && pending === null) {
    return stay(state);
  }

  return {
    state: {
      ...state,
      phase: filled ? 'confirming' : 'drawing',
      values,
      hoverAt,
      draftId,
      preview: definition.preview(build),
      pending,
    },
    outcome: null,
    discarded: false,
  };
};

/**
 * Moves the ghost with the pointer.
 *
 * A hover that the tool has nothing to draw for leaves an idle tool idle — this
 * is what keeps `select` and `pan` out of `drawing`, and what puts the placement
 * tools into it the moment the cursor enters the canvas.
 */
const applyHover = (state: ToolMachineState, at: Point, deps: ToolDeps): ToolTransition => {
  if (state.phase === 'confirming') {
    return stay(state);
  }

  const definition = deps.tools[state.tool];
  const preview = definition.preview({
    values: state.values,
    hoverAt: at,
    draftId: state.draftId,
    context: deps.context,
  });

  if (state.phase === 'ready' && preview === null) {
    return stay(state);
  }

  return {
    state: { ...state, phase: 'drawing', hoverAt: at, preview },
    outcome: null,
    discarded: false,
  };
};

/**
 * One transition of the toolbar.
 *
 * Total: every event is answered in every phase, and an event that means
 * nothing where it arrived returns the state object it was given, unchanged and
 * by reference.
 */
export function reduceTool(
  state: ToolMachineState,
  event: ToolEvent,
  deps: ToolDeps,
): ToolTransition {
  switch (event.type) {
    case 'activate':
      return resetTo(state, event.tool);

    case 'cancel':
      return resetTo(state, state.tool);

    case 'input':
      return applyInput(state, event.value, deps);

    case 'hover':
      return applyHover(state, event.at, deps);

    case 'commit': {
      if (state.phase !== 'confirming' || state.pending === null) {
        return stay(state);
      }

      return {
        state: createToolState(state.tool),
        outcome: state.pending,
        discarded: true,
      };
    }
  }
}
