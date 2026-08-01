import { useState, useCallback } from 'react';
import { getWallMidpoint } from '../lib/geometry/wall';
import { formatMm } from '../lib/format';

export type MeasurementState = 'idle' | 'measuring' | 'committed';

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
 * Gọi getWallMidpoint từ lib/geometry/wall và formatMm từ lib/format.
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
    const p1 = { id: 'start', x: startPoint.x, y: startPoint.y };
    const p2 = { id: 'end', x: currentPoint.x, y: currentPoint.y };
    const mid = getWallMidpoint(p1, p2);
    midPoint = { x: mid.x, y: mid.y };

    const dx = currentPoint.x - startPoint.x;
    const dy = currentPoint.y - startPoint.y;
    distanceMm = Math.round(Math.sqrt(dx * dx + dy * dy) * 12);
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
