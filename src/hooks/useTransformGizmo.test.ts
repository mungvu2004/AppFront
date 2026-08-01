import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTransformGizmo } from './useTransformGizmo';

describe('useTransformGizmo', () => {
  it('khởi tạo activeAxis = null, delta = 0', () => {
    const { result } = renderHook(() => useTransformGizmo());
    expect(result.current.activeAxis).toBeNull();
    expect(result.current.delta).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('startDrag đặt activeAxis', () => {
    const { result } = renderHook(() => useTransformGizmo());
    act(() => result.current.startDrag('x'));
    expect(result.current.activeAxis).toBe('x');
  });

  it('endDrag xoá activeAxis và reset delta', () => {
    const { result } = renderHook(() => useTransformGizmo());
    act(() => result.current.startDrag('y'));
    act(() => result.current.endDrag());
    expect(result.current.activeAxis).toBeNull();
    expect(result.current.delta).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('startDrag mới reset delta về 0', () => {
    const { result } = renderHook(() => useTransformGizmo());
    act(() => result.current.startDrag('x'));
    act(() => result.current.updateDrag(10, 0));
    act(() => result.current.startDrag('y'));
    // Delta phải reset khi startDrag mới
    expect(result.current.delta.x).toBe(0);
  });

  it('hỗ trợ trục x, y, z', () => {
    const { result } = renderHook(() => useTransformGizmo());
    for (const axis of ['x', 'y', 'z'] as const) {
      act(() => result.current.startDrag(axis));
      expect(result.current.activeAxis).toBe(axis);
      act(() => result.current.endDrag());
    }
  });
});
