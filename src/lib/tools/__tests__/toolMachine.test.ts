/**
 * The toolbar's lifecycle, checked on all eight tools at once.
 *
 * Three properties carry the file, and each is checked over the whole registry
 * rather than on a favourite tool:
 *
 * - **Esc leaves nothing behind.** After a cancel, the state is compared with
 *   `createToolState` field by field — not "the phase is ready", but "there is
 *   no pick, no ghost, no minted id and nothing pending anywhere". A gesture
 *   that survived cancelling in any single field would fail.
 * - **Switching tool throws the draft away.** Same comparison, plus the
 *   evidence that the abandoned gesture never emits: the outcomes of a whole
 *   session are collected and the list is read at the end.
 * - **A tool only ever emits.** The reducer's outcome is the only thing a
 *   transition produces, and the four tools that touch the drawing produce a
 *   `ToolCommandRequest` naming a builder — never a patch, never a `Command`.
 *
 * The id port is a counter rather than `createId`, so every assertion below is
 * about the machine and not about randomness.
 *
 * Several assertions compare a `${tool}:${fact}` string rather than the fact on
 * its own. The loops run over all eight tools, and a bare `expect(fact)` would
 * report which value was wrong without saying which tool produced it.
 */

import { describe, expect, it } from 'vitest';

import { measureDistance } from '@/domain/measure/measure';
import { ID_PREFIX_BY_KIND, isIdOfKind, type EntityKind, type IdByKind } from '@/domain/spatial/ids';
import type { EntityId, Point } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';
import { OPENING_COMMAND_TYPES } from '@/lib/commands/business/openingCommands';
import { WALL_COMMAND_TYPES } from '@/lib/commands/business/wallCommands';

import { TOOLS } from '../tools';
import {
  createToolState,
  DEFAULT_TOOL_SETTINGS,
  pendingStep,
  reduceTool,
  TOOL_IDS,
  type ToolContext,
  type ToolDeps,
  type ToolEvent,
  type ToolId,
  type ToolInputValue,
  type ToolMachineState,
  type ToolOutcome,
  type ToolStep,
} from '../toolMachine';

/* -------------------------------------------------------------------------- */
/* Fixture.                                                                    */
/* -------------------------------------------------------------------------- */

const LEVEL_ONE = 'L-LVL001AAAA' as const;
const SOUTH_WALL = 'W-SOUTH01AAA' as const;

const FIRST_PICK: Point = { x: 0, y: 0 };
const HOVER_PICK: Point = { x: 2_400, y: 0 };
const SECOND_PICK: Point = { x: 4_800, y: 0 };
const DRAG_BY: Point = { x: -1_200, y: 350 };
const NOTE_BODY = 'Kiểm tra lại độ dày tường ở đoạn này.';

/** A counting id port, so the ids in the assertions are the ids the tool used. */
const createIdPort = (): ToolContext['nextId'] => {
  let issued = 0;

  return <K extends EntityKind>(kind: K): IdByKind[K] => {
    issued += 1;

    return `${ID_PREFIX_BY_KIND[kind]}-${String(issued).padStart(6, '0')}TEST` as IdByKind[K];
  };
};

const createDeps = (): ToolDeps => ({
  tools: TOOLS,
  context: {
    levelId: LEVEL_ONE,
    settings: DEFAULT_TOOL_SETTINGS,
    nextId: createIdPort(),
  },
});

/* -------------------------------------------------------------------------- */
/* Driving the machine.                                                        */
/* -------------------------------------------------------------------------- */

/** A value that answers one step, whatever the step asks for. */
const valueForStep = (step: ToolStep, index: number): ToolInputValue => {
  switch (step.kind) {
    case 'point':
      return { kind: 'point', at: index === 0 ? FIRST_PICK : SECOND_PICK };
    case 'entity':
      return { kind: 'entity', id: SOUTH_WALL };
    case 'drag':
      return { kind: 'drag', byMm: DRAG_BY };
    case 'text':
      return { kind: 'text', text: NOTE_BODY };
  }
};

/** Every step of one tool, answered in order. */
const valuesFor = (tool: ToolId): readonly ToolInputValue[] =>
  TOOLS[tool].steps.map((step, index) => valueForStep(step, index));

