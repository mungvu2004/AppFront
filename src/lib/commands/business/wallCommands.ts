/**
 * The seven things a person can do to a wall.
 *
 * `wall.draw` · `wall.dragEnd` · `wall.changeThickness` · `wall.changeKind` ·
 * `wall.split` · `wall.merge` · `wall.delete`
 *
 * Each one is two functions: a `validate…` that reads the drawing and answers
 * with Vietnamese sentences, and a `create…Command` that answers with a command
 * or with those same sentences. Nothing is written here and nothing is guessed.
 *
 * **No geometry is restated.** Cutting a wall in two is `domain/walls/edit`
 * `splitWall`, welding two is `mergeWalls`, and carrying the doors along is
 * `domain/openings/reflow`. What this module owns is the business decision
 * around those calls: whether the edit is allowed, everything it drags with it,
 * and the sentence the activity log shows.
 *
 * **Everything an edit drags with it is part of the same command.** Cutting a
 * wall re-homes its openings; welding two walls re-attaches both sets; deleting
 * one takes its openings with it and clears the references rooms and dimensions
 * held to it. All of that lands in one command with full snapshots, so one
 * `Ctrl+Z` puts back exactly what one action changed — no half-deleted door
 * left standing, no room pointing at a wall that is gone.
 */

import { openingCentre, attachToWall } from '@/domain/openings/attach';
import { reflowOpenings, reflowOpeningsAcrossSplit } from '@/domain/openings/reflow';
import { isAttached, type AttachedOpening } from '@/domain/openings/types';
import { isIdOfKind } from '@/domain/spatial/ids';
import type {
  Dimension,
  EntityId,
  Level,
  LevelId,
  Opening as GraphOpening,
  OpeningId,
  Point,
  Room,
  Segment,
  Wall as GraphWall,
  WallId,
  WallKind,
} from '@/domain/spatial/types';
import { compareNearly, nearlyEqualLength, nearlyEqualPoint } from '@/domain/units/compare';
import { distanceBetween } from '@/domain/units/snap';
import { millimetres } from '@/domain/units/types';
import { nearestStandardThickness } from '@/domain/walls/cleanup';
import {
  mergeWalls,
  MIN_WALL_LENGTH_MM,
  orientationDifference,
  splitWall,
  type MergeRefusal,
  type SplitRefusal,
} from '@/domain/walls/edit';
import {
  centrelineLength,
  isThicknessInRange,
  MAX_WALL_THICKNESS_MM,
  MIN_WALL_THICKNESS_MM,
  type Wall as SolidWall,
  type WallEnd,
} from '@/domain/walls/types';

import { changeForAdd, changeForRemove, changeForUpdate } from '../createCommand';
import type { EntityChange } from '../types';
import {
  accept,
  AUTHORED_BY_HAND,
  buildCommand,
  entitiesOfKind,
  formatAngleDeg,
  formatCount,
  formatLengthMm,
  formatPoint,
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
  WALL_KIND_LABELS,
  WALL_KINDS,
  withCentrelineOf,
  type CommandContext,
  type CommandResult,
} from './shared';

/* -------------------------------------------------------------------------- */
/* Command names.                                                              */
/* -------------------------------------------------------------------------- */

/** The seven wall commands, as `dispatch` and the telemetry see them. */
export const WALL_COMMAND_TYPES = {
  draw: 'wall.draw',
  dragEnd: 'wall.dragEnd',
  changeThickness: 'wall.changeThickness',
  changeKind: 'wall.changeKind',
  split: 'wall.split',
  merge: 'wall.merge',
  remove: 'wall.delete',
} as const;

/* -------------------------------------------------------------------------- */
/* Shared checks.                                                              */
/* -------------------------------------------------------------------------- */

/** Both ends of a centreline, in the order the interface offers them. */
export const WALL_END_LABELS: Readonly<Record<WallEnd, string>> = {
  start: 'đầu',
  end: 'cuối',
};

/**
 * Everything that would stop the geometry functions from accepting this wall.
 *
 * The domain throws rather than repairs — a thickness outside 60–600 mm is a
 * unit mix-up, not a rounding error — so a command hands it nothing it would
 * throw on, and reports the same facts as sentences instead.
 */
