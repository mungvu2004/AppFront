import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWallThicknessLegend, WALL_THICKNESS_LEVELS } from './useWallThicknessLegend';

describe('useWallThicknessLegend', () => {
  it('initializes with activeThickness set to null', () => {
    const { result } = renderHook(() => useWallThicknessLegend());
    expect(result.current.activeThickness).toBeNull();
  });

  it('defines the expected 4 wall thickness levels', () => {
    expect(WALL_THICKNESS_LEVELS).toEqual([110, 220, 330, 'CONCRETE_COLUMN']);
  });

  it('sets activeThickness when toggleThickness is called', () => {
    const { result } = renderHook(() => useWallThicknessLegend());
    act(() => result.current.toggleThickness(110));
    expect(result.current.activeThickness).toBe(110);
  });

  it('clears activeThickness when toggleThickness is called twice with the same value', () => {
    const { result } = renderHook(() => useWallThicknessLegend());
    act(() => result.current.toggleThickness(220));
    act(() => result.current.toggleThickness(220));
    expect(result.current.activeThickness).toBeNull();
  });

  it('resets activeThickness to null when clearFilter is called', () => {
    const { result } = renderHook(() => useWallThicknessLegend());
    act(() => result.current.toggleThickness(330));
    act(() => result.current.clearFilter());
    expect(result.current.activeThickness).toBeNull();
  });

  it('supports CONCRETE_COLUMN', () => {
    const { result } = renderHook(() => useWallThicknessLegend());
    act(() => result.current.toggleThickness('CONCRETE_COLUMN'));
    expect(result.current.activeThickness).toBe('CONCRETE_COLUMN');
  });
});
