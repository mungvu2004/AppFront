/**
 * The eight tools of the toolbar, each one declared rather than coded.
 *
 * A tool is three answers and nothing else: **what it asks for** (`steps`),
 * **what it shows while it asks** (`preview`), and **what it emits when it has
 * everything** (`complete`). All the sequencing — which step is next, when the
 * ghost updates, what Esc throws away — belongs to `toolMachine` and is written
 * once for all eight. That is what keeps the lifecycles from bleeding into one
 * another: there is no per-tool control flow to get out of step.
 *
 * | tool             | Vietnamese            | steps                     | emits              |
 * |------------------|-----------------------|---------------------------|--------------------|
 * | `select`         | chọn                  | 1 đối tượng               | selection          |
 * | `pan`            | di chuyển khung nhìn  | 1 lần kéo                 | viewport           |
 * | `drawWall`       | vẽ tường              | 2 điểm                    | `wall.draw`        |
 * | `placeOpening`   | đặt cửa               | 1 điểm                    | `opening.add`      |
 * | `placeFurniture` | đặt đồ đạc            | 1 điểm                    | `furniture.add`    |
 * | `measure`        | đo                    | 2 điểm                    | measurement        |
 * | `splitWall`      | cắt                   | 1 tường + 1 điểm          | `wall.split`       |
 * | `annotate`       | ghi chú               | 1 đối tượng + 1 đoạn chữ  | note               |
 *
 * **Four of the eight change the drawing, and all four do it the same way**: by
 * naming a builder in `lib/commands/business` and handing it an input. Nothing
 * here builds a `Command`, because building one reads the graph and a tool has
 * no graph; nothing here writes, because the road from a request to the data
 * runs through the builder's own validation and then through `dispatch`.
 *
 * **The other four change nothing a person would undo.** Choosing what is
 * selected, moving the viewport, reading a tape off the plan, writing a note:
 * none of them is a data edit, so none of them is a command. They come back as
 * their own outcome kinds and the coordinator routes them.
 *
 * **No geometry is restated.** The tape is `domain/measure` `measureDistance`;
 * which wall a door lands on is `domain/openings/attach`'s answer at command
 * time, which is why the opening ghost names no wall and the opening command
 * takes a plan coordinate rather than a host.
 */

import { measureDistance, type MeasurePoint } from '@/domain/measure/measure';
import { isIdOfKind } from '@/domain/spatial/ids';
import type { BoundingBox, EntityId, Point } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';
import { OPENING_COMMAND_TYPES } from '@/lib/commands/business/openingCommands';
import { isFinitePoint } from '@/lib/commands/business/shared';
import { WALL_COMMAND_TYPES } from '@/lib/commands/business/wallCommands';

import type {
  ToolBuild,
  ToolDefinition,
  ToolId,
  ToolInputValue,
  ToolOutcome,
  ToolPreview,
  ToolRegistry,
} from './toolMachine';

/* -------------------------------------------------------------------------- */
/* Reading the steps a gesture has filled in.                                  */
/* -------------------------------------------------------------------------- */

/**
 * The point filled into step `index`, or `null`.
 *
 * `null` rather than a throw for a step that is not there yet, because a
 * half-filled gesture is the normal case: `preview` runs on every one of them.
 */
const pointOf = (values: readonly ToolInputValue[], index: number): Point | null => {
  const value = values[index];

  return value !== undefined && value.kind === 'point' && isFinitePoint(value.at) ? value.at : null;
};

/** The entity picked at step `index`, or `null`. */
const entityOf = (values: readonly ToolInputValue[], index: number): EntityId | null => {
  const value = values[index];

  return value !== undefined && value.kind === 'entity' ? value.id : null;
};

/** The drag filled into step `index`, or `null`. */
const dragOf = (values: readonly ToolInputValue[], index: number): Point | null => {
  const value = values[index];

  return value !== undefined && value.kind === 'drag' && isFinitePoint(value.byMm)
    ? value.byMm
    : null;
};

/** The text typed at step `index`, or `null`. */
const textOf = (values: readonly ToolInputValue[], index: number): string | null => {
  const value = values[index];

  return value !== undefined && value.kind === 'text' ? value.text : null;
};

/**
 * The point for a step that is either already picked or still under the cursor.
 *
 * The one rule that makes a rubber band work: the pick wins once it exists, and
 * the pointer stands in for it until then.
 */