const geometryReasons = (wall: GraphWall, level: Level): string[] => {
  const reasons: string[] = [];

  if (!isFinitePoint(wall.centreline.start) || !isFinitePoint(wall.centreline.end)) {
    reasons.push(`Tường ${wall.id} có toạ độ tim tường không đọc được.`);

    return reasons;
  }

  if (!Number.isFinite(wall.thicknessMm) || !isThicknessInRange(millimetres(wall.thicknessMm))) {
    reasons.push(
      `Tường ${wall.id} dày ${formatLengthMm(wall.thicknessMm)}, ngoài khoảng ` +
        `${formatLengthMm(MIN_WALL_THICKNESS_MM).replace(' mm', '')}–${formatLengthMm(MAX_WALL_THICKNESS_MM)} cho phép.`,
    );
  }

  const lengthMm = distanceBetween(toPointMm(wall.centreline.start), toPointMm(wall.centreline.end));

  if (compareNearly(lengthMm, 0) <= 0) {
    reasons.push(`Tường ${wall.id} có tim tường dài 0 mm nên không xử lý hình học được.`);
  }

  if (!Number.isFinite(wall.heightMm) || compareNearly(wall.heightMm, 0) <= 0) {
    reasons.push(`Tường ${wall.id} cao ${formatLengthMm(wall.heightMm)}, phải lớn hơn 0 mm.`);
  }

  if (!Number.isFinite(level.elevationMm)) {
    reasons.push(`Tầng ${level.id} có cao độ không đọc được.`);
  }

  return reasons;
};

/** The wall, its level, and every reason the pair cannot be worked on. */
interface WallLookup {
  readonly wall: GraphWall | null;
  readonly level: Level | null;
  readonly reasons: readonly string[];
}

const lookupWall = (context: CommandContext, wallId: WallId): WallLookup => {
  const wall = readOf(context.graph, 'wall', wallId);

  if (wall === null) {
    return { wall: null, level: null, reasons: [`Không tìm thấy tường ${wallId} trong bản vẽ.`] };
  }

  const level = levelOfWall(context.graph, wall);

  if (level === null) {
    return { wall, level: null, reasons: [`Tường ${wallId} đang trỏ tới tầng ${wall.levelId} không tồn tại.`] };
  }

  return { wall, level, reasons: geometryReasons(wall, level) };
};

/** The openings of a wall, ready for the openings domain. */
const attachedOpeningsOf = (
  context: CommandContext,
  wall: GraphWall,
  solid: SolidWall,
): { readonly graph: readonly GraphOpening[]; readonly attached: readonly AttachedOpening[] } => {
  const graphOpenings = openingsOfWall(context.graph, wall.id);

  return {
    graph: graphOpenings,
    attached: graphOpenings.map((opening) => toAttachedOpening(opening, solid)),
  };
};

/** An update change, or nothing at all when the offset did not actually move. */
const openingMoveChange = (
  before: GraphOpening,
  wallId: WallId,
  offsetMm: number,
): readonly EntityChange[] => {
  if (before.wallId === wallId && nearlyEqualLength(millimetres(before.offsetMm), millimetres(offsetMm))) {
    return [];
  }

  return [changeForUpdate('opening', before, { ...before, wallId, offsetMm })];
};

/* -------------------------------------------------------------------------- */
/* 1. Vẽ tường — wall.draw                                                     */
/* -------------------------------------------------------------------------- */

export interface DrawWallInput {
  readonly id: WallId;
  readonly levelId: LevelId;
  readonly centreline: Segment;
  readonly thicknessMm: number;
  readonly heightMm: number;
  readonly kind: WallKind;
}

/** Everything wrong with drawing this wall; empty when it may be drawn. */
export function validateDrawWall(input: DrawWallInput, context: CommandContext): string[] {
  const reasons: string[] = [];

  if (!isIdOfKind('wall', input.id)) {
    reasons.push(`Mã tường "${input.id}" không đúng định dạng của một mã tường.`);
  } else if (idIsTaken(context.graph, input.id)) {
    reasons.push(`Bản vẽ đã có đối tượng mang mã ${input.id}.`);
  }

  if (readOf(context.graph, 'level', input.levelId) === null) {
    reasons.push(`Không tìm thấy tầng ${input.levelId} để đặt tường lên.`);
  }

  if (!WALL_KINDS.includes(input.kind)) {
    reasons.push(`Loại tường "${input.kind}" không có trong hệ thống.`);
  }

  if (!isFinitePoint(input.centreline.start) || !isFinitePoint(input.centreline.end)) {
    reasons.push('Toạ độ tim tường không đọc được.');

    return reasons;
  }

  const lengthMm = distanceBetween(
    toPointMm(input.centreline.start),
    toPointMm(input.centreline.end),
  );

  if (compareNearly(lengthMm, MIN_WALL_LENGTH_MM) < 0) {
    reasons.push(
      `Tường chỉ dài ${formatLengthMm(lengthMm)}, ngắn hơn mức tối thiểu ` +
        `${formatLengthMm(MIN_WALL_LENGTH_MM)}.`,
    );
  }

  if (!Number.isFinite(input.thicknessMm) || !isThicknessInRange(millimetres(input.thicknessMm))) {
    reasons.push(
      `Độ dày ${formatLengthMm(input.thicknessMm)} nằm ngoài khoảng ` +
        `${formatLengthMm(MIN_WALL_THICKNESS_MM).replace(' mm', '')}–${formatLengthMm(MAX_WALL_THICKNESS_MM)}.`,
    );
  }

  if (!Number.isFinite(input.heightMm) || compareNearly(input.heightMm, 0) <= 0) {
    reasons.push(`Chiều cao tường phải lớn hơn 0 mm, đang nhận ${formatLengthMm(input.heightMm)}.`);
  }

  return reasons;
}

