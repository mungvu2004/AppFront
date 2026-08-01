import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMeasurementLabel } from './useMeasurementLabel';

describe('useMeasurementLabel', () => {
  it('khởi tạo state = idle', () => {
    const { result } = renderHook(() => useMeasurementLabel());
    expect(result.current.state).toBe('idle');
    expect(result.current.startPoint).toBeNull();
    expect(result.current.currentPoint).toBeNull();
    expect(result.current.distanceMm).toBe(0);
    expect(result.current.distanceFormatted).toBe('—');
  });

  it('startMeasurement chuyển sang measuring', () => {
    const { result } = renderHook(() => useMeasurementLabel());
    act(() => result.current.startMeasurement(100, 100));
    expect(result.current.state).toBe('measuring');
    expect(result.current.startPoint).toEqual({ x: 100, y: 100 });
  });

  it('commitMeasurement chuyển sang committed', () => {
    const { result } = renderHook(() => useMeasurementLabel());
    act(() => result.current.startMeasurement(0, 0));
    act(() => result.current.commitMeasurement());
    expect(result.current.state).toBe('committed');
  });

  it('resetMeasurement về idle, xoá điểm', () => {
    const { result } = renderHook(() => useMeasurementLabel());
    act(() => result.current.startMeasurement(50, 50));
    act(() => result.current.resetMeasurement());
    expect(result.current.state).toBe('idle');
    expect(result.current.startPoint).toBeNull();
  });

  it('tính distanceMm đúng cho đường ngang', () => {
    const { result } = renderHook(() => useMeasurementLabel());
    // 100px ngang × scaleRatio 12 mm/px = 1200mm
    act(() => result.current.startMeasurement(0, 0));
    act(() => result.current.updateMeasurement(100, 0));
    expect(result.current.distanceMm).toBe(1200);
  });

  it('midPoint là trung điểm đúng', () => {
    const { result } = renderHook(() => useMeasurementLabel());
    act(() => result.current.startMeasurement(0, 0));
    act(() => result.current.updateMeasurement(200, 0));
    expect(result.current.midPoint).toEqual({ x: 100, y: 0 });
  });

  it('updateMeasurement không hoạt động khi idle', () => {
    const { result } = renderHook(() => useMeasurementLabel());
    act(() => result.current.updateMeasurement(999, 999));
    expect(result.current.currentPoint).toBeNull();
  });

  it('distanceFormatted chứa mm', () => {
    const { result } = renderHook(() => useMeasurementLabel());
    act(() => result.current.startMeasurement(0, 0));
    act(() => result.current.updateMeasurement(100, 0));
    expect(result.current.distanceFormatted).toContain('mm');
  });
});
