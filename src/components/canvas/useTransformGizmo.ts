import { useState, useCallback } from 'react';

export type Axis = 'x' | 'y' | 'z' | null;

export function useTransformGizmo() {
  const [activeAxis, setActiveAxis] = useState<Axis>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0, z: 0 });

  const startDrag = useCallback((axis: Axis) => {
    setActiveAxis(axis);
  }, []);

  const updateDrag = useCallback((delta: number) => {
    setActiveAxis((current) => {
      if (!current) return current;
      setOffset((prev) => ({ ...prev, [current]: prev[current] + delta }));
      return current;
    });
  }, []);

  const endDrag = useCallback(() => {
    setActiveAxis(null);
    // Snap back to 0 for demo purposes, using the css transition in the component
    setOffset({ x: 0, y: 0, z: 0 }); 
  }, []);

  return {
    activeAxis,
    offset,
    startDrag,
    updateDrag,
    endDrag,
  };
}
