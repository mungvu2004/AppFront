import { useState, useCallback } from 'react';

export type MeasurementState = 'idle' | 'measuring' | 'committed';

export function useMeasurementLabel() {
  const [state, setState] = useState<MeasurementState>('idle');
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null);

  // For the demo, we will simulate interaction.
  // In a real app, this would be tied to canvas pointer events.
  const startMeasurement = useCallback((x: number, y: number) => {
    setState('measuring');
    setStartPoint({ x, y });
    setCurrentPoint({ x, y });
  }, []);

  const updateMeasurement = useCallback((x: number, y: number) => {
    if (state === 'measuring') {
      setCurrentPoint({ x, y });
    }
  }, [state]);

  const commitMeasurement = useCallback(() => {
    if (state === 'measuring') {
      setState('committed');
    }
  }, [state]);

  const resetMeasurement = useCallback(() => {
    setState('idle');
    setStartPoint(null);
    setCurrentPoint(null);
  }, []);

  const distance = startPoint && currentPoint
    ? Math.round(Math.hypot(currentPoint.x - startPoint.x, currentPoint.y - startPoint.y) * 10) // Mock scale factor
    : 0;

  return {
    state,
    startPoint,
    currentPoint,
    distance,
    startMeasurement,
    updateMeasurement,
    commitMeasurement,
    resetMeasurement,
  };
}
