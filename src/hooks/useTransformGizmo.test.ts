import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTransformGizmo } from './useTransformGizmo';

describe('useTransformGizmo', () => {
  it('initializes with activeAxis set to null and delta set to 0', () => {
    const { result } = renderHook(() => useTransformGizmo());
    expect(result.current.activeAxis).toBeNull();
    expect(result.current.delta).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('sets activeAxis when startDrag is called', () => {
    const { result } = renderHook(() => useTransformGizmo());
    act(() => result.current.startDrag('x'));
    expect(result.current.activeAxis).toBe('x');
  });

  it('clears activeAxis and resets delta when endDrag is called', () => {
    const { result } = renderHook(() => useTransformGizmo());
    act(() => result.current.startDrag('y'));
    act(() => result.current.endDrag());
    expect(result.current.activeAxis).toBeNull();
    expect(result.current.delta).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('resets delta to 0 when a new drag starts', () => {
    const { result } = renderHook(() => useTransformGizmo());
    act(() => result.current.startDrag('x'));
    act(() => result.current.updateDrag(10, 0));
    act(() => result.current.startDrag('y'));
    // Delta phải reset khi startDrag mới
    expect(result.current.delta.x).toBe(0);
  });

  it('supports the x, y, and z axes', () => {
    const { result } = renderHook(() => useTransformGizmo());
    for (const axis of ['x', 'y', 'z'] as const) {
      act(() => result.current.startDrag(axis));
      expect(result.current.activeAxis).toBe(axis);
      act(() => result.current.endDrag());
    }
  });
});