/** Draws a new wall on one level. */
export function createDrawWallCommand(input: DrawWallInput, context: CommandContext): CommandResult {
  const reasons = validateDrawWall(input, context);

  if (reasons.length > 0) {
    return refuse(WALL_COMMAND_TYPES.draw, reasons);
  }

  const level = readOf(context.graph, 'level', input.levelId);
  const lengthMm = distanceBetween(
    toPointMm(input.centreline.start),
    toPointMm(input.centreline.end),
  );

  const wall: GraphWall = {
    ...AUTHORED_BY_HAND,
    id: input.id,
    levelId: input.levelId,
    centreline: { start: { ...input.centreline.start }, end: { ...input.centreline.end } },
    thicknessMm: input.thicknessMm,
    heightMm: input.heightMm,
    kind: input.kind,
    openingIds: [],
  };

  return accept(
    buildCommand(
      WALL_COMMAND_TYPES.draw,
      `Vẽ ${WALL_KIND_LABELS[input.kind]} ${input.id} dài ${formatLengthMm(lengthMm)}, dày ` +
        `${formatLengthMm(input.thicknessMm)}, cao ${formatLengthMm(input.heightMm)} trên tầng ` +
        `${level === null ? input.levelId : level.name}.`,
      [changeForAdd('wall', wall)],
      context,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Kéo đỉnh tường — wall.dragEnd                                            */
/* -------------------------------------------------------------------------- */

export interface DragWallEndInput {
  readonly wallId: WallId;
  readonly end: WallEnd;
  readonly to: Point;
}

/** The centreline this drag would leave behind. */
const draggedCentreline = (wall: GraphWall, input: DragWallEndInput): Segment =>
  input.end === 'start'
    ? { start: { ...input.to }, end: { ...wall.centreline.end } }
    : { start: { ...wall.centreline.start }, end: { ...input.to } };

/** Everything wrong with dragging this end; empty when it may be dragged. */
export function validateDragWallEnd(input: DragWallEndInput, context: CommandContext): string[] {
  const found = lookupWall(context, input.wallId);

  if (found.wall === null || found.level === null || found.reasons.length > 0) {
    return [...found.reasons];
  }

  const reasons: string[] = [];

  if (!isFinitePoint(input.to)) {
    reasons.push('Toạ độ đích của thao tác kéo không đọc được.');

    return reasons;
  }

  const from = input.end === 'start' ? found.wall.centreline.start : found.wall.centreline.end;

  if (nearlyEqualPoint(toPointMm(from), toPointMm(input.to))) {
    reasons.push(
      `Đỉnh ${WALL_END_LABELS[input.end]} của tường ${input.wallId} đã ở ${formatPoint(input.to)} nên không có gì thay đổi.`,
    );
  }

  const centreline = draggedCentreline(found.wall, input);
  const lengthMm = distanceBetween(toPointMm(centreline.start), toPointMm(centreline.end));

  if (compareNearly(lengthMm, MIN_WALL_LENGTH_MM) < 0) {
    reasons.push(
      `Kéo tới đây tường chỉ còn dài ${formatLengthMm(lengthMm)}, ngắn hơn mức tối thiểu ` +
        `${formatLengthMm(MIN_WALL_LENGTH_MM)}.`,
    );
  }

  return reasons;
}

/**
 * Drags one end of a wall to a new point.
 *
 * The openings ride along: `reflowOpenings` keeps each one the same share of
 * the way down the wall, and every opening whose stored offset changes as a
 * result is part of the same command.
 */
export function createDragWallEndCommand(
  input: DragWallEndInput,
  context: CommandContext,
): CommandResult {
  const reasons = validateDragWallEnd(input, context);

  if (reasons.length > 0) {
    return refuse(WALL_COMMAND_TYPES.dragEnd, reasons);
  }

  const found = lookupWall(context, input.wallId);

  if (found.wall === null || found.level === null) {
    return refuse(WALL_COMMAND_TYPES.dragEnd, found.reasons);
  }

  const { wall, level } = found;
  const before = toSolidWall(wall, level);
  const nextWall: GraphWall = { ...wall, centreline: draggedCentreline(wall, input) };
  const after = toSolidWall(nextWall, level);
  const openings = attachedOpeningsOf(context, wall, before);
  const openingsById = new Map(openings.graph.map((opening) => [opening.id, opening] as const));

  const reflow = reflowOpenings(before, after, openings.attached);
  const openingChanges = reflow.openings.flatMap((moved) => {
    const stored = openingsById.get(moved.id);

    return stored === undefined ? [] : openingMoveChange(stored, wall.id, offsetOnWall(moved, after));
  });

  const fromLengthMm = centrelineLength(before);
  const toLengthMm = centrelineLength(after);
  const movedCount = openingChanges.length;

  return accept(
    buildCommand(
      WALL_COMMAND_TYPES.dragEnd,
      `Kéo đỉnh ${WALL_END_LABELS[input.end]} tường ${wall.id} từ ` +
        `${formatPoint(input.end === 'start' ? wall.centreline.start : wall.centreline.end)} sang ` +
        `${formatPoint(input.to)}; tường dài ${formatLengthMm(fromLengthMm)} thành ` +
        `${formatLengthMm(toLengthMm)}` +
        (movedCount === 0 ? '.' : `, ${formatCount(movedCount)} lỗ mở dịch theo.`),
      [changeForUpdate('wall', wall, nextWall), ...openingChanges],
      context,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Đổi độ dày — wall.changeThickness                                        */
/* -------------------------------------------------------------------------- */

export interface ChangeWallThicknessInput {
  readonly wallId: WallId;
  readonly thicknessMm: number;
}

/** Everything wrong with this thickness; empty when it may be applied. */
export function validateChangeWallThickness(
  input: ChangeWallThicknessInput,
  context: CommandContext,
): string[] {
  const wall = readOf(context.graph, 'wall', input.wallId);

  if (wall === null) {
    return [`Không tìm thấy tường ${input.wallId} trong bản vẽ.`];
  }

  const reasons: string[] = [];

  if (!Number.isFinite(input.thicknessMm) || !isThicknessInRange(millimetres(input.thicknessMm))) {
    reasons.push(
      `Độ dày ${formatLengthMm(input.thicknessMm)} nằm ngoài khoảng ` +
        `${formatLengthMm(MIN_WALL_THICKNESS_MM).replace(' mm', '')}–${formatLengthMm(MAX_WALL_THICKNESS_MM)}.`,
    );

    return reasons;
  }

  if (nearlyEqualLength(millimetres(wall.thicknessMm), millimetres(input.thicknessMm))) {
    reasons.push(`Tường ${wall.id} đã dày ${formatLengthMm(wall.thicknessMm)} nên không có gì thay đổi.`);
  }

  return reasons;
}

/**
 * Changes how thick a wall is.
 *
 * A value the standards table would round is not corrected — a thickness is a
 * measurement somebody took — but the nearest standard is named in the log, so
 * the reviewer sees the offer rather than a silent change.
 */
export function createChangeWallThicknessCommand(
  input: ChangeWallThicknessInput,
  context: CommandContext,
): CommandResult {
  const reasons = validateChangeWallThickness(input, context);

  if (reasons.length > 0) {
    return refuse(WALL_COMMAND_TYPES.changeThickness, reasons);
  }

  const wall = readOf(context.graph, 'wall', input.wallId);

  if (wall === null) {
    return refuse(WALL_COMMAND_TYPES.changeThickness, [`Không tìm thấy tường ${input.wallId}.`]);
  }

  const standardMm = nearestStandardThickness(millimetres(input.thicknessMm));

  return accept(
    buildCommand(
      WALL_COMMAND_TYPES.changeThickness,
      `Đổi độ dày tường ${wall.id} từ ${formatLengthMm(wall.thicknessMm)} sang ` +
        `${formatLengthMm(input.thicknessMm)}` +
        (standardMm === null ? '.' : `, gần độ dày chuẩn ${formatLengthMm(standardMm)}.`),
      [changeForUpdate('wall', wall, { ...wall, thicknessMm: input.thicknessMm })],
      context,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Đổi loại tường — wall.changeKind                                         */
/* -------------------------------------------------------------------------- */

export interface ChangeWallKindInput {
  readonly wallId: WallId;
  readonly kind: WallKind;
}

/** Everything wrong with this kind change; empty when it may be applied. */
export function validateChangeWallKind(
  input: ChangeWallKindInput,
  context: CommandContext,
): string[] {
  const wall = readOf(context.graph, 'wall', input.wallId);

  if (wall === null) {
    return [`Không tìm thấy tường ${input.wallId} trong bản vẽ.`];
  }

  if (!WALL_KINDS.includes(input.kind)) {
    return [`Loại tường "${input.kind}" không có trong hệ thống.`];
  }

  if (wall.kind === input.kind) {
    return [`Tường ${wall.id} đã là ${WALL_KIND_LABELS[input.kind]} nên không có gì thay đổi.`];
  }

  return [];
}

/** Changes what a wall is for. */
export function createChangeWallKindCommand(
  input: ChangeWallKindInput,
  context: CommandContext,
): CommandResult {
  const reasons = validateChangeWallKind(input, context);

  if (reasons.length > 0) {
    return refuse(WALL_COMMAND_TYPES.changeKind, reasons);
  }

  const wall = readOf(context.graph, 'wall', input.wallId);

  if (wall === null) {
    return refuse(WALL_COMMAND_TYPES.changeKind, [`Không tìm thấy tường ${input.wallId}.`]);
  }

  const lengthMm = distanceBetween(
    toPointMm(wall.centreline.start),
    toPointMm(wall.centreline.end),
  );

  return accept(
    buildCommand(
      WALL_COMMAND_TYPES.changeKind,
      `Đổi loại tường ${wall.id} từ ${WALL_KIND_LABELS[wall.kind]} sang ` +
        `${WALL_KIND_LABELS[input.kind]}, dài ${formatLengthMm(lengthMm)}, dày ` +
        `${formatLengthMm(wall.thicknessMm)}.`,
      [changeForUpdate('wall', wall, { ...wall, kind: input.kind })],
      context,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* 5. Cắt tường — wall.split                                                   */
/* -------------------------------------------------------------------------- */

export interface SplitWallInput {
  readonly wallId: WallId;
  /** Where to cut; dropped onto the centreline by the geometry. */
  readonly at: Point;
  /** Id for the second piece; the first keeps the original. */
  readonly secondWallId: WallId;
}

/** Vietnamese for every reason the geometry refuses a cut. */
const SPLIT_REFUSAL_REASONS: Readonly<Record<SplitRefusal, string>> = {
  pointOffWall: 'Điểm cắt không rơi vào đoạn tim tường nên không cắt được.',
  pieceTooShort: 'Cắt ở đây sẽ để lại một đoạn ngắn hơn mức tối thiểu.',
};

/** Everything wrong with cutting this wall; empty when it may be cut. */
export function validateSplitWall(input: SplitWallInput, context: CommandContext): string[] {
  const found = lookupWall(context, input.wallId);

  if (found.wall === null || found.level === null || found.reasons.length > 0) {
    return [...found.reasons];
  }

  const reasons: string[] = [];

  if (!isIdOfKind('wall', input.secondWallId)) {
    reasons.push(`Mã "${input.secondWallId}" cho đoạn thứ hai không đúng định dạng của một mã tường.`);
  } else if (idIsTaken(context.graph, input.secondWallId)) {
    reasons.push(`Bản vẽ đã có đối tượng mang mã ${input.secondWallId}.`);
  }

  if (!isFinitePoint(input.at)) {
    reasons.push('Toạ độ điểm cắt không đọc được.');

    return reasons;
  }

  const outcome = splitWall(
    toSolidWall(found.wall, found.level),
    toPointMm(input.at),
    input.secondWallId,
  );

  if (!outcome.ok) {
    const lengthMm = centrelineLength(toSolidWall(found.wall, found.level));

    reasons.push(
      `${SPLIT_REFUSAL_REASONS[outcome.reason]} Tường ${found.wall.id} dài ` +
        `${formatLengthMm(lengthMm)}, đoạn ngắn nhất cho phép là ` +
        `${formatLengthMm(MIN_WALL_LENGTH_MM)}.`,
    );
  }

  return reasons;
}

/**
 * Cuts a wall in two at a point.
 *
 * The first piece keeps the wall's id, the second takes the one the caller
 * supplies, and `reflowOpeningsAcrossSplit` sends each opening to the piece
 * holding its centre without moving it on the plan. Both pieces get the list of
 * openings they ended up with, so the wall and its openings never disagree.
 */
export function createSplitWallCommand(
  input: SplitWallInput,
  context: CommandContext,
): CommandResult {
  const reasons = validateSplitWall(input, context);

  if (reasons.length > 0) {
    return refuse(WALL_COMMAND_TYPES.split, reasons);
  }

  const found = lookupWall(context, input.wallId);

  if (found.wall === null || found.level === null) {
    return refuse(WALL_COMMAND_TYPES.split, found.reasons);
  }

  const { wall, level } = found;
  const original = toSolidWall(wall, level);
  const outcome = splitWall(original, toPointMm(input.at), input.secondWallId);

  if (!outcome.ok) {
    return refuse(WALL_COMMAND_TYPES.split, [SPLIT_REFUSAL_REASONS[outcome.reason]]);
  }

  const [firstSolid, secondSolid] = outcome.walls;
  const openings = attachedOpeningsOf(context, wall, original);
  const openingsById = new Map(openings.graph.map((opening) => [opening.id, opening] as const));

  const reflow = reflowOpeningsAcrossSplit(original, outcome.walls, openings.attached);
  const openingIdsByWall = new Map<WallId, OpeningId[]>([
    [wall.id, []],
    [input.secondWallId, []],
  ]);

  const openingChanges = reflow.openings.flatMap((moved) => {
    const stored = openingsById.get(moved.id);

    if (stored === undefined) {
      return [];
    }

    openingIdsByWall.get(moved.wallId)?.push(moved.id);

    const host = moved.wallId === wall.id ? firstSolid : secondSolid;

    return openingMoveChange(stored, moved.wallId, offsetOnWall(moved, host));
  });

  const firstWall: GraphWall = {
    ...withCentrelineOf(wall, firstSolid),
    openingIds: openingIdsByWall.get(wall.id) ?? [],
  };
  const secondWall: GraphWall = {
    ...withCentrelineOf(wall, secondSolid),
    ...AUTHORED_BY_HAND,
    id: input.secondWallId,
    openingIds: openingIdsByWall.get(input.secondWallId) ?? [],
  };

  const undecided = reflow.needsDecision.length;

  return accept(
    buildCommand(
      WALL_COMMAND_TYPES.split,
      `Cắt tường ${wall.id} dài ${formatLengthMm(centrelineLength(original))} tại ` +
        `${formatPoint(input.at)} thành ${formatLengthMm(centrelineLength(firstSolid))} và ` +
        `${formatLengthMm(centrelineLength(secondSolid))} (đoạn mới ${input.secondWallId})` +
        (undecided === 0 ? '.' : `; ${formatCount(undecided)} lỗ mở nằm vắt qua nhát cắt, cần người xem.`),
      [
        changeForUpdate('wall', wall, firstWall),
        changeForAdd('wall', secondWall),
        ...openingChanges,
      ],
      context,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* 6. Gộp tường — wall.merge                                                   */
/* -------------------------------------------------------------------------- */

export interface MergeWallsInput {
  readonly wallId: WallId;
  readonly otherWallId: WallId;
}

/** Vietnamese for every reason the geometry refuses a weld. */
const MERGE_REFUSAL_REASONS: Readonly<Record<MergeRefusal, string>> = {
  sameWall: 'Hai mã tường trỏ về cùng một tường.',
  kindMismatch: 'Hai tường khác loại nên không gộp được.',
  thicknessMismatch: 'Hai tường khác độ dày nên không gộp được.',
  elevationMismatch: 'Hai tường khác cao độ nên không gộp được.',
  angleTooWide: 'Hai tường lệch phương quá nhiều nên không nằm trên cùng một đường.',
  tooFarApart: 'Hai tường nằm cách nhau quá xa nên đường gộp sẽ không phủ hết chỗ nối.',
};

/** Everything wrong with welding these two walls; empty when they may be welded. */
export function validateMergeWalls(input: MergeWallsInput, context: CommandContext): string[] {
  if (input.wallId === input.otherWallId) {
    return [`Hai mã tường cùng là ${input.wallId}; cần hai tường khác nhau để gộp.`];
  }

  const first = lookupWall(context, input.wallId);
  const second = lookupWall(context, input.otherWallId);
  const blocking = [...first.reasons, ...second.reasons];

  if (first.wall === null || first.level === null || second.wall === null || second.level === null) {
    return blocking;
  }

  if (blocking.length > 0) {
    return blocking;
  }

  const reasons: string[] = [];

  if (first.wall.levelId !== second.wall.levelId) {
    reasons.push(
      `Tường ${first.wall.id} ở tầng ${first.level.name} còn ${second.wall.id} ở tầng ` +
        `${second.level.name}; chỉ gộp được hai tường trên cùng một tầng.`,
    );

    return reasons;
  }

  if (first.wall.kind !== second.wall.kind) {
    reasons.push(
      `Tường ${first.wall.id} là ${WALL_KIND_LABELS[first.wall.kind]} còn ${second.wall.id} là ` +
        `${WALL_KIND_LABELS[second.wall.kind]}; hai tường khác loại thì không gộp.`,
    );
  }

  const firstSolid = toSolidWall(first.wall, first.level);
  const secondSolid = toSolidWall(second.wall, second.level);
  const outcome = mergeWalls(firstSolid, secondSolid);

  if (!outcome.ok) {
    reasons.push(
      `${MERGE_REFUSAL_REASONS[outcome.reason]} Hai tường dày ` +
        `${formatLengthMm(first.wall.thicknessMm)} và ${formatLengthMm(second.wall.thicknessMm)}, ` +
        `lệch phương ${formatAngleDeg(orientationDifference(firstSolid, secondSolid))}.`,
    );
  }

  return reasons;
}

/**
 * Welds two walls into one.
 *
 * The longer wall keeps its id and takes the merged centreline; the other is
 * removed. Every opening of **both** walls is re-attached by its position on
 * the plan — `openingCentre` says where it is, `attachToWall` says where that
 * lands on the merged run — so no door moves because the run it sits on grew.
 */
export function createMergeWallsCommand(
  input: MergeWallsInput,
  context: CommandContext,
): CommandResult {
  const reasons = validateMergeWalls(input, context);

  if (reasons.length > 0) {
    return refuse(WALL_COMMAND_TYPES.merge, reasons);
  }

  const first = lookupWall(context, input.wallId);
  const second = lookupWall(context, input.otherWallId);

  if (first.wall === null || first.level === null || second.wall === null || second.level === null) {
    return refuse(WALL_COMMAND_TYPES.merge, [...first.reasons, ...second.reasons]);
  }

  const firstSolid = toSolidWall(first.wall, first.level);
  const secondSolid = toSolidWall(second.wall, second.level);
  const outcome = mergeWalls(firstSolid, secondSolid);

  if (!outcome.ok) {
    return refuse(WALL_COMMAND_TYPES.merge, [MERGE_REFUSAL_REASONS[outcome.reason]]);
  }

  const keptGraphWall = outcome.wall.id === first.wall.id ? first.wall : second.wall;
  const removedGraphWall = outcome.wall.id === first.wall.id ? second.wall : first.wall;
  const keptSolid = outcome.wall.id === first.wall.id ? firstSolid : secondSolid;
  const removedSolid = outcome.wall.id === first.wall.id ? secondSolid : firstSolid;
  const mergedWall = withCentrelineOf(keptGraphWall, outcome.wall);

  const hosted: readonly { readonly opening: GraphOpening; readonly solid: SolidWall }[] = [
    ...openingsOfWall(context.graph, keptGraphWall.id).map((opening) => ({ opening, solid: keptSolid })),
    ...openingsOfWall(context.graph, removedGraphWall.id).map((opening) => ({ opening, solid: removedSolid })),
  ];

  const openingChanges: EntityChange[] = [];
  const keptOpeningIds: OpeningId[] = [];

  for (const { opening, solid } of hosted) {
    const attached = toAttachedOpening(opening, solid);
    const attachment = attachToWall(
      {
        id: attached.id,
        kind: attached.kind,
        widthMm: attached.widthMm,
        heightMm: attached.heightMm,
        sillHeightMm: attached.sillHeightMm,
        swing: attached.swing,
        centre: openingCentre(solid, attached),
      },
      [outcome.wall],
      millimetres(outcome.wall.thicknessMm),
    );

    const landed = attachment.opening;

    if (!isAttached(landed)) {
      return refuse(WALL_COMMAND_TYPES.merge, [attachment.message]);
    }

    keptOpeningIds.push(opening.id);
    openingChanges.push(
      ...openingMoveChange(opening, outcome.wall.id, offsetOnWall(landed, outcome.wall)),
    );
  }

  return accept(
    buildCommand(
      WALL_COMMAND_TYPES.merge,
      `Gộp tường ${removedGraphWall.id} dài ${formatLengthMm(centrelineLength(removedSolid))} vào ` +
        `${keptGraphWall.id} dài ${formatLengthMm(centrelineLength(keptSolid))}; tường sau khi gộp dài ` +
        `${formatLengthMm(centrelineLength(outcome.wall))} và giữ ${formatCount(keptOpeningIds.length)} lỗ mở.`,
      [
        changeForUpdate('wall', keptGraphWall, { ...mergedWall, openingIds: keptOpeningIds }),
        ...openingChanges,
        changeForRemove('wall', removedGraphWall),
      ],
      context,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* 7. Xoá tường — wall.delete                                                  */
/* -------------------------------------------------------------------------- */

export interface DeleteWallInput {
  readonly wallId: WallId;
}

/** Everything wrong with deleting this wall; empty when it may be deleted. */
export function validateDeleteWall(input: DeleteWallInput, context: CommandContext): string[] {
  if (readOf(context.graph, 'wall', input.wallId) === null) {
    return [`Không tìm thấy tường ${input.wallId} trong bản vẽ.`];
  }

  return [];
}

/** The rooms that list this wall among the ones bounding them. */
const roomsCiting = (context: CommandContext, wallId: WallId): readonly Room[] =>
  entitiesOfKind(context.graph, 'room').filter((room) => room.wallIds.includes(wallId));

/** The dimensions measured against this wall. */
const dimensionsCiting = (context: CommandContext, wallId: EntityId): readonly Dimension[] =>
  entitiesOfKind(context.graph, 'dimension').filter((dimension) =>
    dimension.referenceIds.includes(wallId),
  );

/**
 * Deletes a wall, and everything that would be left dangling without it.
 *
 * The openings cut into it go with it — a door in no wall is not a door — and
 * the references rooms and dimensions held to it are cleared, so the drawing
 * that is left passes `checkIntegrity`. All of it is one command, so undo puts
 * the wall, its openings and every reference back together.
 *
 * The openings are removed **before** the wall, because an opening finds its
 * level through its host: taking the wall away first would leave the openings
 * indexed on a floor they no longer belong to.
 */
export function createDeleteWallCommand(
  input: DeleteWallInput,
  context: CommandContext,
): CommandResult {
  const reasons = validateDeleteWall(input, context);

  if (reasons.length > 0) {
    return refuse(WALL_COMMAND_TYPES.remove, reasons);
  }

  const wall = readOf(context.graph, 'wall', input.wallId);

  if (wall === null) {
    return refuse(WALL_COMMAND_TYPES.remove, [`Không tìm thấy tường ${input.wallId}.`]);
  }

  const openings = openingsOfWall(context.graph, wall.id);
  const rooms = roomsCiting(context, wall.id);
  const dimensions = dimensionsCiting(context, wall.id);

  const changes: EntityChange[] = [
    ...openings.map((opening) => changeForRemove('opening', opening)),
    changeForRemove('wall', wall),
    ...rooms.map((room) =>
      changeForUpdate('room', room, {
        ...room,
        wallIds: room.wallIds.filter((wallId) => wallId !== wall.id),
      }),
    ),
    ...dimensions.map((dimension) =>
      changeForUpdate('dimension', dimension, {
        ...dimension,
        referenceIds: dimension.referenceIds.filter((referenceId) => referenceId !== wall.id),
      }),
    ),
  ];

  const carried = [
    openings.length === 0 ? null : `${formatCount(openings.length)} lỗ mở`,
    rooms.length === 0 ? null : `${formatCount(rooms.length)} phòng`,
    dimensions.length === 0 ? null : `${formatCount(dimensions.length)} kích thước`,
  ].filter((part): part is string => part !== null);

  const lengthMm = distanceBetween(
    toPointMm(wall.centreline.start),
    toPointMm(wall.centreline.end),
  );

  return accept(
    buildCommand(
      WALL_COMMAND_TYPES.remove,
      `Xoá ${WALL_KIND_LABELS[wall.kind]} ${wall.id} dài ${formatLengthMm(lengthMm)}, dày ` +
        `${formatLengthMm(wall.thicknessMm)}` +
        (carried.length === 0
          ? '.'
          : `; kéo theo ${carried.join(', ')}` +
            (openings.length === 0
              ? '.'
              : ` (${openings.map((opening) => nameOfOpening(opening)).join(', ')}).`)),
      changes,
      context,
    ),
  );
}
