/**
 * Mặt bằng 2D chồng hai bản (G5-21, N3-04) — mô hình thuần cho `VersionPlanDiff`.
 *
 * Vẽ HỢP của hai bản: đối tượng bị xoá lấy hình từ bản trái, đối tượng thêm và đối tượng sửa
 * lấy hình từ bản phải. Mã đầu tường `V-<wallId>-start|end` quy về mã tường, nên tường chỉ bị
 * dời đầu vẫn tô "sửa" (lỗi 3D ở `C-con.md` mục 1.2 không lặp lại ở đây).
 */

import type { VersionDiff } from '@/lib/versioning/diff';
import type { Point } from '@/domain/spatial/types';
import type { DiffTone, PlanDiffModel, PlanTone } from './types';
import type { VersionSnapshotSource } from './versionSnapshotAdapter';

/** Lề quanh khung bao, mm. */
const PLAN_MARGIN_MM = 500;

const VERTEX_ID = /^V-(.+)-(?:start|end)$/;

/** `V-W1-start` → `W1`; mã khác giữ nguyên. */
export const planEntityIdOf = (entityId: string): string => VERTEX_ID.exec(entityId)?.[1] ?? entityId;

const LEGEND_LABELS: Readonly<Record<DiffTone, string>> = { added: 'Thêm', removed: 'Xoá', changed: 'Sửa' };

/** Tone theo mã đối tượng: thêm/xoá của chính nó thắng "sửa" (đầu tường thêm cùng tường thêm). */
function tonesOf(diff: VersionDiff): ReadonlyMap<string, DiffTone> {
  const tones = new Map<string, DiffTone>();

  for (const entry of diff.changed) {
    tones.set(planEntityIdOf(entry.entityId), 'changed');
  }

  for (const entry of [...diff.added, ...diff.removed]) {
    const id = planEntityIdOf(entry.entityId);

    // Đầu tường thêm/xoá mà tường vẫn còn ở cả hai bản thì tường chỉ là "sửa".
    if (id === entry.entityId || !tones.has(id)) {
      tones.set(id, entry.kind);
    }
  }

  return tones;
}

/** Bản trái cho đối tượng bị xoá, bản phải cho phần còn lại. */
function pick<T extends { readonly id: string }>(
  left: readonly T[],
  right: readonly T[],
  tones: ReadonlyMap<string, DiffTone>,
): readonly T[] {
  return [...right, ...left.filter((item) => tones.get(item.id) === 'removed')];
}

export interface BuildPlanDiffInput {
  readonly left: VersionSnapshotSource;
  readonly right: VersionSnapshotSource;
  readonly diff: VersionDiff;
  /** Hàng đang ghim, không thì hàng đang trỏ. Mã đầu tường được quy về mã tường. */
  readonly focusId: string | null;
  readonly floorLabel: string;
}

export function buildPlanDiffModel({ diff, floorLabel, focusId, left, right }: BuildPlanDiffInput): PlanDiffModel {
  const tones = tonesOf(diff);
  const focus = focusId === null ? null : planEntityIdOf(focusId);
  const toneOf = (id: string): PlanTone => tones.get(id) ?? 'same';
  const shape = (id: string, label: string, tone: PlanTone = toneOf(id)) => ({ focused: id === focus, id, label, tone });
  const points: Point[] = [];

  const wallSources = [...right.layer.walls, ...left.layer.walls];
  const walls = pick(left.layer.walls, right.layer.walls, tones).map((wall) => {
    const { end, start } = wall.centreline;

    points.push(start, end);

    return { ...shape(wall.id, wall.id), thickness: wall.thicknessMm, x1: start.x, x2: end.x, y1: start.y, y2: end.y };
  });

  const rooms = pick(left.layer.rooms, right.layer.rooms, tones).map((room) => {
    points.push(...room.outline);

    return { ...shape(room.id, room.name), points: room.outline.map((p) => `${String(p.x)},${String(p.y)}`).join(' ') };
  });

  const openings = pick(left.layer.openings, right.layer.openings, tones).flatMap((opening) => {
    // Bản trái có ô mở bị xoá ⇒ tường của nó tìm ở bản trái trước.
    const pool = tones.get(opening.id) === 'removed' ? [...left.layer.walls, ...right.layer.walls] : wallSources;
    const wall = pool.find((item) => item.id === opening.wallId);

    if (wall === undefined) {
      return [];
    }

    const { end, start } = wall.centreline;
    const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
    const ux = (end.x - start.x) / length;
    const uy = (end.y - start.y) / length;
    const from = opening.offsetMm;
    const to = opening.offsetMm + opening.widthMm;
    const wallTone = tones.get(wall.id);
    const tone = tones.get(opening.id) ?? (wallTone === 'removed' || wallTone === 'added' ? wallTone : 'same');

    return [
      {
        ...shape(opening.id, opening.id, tone),
        x1: start.x + ux * from,
        x2: start.x + ux * to,
        y1: start.y + uy * from,
        y2: start.y + uy * to,
      },
    ];
  });

  const furniture = pick(left.layer.furniture, right.layer.furniture, tones).map((item) => {
    points.push(item.centre);

    return { ...shape(item.id, item.kind), x: item.centre.x, y: item.centre.y };
  });

  const all = [...walls, ...rooms, ...openings, ...furniture];
  const legend = (['added', 'removed', 'changed'] as const).map((tone) => ({
    count: all.filter((item) => item.tone === tone).length,
    label: LEGEND_LABELS[tone],
    tone,
  }));

  return { floorLabel, furniture, legend, openings, rooms, viewBox: viewBoxOf(points), walls };
}

/** Khung bao mọi đỉnh, cộng lề; tầng trống thì một ô vuông lề. */
export function viewBoxOf(points: readonly Point[]): string {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = (xs.length === 0 ? 0 : Math.min(...xs)) - PLAN_MARGIN_MM;
  const minY = (ys.length === 0 ? 0 : Math.min(...ys)) - PLAN_MARGIN_MM;
  const maxX = (xs.length === 0 ? 0 : Math.max(...xs)) + PLAN_MARGIN_MM;
  const maxY = (ys.length === 0 ? 0 : Math.max(...ys)) + PLAN_MARGIN_MM;

  return [minX, minY, maxX - minX, maxY - minY].map(String).join(' ');
}
