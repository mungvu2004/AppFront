/**
 * The eight things a person can do to an opening or to a piece of furniture.
 *
 * `opening.add` · `opening.move` · `opening.resize` · `opening.delete` ·
 * `furniture.add` · `furniture.move` · `furniture.rotate` · `furniture.delete`
 *
 * The two families share a file because they share a shape: both are objects
 * placed **inside** something else — an opening inside a wall, a piece of
 * furniture inside a room — and every command in both families is a question
 * about whether the thing still fits where it is being put.
 *
 * **No geometry is restated.** Finding the wall a door belongs to is
 * `domain/openings/attach` `attachToWall`; deciding whether it fits once it is
 * there is `domain/openings/validate` `validateOpening`; deciding whether a
 * chair is inside a room is `domain/rooms/area` `outlineContains`. This module
 * calls them and turns their answers into commands and Vietnamese sentences.
 *
 * A `critical` violation stops the edit, a `warning` does not: a 1,5 m tall door
 * is unusual and worth flagging, but it is a real thing somebody may have
 * measured, and refusing to record it would make the model disagree with the
 * survey. That split is the openings domain's own, and it is honoured as it is.
 */

import { attachToWall } from '@/domain/openings/attach';
import { isAttached, type AttachedOpening, type TracedOpening } from '@/domain/openings/types';
import { validateOpening } from '@/domain/openings/validate';
import { outlineContains } from '@/domain/rooms/area';
import { isIdOfKind } from '@/domain/spatial/ids';
import type {
  BoundingBox,
  Furniture,
  FurnitureId,
  FurnitureKind,
  Level,
  LevelId,
  Opening as GraphOpening,
  OpeningId,
  OpeningKind,
  Point,
  Room,
  RoomId,
  SwingDirection,
  Wall as GraphWall,
} from '@/domain/spatial/types';
import { compareNearly, nearlyEqualLength, nearlyEqualPoint } from '@/domain/units/compare';
import { distanceBetween } from '@/domain/units/snap';
import { degrees, millimetres, normaliseDegrees } from '@/domain/units/types';
import { centrelineLength, type Wall as SolidWall } from '@/domain/walls/types';

import { changeForAdd, changeForRemove, changeForUpdate } from '../createCommand';
import type { EntityChange } from '../types';
import {
  accept,
  AUTHORED_BY_HAND,
  buildCommand,
  formatAngleDeg,
  formatAreaM2,
  formatLengthMm,
  formatPoint,
  FURNITURE_KIND_LABELS,
  FURNITURE_KINDS,
  idIsTaken,
  isFinitePoint,
  levelOfWall,
  nameOfOpening,
  offsetOnWall,
  openingsOfWall,
  readOf,
  refuse,
  toAttachedOpening,
  toPointMm,
  toSolidWall,
  wallsOnLevel,
  type CommandContext,
  type CommandResult,
} from './shared';

/* -------------------------------------------------------------------------- */
/* Command names.                                                              */
/* -------------------------------------------------------------------------- */

/** The eight opening and furniture commands. */
export const OPENING_COMMAND_TYPES = {
  addOpening: 'opening.add',
  moveOpening: 'opening.move',
  resizeOpening: 'opening.resize',
  removeOpening: 'opening.delete',
  addFurniture: 'furniture.add',
  moveFurniture: 'furniture.move',
  rotateFurniture: 'furniture.rotate',
  removeFurniture: 'furniture.delete',
} as const;

/* -------------------------------------------------------------------------- */
/* Shared checks.                                                              */
/* -------------------------------------------------------------------------- */

/** An opening, its host wall and the level they stand on, resolved together. */
interface OpeningLookup {
  readonly opening: GraphOpening | null;
  readonly wall: GraphWall | null;
  readonly solid: SolidWall | null;
  readonly reasons: readonly string[];
}

/** Is every measurement on this wall one the geometry can work with? */
const wallIsUsable = (wall: GraphWall, level: Level): boolean =>
  isFinitePoint(wall.centreline.start) &&
  isFinitePoint(wall.centreline.end) &&
  Number.isFinite(wall.thicknessMm) &&
  Number.isFinite(wall.heightMm) &&
  Number.isFinite(level.elevationMm) &&
  compareNearly(
    distanceBetween(toPointMm(wall.centreline.start), toPointMm(wall.centreline.end)),
    0,
  ) > 0;

