/**
 * The six things a person can do to a room or to a storey.
 *
 * `room.rename` · `room.changeUsage` · `room.merge` · `room.split` ·
 * `level.changeElevation` · `level.reorder`
 *
 * Rooms and levels share a file because they are the same kind of object seen
 * at two scales: a room is a piece of floor with a name and an area, a level is
 * a stack of them with a name and an elevation. Editing either is editing how
 * the building is divided up, never how it is drawn.
 *
 * **No area is computed here.** `domain/rooms/area` `computeArea` and
 * `totalArea` are the only functions that turn an outline into a number, and
 * they are called rather than repeated — which is what keeps a merged room from
 * disagreeing with the sum of its parts in the second decimal, and what makes
 * the sample building still add up to 248,60 m² afterwards.
 *
 * The two shape commands take the outlines they should produce, because working
 * out where a wall divides a floor is the room detection pass's job, not a
 * command's. What the commands own is the arithmetic that says the result is
 * possible: a merge cannot be smaller than the rooms it swallowed, and a split
 * cannot make floor area out of nothing. Both are checked, in square metres,
 * against the outlines actually supplied.
 */

import { computeArea, outlineContains, totalArea } from '@/domain/rooms/area';
import { describeUsage } from '@/domain/rooms/classify';
import { isIdOfKind } from '@/domain/spatial/ids';
import type {
  Furniture,
  Level,
  LevelId,
  Point,
  Room,
  RoomId,
  RoomUsage,
  WallId,
} from '@/domain/spatial/types';
import { compareNearly, nearlyEqualLength } from '@/domain/units/compare';
import { millimetres } from '@/domain/units/types';

import { changeForAdd, changeForRemove, changeForUpdate } from '../createCommand';
import type { EntityChange } from '../types';
import {
  accept,
  AUTHORED_BY_HAND,
  buildCommand,
  entitiesOfKind,
  formatAreaM2,
  formatCount,
  formatElevationM,
  formatMetres,
  idIsTaken,
  isFinitePoint,
  readOf,
  refuse,
  toPointMm,
  type CommandContext,
  type CommandResult,
} from './shared';

/* -------------------------------------------------------------------------- */
/* Command names and limits.                                                   */
/* -------------------------------------------------------------------------- */

/** The six room and level commands. */
export const ROOM_FLOOR_COMMAND_TYPES = {
  renameRoom: 'room.rename',
  changeRoomUsage: 'room.changeUsage',
  mergeRooms: 'room.merge',
  splitRoom: 'room.split',
  changeLevelElevation: 'level.changeElevation',
  reorderLevels: 'level.reorder',
} as const;

/** Longest room name a plan label can hold without being cut off. */
export const MAX_ROOM_NAME_LENGTH = 60;

/**
 * How far two areas may disagree and still be the same area.
 *
 * One hundredth of a square metre: exactly the step `computeArea` rounds onto,
 * so the tolerance absorbs the rounding and nothing more.
 */
export const AREA_TOLERANCE_M2 = 0.01;

/** Fewer corners than this and an outline encloses nothing. */
const MIN_OUTLINE_VERTICES = 3;

/**
 * Every room use the graph knows.
 *
 * A complete record rather than a list, so adding a use to `RoomUsage` fails
 * the build here instead of letting an unknown value through validation.
 */
const ROOM_USAGES: Readonly<Record<RoomUsage, true>> = {
  livingRoom: true,
  bedroom: true,
  kitchen: true,
  bathroom: true,
  corridor: true,
  stairwell: true,
  utility: true,
  other: true,
};

const isKnownUsage = (usage: string): usage is RoomUsage =>
  Object.prototype.hasOwnProperty.call(ROOM_USAGES, usage);

/* -------------------------------------------------------------------------- */
/* Shared checks.                                                              */
/* -------------------------------------------------------------------------- */

/** The area an outline actually encloses, in square metres. */
const areaOf = (outline: readonly Point[]): number =>
  computeArea(outline.map((corner) => toPointMm(corner)));

