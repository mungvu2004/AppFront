/**
 * Every sentence the geometry rules say, in one place.
 *
 * Two reasons the text lives here rather than beside the geometry.
 *
 * The first is that these sentences are the product. A violation a person
 * cannot act on is worse than no violation: it costs attention and returns
 * nothing. So every message names the entity codes involved and carries the
 * measurement that made it fire — "hở 600 mm", "chỉ được đỡ 0%", "lệch trục
 * 1.500 mm" — and every suggestion names a move, not a wish. "Kiểm tra lại
 * tường" is not a suggestion; "kéo đầu tường về nút giao gần nhất, cách 300 mm"
 * is.
 *
 * The second is that the geometry file should read as geometry. Mixing the
 * trigonometry with the copywriting makes both harder to check, and the numbers
 * in a sentence stop matching the numbers in the test the moment somebody edits
 * around them.
 *
 * Units follow the project: millimetres for anything on a plan, metres for
 * elevations, square metres for areas, and a comma for the decimal separator.
 */

import { formatLength } from '../../../lib/format/measure';
import { formatNumber } from '../../../lib/format/number';

/** A finished pair of sentences: what is wrong, and what to do about it. */
export interface RuleText {
  readonly message: string;
  readonly suggestion: string;
}

/* -------------------------------------------------------------------------- */
/* Shared formatting.                                                          */
/* -------------------------------------------------------------------------- */

/** A length, rounded to the millimetre: `1.500 mm`. */
export function lengthText(valueMm: number): string {
  return formatLength(Math.round(valueMm), { unit: 'mm' });
}

/** A plan coordinate: `(3.000; 4.000)`, in millimetres. */
export function pointText(point: { readonly x: number; readonly y: number }): string {
  return `(${formatNumber(Math.round(point.x), { fractionDigits: 0 })}; ${formatNumber(Math.round(point.y), { fractionDigits: 0 })})`;
}

/** A fraction read as a whole percentage: `80%`. */
export function shareText(share: number): string {
  return `${formatNumber(Math.round(share * 100), { fractionDigits: 0 })}%`;
}

/** A count, so a sentence never shows a bare JavaScript number. */
export function countText(value: number): string {
  return formatNumber(value, { fractionDigits: 0 });
}

/* -------------------------------------------------------------------------- */
/* WALL-OVERLAP.                                                               */
/* -------------------------------------------------------------------------- */

export interface WallOverlapInput {
  readonly wallId: string;
  readonly otherWallId: string;
  /** How far the two runs share the same line. */
  readonly overlapMm: number;
}

export function wallOverlapAlongText(input: WallOverlapInput): RuleText {
  return {
    message:
      `Tường ${input.wallId} nằm đè lên tường ${input.otherWallId} một đoạn ` +
      `${lengthText(input.overlapMm)} trên cùng một đường.`,
    suggestion:
      `Gộp hai tường thành một, hoặc xoá đoạn ${lengthText(input.overlapMm)} bị lặp ở ` +
      `tường ${input.otherWallId}.`,
  };
}

export interface WallCrossingInput {
  readonly wallId: string;
  readonly otherWallId: string;
  /** Where the two centrelines cut each other. */
  readonly at: { readonly x: number; readonly y: number };
}

export function wallCrossingText(input: WallCrossingInput): RuleText {
  return {
    message:
      `Tường ${input.wallId} cắt ngang tường ${input.otherWallId} tại ${pointText(input.at)} mm, ` +
      'không phải ở đầu tường nào.',
    suggestion:
      `Tách cả hai tường tại ${pointText(input.at)} để thành nút giao chữ thập, hoặc dời một ` +
      'trong hai tường ra khỏi tường kia.',
  };
}

/* -------------------------------------------------------------------------- */
/* WALL-DANGLING-END.                                                          */
/* -------------------------------------------------------------------------- */

