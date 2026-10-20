/**
 * `useScaleStatus` — trang 3D có nên cảnh báo "bản vẽ chưa hiệu chỉnh tỷ lệ" không (WP8).
 *
 * Hai nguồn: N16 của từng tầng mang `scaleStatus: 'unresolved'` (đọc bằng `readLayer` sẵn có,
 * không thêm endpoint), hoặc nhìn hình mà đoán — cả nhà gói trong < 3 m mà tầng cao ≥ 2,4 m thì
 * gần như chắc tỷ lệ sai. Tầng đọc lỗi thì bỏ qua (chỉ ghi log một lần) — các tầng còn lại và phép
 * đoán vẫn chạy, để một tầng hỏng không giấu cảnh báo của cả nhà.
 */
import { useEffect, useState } from 'react';

import type { FloorLayerDocument } from '@/api/schemas/spatialLayer';
import { denormalizeSpatial } from '@/domain/spatial/normalize';
import type { Level, Wall } from '@/domain/spatial/types';
import { useStore } from '@/store';

/** Ngưỡng của phép đoán: nhà gọn hơn 3 m mà tầng cao từ 2,4 m. */
const TINY_FOOTPRINT_MM = 3000;
const NORMAL_STOREY_MM = 2400;

export type ScaleStatus =
  | { readonly status: 'unknown' }
  | { readonly status: 'resolved' }
  | { readonly status: 'unresolved'; readonly floorId: string };

export type ReadScale = (floorId: string) => Promise<Pick<FloorLayerDocument, 'scaleStatus'>>;

/** Tầng có tường mà cả khối tường gói trong < 3 m dù tầng cao ≥ 2,4 m. */
export function tinyFootprintLevel(levels: readonly Level[], walls: readonly Wall[]): string | undefined {
  return levels.find((level) => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const wall of walls) {
      if (wall.levelId !== level.id) continue;
      xs.push(wall.centreline.start.x, wall.centreline.end.x);
      ys.push(wall.centreline.start.y, wall.centreline.end.y);
    }
    if (xs.length === 0) return false;
    const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    return extent < TINY_FOOTPRINT_MM && level.heightMm >= NORMAL_STOREY_MM;
  })?.id;
}

let failureLogged = false;

async function defaultReadScale(projectId: string, floorId: string) {
  const { createAppApiClient } = await import('@/api/appClient');
  const result = await createAppApiClient().spatial.readLayer({ projectId, floorId });
  if (!result.ok) throw result.error;
  return result.data;
}

/** Chạy một lần mỗi dự án, khi kho đã có cảnh (cầu nạp xong). */
export function useScaleStatus(projectId: string, readScale?: ReadScale): ScaleStatus {
  const loaded = useStore((state) => state.spatial !== null);
  const [status, setStatus] = useState<ScaleStatus>({ status: 'unknown' });

  useEffect(() => {
    const spatial = useStore.getState().spatial;
    if (spatial === null) return;
    let cancelled = false;
    const { levels, walls } = denormalizeSpatial(spatial);
    const read = readScale ?? ((floorId: string) => defaultReadScale(projectId, floorId));

    void Promise.allSettled(levels.map((level) => read(level.id))).then((results) => {
      const failure = results.find((result) => result.status === 'rejected');
      if (failure !== undefined && !failureLogged) {
        failureLogged = true;
        console.warn('[pascal] không đọc được trạng thái tỷ lệ tầng', failure.reason);
      }
      if (cancelled) return;
      const index = results.findIndex(
        (result) => result.status === 'fulfilled' && result.value.scaleStatus === 'unresolved',
      );
      const floorId = levels[index]?.id ?? tinyFootprintLevel(levels, walls);
      setStatus(floorId === undefined ? { status: 'resolved' } : { status: 'unresolved', floorId });
    });
    return () => {
      cancelled = true;
    };
  }, [loaded, projectId, readScale]);

  return status;
}
