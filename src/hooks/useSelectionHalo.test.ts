import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSelectionHalo } from './useSelectionHalo';

describe('useSelectionHalo', () => {
  it('khởi tạo với isVisible = false', () => {
    const { result } = renderHook(() => useSelectionHalo());
    expect(result.current.isVisible).toBe(false);
    expect(result.current.hasEntered).toBe(false);
  });

  it('select() đặt isVisible = true, variant = selected', () => {
    const { result } = renderHook(() => useSelectionHalo());
    act(() => result.current.select());
    expect(result.current.isVisible).toBe(true);
    expect(result.current.variant).toBe('selected');
  });

  it('hover() đặt isVisible = true, variant = hover', () => {
    const { result } = renderHook(() => useSelectionHalo());
    act(() => result.current.hover());
    expect(result.current.isVisible).toBe(true);
    expect(result.current.variant).toBe('hover');
  });

  it('deselect() đặt isVisible = false', () => {
    const { result } = renderHook(() => useSelectionHalo());
    act(() => result.current.select());
    act(() => result.current.deselect());
    expect(result.current.isVisible).toBe(false);
  });

  it('chuyển từ selected sang hover được', () => {
    const { result } = renderHook(() => useSelectionHalo());
    act(() => result.current.select());
    expect(result.current.variant).toBe('selected');
    act(() => result.current.hover());
    expect(result.current.variant).toBe('hover');
  });

  it('hasEntered = false ngay sau select()', () => {
    const { result } = renderHook(() => useSelectionHalo());
    act(() => result.current.select());
    // Ngay lập tức, chưa qua 120ms
    expect(result.current.hasEntered).toBe(false);
  });
});
