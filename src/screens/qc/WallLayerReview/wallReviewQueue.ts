/**
 * Hàng đợi duyệt của màn Duyệt lớp tường (demo Z/S-15 vòng 9) — phần thuần, không React.
 *
 * MỘT thứ tự duy nhất cho danh sách trái, nút "Duyệt tiếp" ở cổng, phím J và tự chuyển sau
 * "Duyệt": không chuẩn lên đầu, rồi đúng chuẩn chưa duyệt, rồi đã duyệt (trong mỗi nhóm giữ thứ
 * tự mã hiển thị). "Không chuẩn" = lệch quá `WALL_THICKNESS_TOLERANCE_MM` so với chuẩn gần nhất
 * (qua `isStandardThickness`, thang sáu bậc `STANDARD_THICKNESSES_MM`); chuẩn đích khi đổi là
 * `standardizeThickness` (bậc gần nhất, hoà về bậc nhỏ; cột BTCT = xem tay, không tự đổi). Màn
 * không viết ngưỡng nào, chữ đọc từ thang và ngưỡng của domain.
 */

import type { FlowGateCondition } from '@/components/shell/FlowGate';
import { isEntityOfKind, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Level, LevelId, Wall, WallId } from '@/domain/spatial/types';
import { WALL_THICKNESS_TOLERANCE_MM } from '@/domain/walls/thicknessTolerance';
import { centrelineLength } from '@/domain/walls/types';
import { formatNumber } from '@/lib/format/number';
import { CONCRETE_COLUMN_THRESHOLD_MM, standardizeThickness, standardTierRangeOf } from '@/lib/geometry/standardize';

import { WALL_THICKNESS_CHOICES, type WallThicknessChoice } from './types';
import { wallThicknessBandOf } from './wallLayerHatch';
import { isStandardThickness, toGeometryWall } from './wallLayerReviewGateway';

/** Ba nhóm của danh sách, đúng thứ tự hàng đợi. */
export type WallQueueGroup = 'nonStandard' | 'standard' | 'reviewed';

/** Phần thêm của một hàng mà `WallRowViewModel` (đóng băng) không mang — đã định dạng sẵn (A15). */
export interface WallRowExtra {
  /** Chiều dài tim tường, số mm nguyên không đơn vị ("1.369") — đầu cột ghi "Dài, mm". */
  readonly lengthText: string;
  /** Độ dày đo, số mm nguyên không đơn vị ("278"). */
  readonly thicknessText: string;
  /** Hàng đúng chuẩn mà số đo lệch chuẩn: "≈110". `null` khi khớp đúng hoặc không chuẩn. */
  readonly nearText: string | null;
  readonly group: WallQueueGroup;
  /** Chuẩn đích khi đổi về chuẩn; `null` = không đổi tự động được, cần xem tay. */
  readonly targetMm: WallThicknessChoice | null;
  /** Một câu cho khối độ dày của thanh tra. */
  readonly note: string;
}

export interface WallBulkGroup {
  readonly targetMm: WallThicknessChoice;
  readonly count: number;
  /** Khoảng số đo về chuẩn này, từ thang domain ("261–350"). */
  readonly rangeText: string;
}

/** Xem trước "Đổi n/N tường về chuẩn…". */
export interface WallBulkPlan {
  readonly groups: readonly WallBulkGroup[];
  /** Số tường sẽ đổi. */
  readonly changeCount: number;
  /** Số tường không chuẩn chưa duyệt (mẫu số trên nút). */
  readonly totalCount: number;
  /** Dày quá ngưỡng cột BTCT: giữ ở nhóm Không chuẩn để xem tay. */
  readonly manualCount: number;
  /** "trên 450 mm" — biên xem tay, đọc từ ngưỡng cột của domain. */
  readonly manualRangeText: string;
  readonly targets: readonly { readonly wallId: WallId; readonly targetMm: WallThicknessChoice }[];
}

/** Mọi thứ hàng đợi đưa cho view (cổng, danh sách, thanh tra, thanh phím). */
export interface WallReviewQueue {
  readonly extras: ReadonlyMap<string, WallRowExtra>;
  /** Tường không chuẩn CHƯA duyệt của cả tầng (không theo bộ lọc) — cho dòng trạng thái. */
  readonly nonStandardCount: number;
  readonly bulk: WallBulkPlan;
  /** Đoạn kế trong hàng đợi sau đoạn đang chọn; `null` khi hết việc. */
  readonly nextWallId: WallId | null;
  readonly nextWallLabel: string | null;
  /** ≤3 điều kiện của cổng: Tường, và Cửa/Phòng khi tầng có dữ liệu đó. */
  readonly conditions: readonly FlowGateCondition[];
  /** "Lệch không quá 30 mm" — đọc từ hằng domain, không gõ số. */
  readonly toleranceText: string;
  /** Mọi đoạn cùng một độ tin cậy thì độ tin cậy không giúp quyết định: ẩn. */
  readonly showConfidence: boolean;
  readonly onStandardize: (wallId: WallId) => void;
  readonly onBulkStandardize: () => void;
}

const RANK: Readonly<Record<WallQueueGroup, number>> = { nonStandard: 0, standard: 1, reviewed: 2 };

export const queueGroupOf = (wall: Wall): WallQueueGroup =>
  wall.reviewed ? 'reviewed' : isStandardThickness(wall.thicknessMm) ? 'standard' : 'nonStandard';

/** Tường CHƯA DUYỆT kế tiếp sau `fromId`, quay vòng về đầu danh sách. */
export function nextUnreviewedWallId(walls: readonly Wall[], fromId: WallId | null): WallId | null {
  if (walls.length === 0) {
    return null;
  }

  const start = fromId === null ? -1 : walls.findIndex((wall) => wall.id === fromId);
  const after = walls.slice(start + 1).find((wall) => !wall.reviewed);

  if (after !== undefined) {
    return after.id;
  }

  const wrapped = walls.slice(0, start + 1).find((wall) => !wall.reviewed);

  return wrapped?.id ?? null;
}

