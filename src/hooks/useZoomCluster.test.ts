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

  it('increases zoom by 25%', () => {
    const { result } = renderHook(() => useZoomCluster());
    act(() => result.current.zoomIn());
    expect(result.current.zoomLevel).toBe(125);
  });

  it('decreases zoom by 25%', () => {
    const { result } = renderHook(() => useZoomCluster());
    act(() => result.current.zoomOut());
    expect(result.current.zoomLevel).toBe(75);
  });

  it('snaps an off-step level (85% fit) to the next 25% step', () => {
    const { result } = renderHook(() => useZoomCluster(85));
    act(() => result.current.zoomIn());
    expect(result.current.zoomLevel).toBe(100);
    act(() => result.current.fitToScreen());
    act(() => result.current.zoomOut());
    expect(result.current.zoomLevel).toBe(75);
  });

  it('keeps the level per persistKey across remounts (G4b-30)', () => {
    sessionStorage.clear();
    const first = renderHook(() => useZoomCluster(100, 'dimensions:L1'));
    act(() => first.result.current.zoomIn());
    first.unmount();
    expect(renderHook(() => useZoomCluster(100, 'dimensions:L1')).result.current.zoomLevel).toBe(125);
    expect(renderHook(() => useZoomCluster(100, 'dimensions:L2')).result.current.zoomLevel).toBe(100);
    expect(renderHook(() => useZoomCluster()).result.current.zoomLevel).toBe(100);
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