export interface DanglingEndInput {
  readonly wallId: string;
  /** The free end, in plan coordinates. */
  readonly at: { readonly x: number; readonly y: number };
  /** Distance to the nearest other wall, or `null` when the level has none. */
  readonly nearestGapMm: number | null;
  readonly nearestWallId: string | null;
  /** How close an end has to be to count as joined. */
  readonly toleranceMm: number;
}

export function danglingEndText(input: DanglingEndInput): RuleText {
  const where = `Đầu tường ${input.wallId} tại ${pointText(input.at)} mm không nối vào tường nào`;

  if (input.nearestGapMm === null || input.nearestWallId === null) {
    return {
      message: `${where}; tầng này không còn tường nào khác.`,
      suggestion: `Vẽ tường tiếp theo nối vào đầu này, hoặc xoá tường ${input.wallId}.`,
    };
  }

  return {
    message:
      `${where}; tường gần nhất là ${input.nearestWallId}, còn cách ` +
      `${lengthText(input.nearestGapMm)} (ngưỡng nối là ${lengthText(input.toleranceMm)}).`,
    suggestion:
      `Kéo đầu tường ${input.wallId} thêm ${lengthText(input.nearestGapMm)} để chạm tường ` +
      `${input.nearestWallId}, hoặc xoá đoạn tường thừa này.`,
  };
}

/* -------------------------------------------------------------------------- */
/* ROOM-NOT-CLOSED.                                                            */
/* -------------------------------------------------------------------------- */

export interface RoomNotClosedInput {
  readonly roomId: string;
  readonly roomName: string;
  /** Total length of outline that no wall runs along. */
  readonly uncoveredMm: number;
  /** Perimeter of the outline. */
  readonly perimeterMm: number;
  /** How many separate stretches of outline are open. */
  readonly gapCount: number;
  /** Midpoint of the longest gap, for the interface to zoom to. */
  readonly worstGapAt: { readonly x: number; readonly y: number };
  readonly worstGapMm: number;
}

export function roomNotClosedText(input: RoomNotClosedInput): RuleText {
  return {
    message:
      `Phòng ${input.roomId} (${input.roomName}) chưa kín: ${lengthText(input.uncoveredMm)} ` +
      `trên tổng chu vi ${lengthText(input.perimeterMm)} không có tường chạy dọc, ` +
      `chia thành ${countText(input.gapCount)} chỗ hở; chỗ hở dài nhất ` +
      `${lengthText(input.worstGapMm)} quanh ${pointText(input.worstGapAt)} mm.`,
    suggestion:
      `Vẽ tường bù vào chỗ hở quanh ${pointText(input.worstGapAt)}, hoặc kéo đường bao phòng ` +
      'về đúng tim tường đang có.',
  };
}

/* -------------------------------------------------------------------------- */
/* DOOR-SWING-BLOCKED.                                                         */
/* -------------------------------------------------------------------------- */

export interface DoorSwingBlockedInput {
  readonly openingId: string;
  readonly hostWallId: string;
  /** Codes of the walls the leaf runs into, in model order. */
  readonly blockingWallIds: readonly string[];
  /** Length of leaf that has to swing clear. */
  readonly leafMm: number;
  /** The largest clear depth any face offers. */
  readonly bestClearanceMm: number;
}

export function doorSwingBlockedText(input: DoorSwingBlockedInput): RuleText {
  return {
    message:
      `Cửa đi ${input.openingId} trên tường ${input.hostWallId} mở ra là đâm vào tường ` +
      `${input.blockingWallIds.join(', ')}: cánh cần ${lengthText(input.leafMm)} nhưng bên ` +
      `thoáng nhất chỉ còn ${lengthText(input.bestClearanceMm)}.`,
    suggestion:
      `Đổi sang cửa trượt, hoặc thu hẹp cánh xuống ${lengthText(input.bestClearanceMm)}, ` +
      `hoặc dời cửa ${input.openingId} ra xa tường ${input.blockingWallIds.join(', ')}.`,
  };
}

/* -------------------------------------------------------------------------- */
/* OPENING-OVERLAP.                                                            */
/* -------------------------------------------------------------------------- */

