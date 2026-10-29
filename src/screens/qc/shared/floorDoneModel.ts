import { useMemo, useSyncExternalStore } from 'react';

import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import { entitiesOfKind, formatAreaM2 } from '@/lib/commands/business/shared';
import { useProjectFloors } from '@/hooks/useProjectFloors';
import { formatLength } from '@/lib/format/measure';

import { floorReviewCountsOf, floorReviewGateOf } from './floorReviewGateModel';
import { useFloorReview } from './useFloorReview';

/**
 * Màn Xong tầng của bố cục L23 (mock `v9-sua2/phong-xong`, thành phần ở `QcFloorDone.tsx`): khi tỷ lệ đã xác nhận và ba lớp bắt buộc
 * đều duyệt xong, bước Phòng đổi cột việc thành tổng kết tầng + nút Dựng mô hình 3D.
 * "Mở lại bước Phòng" trả hàng đợi về trong phiên này (một tập tầng của module, chung cho cột và thẻ).
 */
const reopened = new Set<string>();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function reopenFloor(floorId: string): void {
  if (reopened.has(floorId)) return;
  reopened.add(floorId);
  for (const listener of listeners) listener();
}

export function useFloorReopened(floorId: string): boolean {
  return useSyncExternalStore(subscribe, () => reopened.has(floorId), () => reopened.has(floorId));
}

/** Tổng kết "Bạn đã duyệt những gì": mỗi lớp một câu, cộng diện tích sàn. */
export interface FloorDoneSummary {
  readonly walls: string;
  readonly objects: string;
  readonly rooms: string;
  readonly area: string;
}

const countOf = (count: number, unit: string): string | null => (count === 0 ? null : `${count} ${unit}`);

export function floorDoneSummaryOf(graph: NormalizedSpatial, floorId: string): FloorDoneSummary {
  const walls = entitiesOfKind(graph, 'wall').filter((wall) => wall.levelId === floorId);
  const wallIds = new Set<string>(walls.map((wall) => wall.id));
  const openings = entitiesOfKind(graph, 'opening').filter((opening) => wallIds.has(opening.wallId));
  const furniture = entitiesOfKind(graph, 'furniture').filter((item) => item.levelId === floorId);
  const rooms = entitiesOfKind(graph, 'room').filter((room) => room.levelId === floorId);

  const lengthMm = walls.reduce((sum, { centreline: { start, end } }) => sum + Math.hypot(end.x - start.x, end.y - start.y), 0);
  const objectParts = [
    countOf(openings.filter((item) => item.kind === 'door').length, 'cửa đi'),
    countOf(openings.filter((item) => item.kind === 'window').length, 'cửa sổ'),
    countOf(furniture.length, 'món nội thất'),
  ].filter((part) => part !== null);
  const names = rooms.map((room) => room.name.trim()).filter((name) => name !== '');

  return {
    walls: `${walls.length} đoạn, tổng dài ${formatLength(lengthMm, { unit: 'm', fractionDigits: 1 })}.`,
    objects: objectParts.length === 0 ? 'Tầng không có cửa hay nội thất.' : `${objectParts.join(', ')}.`,
    rooms: names.length === 0 ? `${rooms.length} phòng.` : `${rooms.length} phòng: ${names.join(', ')}.`,
    area: formatAreaM2(rooms.reduce((sum, room) => sum + room.areaM2, 0)),
  };
}

/** Tầng xong và chưa mở lại: tỷ lệ đã xác nhận, ba lớp bắt buộc duyệt hết. */
export function useFloorDone(projectId: string, floorId: string): { readonly done: boolean; readonly graph: NormalizedSpatial | null } {
  const { graph, scale } = useFloorReview(projectId, floorId);
  const isReopened = useFloorReopened(floorId);
  const allDone = useMemo(
    () => graph !== null && scale === 'confirmed' && floorReviewGateOf(floorReviewCountsOf(graph, floorId)).next === null,
    [floorId, graph, scale],
  );
  return { done: allDone && !isReopened, graph };
}

export const useFloorLabel = (projectId: string, floorId: string): string =>
  useProjectFloors(projectId).find((floor) => floor.id === floorId)?.label ?? '';

/** Đầu cột việc của màn Xong tầng. */
export const floorDoneTexts = (label: string) => ({
  eyebrow: `Tầng ${label} · Xong`,
  task: `Tầng ${label} đã duyệt xong cả 4 bước.`,
  hint: 'Mở lại bước nào cũng được; sửa xong, mô hình 3D dựng lại theo bản mới.',
});
