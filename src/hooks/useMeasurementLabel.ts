import { useState, useCallback } from 'react';
import { formatMm } from '../lib/format';

export type MeasurementState = 'idle' | 'measuring' | 'committed';

/**
 * Millimetres one pixel of the measuring overlay stands for.
 *
 * Named rather than written into the arithmetic below, because a bare `12` in a
 * distance calculation reads as a typo and is the one number in this hook that
 * decides whether a measurement is right.
 */
const MM_PER_PIXEL = 12;

export interface Point {
  x: number;
  y: number;
}

export interface MeasurementLabelState {
  state: MeasurementState;
  startPoint: Point | null;
  currentPoint: Point | null;
  distanceMm: number;
  distanceFormatted: string;
  midPoint: Point | null;
  startMeasurement: (x: number, y: number) => void;
  updateMeasurement: (x: number, y: number) => void;
  commitMeasurement: () => void;
  resetMeasurement: () => void;
}

/**
 * Hook thuần — quản lý trạng thái đo khoảng cách.
 * Toạ độ ở đây là pixel của lớp phủ, không phải milimét của mô hình, nên phép
 * tính nằm tại chỗ thay vì gọi hình học của domain: đưa pixel vào một hàm nhận
 * `PointMm` chính là kiểu nhầm đơn vị mà `src/domain/units` sinh ra để chặn.
 * Định dạng chuỗi vẫn lấy formatMm từ lib/format.
 */
export function useMeasurementLabel(): MeasurementLabelState {
  const [state, setState] = useState<MeasurementState>('idle');
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);

  const startMeasurement = useCallback((x: number, y: number) => {
    setState('measuring');
    setStartPoint({ x, y });
    setCurrentPoint({ x, y });
  }, []);

  const updateMeasurement = useCallback(
    (x: number, y: number) => {
      if (state === 'measuring') setCurrentPoint({ x, y });
    },
    [state]
  );

  const commitMeasurement = useCallback(() => {
    if (state === 'measuring') setState('committed');
  }, [state]);

  const resetMeasurement = useCallback(() => {
    setState('idle');
    setStartPoint(null);
    setCurrentPoint(null);
  }, []);

  let distanceMm = 0;
  let midPoint: Point | null = null;

  if (startPoint && currentPoint) {
    midPoint = {
      x: (startPoint.x + currentPoint.x) / 2,
      y: (startPoint.y + currentPoint.y) / 2,
    };

    const dx = currentPoint.x - startPoint.x;
    const dy = currentPoint.y - startPoint.y;
    distanceMm = Math.round(Math.sqrt(dx * dx + dy * dy) * MM_PER_PIXEL);
  }

  return {
    state,
    startPoint,
    currentPoint,
    distanceMm,
    distanceFormatted: distanceMm > 0 ? formatMm(distanceMm) : '—',
    midPoint,
    startMeasurement,
    updateMeasurement,
    commitMeasurement,
    resetMeasurement,
  };
}
