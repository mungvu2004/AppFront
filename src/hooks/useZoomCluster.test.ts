import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useZoomCluster } from './useZoomCluster';

describe('useZoomCluster', () => {
  it('initializes with 100% zoom', () => {
    const { result } = renderHook(() => useZoomCluster());
    expect(result.current.zoomLevel).toBe(100);
    expect(result.current.zoomLabel).toBe('100%');
  });

  it('initializes with a custom value', () => {
    const { result } = renderHook(() => useZoomCluster(150));
    expect(result.current.zoomLevel).toBe(150);
  });

  it('increases zoom by 10%', () => {
    const { result } = renderHook(() => useZoomCluster());
    act(() => result.current.zoomIn());
    expect(result.current.zoomLevel).toBe(110);
  });

  it('decreases zoom by 10%', () => {
    const { result } = renderHook(() => useZoomCluster());
    act(() => result.current.zoomOut());
    expect(result.current.zoomLevel).toBe(90);
  });

  it('resets zoom to 100', () => {
    const { result } = renderHook(() => useZoomCluster(200));
    act(() => result.current.resetZoom());
    expect(result.current.zoomLevel).toBe(100);
  });

  it('fits zoom to 85', () => {
    const { result } = renderHook(() => useZoomCluster());
    act(() => result.current.fitToScreen());
    expect(result.current.zoomLevel).toBe(85);
  });

  it('does not exceed 400', () => {
    const { result } = renderHook(() => useZoomCluster(400));
    act(() => result.current.zoomIn());
    expect(result.current.zoomLevel).toBe(400);
  });

  it('does not go below 10', () => {
    const { result } = renderHook(() => useZoomCluster(10));
    act(() => result.current.zoomOut());
    expect(result.current.zoomLevel).toBe(10);
  });

  it('updates zoomLabel from zoomLevel', () => {
    const { result } = renderHook(() => useZoomCluster(75));
    expect(result.current.zoomLabel).toBe('75%');
  });
});