const lookupOpening = (context: CommandContext, openingId: OpeningId): OpeningLookup => {
  const opening = readOf(context.graph, 'opening', openingId);

  if (opening === null) {
    return {
      opening: null,
      wall: null,
      solid: null,
      reasons: [`Không tìm thấy lỗ mở ${openingId} trong bản vẽ.`],
    };
  }

  const wall = readOf(context.graph, 'wall', opening.wallId);

  if (wall === null) {
    return {
      opening,
      wall: null,
      solid: null,
      reasons: [`Lỗ mở ${openingId} đang trỏ tới tường ${opening.wallId} không tồn tại.`],
    };
  }

  const level = levelOfWall(context.graph, wall);

  if (level === null) {
    return {
      opening,
      wall,
      solid: null,
      reasons: [`Tường ${wall.id} đang trỏ tới tầng ${wall.levelId} không tồn tại.`],
    };
  }

  if (!wallIsUsable(wall, level)) {
    return {
      opening,
      wall,
      solid: null,
      reasons: [`Tường ${wall.id} có số đo không dùng được nên chưa xử lý lỗ mở trên nó được.`],
    };
  }

  return { opening, wall, solid: toSolidWall(wall, level), reasons: [] };
};

/**
 * The critical problems an opening would have on its wall.
 *
 * Only `critical` is returned: a warning is the standards table talking, and a
 * person may accept every one of them.
 */
const criticalReasonsFor = (
  context: CommandContext,
  opening: AttachedOpening,
  solid: SolidWall,
): string[] => {
  const siblings = openingsOfWall(context.graph, solid.id)
    .filter((candidate) => candidate.id !== opening.id)
    .map((candidate) => toAttachedOpening(candidate, solid));

  return validateOpening(opening, solid, siblings)
    .filter((violation) => violation.severity === 'critical')
    .map((violation) => violation.message);
};

/** The wall list a new opening is offered, with the ones it could never sit on left out. */
const attachableWalls = (context: CommandContext, levelId: LevelId): readonly SolidWall[] => {
  const level = readOf(context.graph, 'level', levelId);

  if (level === null) {
    return [];
  }

  return wallsOnLevel(context.graph, levelId)
    .filter((wall) => wallIsUsable(wall, level))
    .map((wall) => toSolidWall(wall, level));
};

/* -------------------------------------------------------------------------- */
/* 1. Thêm cửa — opening.add                                                   */
/* -------------------------------------------------------------------------- */

export interface AddOpeningInput {
  readonly id: OpeningId;
  readonly levelId: LevelId;
  readonly kind: OpeningKind;
  /** Where the opening was placed on the plan; the host wall is found from it. */
  readonly centre: Point;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly sillHeightMm: number;
  readonly swing: SwingDirection;
}

/** The traced opening the attach function is asked about. */
const tracedFrom = (input: AddOpeningInput): TracedOpening => ({
  id: input.id,
  kind: input.kind,
  widthMm: millimetres(input.widthMm),
  heightMm: millimetres(input.heightMm),
  sillHeightMm: millimetres(input.sillHeightMm),
  swing: input.swing,
  centre: toPointMm(input.centre),
});

