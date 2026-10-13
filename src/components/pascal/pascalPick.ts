/**
 * Chạm chọn và đo hai điểm ở khung xem (F-15 S2). Thuần: không nhập Pascal,
 * nên test được không cần WebGL. `PascalFrame` nối nó vào bus `emitter`.
 */

import type { PascalMeasureResult } from './pascalMountTypes';

export type Point3 = readonly [number, number, number];

/** Khoảng cách Euclid giữa hai điểm thế giới; đơn vị của Pascal là mét. */
export function distanceM(a: Point3, b: Point3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export interface PickMeasureOptions {
  readonly measure: boolean;
  readonly onPick: ((nodeId: string | null) => void) | undefined;
  readonly onMeasure: ((result: PascalMeasureResult) => void) | undefined;
}

/**
 * Một lần chạm: `nodeId` null là chạm ra khoảng trống. Ở chế độ đo, hai lần
 * chạm liên tiếp cho một số đo (không gọi `onPick`); lần thứ ba bắt đầu lại.
 */
export function createPickMeasure({ measure, onPick, onMeasure }: PickMeasureOptions) {
  let first: Point3 | null = null;
  return (nodeId: string | null, position: Point3): void => {
    if (!measure) {
      onPick?.(nodeId);
      return;
    }
    if (first === null) {
      first = position;
      return;
    }
    const distance = distanceM(first, position);
    first = null;
    onMeasure?.({ distanceM: distance });
  };
}
