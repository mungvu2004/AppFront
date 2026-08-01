import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useZoomCluster } from './useZoomCluster';

describe('useZoomCluster', () => {
  it('khởi tạo với zoom 100%', () => {
    const { result } = renderHook(() => useZoomCluster());
    expect(result.current.zoomLevel).toBe(100);
    expect(result.current.zoomLabel).toBe('100%');
  });

  it('khởi tạo với giá trị tuỳ chỉnh', () => {
    const { result } = renderHook(() => useZoomCluster(150));
    expect(result.current.zoomLevel).toBe(150);
  });

  it('zoomIn tăng 10%', () => {
    const { result } = renderHook(() => useZoomCluster());
    act(() => result.current.zoomIn());
    expect(result.current.zoomLevel).toBe(110);
  });

  it('zoomOut giảm 10%', () => {
    const { result } = renderHook(() => useZoomCluster());
    act(() => result.current.zoomOut());
    expect(result.current.zoomLevel).toBe(90);
  });

  it('resetZoom về 100', () => {
    const { result } = renderHook(() => useZoomCluster(200));
    act(() => result.current.resetZoom());
    expect(result.current.zoomLevel).toBe(100);
  });

  it('fitToScreen về 85', () => {
    const { result } = renderHook(() => useZoomCluster());
    act(() => result.current.fitToScreen());
    expect(result.current.zoomLevel).toBe(85);
  });

  it('không vượt quá 400', () => {
    const { result } = renderHook(() => useZoomCluster(400));
    act(() => result.current.zoomIn());
    expect(result.current.zoomLevel).toBe(400);
  });

  it('không xuống dưới 10', () => {
    const { result } = renderHook(() => useZoomCluster(10));
    act(() => result.current.zoomOut());
    expect(result.current.zoomLevel).toBe(10);
  });

  it('zoomLabel cập nhật theo zoomLevel', () => {
    const { result } = renderHook(() => useZoomCluster(75));
    expect(result.current.zoomLabel).toBe('75%');
  });
});