/** Runs a list of events and keeps everything they emitted. */
const run = (
  start: ToolMachineState,
  events: readonly ToolEvent[],
  deps: ToolDeps,
): { readonly state: ToolMachineState; readonly outcomes: readonly ToolOutcome[] } => {
  const outcomes: ToolOutcome[] = [];
  let state = start;

  for (const event of events) {
    const transition = reduceTool(state, event, deps);

    state = transition.state;

    if (transition.outcome !== null) {
      outcomes.push(transition.outcome);
    }
  }

  return { state, outcomes };
};

const inputEvents = (values: readonly ToolInputValue[]): readonly ToolEvent[] =>
  values.map((value) => ({ type: 'input', value }) as const);

/** The tool with every step filled in, waiting for a commit. */
const intoConfirming = (tool: ToolId, deps: ToolDeps): ToolMachineState =>
  run(createToolState(tool), inputEvents(valuesFor(tool)), deps).state;

/**
 * The six tools that have something to draw before they are done.
 *
 * `select` and `pan` are not among them on purpose: a single pick with no ghost
 * to follow goes straight from `ready` to `confirming`, because there is
 * nothing to draw in between.
 */
const TOOLS_WITH_DRAWING_PHASE: readonly ToolId[] = [
  'drawWall',
  'placeOpening',
  'placeFurniture',
  'measure',
  'splitWall',
  'annotate',
];

/** The tool part-way through its gesture, ghost live and nothing pending. */
const intoDrawing = (tool: ToolId, deps: ToolDeps): ToolMachineState => {
  const values = valuesFor(tool);

  if (values.length > 1) {
    return run(createToolState(tool), inputEvents(values.slice(0, -1)), deps).state;
  }

  return reduceTool(createToolState(tool), { type: 'hover', at: HOVER_PICK }, deps).state;
};

/* -------------------------------------------------------------------------- */
/* The declaration each tool makes.                                            */
/* -------------------------------------------------------------------------- */