const pointOrHover = (build: ToolBuild, index: number): Point | null => {
  const picked = pointOf(build.values, index);

  if (picked !== null) {
    return picked;
  }

  return build.hoverAt !== null && isFinitePoint(build.hoverAt) ? build.hoverAt : null;
};

/** A plan coordinate as the measure domain wants it. */
const toMeasurePoint = (point: Point): MeasurePoint => ({
  x: millimetres(point.x),
  y: millimetres(point.y),
});

/** The box a piece of furniture of these sizes occupies around a centre. */
const boxAround = (centre: Point, widthMm: number, depthMm: number): BoundingBox => ({
  min: { x: centre.x - widthMm / 2, y: centre.y - depthMm / 2 },
  max: { x: centre.x + widthMm / 2, y: centre.y + depthMm / 2 },
});

/* -------------------------------------------------------------------------- */
/* 1. Chọn — select                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Picks one object.
 *
 * Emits a selection rather than a command: what is highlighted is not part of
 * the drawing, so it is not something invariant A8 offers to undo.
 */
const SELECT_TOOL: ToolDefinition = {
  id: 'select',
  label: 'chọn',
  description: 'Chọn một đối tượng trên bản vẽ để xem hoặc sửa.',
  steps: [{ kind: 'entity', hint: 'Bấm vào đối tượng cần chọn.' }],
  creates: null,
  preview: ({ values }): ToolPreview | null => {
    const id = entityOf(values, 0);

    return id === null ? null : { kind: 'highlight', ids: [id] };
  },
  complete: ({ values }): ToolOutcome | null => {
    const id = entityOf(values, 0);

    return id === null ? null : { kind: 'selection', ids: [id] };
  },
};

/* -------------------------------------------------------------------------- */
/* 2. Di chuyển khung nhìn — pan                                               */
/* -------------------------------------------------------------------------- */

/**
 * Slides the viewport.
 *
 * The drag is measured in millimetres of plan rather than in pixels, so a pan
 * means the same thing at every zoom and the tool never has to know one.
 */
const PAN_TOOL: ToolDefinition = {
  id: 'pan',
  label: 'di chuyển khung nhìn',
  description: 'Kéo bản vẽ để nhìn sang phần khác, không đổi dữ liệu.',
  steps: [{ kind: 'drag', hint: 'Kéo chuột để dời khung nhìn.' }],
  creates: null,
  preview: ({ values }): ToolPreview | null => {
    const byMm = dragOf(values, 0);

    return byMm === null ? null : { kind: 'pan', byMm };
  },
  complete: ({ values }): ToolOutcome | null => {
    const panByMm = dragOf(values, 0);

    return panByMm === null ? null : { kind: 'viewport', panByMm };
  },
};

/* -------------------------------------------------------------------------- */
/* 3. Vẽ tường — drawWall                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Draws one wall run between two picks.
 *
 * The ghost is a centreline and a thickness, never a `Wall`: it carries no id
 * of its own on screen, no review metadata and no opening list, so nothing that
 * reads the draft layer can mistake it for a wall the drawing holds. The id the
 * machine minted travels with the command instead.
 */