/** Everything wrong with adding this opening; empty when it may be added. */
export function validateAddOpening(input: AddOpeningInput, context: CommandContext): string[] {
  const reasons: string[] = [];

  if (!isIdOfKind('opening', input.id)) {
    reasons.push(`Mã lỗ mở "${input.id}" không đúng định dạng của một mã lỗ mở.`);
  } else if (idIsTaken(context.graph, input.id)) {
    reasons.push(`Bản vẽ đã có đối tượng mang mã ${input.id}.`);
  }

  if (readOf(context.graph, 'level', input.levelId) === null) {
    reasons.push(`Không tìm thấy tầng ${input.levelId} để đặt lỗ mở lên.`);
  }

  if (!isFinitePoint(input.centre)) {
    reasons.push('Toạ độ tâm lỗ mở không đọc được.');
  }

  for (const [label, value] of [
    ['Chiều rộng', input.widthMm],
    ['Chiều cao', input.heightMm],
  ] as const) {
    if (!Number.isFinite(value) || compareNearly(value, 0) <= 0) {
      reasons.push(`${label} lỗ mở phải lớn hơn 0 mm, đang nhận ${formatLengthMm(value)}.`);
    }
  }

  if (!Number.isFinite(input.sillHeightMm) || compareNearly(input.sillHeightMm, 0) < 0) {
    reasons.push(`Cao độ ngưỡng không được âm, đang nhận ${formatLengthMm(input.sillHeightMm)}.`);
  }

  if (reasons.length > 0) {
    return reasons;
  }

  const walls = attachableWalls(context, input.levelId);
  const attachment = attachToWall(tracedFrom(input), walls);
  const landed = attachment.opening;

  if (!isAttached(landed)) {
    reasons.push(attachment.message);

    return reasons;
  }

  const host = walls.find((wall) => wall.id === landed.wallId);

  if (host === undefined) {
    reasons.push(`Không tìm thấy lại tường ${landed.wallId} vừa chọn để gắn lỗ mở.`);

    return reasons;
  }

  return [...reasons, ...criticalReasonsFor(context, landed, host)];
}

/**
 * Adds a door, a window or a plain hole, on the wall it was drawn against.
 *
 * The host wall is not asked for: `attachToWall` finds the nearest wall
 * measured from its **body**, so a window drawn on the outer face of a 400 mm
 * wall belongs to that wall rather than being orphaned for being 200 mm off the
 * centreline. An opening no wall will take is refused with the reason the
 * domain gave, and nothing is written.
 */
