import { useState, useCallback } from 'react';
import type { WallThickness } from '../types/spatial';

export type { WallThickness };

export const WALL_THICKNESS_LEVELS: WallThickness[] = [110, 220, 330, 'CONCRETE_COLUMN'];

export interface WallThicknessLegendState {
  activeThickness: WallThickness | null;
  toggleThickness: (thickness: WallThickness) => void;
  clearFilter: () => void;
}

/**
 * Hook thuần — quản lý filter theo độ dày tường.
 */
export function useWallThicknessLegend(): WallThicknessLegendState {
  const [activeThickness, setActiveThickness] = useState<WallThickness | null>(null);

  const toggleThickness = useCallback((thickness: WallThickness) => {
    setActiveThickness((current) => (current === thickness ? null : thickness));
  }, []);

  const clearFilter = useCallback(() => {
    setActiveThickness(null);
  }, []);

  return { activeThickness, toggleThickness, clearFilter };
}