const DRAW_WALL_TOOL: ToolDefinition = {
  id: 'drawWall',
  label: 'vẽ tường',
  description: 'Chấm hai điểm để vẽ một đoạn tường mới trên tầng đang xem.',
  steps: [
    { kind: 'point', hint: 'Chấm điểm đầu của tim tường.' },
    { kind: 'point', hint: 'Chấm điểm cuối của tim tường.' },
  ],
  creates: 'wall',
  preview: (build): ToolPreview | null => {
    const start = pointOf(build.values, 0);
    const end = pointOrHover(build, 1);

    if (start === null || end === null) {
      return null;
    }

    return {
      kind: 'wallGhost',
      centreline: { start, end },
      thicknessMm: build.context.settings.wallThicknessMm,
      heightMm: build.context.settings.wallHeightMm,
      wallKind: build.context.settings.wallKind,
    };
  },
  complete: ({ values, draftId, context }): ToolOutcome | null => {
    const start = pointOf(values, 0);
    const end = pointOf(values, 1);

    if (start === null || end === null || draftId === null || !isIdOfKind('wall', draftId)) {
      return null;
    }

    return {
      kind: 'command',
      request: {
        type: WALL_COMMAND_TYPES.draw,
        input: {
          id: draftId,
          levelId: context.levelId,
          centreline: { start, end },
          thicknessMm: context.settings.wallThicknessMm,
          heightMm: context.settings.wallHeightMm,
          kind: context.settings.wallKind,
        },
      },
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 4. Đặt cửa — placeOpening                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Drops a door or a window onto the wall it was drawn against.
 *
 * One pick, and the host wall is not among the steps: `attachToWall` finds it
 * from the body of the walls on the level when the command is built, which is
 * the only place that knows how thick they are. Asking the user to name the
 * wall as well would be asking them to answer a question the geometry answers
 * better.
 */
const PLACE_OPENING_TOOL: ToolDefinition = {
  id: 'placeOpening',
  label: 'đặt cửa',
  description: 'Chấm một điểm trên tường để đặt cửa đi hoặc cửa sổ.',
  steps: [{ kind: 'point', hint: 'Chấm tâm ô mở trên tường.' }],
  creates: 'opening',
  preview: (build): ToolPreview | null => {
    const centre = pointOrHover(build, 0);

    if (centre === null) {
      return null;
    }

    return {
      kind: 'openingGhost',
      centre,
      openingKind: build.context.settings.openingKind,
      widthMm: build.context.settings.openingWidthMm,
      heightMm: build.context.settings.openingHeightMm,
      sillHeightMm: build.context.settings.openingSillHeightMm,
    };
  },
  complete: ({ values, draftId, context }): ToolOutcome | null => {
    const centre = pointOf(values, 0);

    if (centre === null || draftId === null || !isIdOfKind('opening', draftId)) {
      return null;
    }

    return {
      kind: 'command',
      request: {
        type: OPENING_COMMAND_TYPES.addOpening,
        input: {
          id: draftId,
          levelId: context.levelId,
          kind: context.settings.openingKind,
          centre,
          widthMm: context.settings.openingWidthMm,
          heightMm: context.settings.openingHeightMm,
          sillHeightMm: context.settings.openingSillHeightMm,
          swing: context.settings.openingSwing,
        },
      },
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 5. Đặt đồ đạc — placeFurniture                                              */
/* -------------------------------------------------------------------------- */

/**
 * Places a piece of furniture at a point.
 *
 * The room is left unset. Which room a chair is in is `outlineContains` read
 * against the rooms of the level, and the tool has no level to read; the
 * command accepts furniture without a room, and the room detection pass assigns
 * one later.
 */
const PLACE_FURNITURE_TOOL: ToolDefinition = {
  id: 'placeFurniture',
  label: 'đặt đồ đạc',
  description: 'Chấm một điểm để đặt đồ đạc theo cỡ đang chọn.',
  steps: [{ kind: 'point', hint: 'Chấm tâm đồ đạc.' }],
  creates: 'furniture',
  preview: (build): ToolPreview | null => {
    const centre = pointOrHover(build, 0);

    if (centre === null) {
      return null;
    }

    const { settings } = build.context;

    return {
      kind: 'furnitureGhost',
      centre,
      boundingBox: boxAround(centre, settings.furnitureWidthMm, settings.furnitureDepthMm),
      furnitureKind: settings.furnitureKind,
      rotationDeg: settings.furnitureRotationDeg,
    };
  },
  complete: ({ values, draftId, context }): ToolOutcome | null => {
    const centre = pointOf(values, 0);

    if (centre === null || draftId === null || !isIdOfKind('furniture', draftId)) {
      return null;
    }

    return {
      kind: 'command',
      request: {
        type: OPENING_COMMAND_TYPES.addFurniture,
        input: {
          id: draftId,
          levelId: context.levelId,
          kind: context.settings.furnitureKind,
          centre,
          boundingBox: boxAround(
            centre,
            context.settings.furnitureWidthMm,
            context.settings.furnitureDepthMm,
          ),
          rotationDeg: context.settings.furnitureRotationDeg,
        },
      },
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 6. Đo — measure                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The tape measure.
 *
 * Reads the plan and changes nothing, so it emits a `Measurement` rather than a
 * command — there is no edit to undo and no snapshot to invert. The number
 * itself comes from `domain/measure` `measureDistance`, so the plan and the 3D
 * view can never report different lengths for the same two points.
 */
const MEASURE_TOOL: ToolDefinition = {
  id: 'measure',
  label: 'đo',
  description: 'Chấm hai điểm để đọc khoảng cách giữa chúng.',
  steps: [
    { kind: 'point', hint: 'Chấm điểm đầu cần đo.' },
    { kind: 'point', hint: 'Chấm điểm cuối cần đo.' },
  ],
  creates: null,
  preview: (build): ToolPreview | null => {
    const from = pointOf(build.values, 0);

    if (from === null) {
      return null;
    }

    const to = pointOrHover(build, 1);

    if (to === null) {
      return { kind: 'tape', points: [from], measurement: null };
    }

    return {
      kind: 'tape',
      points: [from, to],
      measurement: measureDistance(toMeasurePoint(from), toMeasurePoint(to)),
    };
  },
  complete: ({ values }): ToolOutcome | null => {
    const from = pointOf(values, 0);
    const to = pointOf(values, 1);

    if (from === null || to === null) {
      return null;
    }

    return {
      kind: 'measurement',
      measurement: measureDistance(toMeasurePoint(from), toMeasurePoint(to)),
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 7. Cắt — splitWall                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Cuts a wall in two.
 *
 * The wall is picked first and the cut second, because the cut has no meaning
 * without the wall it falls on. Whether the point actually lands on the
 * centreline, and whether either piece would be too short, is `splitWall`'s
 * answer inside the command builder; refusing here as well would be a second
 * opinion that could disagree with the first.
 */
const SPLIT_WALL_TOOL: ToolDefinition = {
  id: 'splitWall',
  label: 'cắt',
  description: 'Chọn một tường rồi chấm vị trí để cắt tường thành hai đoạn.',
  steps: [
    { kind: 'entity', hint: 'Bấm vào tường cần cắt.' },
    { kind: 'point', hint: 'Chấm vị trí nhát cắt trên tim tường.' },
  ],
  creates: 'wall',
  preview: (build): ToolPreview | null => {
    const wallId = entityOf(build.values, 0);

    if (wallId === null || !isIdOfKind('wall', wallId)) {
      return null;
    }

    return { kind: 'cutMarker', wallId, at: pointOrHover(build, 1) };
  },
  complete: ({ values, draftId }): ToolOutcome | null => {
    const wallId = entityOf(values, 0);
    const at = pointOf(values, 1);

    if (
      wallId === null ||
      !isIdOfKind('wall', wallId) ||
      at === null ||
      draftId === null ||
      !isIdOfKind('wall', draftId)
    ) {
      return null;
    }

    return {
      kind: 'command',
      request: {
        type: WALL_COMMAND_TYPES.split,
        input: { wallId, at, secondWallId: draftId },
      },
    };
  },
};

/* -------------------------------------------------------------------------- */
/* 8. Ghi chú — annotate                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Writes a note against an object.
 *
 * A blank note is not a note: an empty body leaves the gesture in `drawing`
 * rather than producing a note nobody can read. The note comes back as its own
 * outcome because `Note` is outside the entity table `EntityChange` is built
 * from — it carries no prefixed id — so there is no `note.add` builder for a
 * request to name. The coordinator saves it; when a builder exists, this is the
 * one line that changes.
 */
const ANNOTATE_TOOL: ToolDefinition = {
  id: 'annotate',
  label: 'ghi chú',
  description: 'Chọn một đối tượng rồi viết ghi chú gắn vào nó.',
  steps: [
    { kind: 'entity', hint: 'Bấm vào đối tượng cần ghi chú.' },
    { kind: 'text', hint: 'Nhập nội dung ghi chú.' },
  ],
  creates: null,
  preview: ({ values }): ToolPreview | null => {
    const entityId = entityOf(values, 0);

    if (entityId === null) {
      return null;
    }

    return { kind: 'noteDraft', entityId, body: textOf(values, 1) ?? '' };
  },
  complete: ({ values }): ToolOutcome | null => {
    const entityId = entityOf(values, 0);
    const body = textOf(values, 1)?.trim() ?? '';

    if (entityId === null || body === '') {
      return null;
    }

    return { kind: 'note', note: { entityId, body } };
  },
};

/* -------------------------------------------------------------------------- */
/* The toolbar.                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The eight tools, by id.
 *
 * A complete record rather than a list with a lookup, so adding an id to
 * `ToolId` fails the build here instead of leaving a button that resolves to
 * nothing at runtime.
 */
export const TOOLS: ToolRegistry = {
  select: SELECT_TOOL,
  pan: PAN_TOOL,
  drawWall: DRAW_WALL_TOOL,
  placeOpening: PLACE_OPENING_TOOL,
  placeFurniture: PLACE_FURNITURE_TOOL,
  measure: MEASURE_TOOL,
  splitWall: SPLIT_WALL_TOOL,
  annotate: ANNOTATE_TOOL,
};

/** One tool by id. */
export const toolById = (id: ToolId): ToolDefinition => TOOLS[id];