export function createAddOpeningCommand(
  input: AddOpeningInput,
  context: CommandContext,
): CommandResult {
  const reasons = validateAddOpening(input, context);

  if (reasons.length > 0) {
    return refuse(OPENING_COMMAND_TYPES.addOpening, reasons);
  }

  const walls = attachableWalls(context, input.levelId);
  const attachment = attachToWall(tracedFrom(input), walls);
  const landed = attachment.opening;

  if (!isAttached(landed)) {
    return refuse(OPENING_COMMAND_TYPES.addOpening, [attachment.message]);
  }

  const host = walls.find((wall) => wall.id === landed.wallId);
  const hostWall = readOf(context.graph, 'wall', landed.wallId);

  if (host === undefined || hostWall === null) {
    return refuse(OPENING_COMMAND_TYPES.addOpening, [
      `Không tìm thấy lại tường ${landed.wallId} vừa chọn để gắn lỗ mở.`,
    ]);
  }

  const offsetMm = offsetOnWall(landed, host);
  const opening: GraphOpening = {
    ...AUTHORED_BY_HAND,
    id: input.id,
    wallId: landed.wallId,
    kind: input.kind,
    offsetMm,
    widthMm: input.widthMm,
    heightMm: input.heightMm,
    sillHeightMm: input.sillHeightMm,
    swing: input.swing,
  };

  return accept(
    buildCommand(
      OPENING_COMMAND_TYPES.addOpening,
      `Thêm ${nameOfOpening(opening)} rộng ${formatLengthMm(input.widthMm)}, cao ` +
        `${formatLengthMm(input.heightMm)} vào tường ${landed.wallId} dài ` +
        `${formatLengthMm(centrelineLength(host))}, cách đầu tường ${formatLengthMm(offsetMm)}.`,
      [
        changeForAdd('opening', opening),
        changeForUpdate('wall', hostWall, {
          ...hostWall,
          openingIds: [...hostWall.openingIds, opening.id],
        }),
      ],
      context,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Di chuyển cửa — opening.move                                             */
/* -------------------------------------------------------------------------- */

export interface MoveOpeningInput {
  readonly openingId: OpeningId;
  /** New distance from the start of the centreline to the left edge. */
  readonly offsetMm: number;
}

/** Everything wrong with moving this opening; empty when it may be moved. */
export function validateMoveOpening(input: MoveOpeningInput, context: CommandContext): string[] {
  const found = lookupOpening(context, input.openingId);

  if (found.opening === null || found.solid === null) {
    return [...found.reasons];
  }

  if (!Number.isFinite(input.offsetMm)) {
    return ['Vị trí mới của lỗ mở không đọc được.'];
  }

  if (nearlyEqualLength(millimetres(found.opening.offsetMm), millimetres(input.offsetMm))) {
    return [
      `${nameOfOpening(found.opening)} đã cách đầu tường ${formatLengthMm(found.opening.offsetMm)} ` +
        'nên không có gì thay đổi.',
    ];
  }

  const moved = toAttachedOpening({ ...found.opening, offsetMm: input.offsetMm }, found.solid);

  return criticalReasonsFor(context, moved, found.solid);
}

/** Slides an opening along the wall it is already cut into. */
export function createMoveOpeningCommand(
  input: MoveOpeningInput,
  context: CommandContext,
): CommandResult {
  const reasons = validateMoveOpening(input, context);

  if (reasons.length > 0) {
    return refuse(OPENING_COMMAND_TYPES.moveOpening, reasons);
  }

  const found = lookupOpening(context, input.openingId);

  if (found.opening === null || found.solid === null) {
    return refuse(OPENING_COMMAND_TYPES.moveOpening, found.reasons);
  }

  const { opening, solid } = found;

  return accept(
    buildCommand(
      OPENING_COMMAND_TYPES.moveOpening,
      `Di chuyển ${nameOfOpening(opening)} trên tường ${opening.wallId} từ ` +
        `${formatLengthMm(opening.offsetMm)} sang ${formatLengthMm(input.offsetMm)} tính từ đầu ` +
        `tường; dịch ${formatLengthMm(Math.abs(input.offsetMm - opening.offsetMm))} trên đoạn dài ` +
        `${formatLengthMm(centrelineLength(solid))}.`,
      [changeForUpdate('opening', opening, { ...opening, offsetMm: input.offsetMm })],
      context,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Đổi kích thước cửa — opening.resize                                      */
/* -------------------------------------------------------------------------- */

export interface ResizeOpeningInput {
  readonly openingId: OpeningId;
  readonly widthMm?: number;
  readonly heightMm?: number;
  readonly sillHeightMm?: number;
}

/** The opening this resize would leave behind. */
const resizedOpening = (opening: GraphOpening, input: ResizeOpeningInput): GraphOpening => ({
  ...opening,
  widthMm: input.widthMm ?? opening.widthMm,
  heightMm: input.heightMm ?? opening.heightMm,
  sillHeightMm: input.sillHeightMm ?? opening.sillHeightMm,
});

/** Everything wrong with this resize; empty when it may be applied. */
export function validateResizeOpening(
  input: ResizeOpeningInput,
  context: CommandContext,
): string[] {
  const found = lookupOpening(context, input.openingId);

  if (found.opening === null || found.solid === null) {
    return [...found.reasons];
  }

  const reasons: string[] = [];

  if (
    input.widthMm === undefined &&
    input.heightMm === undefined &&
    input.sillHeightMm === undefined
  ) {
    reasons.push('Lệnh đổi kích thước không nêu số đo nào cần đổi.');

    return reasons;
  }

  for (const [label, value] of [
    ['Chiều rộng', input.widthMm],
    ['Chiều cao', input.heightMm],
  ] as const) {
    if (value !== undefined && (!Number.isFinite(value) || compareNearly(value, 0) <= 0)) {
      reasons.push(`${label} lỗ mở phải lớn hơn 0 mm, đang nhận ${formatLengthMm(value)}.`);
    }
  }

  if (
    input.sillHeightMm !== undefined &&
    (!Number.isFinite(input.sillHeightMm) || compareNearly(input.sillHeightMm, 0) < 0)
  ) {
    reasons.push(`Cao độ ngưỡng không được âm, đang nhận ${formatLengthMm(input.sillHeightMm)}.`);
  }

  if (reasons.length > 0) {
    return reasons;
  }

  const resized = resizedOpening(found.opening, input);

  if (
    nearlyEqualLength(millimetres(resized.widthMm), millimetres(found.opening.widthMm)) &&
    nearlyEqualLength(millimetres(resized.heightMm), millimetres(found.opening.heightMm)) &&
    nearlyEqualLength(millimetres(resized.sillHeightMm), millimetres(found.opening.sillHeightMm))
  ) {
    reasons.push(`${nameOfOpening(found.opening)} đã có đúng kích thước đó nên không có gì thay đổi.`);

    return reasons;
  }

  return criticalReasonsFor(context, toAttachedOpening(resized, found.solid), found.solid);
}

/**
 * Changes the size of an opening.
 *
 * The centre stays where it is: the stored offset is the **left edge**, so a
 * widened opening keeps its middle by moving that edge back half the growth.
 * Widening a door around its middle is what a person means by making it wider.
 */
export function createResizeOpeningCommand(
  input: ResizeOpeningInput,
  context: CommandContext,
): CommandResult {
  const reasons = validateResizeOpening(input, context);

  if (reasons.length > 0) {
    return refuse(OPENING_COMMAND_TYPES.resizeOpening, reasons);
  }

  const found = lookupOpening(context, input.openingId);

  if (found.opening === null || found.solid === null) {
    return refuse(OPENING_COMMAND_TYPES.resizeOpening, found.reasons);
  }

  const { opening } = found;
  const resized = resizedOpening(opening, input);
  const after: GraphOpening = {
    ...resized,
    offsetMm: opening.offsetMm - (resized.widthMm - opening.widthMm) / 2,
  };

  const parts = [
    ['rộng', opening.widthMm, after.widthMm] as const,
    ['cao', opening.heightMm, after.heightMm] as const,
    ['ngưỡng', opening.sillHeightMm, after.sillHeightMm] as const,
  ]
    .filter(([, from, to]) => !nearlyEqualLength(millimetres(from), millimetres(to)))
    .map(([label, from, to]) => `${label} ${formatLengthMm(from)} thành ${formatLengthMm(to)}`);

  return accept(
    buildCommand(
      OPENING_COMMAND_TYPES.resizeOpening,
      `Đổi kích thước ${nameOfOpening(opening)} trên tường ${opening.wallId}: ${parts.join(', ')}.`,
      [changeForUpdate('opening', opening, after)],
      context,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Xoá cửa — opening.delete                                                 */
/* -------------------------------------------------------------------------- */

export interface DeleteOpeningInput {
  readonly openingId: OpeningId;
}

/** Everything wrong with deleting this opening; empty when it may be deleted. */
export function validateDeleteOpening(
  input: DeleteOpeningInput,
  context: CommandContext,
): string[] {
  if (readOf(context.graph, 'opening', input.openingId) === null) {
    return [`Không tìm thấy lỗ mở ${input.openingId} trong bản vẽ.`];
  }

  return [];
}

/**
 * Deletes an opening and takes it off its wall's list in the same breath.
 *
 * A wall listing an opening that is gone is exactly what `checkIntegrity`
 * reports as a critical missing reference, so the two changes belong to one
 * command and one undo step.
 */
export function createDeleteOpeningCommand(
  input: DeleteOpeningInput,
  context: CommandContext,
): CommandResult {
  const reasons = validateDeleteOpening(input, context);

  if (reasons.length > 0) {
    return refuse(OPENING_COMMAND_TYPES.removeOpening, reasons);
  }

  const opening = readOf(context.graph, 'opening', input.openingId);

  if (opening === null) {
    return refuse(OPENING_COMMAND_TYPES.removeOpening, [`Không tìm thấy lỗ mở ${input.openingId}.`]);
  }

  const wall = readOf(context.graph, 'wall', opening.wallId);
  const changes: EntityChange[] = [changeForRemove('opening', opening)];

  if (wall !== null && wall.openingIds.includes(opening.id)) {
    changes.push(
      changeForUpdate('wall', wall, {
        ...wall,
        openingIds: wall.openingIds.filter((openingId) => openingId !== opening.id),
      }),
    );
  }

  return accept(
    buildCommand(
      OPENING_COMMAND_TYPES.removeOpening,
      `Xoá ${nameOfOpening(opening)} rộng ${formatLengthMm(opening.widthMm)}, cao ` +
        `${formatLengthMm(opening.heightMm)} khỏi tường ${opening.wallId}.`,
      changes,
      context,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* 5. Thêm đồ đạc — furniture.add                                              */
/* -------------------------------------------------------------------------- */

export interface AddFurnitureInput {
  readonly id: FurnitureId;
  readonly levelId: LevelId;
  readonly kind: FurnitureKind;
  readonly centre: Point;
  readonly boundingBox: BoundingBox;
  readonly rotationDeg: number;
  readonly roomId?: RoomId;
}

/** Is the box a real rectangle with both sides longer than nothing? */
const boxReasons = (box: BoundingBox): string[] => {
  if (!isFinitePoint(box.min) || !isFinitePoint(box.max)) {
    return ['Khung bao đồ đạc có toạ độ không đọc được.'];
  }

  const reasons: string[] = [];
  const widthMm = box.max.x - box.min.x;
  const depthMm = box.max.y - box.min.y;

  if (compareNearly(widthMm, 0) <= 0 || compareNearly(depthMm, 0) <= 0) {
    reasons.push(
      `Khung bao đồ đạc đo ${formatLengthMm(widthMm)} × ${formatLengthMm(depthMm)}; cả hai cạnh ` +
        'phải lớn hơn 0 mm.',
    );
  }

  return reasons;
};

/** Is this point inside the box, edges included? */
const boxContains = (box: BoundingBox, point: Point): boolean =>
  compareNearly(point.x, box.min.x) >= 0 &&
  compareNearly(point.x, box.max.x) <= 0 &&
  compareNearly(point.y, box.min.y) >= 0 &&
  compareNearly(point.y, box.max.y) <= 0;

/** Is this point inside the room's outline? */
const roomContains = (room: Room, point: Point): boolean =>
  outlineContains(room.outline.map((corner) => toPointMm(corner)), toPointMm(point));

/** Everything wrong with adding this furniture; empty when it may be added. */
export function validateAddFurniture(input: AddFurnitureInput, context: CommandContext): string[] {
  const reasons: string[] = [];

  if (!isIdOfKind('furniture', input.id)) {
    reasons.push(`Mã đồ đạc "${input.id}" không đúng định dạng của một mã đồ đạc.`);
  } else if (idIsTaken(context.graph, input.id)) {
    reasons.push(`Bản vẽ đã có đối tượng mang mã ${input.id}.`);
  }

  if (readOf(context.graph, 'level', input.levelId) === null) {
    reasons.push(`Không tìm thấy tầng ${input.levelId} để đặt đồ đạc lên.`);
  }

  if (!FURNITURE_KINDS.includes(input.kind)) {
    reasons.push(`Loại đồ đạc "${input.kind}" không có trong hệ thống.`);
  }

  reasons.push(...boxReasons(input.boundingBox));

  if (!isFinitePoint(input.centre)) {
    reasons.push('Toạ độ tâm đồ đạc không đọc được.');
  } else if (reasons.length === 0 && !boxContains(input.boundingBox, input.centre)) {
    reasons.push(
      `Tâm đồ đạc ở ${formatPoint(input.centre)} nằm ngoài khung bao từ ` +
        `${formatPoint(input.boundingBox.min)} tới ${formatPoint(input.boundingBox.max)}.`,
    );
  }

  if (!Number.isFinite(input.rotationDeg)) {
    reasons.push('Góc xoay đồ đạc không đọc được.');
  }

  if (input.roomId !== undefined) {
    const room = readOf(context.graph, 'room', input.roomId);

    if (room === null) {
      reasons.push(`Không tìm thấy phòng ${input.roomId} để gán đồ đạc vào.`);
    } else if (room.levelId !== input.levelId) {
      reasons.push(
        `Phòng ${room.id} ở tầng ${room.levelId} còn đồ đạc đặt trên tầng ${input.levelId}.`,
      );
    } else if (isFinitePoint(input.centre) && !roomContains(room, input.centre)) {
      reasons.push(
        `Tâm đồ đạc ở ${formatPoint(input.centre)} nằm ngoài ranh phòng "${room.name}" ` +
          `${room.id} rộng ${formatAreaM2(room.areaM2)}.`,
      );
    }
  }

  return reasons;
}

/** Places a piece of furniture on a level, and in a room when one is named. */
export function createAddFurnitureCommand(
  input: AddFurnitureInput,
  context: CommandContext,
): CommandResult {
  const reasons = validateAddFurniture(input, context);

  if (reasons.length > 0) {
    return refuse(OPENING_COMMAND_TYPES.addFurniture, reasons);
  }

  const widthMm = input.boundingBox.max.x - input.boundingBox.min.x;
  const depthMm = input.boundingBox.max.y - input.boundingBox.min.y;

  const item: Furniture = {
    ...AUTHORED_BY_HAND,
    id: input.id,
    levelId: input.levelId,
    kind: input.kind,
    centre: { ...input.centre },
    boundingBox: { min: { ...input.boundingBox.min }, max: { ...input.boundingBox.max } },
    rotationDeg: normaliseDegrees(degrees(input.rotationDeg)),
    ...(input.roomId === undefined ? {} : { roomId: input.roomId }),
  };

  return accept(
    buildCommand(
      OPENING_COMMAND_TYPES.addFurniture,
      `Thêm ${FURNITURE_KIND_LABELS[input.kind]} ${input.id} cỡ ${formatLengthMm(widthMm)} × ` +
        `${formatLengthMm(depthMm)} tại ${formatPoint(input.centre)}, xoay ` +
        `${formatAngleDeg(item.rotationDeg)}` +
        (input.roomId === undefined ? '.' : ` trong phòng ${input.roomId}.`),
      [changeForAdd('furniture', item)],
      context,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* 6. Di chuyển đồ đạc — furniture.move                                        */
/* -------------------------------------------------------------------------- */

export interface MoveFurnitureInput {
  readonly furnitureId: FurnitureId;
  readonly to: Point;
}

/** The item this move would leave behind, box carried along with the centre. */
const movedFurniture = (item: Furniture, to: Point): Furniture => {
  const shiftX = to.x - item.centre.x;
  const shiftY = to.y - item.centre.y;

  return {
    ...item,
    centre: { ...to },
    boundingBox: {
      min: { x: item.boundingBox.min.x + shiftX, y: item.boundingBox.min.y + shiftY },
      max: { x: item.boundingBox.max.x + shiftX, y: item.boundingBox.max.y + shiftY },
    },
  };
};

/** Everything wrong with this move; empty when it may be applied. */
export function validateMoveFurniture(
  input: MoveFurnitureInput,
  context: CommandContext,
): string[] {
  const item = readOf(context.graph, 'furniture', input.furnitureId);

  if (item === null) {
    return [`Không tìm thấy đồ đạc ${input.furnitureId} trong bản vẽ.`];
  }

  if (!isFinitePoint(input.to)) {
    return ['Toạ độ đích của thao tác di chuyển không đọc được.'];
  }

  const reasons: string[] = [];

  if (nearlyEqualPoint(toPointMm(item.centre), toPointMm(input.to))) {
    reasons.push(
      `${FURNITURE_KIND_LABELS[item.kind]} ${item.id} đã ở ${formatPoint(input.to)} nên không có gì thay đổi.`,
    );
  }

  if (item.roomId !== undefined) {
    const room = readOf(context.graph, 'room', item.roomId);

    if (room !== null && !roomContains(room, input.to)) {
      reasons.push(
        `${formatPoint(input.to)} nằm ngoài ranh phòng "${room.name}" ${room.id}; hãy bỏ gán ` +
          'phòng trước khi đưa đồ đạc ra ngoài.',
      );
    }
  }

  return reasons;
}

/** Moves a piece of furniture, carrying its bounding box with it. */
export function createMoveFurnitureCommand(
  input: MoveFurnitureInput,
  context: CommandContext,
): CommandResult {
  const reasons = validateMoveFurniture(input, context);

  if (reasons.length > 0) {
    return refuse(OPENING_COMMAND_TYPES.moveFurniture, reasons);
  }

  const item = readOf(context.graph, 'furniture', input.furnitureId);

  if (item === null) {
    return refuse(OPENING_COMMAND_TYPES.moveFurniture, [
      `Không tìm thấy đồ đạc ${input.furnitureId}.`,
    ]);
  }

  const travelledMm = distanceBetween(toPointMm(item.centre), toPointMm(input.to));

  return accept(
    buildCommand(
      OPENING_COMMAND_TYPES.moveFurniture,
      `Di chuyển ${FURNITURE_KIND_LABELS[item.kind]} ${item.id} từ ${formatPoint(item.centre)} sang ` +
        `${formatPoint(input.to)}, đi ${formatLengthMm(travelledMm)}.`,
      [changeForUpdate('furniture', item, movedFurniture(item, input.to))],
      context,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* 7. Xoay đồ đạc — furniture.rotate                                           */
/* -------------------------------------------------------------------------- */

export interface RotateFurnitureInput {
  readonly furnitureId: FurnitureId;
  readonly rotationDeg: number;
}

/** Everything wrong with this rotation; empty when it may be applied. */
export function validateRotateFurniture(
  input: RotateFurnitureInput,
  context: CommandContext,
): string[] {
  const item = readOf(context.graph, 'furniture', input.furnitureId);

  if (item === null) {
    return [`Không tìm thấy đồ đạc ${input.furnitureId} trong bản vẽ.`];
  }

  if (!Number.isFinite(input.rotationDeg)) {
    return ['Góc xoay không đọc được.'];
  }

  const wanted = normaliseDegrees(degrees(input.rotationDeg));

  if (compareNearly(wanted, normaliseDegrees(degrees(item.rotationDeg))) === 0) {
    return [
      `${FURNITURE_KIND_LABELS[item.kind]} ${item.id} đã xoay ${formatAngleDeg(wanted)} nên không có gì thay đổi.`,
    ];
  }

  return [];
}

/**
 * Turns a piece of furniture on the spot.
 *
 * The angle is folded into `[0, 360)` by `normaliseDegrees`, so 450° and 90° are
 * one heading and turning a chair twice round is not a change to record.
 */
export function createRotateFurnitureCommand(
  input: RotateFurnitureInput,
  context: CommandContext,
): CommandResult {
  const reasons = validateRotateFurniture(input, context);

  if (reasons.length > 0) {
    return refuse(OPENING_COMMAND_TYPES.rotateFurniture, reasons);
  }

  const item = readOf(context.graph, 'furniture', input.furnitureId);

  if (item === null) {
    return refuse(OPENING_COMMAND_TYPES.rotateFurniture, [
      `Không tìm thấy đồ đạc ${input.furnitureId}.`,
    ]);
  }

  const rotationDeg = normaliseDegrees(degrees(input.rotationDeg));

  return accept(
    buildCommand(
      OPENING_COMMAND_TYPES.rotateFurniture,
      `Xoay ${FURNITURE_KIND_LABELS[item.kind]} ${item.id} tại ${formatPoint(item.centre)} từ ` +
        `${formatAngleDeg(item.rotationDeg)} sang ${formatAngleDeg(rotationDeg)}.`,
      [changeForUpdate('furniture', item, { ...item, rotationDeg })],
      context,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* 8. Xoá đồ đạc — furniture.delete                                            */
/* -------------------------------------------------------------------------- */

export interface DeleteFurnitureInput {
  readonly furnitureId: FurnitureId;
}

/** Everything wrong with deleting this furniture; empty when it may be deleted. */
export function validateDeleteFurniture(
  input: DeleteFurnitureInput,
  context: CommandContext,
): string[] {
  if (readOf(context.graph, 'furniture', input.furnitureId) === null) {
    return [`Không tìm thấy đồ đạc ${input.furnitureId} trong bản vẽ.`];
  }

  return [];
}

/** Removes a piece of furniture from the plan. */
export function createDeleteFurnitureCommand(
  input: DeleteFurnitureInput,
  context: CommandContext,
): CommandResult {
  const reasons = validateDeleteFurniture(input, context);

  if (reasons.length > 0) {
    return refuse(OPENING_COMMAND_TYPES.removeFurniture, reasons);
  }

  const item = readOf(context.graph, 'furniture', input.furnitureId);

  if (item === null) {
    return refuse(OPENING_COMMAND_TYPES.removeFurniture, [
      `Không tìm thấy đồ đạc ${input.furnitureId}.`,
    ]);
  }

  const widthMm = item.boundingBox.max.x - item.boundingBox.min.x;
  const depthMm = item.boundingBox.max.y - item.boundingBox.min.y;

  return accept(
    buildCommand(
      OPENING_COMMAND_TYPES.removeFurniture,
      `Xoá ${FURNITURE_KIND_LABELS[item.kind]} ${item.id} cỡ ${formatLengthMm(widthMm)} × ` +
        `${formatLengthMm(depthMm)} tại ${formatPoint(item.centre)}.`,
      [changeForRemove('furniture', item)],
      context,
    ),
  );
}