export interface OpeningOverlapInput {
  readonly openingId: string;
  readonly otherOpeningId: string;
  readonly wallId: string;
  /** How much of the wall the two openings both claim. */
  readonly overlapMm: number;
  /** Where the shared stretch starts, measured from the wall start. */
  readonly fromMm: number;
  readonly toMm: number;
}

export function openingOverlapText(input: OpeningOverlapInput): RuleText {
  return {
    message:
      `Lỗ mở ${input.openingId} và ${input.otherOpeningId} cùng chiếm đoạn ` +
      `${lengthText(input.fromMm)}–${lengthText(input.toMm)} của tường ${input.wallId}, ` +
      `chồng nhau ${lengthText(input.overlapMm)}.`,
    suggestion:
      `Dời một trong hai lỗ mở đi ít nhất ${lengthText(input.overlapMm)} dọc tường ` +
      `${input.wallId}, hoặc gộp thành một lỗ mở duy nhất.`,
  };
}

/* -------------------------------------------------------------------------- */
/* WALL-UNSUPPORTED.                                                           */
/* -------------------------------------------------------------------------- */

export interface WallUnsupportedInput {
  readonly wallId: string;
  readonly levelName: string;
  readonly levelBelowName: string;
  readonly wallLengthMm: number;
  /** Share of the wall that does have something under it. */
  readonly supportedShare: number;
  /** Best candidate below, or `null` when nothing lines up at all. */
  readonly bestSupportWallId: string | null;
  /** Share that has to be supported for the wall to be accepted. */
  readonly requiredShare: number;
}

export function wallUnsupportedText(input: WallUnsupportedInput): RuleText {
  const head =
    `Tường chịu lực ${input.wallId} ở ${input.levelName} dài ${lengthText(input.wallLengthMm)} ` +
    `nhưng chỉ được ${input.levelBelowName} đỡ ${shareText(input.supportedShare)}, ` +
    `dưới mức ${shareText(input.requiredShare)}`;

  if (input.bestSupportWallId === null) {
    return {
      message: `${head}; bên dưới không có tường chịu lực nào cùng phương.`,
      suggestion:
        `Thêm tường chịu lực ở ${input.levelBelowName} ngay dưới ${input.wallId}, ` +
        `hoặc đổi ${input.wallId} thành tường ngăn nếu nó không chịu lực.`,
    };
  }

  return {
    message: `${head}; tường đỡ gần nhất là ${input.bestSupportWallId}.`,
    suggestion:
      `Kéo dài tường ${input.bestSupportWallId} ở ${input.levelBelowName} cho hết chiều dài ` +
      `${lengthText(input.wallLengthMm)} của ${input.wallId}, hoặc đổi ${input.wallId} thành ` +
      'tường ngăn nếu nó không chịu lực.',
  };
}

/* -------------------------------------------------------------------------- */
/* STAIR-ALIGNMENT.                                                            */
/* -------------------------------------------------------------------------- */

export interface StairAlignmentInput {
  readonly stairId: string;
  readonly stairBelowId: string;
  readonly levelName: string;
  readonly levelBelowName: string;
  readonly offsetMm: number;
  readonly toleranceMm: number;
  readonly at: { readonly x: number; readonly y: number };
  readonly belowAt: { readonly x: number; readonly y: number };
}

export function stairAlignmentText(input: StairAlignmentInput): RuleText {
  return {
    message:
      `Cầu thang ${input.stairId} ở ${input.levelName} đặt tại ${pointText(input.at)} mm, ` +
      `lệch ${lengthText(input.offsetMm)} so với cầu thang ${input.stairBelowId} ở ` +
      `${input.levelBelowName} tại ${pointText(input.belowAt)} mm; ngưỡng cho phép là ` +
      `${lengthText(input.toleranceMm)}.`,
    suggestion:
      `Dời cầu thang ${input.stairId} về ${pointText(input.belowAt)} để hai tầng thẳng trục, ` +
      `hoặc kiểm tra lại việc chồng tầng nếu cả ${input.levelBelowName} cũng đang lệch.`,
  };
}