/** Everything wrong with an outline offered as a room boundary. */
const outlineReasons = (outline: readonly Point[], label: string): string[] => {
  if (outline.length < MIN_OUTLINE_VERTICES) {
    return [
      `${label} mới chỉ có ${formatCount(outline.length)} đỉnh; dưới ${formatCount(MIN_OUTLINE_VERTICES)} đỉnh ` +
        'thì hình chưa khép nên không bao lấy mặt sàn nào.',
    ];
  }

  if (!outline.every((corner) => isFinitePoint(corner))) {
    return [`${label} có đỉnh mang toạ độ không đọc được.`];
  }

  if (compareNearly(areaOf(outline), 0) <= 0) {
    return [`${label} bao diện tích ${formatAreaM2(areaOf(outline))}, phải lớn hơn 0 m².`];
  }

  return [];
};

/** A fresh copy of an outline, so no command hands the store a shared array. */
const copyOutline = (outline: readonly Point[]): Point[] =>
  outline.map((corner) => ({ x: corner.x, y: corner.y }));

/** Is this point inside the outline? */
const outlineHolds = (outline: readonly Point[], point: Point): boolean =>
  outlineContains(outline.map((corner) => toPointMm(corner)), toPointMm(point));

/** The furniture assigned to one room. */
const furnitureOfRoom = (context: CommandContext, roomId: RoomId): readonly Furniture[] =>
  entitiesOfKind(context.graph, 'furniture').filter((item) => item.roomId === roomId);

/** The levels of the building, bottom up. */
const levelsInOrder = (context: CommandContext): readonly Level[] =>
  [...entitiesOfKind(context.graph, 'level')].sort((first, second) => first.order - second.order);

/** "Phòng khách" R-3, for the middle of a sentence. */
const nameOfRoom = (room: Room): string => `"${room.name}" ${room.id}`;

/* -------------------------------------------------------------------------- */
/* 1. Đặt tên phòng — room.rename                                              */
/* -------------------------------------------------------------------------- */

export interface RenameRoomInput {
  readonly roomId: RoomId;
  readonly name: string;
}

/** Everything wrong with this name; empty when it may be used. */
export function validateRenameRoom(input: RenameRoomInput, context: CommandContext): string[] {
  const room = readOf(context.graph, 'room', input.roomId);

  if (room === null) {
    return [`Không tìm thấy phòng ${input.roomId} trong bản vẽ.`];
  }

  const name = input.name.trim();
  const reasons: string[] = [];

  if (name === '') {
    reasons.push('Tên phòng không được để trống.');

    return reasons;
  }

  if (name.length > MAX_ROOM_NAME_LENGTH) {
    reasons.push(
      `Tên phòng dài ${formatCount(name.length)} ký tự, quá mức ${formatCount(MAX_ROOM_NAME_LENGTH)} ký tự ` +
        'mà nhãn trên mặt bằng chứa được.',
    );
  }

  if (name === room.name) {
    reasons.push(`Phòng ${room.id} đã tên là "${name}" nên không có gì thay đổi.`);
  }

  const clash = entitiesOfKind(context.graph, 'room').find(
    (candidate) =>
      candidate.id !== room.id &&
      candidate.levelId === room.levelId &&
      candidate.name.trim().toLowerCase() === name.toLowerCase(),
  );

  if (clash !== undefined) {
    reasons.push(`Tầng ${room.levelId} đã có phòng ${clash.id} mang tên "${clash.name}".`);
  }

  return reasons;
}

