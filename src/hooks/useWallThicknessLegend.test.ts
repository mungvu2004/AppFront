import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWallThicknessLegend, WALL_THICKNESS_LEVELS } from './useWallThicknessLegend';

describe('useWallThicknessLegend', () => {
  it('khởi tạo với activeThickness = null', () => {
    const { result } = renderHook(() => useWallThicknessLegend());
    expect(result.current.activeThickness).toBeNull();
  });

  it('WALL_THICKNESS_LEVELS gồm 4 cấp đúng', () => {
    expect(WALL_THICKNESS_LEVELS).toEqual([110, 220, 330, 'CONCRETE_COLUMN']);
  });

  it('toggleThickness đặt activeThickness', () => {
    const { result } = renderHook(() => useWallThicknessLegend());
    act(() => result.current.toggleThickness(110));
    expect(result.current.activeThickness).toBe(110);
  });

  it('toggleThickness lần 2 cùng giá trị → null (xoá lọc)', () => {
    const { result } = renderHook(() => useWallThicknessLegend());
    act(() => result.current.toggleThickness(220));
    act(() => result.current.toggleThickness(220));
    expect(result.current.activeThickness).toBeNull();
  });

  it('clearFilter đặt lại về null', () => {
    const { result } = renderHook(() => useWallThicknessLegend());
    act(() => result.current.toggleThickness(330));
    act(() => result.current.clearFilter());
    expect(result.current.activeThickness).toBeNull();
  });

  it('hỗ trợ CONCRETE_COLUMN', () => {
    const { result } = renderHook(() => useWallThicknessLegend());
    act(() => result.current.toggleThickness('CONCRETE_COLUMN'));
    expect(result.current.activeThickness).toBe('CONCRETE_COLUMN');
  });
});