/** Xếp theo hàng đợi; giữ thứ tự vào trong mỗi nhóm (sort ổn định). */
export const sortByReviewQueue = (walls: readonly Wall[]): readonly Wall[] =>
  [...walls].sort((a, b) => RANK[queueGroupOf(a)] - RANK[queueGroupOf(b)]);

const isChoice = (value: unknown): value is WallThicknessChoice =>
  typeof value === 'number' && (WALL_THICKNESS_CHOICES as readonly number[]).includes(value);

/** Chuẩn đích theo `standardizeThickness`; cột BTCT (xem tay) → `null`. */
export const thicknessTargetOf = (thicknessMm: number): WallThicknessChoice | null => {
  const { standardized } = standardizeThickness(thicknessMm);

  return isChoice(standardized) ? standardized : null;
};

/** Khoảng số đo về một chuẩn, sinh từ thang sáu bậc: 300 → "261–350", 100 → "≤125". */
function roundingRangeOf(targetMm: WallThicknessChoice): string {
  const { fromMm, toMm } = standardTierRangeOf(targetMm);

  return fromMm === null ? `≤${mm(toMm)}` : `${mm(fromMm)}–${mm(toMm)}`;
}

const mm = (value: number): string => formatNumber(value, { fractionDigits: 0 });

export const toleranceTextOf = (): string => `lệch không quá ${mm(WALL_THICKNESS_TOLERANCE_MM)} mm`;

function noteOf(wall: Wall, targetMm: WallThicknessChoice | null): string {
  const band = wallThicknessBandOf(wall.thicknessMm);

  if (band !== null) {
    return `Đúng chuẩn ${mm(band)} mm (${toleranceTextOf()}).`;
  }

  if (targetMm !== null) {
    const diff = targetMm - wall.thicknessMm;

    return `Thuộc khoảng ${roundingRangeOf(targetMm)} mm nên về ${mm(targetMm)} mm, ${diff > 0 ? 'thiếu' : 'dư'} ${mm(Math.abs(diff))} mm.`;
  }

  return `Dày trên ${mm(CONCRETE_COLUMN_THRESHOLD_MM)} mm: dày bất thường, có thể là cột BTCT. Cần xem tay.`;
}

export function rowExtraOf(wall: Wall, level: Level | null): WallRowExtra {
  const group = queueGroupOf(wall);
  const band = wallThicknessBandOf(wall.thicknessMm);
  const targetMm = band === null ? thicknessTargetOf(wall.thicknessMm) : null;

  return {
    lengthText: level === null ? '–' : mm(centrelineLength(toGeometryWall(wall, level))),
    thicknessText: mm(wall.thicknessMm),
    nearText: band !== null && band !== wall.thicknessMm ? `≈${mm(band)}` : null,
    group,
    targetMm,
    note: noteOf(wall, targetMm),
  };
}

export function bulkPlanOf(walls: readonly Wall[]): WallBulkPlan {
  const pending = walls.filter((wall) => queueGroupOf(wall) === 'nonStandard');
  const targets = pending.flatMap((wall) => {
    const targetMm = thicknessTargetOf(wall.thicknessMm);

    return targetMm === null ? [] : [{ wallId: wall.id, targetMm }];
  });
  const groups = WALL_THICKNESS_CHOICES.map((targetMm) => ({
    targetMm,
    count: targets.filter((target) => target.targetMm === targetMm).length,
    rangeText: roundingRangeOf(targetMm),
  })).filter((group) => group.count > 0);

  return {
    groups,
    changeCount: targets.length,
    totalCount: pending.length,
    manualCount: pending.length - targets.length,
    manualRangeText: `trên ${mm(CONCRETE_COLUMN_THRESHOLD_MM)} mm`,
    targets,
  };
}

/** Câu nhật ký hoàn tác của lượt đổi hàng loạt. */
export const bulkLabelOf = (count: number): string => `Đổi ${mm(count)} tường về chuẩn`;

/**
 * Điều kiện cổng: Tường luôn có; Cửa (cửa đi, cửa sổ, nội thất) và Phòng chỉ khi tầng có dữ liệu
 * đó trong đồ thị — "xong" = mọi đối tượng đã duyệt. Không có dữ liệu thì không bịa điều kiện.
 */
export function gateConditionsOf(
  graph: NormalizedSpatial | null,
  levelId: LevelId | null,
  wallsDone: boolean,
): readonly FlowGateCondition[] {
  const conditions: FlowGateCondition[] = [{ label: 'Tường', done: wallsDone }];

  if (graph === null || levelId === null) {
    return conditions;
  }

  const onLevel = (graph.byLevel[levelId] ?? []).flatMap((id) => {
    const entity = graph.byId[id];

    return entity === undefined ? [] : [entity];
  });
  const objects = onLevel.filter((entity) => isEntityOfKind('opening', entity) || isEntityOfKind('furniture', entity));
  const rooms = onLevel.filter((entity) => isEntityOfKind('room', entity));

  if (objects.length > 0) {
    conditions.push({ label: 'Cửa', done: objects.every((entity) => entity.reviewed) });
  }

  if (rooms.length > 0) {
    conditions.push({ label: 'Phòng', done: rooms.every((entity) => entity.reviewed) });
  }

  return conditions;
}

/** Độ tin cậy có khác nhau giữa các đoạn không. */
export const hasConfidenceSpread = (walls: readonly Wall[]): boolean =>
  walls.some((wall) => wall.confidence !== walls[0]?.confidence);