/** Names a room. */
export function createRenameRoomCommand(
  input: RenameRoomInput,
  context: CommandContext,
): CommandResult {
  const reasons = validateRenameRoom(input, context);

  if (reasons.length > 0) {
    return refuse(ROOM_FLOOR_COMMAND_TYPES.renameRoom, reasons);
  }

  const room = readOf(context.graph, 'room', input.roomId);

  if (room === null) {
    return refuse(ROOM_FLOOR_COMMAND_TYPES.renameRoom, [`Không tìm thấy phòng ${input.roomId}.`]);
  }

  const name = input.name.trim();

  return accept(
    buildCommand(
      ROOM_FLOOR_COMMAND_TYPES.renameRoom,
      `Đổi tên phòng ${room.id} từ "${room.name}" thành "${name}", diện tích ` +
        `${formatAreaM2(room.areaM2)}.`,
      [changeForUpdate('room', room, { ...room, name })],
      context,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Đổi công năng — room.changeUsage                                         */
/* -------------------------------------------------------------------------- */

export interface ChangeRoomUsageInput {
  readonly roomId: RoomId;
  readonly usage: RoomUsage;
}

/** Everything wrong with this use; empty when it may be applied. */
export function validateChangeRoomUsage(
  input: ChangeRoomUsageInput,
  context: CommandContext,
): string[] {
  const room = readOf(context.graph, 'room', input.roomId);

  if (room === null) {
    return [`Không tìm thấy phòng ${input.roomId} trong bản vẽ.`];
  }

  if (!isKnownUsage(input.usage)) {
    return [`Công năng "${String(input.usage)}" không có trong hệ thống.`];
  }

  if (room.usage === input.usage) {
    return [
      `Phòng ${room.id} đã là ${describeUsage(input.usage).toLowerCase()} nên không có gì thay đổi.`,
    ];
  }

  return [];
}

/**
 * Changes what a room is for.
 *
 * The Vietnamese names come from `domain/rooms/classify`, the same table the
 * detection pass proposes with, so the log and the suggestion never use two
 * different words for one use.
 */
export function createChangeRoomUsageCommand(
  input: ChangeRoomUsageInput,
  context: CommandContext,
): CommandResult {
  const reasons = validateChangeRoomUsage(input, context);

  if (reasons.length > 0) {
    return refuse(ROOM_FLOOR_COMMAND_TYPES.changeRoomUsage, reasons);
  }

  const room = readOf(context.graph, 'room', input.roomId);

  if (room === null) {
    return refuse(ROOM_FLOOR_COMMAND_TYPES.changeRoomUsage, [
      `Không tìm thấy phòng ${input.roomId}.`,
    ]);
  }

  return accept(
    buildCommand(
      ROOM_FLOOR_COMMAND_TYPES.changeRoomUsage,
      `Đổi công năng phòng ${nameOfRoom(room)} từ ${describeUsage(room.usage).toLowerCase()} sang ` +
        `${describeUsage(input.usage).toLowerCase()}, diện tích ${formatAreaM2(room.areaM2)}.`,
      [changeForUpdate('room', room, { ...room, usage: input.usage })],
      context,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Gộp phòng — room.merge                                                   */
/* -------------------------------------------------------------------------- */

export interface MergeRoomsInput {
  readonly targetRoomId: RoomId;
  readonly absorbedRoomId: RoomId;
  /** The boundary of the one room the two become. */
  readonly outline: readonly Point[];
}

/** Everything wrong with this merge; empty when it may be applied. */
export function validateMergeRooms(input: MergeRoomsInput, context: CommandContext): string[] {
  if (input.targetRoomId === input.absorbedRoomId) {
    return [`Hai mã phòng cùng là ${input.targetRoomId}; cần hai phòng khác nhau để gộp.`];
  }

  const target = readOf(context.graph, 'room', input.targetRoomId);
  const absorbed = readOf(context.graph, 'room', input.absorbedRoomId);
  const reasons: string[] = [];

  if (target === null) {
    reasons.push(`Không tìm thấy phòng ${input.targetRoomId} trong bản vẽ.`);
  }

  if (absorbed === null) {
    reasons.push(`Không tìm thấy phòng ${input.absorbedRoomId} trong bản vẽ.`);
  }

  if (target === null || absorbed === null) {
    return reasons;
  }

  if (target.levelId !== absorbed.levelId) {
    reasons.push(
      `Phòng ${target.id} ở tầng ${target.levelId} còn ${absorbed.id} ở tầng ${absorbed.levelId}; ` +
        'chỉ gộp được hai phòng trên cùng một tầng.',
    );
  }

  reasons.push(...outlineReasons(input.outline, 'Ranh phòng sau khi gộp'));

  if (reasons.length > 0) {
    return reasons;
  }

  const partsM2 = totalArea([target.outline, absorbed.outline].map((outline) => outline.map((corner) => toPointMm(corner))));
  const mergedM2 = areaOf(input.outline);

  if (mergedM2 < partsM2 - AREA_TOLERANCE_M2) {
    reasons.push(
      `Ranh phòng sau khi gộp chỉ bao ${formatAreaM2(mergedM2)}, nhỏ hơn tổng ` +
        `${formatAreaM2(partsM2)} của hai phòng; phòng gộp phải chứa trọn cả hai.`,
    );
  }

  return reasons;
}

/**
 * Folds one room into another.
 *
 * The target keeps its id and takes the merged boundary; the absorbed room is
 * removed and its furniture changes hands, because a piece of furniture in a
 * room that is gone is exactly what `checkIntegrity` reports.
 */
export function createMergeRoomsCommand(
  input: MergeRoomsInput,
  context: CommandContext,
): CommandResult {
  const reasons = validateMergeRooms(input, context);

  if (reasons.length > 0) {
    return refuse(ROOM_FLOOR_COMMAND_TYPES.mergeRooms, reasons);
  }

  const target = readOf(context.graph, 'room', input.targetRoomId);
  const absorbed = readOf(context.graph, 'room', input.absorbedRoomId);

  if (target === null || absorbed === null) {
    return refuse(ROOM_FLOOR_COMMAND_TYPES.mergeRooms, ['Không tìm thấy đủ hai phòng để gộp.']);
  }

  const mergedM2 = areaOf(input.outline);
  const wallIds: WallId[] = [...target.wallIds];

  for (const wallId of absorbed.wallIds) {
    if (!wallIds.includes(wallId)) {
      wallIds.push(wallId);
    }
  }

  const rehomed = furnitureOfRoom(context, absorbed.id);
  const changes: EntityChange[] = [
    changeForUpdate('room', target, {
      ...target,
      outline: copyOutline(input.outline),
      areaM2: mergedM2,
      wallIds,
    }),
    ...rehomed.map((item) => changeForUpdate('furniture', item, { ...item, roomId: target.id })),
    changeForRemove('room', absorbed),
  ];

  return accept(
    buildCommand(
      ROOM_FLOOR_COMMAND_TYPES.mergeRooms,
      `Gộp phòng ${nameOfRoom(absorbed)} ${formatAreaM2(absorbed.areaM2)} vào phòng ` +
        `${nameOfRoom(target)} ${formatAreaM2(target.areaM2)}; phòng sau khi gộp rộng ` +
        `${formatAreaM2(mergedM2)}` +
        (rehomed.length === 0 ? '.' : `, kèm ${formatCount(rehomed.length)} đồ đạc đổi phòng.`),
      changes,
      context,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Tách phòng — room.split                                                  */
/* -------------------------------------------------------------------------- */

export interface SplitRoomInput {
  readonly roomId: RoomId;
  /** Id for the second piece; the first keeps the original. */
  readonly newRoomId: RoomId;
  readonly firstOutline: readonly Point[];
  readonly secondOutline: readonly Point[];
  /** Name for the second piece; derived from the original when left out. */
  readonly newRoomName?: string;
}

/** The name the second piece gets when the caller does not supply one. */
const derivedName = (room: Room, input: SplitRoomInput): string =>
  (input.newRoomName ?? `${room.name} (phần 2)`).trim();

/** Everything wrong with this split; empty when it may be applied. */
export function validateSplitRoom(input: SplitRoomInput, context: CommandContext): string[] {
  const room = readOf(context.graph, 'room', input.roomId);

  if (room === null) {
    return [`Không tìm thấy phòng ${input.roomId} trong bản vẽ.`];
  }

  const reasons: string[] = [];

  if (!isIdOfKind('room', input.newRoomId)) {
    reasons.push(`Mã "${input.newRoomId}" cho phòng mới không đúng định dạng của một mã phòng.`);
  } else if (idIsTaken(context.graph, input.newRoomId)) {
    reasons.push(`Bản vẽ đã có đối tượng mang mã ${input.newRoomId}.`);
  }

  if (derivedName(room, input) === '') {
    reasons.push('Tên phòng mới không được để trống.');
  }

  reasons.push(...outlineReasons(input.firstOutline, 'Ranh phần thứ nhất'));
  reasons.push(...outlineReasons(input.secondOutline, 'Ranh phần thứ hai'));

  if (reasons.length > 0) {
    return reasons;
  }

  const wholeM2 = areaOf(room.outline);
  const partsM2 = totalArea(
    [input.firstOutline, input.secondOutline].map((outline) => outline.map((corner) => toPointMm(corner))),
  );

  if (partsM2 > wholeM2 + AREA_TOLERANCE_M2) {
    reasons.push(
      `Hai phần cộng lại ${formatAreaM2(partsM2)}, lớn hơn ${formatAreaM2(wholeM2)} của phòng ` +
        `${room.id}; tách phòng không tạo thêm được mét vuông nào.`,
    );
  }

  return reasons;
}

/**
 * Cuts a room in two.
 *
 * The original keeps its id and its first piece, the second becomes a room of
 * its own with the same use and the same bounding walls — the list of walls
 * that actually bound each piece is re-derived by the detection pass and is not
 * guessed at here. Furniture whose centre falls in the second piece moves with
 * it, decided by `outlineContains` rather than by which room it used to be in.
 */
export function createSplitRoomCommand(
  input: SplitRoomInput,
  context: CommandContext,
): CommandResult {
  const reasons = validateSplitRoom(input, context);

  if (reasons.length > 0) {
    return refuse(ROOM_FLOOR_COMMAND_TYPES.splitRoom, reasons);
  }

  const room = readOf(context.graph, 'room', input.roomId);

  if (room === null) {
    return refuse(ROOM_FLOOR_COMMAND_TYPES.splitRoom, [`Không tìm thấy phòng ${input.roomId}.`]);
  }

  const firstM2 = areaOf(input.firstOutline);
  const secondM2 = areaOf(input.secondOutline);

  const newRoom: Room = {
    ...AUTHORED_BY_HAND,
    id: input.newRoomId,
    levelId: room.levelId,
    name: derivedName(room, input),
    usage: room.usage,
    outline: copyOutline(input.secondOutline),
    areaM2: secondM2,
    wallIds: [...room.wallIds],
  };

  const rehomed = furnitureOfRoom(context, room.id).filter((item) =>
    outlineHolds(input.secondOutline, item.centre),
  );

  const changes: EntityChange[] = [
    changeForUpdate('room', room, {
      ...room,
      outline: copyOutline(input.firstOutline),
      areaM2: firstM2,
    }),
    changeForAdd('room', newRoom),
    ...rehomed.map((item) => changeForUpdate('furniture', item, { ...item, roomId: newRoom.id })),
  ];

  return accept(
    buildCommand(
      ROOM_FLOOR_COMMAND_TYPES.splitRoom,
      `Tách phòng ${nameOfRoom(room)} ${formatAreaM2(room.areaM2)} thành ${formatAreaM2(firstM2)} và ` +
        `phòng mới "${newRoom.name}" ${newRoom.id} ${formatAreaM2(secondM2)}` +
        (rehomed.length === 0 ? '.' : `, kèm ${formatCount(rehomed.length)} đồ đạc sang phòng mới.`),
      changes,
      context,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* 5. Đổi cao độ tầng — level.changeElevation                                  */
/* -------------------------------------------------------------------------- */

export interface ChangeLevelElevationInput {
  readonly levelId: LevelId;
  readonly elevationMm: number;
}

/** Everything wrong with this elevation; empty when it may be applied. */
export function validateChangeLevelElevation(
  input: ChangeLevelElevationInput,
  context: CommandContext,
): string[] {
  const level = readOf(context.graph, 'level', input.levelId);

  if (level === null) {
    return [`Không tìm thấy tầng ${input.levelId} trong bản vẽ.`];
  }

  if (!Number.isFinite(input.elevationMm)) {
    return ['Cao độ mới không đọc được.'];
  }

  const reasons: string[] = [];

  if (nearlyEqualLength(millimetres(level.elevationMm), millimetres(input.elevationMm))) {
    reasons.push(
      `Tầng "${level.name}" đã ở cao độ ${formatElevationM(level.elevationMm)} nên không có gì thay đổi.`,
    );
  }

  const stack = levelsInOrder(context);
  const position = stack.findIndex((candidate) => candidate.id === level.id);
  const below = position > 0 ? stack[position - 1] : undefined;
  const above = position >= 0 ? stack[position + 1] : undefined;

  if (below !== undefined && compareNearly(below.elevationMm + below.heightMm, input.elevationMm) > 0) {
    reasons.push(
      `Tầng "${below.name}" ở ${formatElevationM(below.elevationMm)} cao ` +
        `${formatMetres(below.heightMm)} nên đỉnh của nó ở ${formatElevationM(below.elevationMm + below.heightMm)}; ` +
        `cao độ mới ${formatElevationM(input.elevationMm)} nằm thấp hơn.`,
    );
  }

  if (above !== undefined && compareNearly(input.elevationMm + level.heightMm, above.elevationMm) > 0) {
    reasons.push(
      `Đặt ở ${formatElevationM(input.elevationMm)} thì tầng "${level.name}" cao ` +
        `${formatMetres(level.heightMm)} sẽ chạm lên tầng "${above.name}" đang ở ` +
        `${formatElevationM(above.elevationMm)}.`,
    );
  }

  return reasons;
}

/**
 * Moves one storey up or down the stack.
 *
 * Only that storey moves. The check is that it still fits: its floor is not
 * below the top of the storey under it, and its own top does not push into the
 * storey above. Neighbours are never nudged out of the way — a stack that no
 * longer fits is a decision for a person, not for a command.
 */
export function createChangeLevelElevationCommand(
  input: ChangeLevelElevationInput,
  context: CommandContext,
): CommandResult {
  const reasons = validateChangeLevelElevation(input, context);

  if (reasons.length > 0) {
    return refuse(ROOM_FLOOR_COMMAND_TYPES.changeLevelElevation, reasons);
  }

  const level = readOf(context.graph, 'level', input.levelId);

  if (level === null) {
    return refuse(ROOM_FLOOR_COMMAND_TYPES.changeLevelElevation, [
      `Không tìm thấy tầng ${input.levelId}.`,
    ]);
  }

  const risen = input.elevationMm > level.elevationMm;

  return accept(
    buildCommand(
      ROOM_FLOOR_COMMAND_TYPES.changeLevelElevation,
      `Đổi cao độ tầng "${level.name}" ${level.id} từ ${formatElevationM(level.elevationMm)} ` +
        `${risen ? 'lên' : 'xuống'} ${formatElevationM(input.elevationMm)}, chênh ` +
        `${formatMetres(Math.abs(input.elevationMm - level.elevationMm))}.`,
      [changeForUpdate('level', level, { ...level, elevationMm: input.elevationMm })],
      context,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* 6. Sắp xếp lại tầng — level.reorder                                         */
/* -------------------------------------------------------------------------- */

export interface ReorderLevelsInput {
  /** Every level of the building, bottom up, in the order they should stack. */
  readonly levelIds: readonly LevelId[];
}

/** Where each level lands once the stack is rebuilt from the datum upwards. */
interface StackedLevel {
  readonly level: Level;
  readonly order: number;
  readonly elevationMm: number;
}

/**
 * Rebuilds the stack from the datum, each storey sitting on the one below.
 *
 * Re-stacking rather than only renumbering is what makes the command mean
 * something: moving a storey in the list moves the storeys above it by that
 * storey's height, and the building is left with no gap and no overlap.
 */
const restack = (context: CommandContext, levelIds: readonly LevelId[]): StackedLevel[] => {
  const stacked: StackedLevel[] = [];
  let elevationMm = context.graph.building.datumElevationMm;

  levelIds.forEach((levelId, order) => {
    const level = readOf(context.graph, 'level', levelId);

    if (level === null) {
      return;
    }

    stacked.push({ level, order, elevationMm });
    elevationMm += level.heightMm;
  });

  return stacked;
};

/** Everything wrong with this ordering; empty when it may be applied. */
export function validateReorderLevels(
  input: ReorderLevelsInput,
  context: CommandContext,
): string[] {
  const levels = levelsInOrder(context);
  const reasons: string[] = [];

  if (levels.length < 2) {
    return [
      `Toà nhà mới có ${formatCount(levels.length)} tầng nên chưa có gì để sắp xếp lại.`,
    ];
  }

  const seen = new Set<LevelId>();

  for (const levelId of input.levelIds) {
    if (seen.has(levelId)) {
      reasons.push(`Thứ tự mới lặp lại tầng ${levelId}.`);

      continue;
    }

    seen.add(levelId);

    if (readOf(context.graph, 'level', levelId) === null) {
      reasons.push(`Không tìm thấy tầng ${levelId} trong bản vẽ.`);
    }
  }

  const missing = levels.filter((level) => !seen.has(level.id));

  if (missing.length > 0) {
    reasons.push(
      `Thứ tự mới bỏ sót ${formatCount(missing.length)} trên ${formatCount(levels.length)} tầng: ` +
        `${missing.map((level) => level.id).join(', ')}.`,
    );
  }

  for (const level of levels) {
    if (!Number.isFinite(level.heightMm) || compareNearly(level.heightMm, 0) <= 0) {
      reasons.push(
        `Tầng "${level.name}" cao ${formatMetres(level.heightMm)}; phải lớn hơn 0 m thì mới xếp chồng được.`,
      );
    }
  }

  if (reasons.length > 0) {
    return reasons;
  }

  const moved = restack(context, input.levelIds).filter(
    (entry) =>
      entry.level.order !== entry.order ||
      !nearlyEqualLength(millimetres(entry.level.elevationMm), millimetres(entry.elevationMm)),
  );

  if (moved.length === 0) {
    reasons.push('Thứ tự mới trùng với thứ tự và cao độ hiện tại nên không có gì thay đổi.');
  }

  return reasons;
}

/** Re-stacks the storeys of the building in a new order. */
export function createReorderLevelsCommand(
  input: ReorderLevelsInput,
  context: CommandContext,
): CommandResult {
  const reasons = validateReorderLevels(input, context);

  if (reasons.length > 0) {
    return refuse(ROOM_FLOOR_COMMAND_TYPES.reorderLevels, reasons);
  }

  const stacked = restack(context, input.levelIds);
  const moved = stacked.filter(
    (entry) =>
      entry.level.order !== entry.order ||
      !nearlyEqualLength(millimetres(entry.level.elevationMm), millimetres(entry.elevationMm)),
  );

  const reordered = moved.filter((entry) => entry.level.order !== entry.order).length;
  const raised = moved.filter(
    (entry) => !nearlyEqualLength(millimetres(entry.level.elevationMm), millimetres(entry.elevationMm)),
  ).length;

  return accept(
    buildCommand(
      ROOM_FLOOR_COMMAND_TYPES.reorderLevels,
      `Sắp xếp lại ${formatCount(stacked.length)} tầng: ${formatCount(reordered)} tầng đổi vị trí, ` +
        `${formatCount(raised)} tầng đổi cao độ; xếp chồng lại từ cao độ ` +
        `${formatElevationM(context.graph.building.datumElevationMm)}.`,
      moved.map((entry) =>
        changeForUpdate('level', entry.level, {
          ...entry.level,
          order: entry.order,
          elevationMm: entry.elevationMm,
        }),
      ),
      context,
    ),
  );
}
