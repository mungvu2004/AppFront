import { useState, useCallback } from 'react';

export type WallThickness = 110 | 220 | 330;

export function useWallThicknessLegend() {
  const [activeThickness, setActiveThickness] = useState<WallThickness | null>(null);

  const toggleThickness = useCallback((thickness: WallThickness) => {
    setActiveThickness((current) => (current === thickness ? null : thickness));
  }, []);

  return {
    activeThickness,
    toggleThickness,
  };
}
