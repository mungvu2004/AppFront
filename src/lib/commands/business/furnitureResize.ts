/**
 * `furniture.resize` — đổi rộng × sâu một món đồ đạc, tâm giữ nguyên.
 *
 * Tách khỏi `openingCommands.ts` (B3): chỉ màn Lớp đối tượng gọi lệnh này, nên nó nằm ở module
 * riêng và đi vào chunk của màn ấy thay vì làm phình chunk `openingCommands` mà mọi màn dùng chung
 * (cổng kích thước gói, "chi phí thêm cho một màn").
 */

import { displayCodeIn } from '@/domain/spatial/normalize';
import type { BoundingBox, Furniture, FurnitureId, Point } from '@/domain/spatial/types';
import { compareNearly, nearlyEqualLength } from '@/domain/units/compare';
import { millimetres } from '@/domain/units/types';

import { changeForUpdate } from '../createCommand';
import { OPENING_COMMAND_TYPES } from './commandTypes';
import { boxReasons } from './openingCommands';
import {
  accept,
  buildCommand,
  formatLengthMm,
  formatPoint,
  FURNITURE_KIND_LABELS,
  isFinitePoint,
  readOf,
  refuse,
  type CommandContext,
  type CommandResult,
} from './shared';

/* -------------------------------------------------------------------------- */
/* 8. Đổi kích thước đồ đạc — furniture.resize                                 */
/* -------------------------------------------------------------------------- */

export interface ResizeFurnitureInput {
  readonly furnitureId: FurnitureId;
  readonly widthMm?: number;
  readonly depthMm?: number;
}

/** How far a bounding box reaches along each plan axis. */
const boxSize = (box: BoundingBox): { readonly widthMm: number; readonly depthMm: number } => ({
  widthMm: box.max.x - box.min.x,
  depthMm: box.max.y - box.min.y,
});

/**
 * The item this resize would leave behind.
 *
 * **The centre stays exactly where it is** and the box is scaled about it, so
 * every corner keeps its share of the box. That is the same tie `movedFurniture`
 * holds rigid, read the other way round: a move keeps the shape and carries the
 * box, a resize keeps the anchor and stretches the box around it. Keeping the
 * centre is also what makes two facts hold for free — the centre never leaves
 * its own box, and a piece assigned to a room is still in that room afterwards
 * — which are the two things `validateAddFurniture` and `validateMoveFurniture`
 * each have to check on their own side.
 */
const resizedFurniture = (item: Furniture, input: ResizeFurnitureInput): Furniture => {
  const size = boxSize(item.boundingBox);
  const scaleX = (input.widthMm ?? size.widthMm) / size.widthMm;
  const scaleY = (input.depthMm ?? size.depthMm) / size.depthMm;
  const scaled = (corner: Point): Point => ({
    x: item.centre.x + (corner.x - item.centre.x) * scaleX,
    y: item.centre.y + (corner.y - item.centre.y) * scaleY,
  });

  return {
    ...item,
    boundingBox: { min: scaled(item.boundingBox.min), max: scaled(item.boundingBox.max) },
  };
};

/** Everything wrong with this resize; empty when it may be applied. */
export function validateResizeFurniture(
  input: ResizeFurnitureInput,
  context: CommandContext,
): string[] {
  const item = readOf(context.graph, 'furniture', input.furnitureId);

  if (item === null) {
    return [`Không tìm thấy đồ đạc ${displayCodeIn(context.graph, input.furnitureId)} trong bản vẽ.`];
  }

  if (input.widthMm === undefined && input.depthMm === undefined) {
    return ['Lệnh đổi kích thước không nêu số đo nào cần đổi.'];
  }

  const reasons: string[] = [];

  for (const [label, value] of [
    ['Chiều rộng', input.widthMm],
    ['Chiều sâu', input.depthMm],
  ] as const) {
    if (value !== undefined && (!Number.isFinite(value) || compareNearly(value, 0) <= 0)) {
      reasons.push(`${label} đồ đạc phải lớn hơn 0 mm, đang nhận ${formatLengthMm(value)}.`);
    }
  }

  if (!isFinitePoint(item.centre)) {
    reasons.push('Toạ độ tâm đồ đạc không đọc được.');
  }

  // The box is scaled about the centre, so the box it starts from has to be a
  // real rectangle before there is any ratio to scale it by.
  reasons.push(...boxReasons(item.boundingBox));

  if (reasons.length > 0) {
    return reasons;
  }

  const before = boxSize(item.boundingBox);
  const after = boxSize(resizedFurniture(item, input).boundingBox);

  if (
    nearlyEqualLength(millimetres(before.widthMm), millimetres(after.widthMm)) &&
    nearlyEqualLength(millimetres(before.depthMm), millimetres(after.depthMm))
  ) {
    reasons.push(
      `${FURNITURE_KIND_LABELS[item.kind]} ${displayCodeIn(context.graph, item.id)} đã đo ${formatLengthMm(before.widthMm)} × ` +
        `${formatLengthMm(before.depthMm)} nên không có gì thay đổi.`,
    );
  }

  return reasons;
}

/**
 * Changes how big a piece of furniture is, without moving it.
 *
 * What this command deliberately does **not** ask is whether the bigger piece
 * now runs into a wall or into the piece beside it. That is `FURNITURE-CLASH`
 * in the function rule set, which reads the whole floor after the edit lands
 * and reports a clash as a warning a person may accept — a wardrobe measured
 * 50 mm into a skirting is a real wardrobe. Refusing here would make the
 * command stricter than the rule it duplicates. Nothing is nudged aside to make
 * room either: moving somebody else's furniture is its own decision, and its
 * own command.
 */
export function createResizeFurnitureCommand(
  input: ResizeFurnitureInput,
  context: CommandContext,
): CommandResult {
  const reasons = validateResizeFurniture(input, context);

  if (reasons.length > 0) {
    return refuse(OPENING_COMMAND_TYPES.resizeFurniture, reasons);
  }

  const item = readOf(context.graph, 'furniture', input.furnitureId);

  if (item === null) {
    return refuse(OPENING_COMMAND_TYPES.resizeFurniture, [
      `Không tìm thấy đồ đạc ${displayCodeIn(context.graph, input.furnitureId)}.`,
    ]);
  }

  const after = resizedFurniture(item, input);
  const before = boxSize(item.boundingBox);
  const size = boxSize(after.boundingBox);

  const parts = [
    ['rộng', before.widthMm, size.widthMm] as const,
    ['sâu', before.depthMm, size.depthMm] as const,
  ]
    .filter(([, from, to]) => !nearlyEqualLength(millimetres(from), millimetres(to)))
    .map(([label, from, to]) => `${label} ${formatLengthMm(from)} thành ${formatLengthMm(to)}`);

  return accept(
    buildCommand(
      OPENING_COMMAND_TYPES.resizeFurniture,
      `Đổi kích thước ${FURNITURE_KIND_LABELS[item.kind]} ${displayCodeIn(context.graph, item.id)} giữ nguyên tâm ` +
        `${formatPoint(item.centre)}: ${parts.join(', ')}.`,
      [changeForUpdate('furniture', item, after)],
      context,
    ),
  );
}