describe('the eight tools', () => {
  it('declares all eight, each with its own input steps', () => {
    expect(TOOL_IDS).toHaveLength(8);
    expect(Object.keys(TOOLS).sort()).toEqual([...TOOL_IDS].sort());

    for (const tool of TOOL_IDS) {
      const definition = TOOLS[tool];

      expect(definition.id).toBe(tool);
      expect(definition.steps.length).toBeGreaterThan(0);

      for (const step of definition.steps) {
        expect(step.hint.trim()).not.toBe('');
      }
    }
  });

  it('labels every tool in lower case sentence style, as invariant A6 requires', () => {
    for (const tool of TOOL_IDS) {
      const { label } = TOOLS[tool];

      expect(label).toBe(label.toLowerCase());
      expect(label.trim()).not.toBe('');
    }
  });

  it('names the step it is waiting for at each point of a gesture', () => {
    const deps = createDeps();
    const start = createToolState('drawWall');

    expect(pendingStep(start, TOOLS)?.kind).toBe('point');

    const afterFirst = run(start, inputEvents(valuesFor('drawWall').slice(0, 1)), deps).state;

    expect(pendingStep(afterFirst, TOOLS)?.kind).toBe('point');
    expect(pendingStep(intoConfirming('drawWall', deps), TOOLS)).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* The three phases.                                                           */
/* -------------------------------------------------------------------------- */

describe('the tool state machine', () => {
  it('runs a wall through ready, drawing, confirming and back to ready', () => {
    const deps = createDeps();
    const ready = createToolState('drawWall');

    expect(ready.phase).toBe('ready');

    const started = reduceTool(ready, { type: 'input', value: { kind: 'point', at: FIRST_PICK } }, deps);

    expect(started.state.phase).toBe('drawing');
    expect(started.state.values).toHaveLength(1);
    expect(started.state.pending).toBeNull();
    expect(started.outcome).toBeNull();
    expect(isIdOfKind('wall', started.state.draftId ?? '')).toBe(true);

    const hovering = reduceTool(started.state, { type: 'hover', at: HOVER_PICK }, deps);

    expect(hovering.state.phase).toBe('drawing');
    expect(hovering.state.preview).toEqual({
      kind: 'wallGhost',
      centreline: { start: FIRST_PICK, end: HOVER_PICK },
      thicknessMm: DEFAULT_TOOL_SETTINGS.wallThicknessMm,
      heightMm: DEFAULT_TOOL_SETTINGS.wallHeightMm,
      wallKind: DEFAULT_TOOL_SETTINGS.wallKind,
    });

    const finished = reduceTool(
      hovering.state,
      { type: 'input', value: { kind: 'point', at: SECOND_PICK } },
      deps,
    );

    expect(finished.state.phase).toBe('confirming');
    expect(finished.state.hoverAt).toBeNull();
    expect(finished.outcome).toBeNull();
    expect(finished.state.pending).toEqual({
      kind: 'command',
      request: {
        type: WALL_COMMAND_TYPES.draw,
        input: {
          id: started.state.draftId,
          levelId: LEVEL_ONE,
          centreline: { start: FIRST_PICK, end: SECOND_PICK },
          thicknessMm: DEFAULT_TOOL_SETTINGS.wallThicknessMm,
          heightMm: DEFAULT_TOOL_SETTINGS.wallHeightMm,
          kind: DEFAULT_TOOL_SETTINGS.wallKind,
        },
      },
    });

    const committed = reduceTool(finished.state, { type: 'commit' }, deps);

    expect(committed.outcome).toEqual(finished.state.pending);
    expect(committed.discarded).toBe(true);
    expect(committed.state).toEqual(createToolState('drawWall'));
  });

  it('gives a drawing phase to the six tools with a ghost, and to no others', () => {
    const deps = createDeps();

    for (const tool of TOOL_IDS) {
      const drawing = intoDrawing(tool, deps);
      const expected = TOOLS_WITH_DRAWING_PHASE.includes(tool) ? 'drawing' : 'ready';

      expect(`${tool}:${drawing.phase}`).toBe(`${tool}:${expected}`);
      expect(drawing.pending).toBeNull();
    }
  });

  it('emits on the commit and on no other transition, for every tool', () => {
    const deps = createDeps();

    for (const tool of TOOL_IDS) {
      const session = run(
        createToolState(tool),
        [{ type: 'hover', at: HOVER_PICK }, ...inputEvents(valuesFor(tool))],
        deps,
      );

      expect(`${tool}:${session.outcomes.length}`).toBe(`${tool}:0`);
      expect(`${tool}:${session.state.phase}`).toBe(`${tool}:confirming`);

      const committed = reduceTool(session.state, { type: 'commit' }, deps);

      expect(committed.outcome).not.toBeNull();
    }
  });

  it('ignores a commit while steps are still missing', () => {
    const deps = createDeps();
    const drawing = intoDrawing('drawWall', deps);
    const committed = reduceTool(drawing, { type: 'commit' }, deps);

    expect(committed.outcome).toBeNull();
    expect(committed.discarded).toBe(false);
    expect(committed.state).toBe(drawing);
  });

  it('refuses an input that does not answer the step being asked for', () => {
    const deps = createDeps();
    const ready = createToolState('splitWall');
    const wrongKind = reduceTool(ready, { type: 'input', value: { kind: 'point', at: FIRST_PICK } }, deps);

    expect(wrongKind.state).toBe(ready);
    expect(wrongKind.state.phase).toBe('ready');
  });

  it('takes no further input once every step is filled', () => {
    const deps = createDeps();
    const confirming = intoConfirming('measure', deps);
    const extra = reduceTool(confirming, { type: 'input', value: { kind: 'point', at: HOVER_PICK } }, deps);

    expect(extra.state).toBe(confirming);
    expect(extra.state.values).toHaveLength(2);
  });
});

/* -------------------------------------------------------------------------- */
/* Esc, and switching tool.                                                    */
/* -------------------------------------------------------------------------- */

describe('discarding a draft', () => {
  it('leaves nothing behind when Esc lands mid-gesture, for every tool', () => {
    const deps = createDeps();

    for (const tool of TOOL_IDS) {
      const drawing = intoDrawing(tool, deps);
      const cancelled = reduceTool(drawing, { type: 'cancel' }, deps);

      expect(cancelled.outcome).toBeNull();
      expect(cancelled.state).toEqual(createToolState(tool));
      expect(cancelled.state.values).toEqual([]);
      expect(cancelled.state.preview).toBeNull();
      expect(cancelled.state.pending).toBeNull();
      expect(cancelled.state.draftId).toBeNull();
      expect(cancelled.state.hoverAt).toBeNull();
    }
  });

  it('throws the waiting command away when Esc lands on the confirming phase', () => {
    const deps = createDeps();

    for (const tool of TOOL_IDS) {
      const confirming = intoConfirming(tool, deps);

      expect(confirming.pending).not.toBeNull();

      const cancelled = reduceTool(confirming, { type: 'cancel' }, deps);

      expect(cancelled.outcome).toBeNull();
      expect(cancelled.discarded).toBe(true);
      expect(cancelled.state).toEqual(createToolState(tool));
    }
  });

  it('reports no discard when Esc arrives at an idle tool', () => {
    const deps = createDeps();
    const ready = createToolState('select');
    const cancelled = reduceTool(ready, { type: 'cancel' }, deps);

    expect(cancelled.state).toBe(ready);
    expect(cancelled.discarded).toBe(false);
  });

  it('wipes the draft when the tool is switched half-way through a wall', () => {
    const deps = createDeps();
    const drawing = reduceTool(
      createToolState('drawWall'),
      { type: 'input', value: { kind: 'point', at: FIRST_PICK } },
      deps,
    ).state;

    expect(drawing.values).toHaveLength(1);
    expect(drawing.draftId).not.toBeNull();

    const switched = reduceTool(drawing, { type: 'activate', tool: 'measure' }, deps);

    expect(switched.discarded).toBe(true);
    expect(switched.outcome).toBeNull();
    expect(switched.state).toEqual(createToolState('measure'));
    expect(switched.state.tool).toBe('measure');
    expect(switched.state.values).toEqual([]);
    expect(switched.state.draftId).toBeNull();
    expect(switched.state.preview).toBeNull();
    expect(switched.state.pending).toBeNull();
  });

  it('never emits a command for a wall gesture that was abandoned', () => {
    const deps = createDeps();
    const session = run(
      createToolState('drawWall'),
      [
        { type: 'input', value: { kind: 'point', at: FIRST_PICK } },
        { type: 'hover', at: HOVER_PICK },
        { type: 'activate', tool: 'measure' },
        ...inputEvents(valuesFor('measure')),
        { type: 'commit' },
      ],
      deps,
    );

    expect(session.outcomes).toHaveLength(1);
    expect(session.outcomes.every((outcome) => outcome.kind !== 'command')).toBe(true);
    expect(session.state).toEqual(createToolState('measure'));
  });

  it('runs one tool at a time: the old tool’s next step is refused after a switch', () => {
    const deps = createDeps();
    const drawing = reduceTool(
      createToolState('drawWall'),
      { type: 'input', value: { kind: 'point', at: FIRST_PICK } },
      deps,
    ).state;
    const switched = reduceTool(drawing, { type: 'activate', tool: 'annotate' }, deps).state;
    const stalePick = reduceTool(switched, { type: 'input', value: { kind: 'point', at: SECOND_PICK } }, deps);

    expect(switched.tool).toBe('annotate');
    expect(stalePick.state).toBe(switched);
    expect(stalePick.state.values).toEqual([]);
  });

  it('discards nothing when the idle tool already in hand is picked again', () => {
    const deps = createDeps();
    const ready = createToolState('pan');
    const again = reduceTool(ready, { type: 'activate', tool: 'pan' }, deps);

    expect(again.state).toBe(ready);
    expect(again.discarded).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* What each tool emits.                                                       */
/* -------------------------------------------------------------------------- */

describe('the outcome a finished gesture emits', () => {
  const commit = (tool: ToolId, deps: ToolDeps): ToolOutcome | null =>
    reduceTool(intoConfirming(tool, deps), { type: 'commit' }, deps).outcome;

  it('sends a command request, never data, from the four tools that edit the drawing', () => {
    const deps = createDeps();
    const expected: Readonly<Record<string, string>> = {
      drawWall: WALL_COMMAND_TYPES.draw,
      placeOpening: OPENING_COMMAND_TYPES.addOpening,
      placeFurniture: OPENING_COMMAND_TYPES.addFurniture,
      splitWall: WALL_COMMAND_TYPES.split,
    };

    for (const [tool, type] of Object.entries(expected)) {
      const outcome = commit(tool as ToolId, deps);

      expect(outcome?.kind).toBe('command');
      expect(outcome !== null && outcome.kind === 'command' ? outcome.request.type : null).toBe(type);
    }
  });

  it('sends no command from the four tools that change nothing in the drawing', () => {
    const deps = createDeps();

    for (const tool of ['select', 'pan', 'measure', 'annotate'] as const) {
      const outcome = commit(tool, deps);

      expect(`${tool}:${outcome?.kind ?? 'none'}`).not.toBe(`${tool}:command`);
    }
  });

  it('returns the picked entity from the select tool', () => {
    expect(commit('select', createDeps())).toEqual({ kind: 'selection', ids: [SOUTH_WALL] });
  });

  it('returns the travel in millimetres of plan from the pan tool', () => {
    expect(commit('pan', createDeps())).toEqual({ kind: 'viewport', panByMm: DRAG_BY });
  });

  it('returns the domain reading from the measure tool rather than its own arithmetic', () => {
    expect(commit('measure', createDeps())).toEqual({
      kind: 'measurement',
      measurement: measureDistance(
        { x: millimetres(FIRST_PICK.x), y: millimetres(FIRST_PICK.y) },
        { x: millimetres(SECOND_PICK.x), y: millimetres(SECOND_PICK.y) },
      ),
    });
  });

  it('returns the note against the picked entity from the annotate tool', () => {
    expect(commit('annotate', createDeps())).toEqual({
      kind: 'note',
      note: { entityId: SOUTH_WALL, body: NOTE_BODY },
    });
  });

  it('refuses a blank note body', () => {
    const deps = createDeps();
    const withEntity = reduceTool(
      createToolState('annotate'),
      { type: 'input', value: { kind: 'entity', id: SOUTH_WALL } },
      deps,
    ).state;
    const blank = reduceTool(withEntity, { type: 'input', value: { kind: 'text', text: '   ' } }, deps);

    expect(blank.state).toBe(withEntity);
    expect(blank.state.phase).toBe('drawing');
    expect(blank.state.pending).toBeNull();
  });

  it('sends a fresh id for the second piece and keeps the old one for the first', () => {
    const deps = createDeps();
    const confirming = intoConfirming('splitWall', deps);
    const outcome = reduceTool(confirming, { type: 'commit' }, deps).outcome;

    expect(outcome).toEqual({
      kind: 'command',
      request: {
        type: WALL_COMMAND_TYPES.split,
        input: { wallId: SOUTH_WALL, at: SECOND_PICK, secondWallId: confirming.draftId },
      },
    });
    expect(confirming.draftId).not.toBe(SOUTH_WALL);
  });

  it('leaves the host wall of a new opening to the command layer', () => {
    const deps = createDeps();
    const outcome = commit('placeOpening', deps);

    expect(outcome?.kind).toBe('command');
    expect(outcome !== null && outcome.kind === 'command' ? outcome.request.input : null).toEqual({
      id: expect.stringMatching(/^D-/) as unknown as string,
      levelId: LEVEL_ONE,
      kind: DEFAULT_TOOL_SETTINGS.openingKind,
      centre: FIRST_PICK,
      widthMm: DEFAULT_TOOL_SETTINGS.openingWidthMm,
      heightMm: DEFAULT_TOOL_SETTINGS.openingHeightMm,
      sillHeightMm: DEFAULT_TOOL_SETTINGS.openingSillHeightMm,
      swing: DEFAULT_TOOL_SETTINGS.openingSwing,
    });
  });

  it('builds the furniture box around the picked centre', () => {
    const deps = createDeps();
    const outcome = commit('placeFurniture', deps);
    const halfWidth = DEFAULT_TOOL_SETTINGS.furnitureWidthMm / 2;
    const halfDepth = DEFAULT_TOOL_SETTINGS.furnitureDepthMm / 2;

    expect(outcome?.kind).toBe('command');
    expect(
      outcome !== null && outcome.kind === 'command' && outcome.request.type === OPENING_COMMAND_TYPES.addFurniture
        ? outcome.request.input.boundingBox
        : null,
    ).toEqual({
      min: { x: FIRST_PICK.x - halfWidth, y: FIRST_PICK.y - halfDepth },
      max: { x: FIRST_PICK.x + halfWidth, y: FIRST_PICK.y + halfDepth },
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Preview data.                                                               */
/* -------------------------------------------------------------------------- */

describe('preview data', () => {
  it('is a ghost, carrying none of the id or review metadata of a real entity', () => {
    const deps = createDeps();
    const ghost = reduceTool(intoDrawing('drawWall', deps), { type: 'hover', at: HOVER_PICK }, deps)
      .state.preview;

    expect(ghost?.kind).toBe('wallGhost');
    expect(ghost).not.toHaveProperty('id');
    expect(ghost).not.toHaveProperty('reviewed');
    expect(ghost).not.toHaveProperty('openingIds');
  });

  it('follows the pointer until the step is picked, then holds the pick', () => {
    const deps = createDeps();
    const following = reduceTool(intoDrawing('drawWall', deps), { type: 'hover', at: HOVER_PICK }, deps).state;
    const settled = reduceTool(following, { type: 'input', value: { kind: 'point', at: SECOND_PICK } }, deps).state;

    expect(following.preview).toMatchObject({ centreline: { start: FIRST_PICK, end: HOVER_PICK } });
    expect(settled.preview).toMatchObject({ centreline: { start: FIRST_PICK, end: SECOND_PICK } });
  });

  it('shows the tape reading while the pointer is still moving', () => {
    const deps = createDeps();
    const tape = reduceTool(intoDrawing('measure', deps), { type: 'hover', at: HOVER_PICK }, deps).state.preview;

    expect(tape).toEqual({
      kind: 'tape',
      points: [FIRST_PICK, HOVER_PICK],
      measurement: measureDistance(
        { x: millimetres(FIRST_PICK.x), y: millimetres(FIRST_PICK.y) },
        { x: millimetres(HOVER_PICK.x), y: millimetres(HOVER_PICK.y) },
      ),
    });
  });

  it('refuses an unreadable coordinate rather than building a broken ghost', () => {
    const deps = createDeps();
    const broken: Point = { x: Number.NaN, y: 0 };
    const hovered = reduceTool(createToolState('placeFurniture'), { type: 'hover', at: broken }, deps);
    const picked = reduceTool(createToolState('placeOpening'), { type: 'input', value: { kind: 'point', at: broken } }, deps);

    expect(hovered.state.preview).toBeNull();
    expect(hovered.state.phase).toBe('ready');
    expect(picked.state.phase).toBe('ready');
    expect(picked.state.pending).toBeNull();
  });

  it('gives every drawing tool a ghost before it is confirmed', () => {
    const deps = createDeps();

    for (const tool of TOOLS_WITH_DRAWING_PHASE) {
      const drawing = reduceTool(intoDrawing(tool, deps), { type: 'hover', at: HOVER_PICK }, deps).state;

      expect(`${tool}:${drawing.preview === null ? 'empty' : drawing.preview.kind}`).not.toBe(`${tool}:empty`);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* The id port.                                                                */
/* -------------------------------------------------------------------------- */

describe('the id minted for a gesture', () => {
  it('is minted only for the tools that create something', () => {
    const deps = createDeps();

    for (const tool of TOOL_IDS) {
      const confirming = intoConfirming(tool, deps);
      const creates = TOOLS[tool].creates;

      expect(`${tool}:${confirming.draftId === null ? 'none' : 'minted'}`).toBe(
        `${tool}:${creates === null ? 'none' : 'minted'}`,
      );
    }
  });

  it('is minted once for the whole gesture, never once per pointer move', () => {
    const deps = createDeps();
    const started = reduceTool(
      createToolState('drawWall'),
      { type: 'input', value: { kind: 'point', at: FIRST_PICK } },
      deps,
    ).state;

    const hovered = [HOVER_PICK, SECOND_PICK, HOVER_PICK].reduce<ToolMachineState>(
      (state, at) => reduceTool(state, { type: 'hover', at }, deps).state,
      started,
    );
    const finished = reduceTool(hovered, { type: 'input', value: { kind: 'point', at: SECOND_PICK } }, deps).state;

    expect(hovered.draftId).toBe(started.draftId);
    expect(finished.draftId).toBe(started.draftId);
  });

  it('is of the kind the tool creates', () => {
    const deps = createDeps();
    const kinds: Readonly<Record<string, EntityKind>> = {
      drawWall: 'wall',
      placeOpening: 'opening',
      placeFurniture: 'furniture',
      splitWall: 'wall',
    };

    for (const [tool, kind] of Object.entries(kinds)) {
      const draftId: EntityId | null = intoConfirming(tool as ToolId, deps).draftId;

      expect(`${tool}:${isIdOfKind(kind, draftId ?? '')}`).toBe(`${tool}:true`);
    }
  });
});
