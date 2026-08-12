import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMeasurementLabel } from './useMeasurementLabel';

describe('useMeasurementLabel', () => {
  it('initializes with idle state', () => {
    const { result } = renderHook(() => useMeasurementLabel());
    expect(result.current.state).toBe('idle');
    expect(result.current.startPoint).toBeNull();
    expect(result.current.currentPoint).toBeNull();
    expect(result.current.distanceMm).toBe(0);
    expect(result.current.distanceFormatted).toBe('—');
  });

  it('switches to measuring when startMeasurement is called', () => {
    const { result } = renderHook(() => useMeasurementLabel());
    act(() => result.current.startMeasurement(100, 100));
    expect(result.current.state).toBe('measuring');
    expect(result.current.startPoint).toEqual({ x: 100, y: 100 });
  });

  it('switches to committed when commitMeasurement is called', () => {
    const { result } = renderHook(() => useMeasurementLabel());
    act(() => result.current.startMeasurement(0, 0));
    act(() => result.current.commitMeasurement());
    expect(result.current.state).toBe('committed');
  });

  it('resets to idle and clears points when resetMeasurement is called', () => {
    const { result } = renderHook(() => useMeasurementLabel());
    act(() => result.current.startMeasurement(50, 50));
    act(() => result.current.resetMeasurement());
    expect(result.current.state).toBe('idle');
    expect(result.current.startPoint).toBeNull();
  });

  it('calculates distanceMm for a horizontal line', () => {
    const { result } = renderHook(() => useMeasurementLabel());
    // 100px ngang × scaleRatio 12 mm/px = 1200mm
    act(() => result.current.startMeasurement(0, 0));
    act(() => result.current.updateMeasurement(100, 0));
    expect(result.current.distanceMm).toBe(1200);
  });

  it('calculates the midpoint', () => {
    const { result } = renderHook(() => useMeasurementLabel());
    act(() => result.current.startMeasurement(0, 0));
    act(() => result.current.updateMeasurement(200, 0));
    expect(result.current.midPoint).toEqual({ x: 100, y: 0 });
  });

  it('does not update measurement while idle', () => {
    const { result } = renderHook(() => useMeasurementLabel());
    act(() => result.current.updateMeasurement(999, 999));
    expect(result.current.currentPoint).toBeNull();
  });

  it('formats distance with the mm unit', () => {
    const { result } = renderHook(() => useMeasurementLabel());
    act(() => result.current.startMeasurement(0, 0));
    act(() => result.current.updateMeasurement(100, 0));
    expect(result.current.distanceFormatted).toContain('mm');
  });
});
