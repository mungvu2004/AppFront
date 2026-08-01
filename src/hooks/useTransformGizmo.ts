import { useState, useCallback } from 'react';

export type Axis = 'x' | 'y' | 'z';

export interface DeltaOffset {
  x: number;
  y: number;
  z: number;
}

export interface TransformGizmoState {
  activeAxis: Axis | null;
  delta: DeltaOffset;
  startDrag: (axis: Axis) => void;
  updateDrag: (screenDeltaX: number, screenDeltaY: number) => void;
  endDrag: () => void;
}

const MM_PER_PX = 12;

/**
 * Hook thuần — quản lý trạng thái transform gizmo 3 trục.
 */
export function useTransformGizmo(scaleRatioMmPerPx = MM_PER_PX): TransformGizmoState {
  const [activeAxis, setActiveAxis] = useState<Axis | null>(null);
  const [delta, setDelta] = useState<DeltaOffset>({ x: 0, y: 0, z: 0 });

  const startDrag = useCallback((axis: Axis) => {
    setActiveAxis(axis);
    setDelta({ x: 0, y: 0, z: 0 });
  }, []);

  const updateDrag = useCallback(
    (screenDeltaX: number, screenDeltaY: number) => {
      setActiveAxis((current) => {
        if (!current) return current;
        let axisDelta = 0;
        if (current === 'x') axisDelta = screenDeltaX * scaleRatioMmPerPx;
        else if (current === 'y') axisDelta = -screenDeltaY * scaleRatioMmPerPx;
        else if (current === 'z') axisDelta = (screenDeltaX - screenDeltaY) * scaleRatioMmPerPx * 0.5;
        setDelta((prev) => ({ ...prev, [current]: Math.round(axisDelta) }));
        return current;
      });
    },
    [scaleRatioMmPerPx]
  );

  const endDrag = useCallback(() => {
    setActiveAxis(null);
    setDelta({ x: 0, y: 0, z: 0 });
  }, []);

  return { activeAxis, delta, startDrag, updateDrag, endDrag };
}
