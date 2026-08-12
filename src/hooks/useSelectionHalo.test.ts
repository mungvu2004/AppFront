import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSelectionHalo } from './useSelectionHalo';

describe('useSelectionHalo', () => {
  it('initializes with isVisible set to false', () => {
    const { result } = renderHook(() => useSelectionHalo());
    expect(result.current.isVisible).toBe(false);
    expect(result.current.hasEntered).toBe(false);
  });

  it('sets isVisible and selected variant when select is called', () => {
    const { result } = renderHook(() => useSelectionHalo());
    act(() => result.current.select());
    expect(result.current.isVisible).toBe(true);
    expect(result.current.variant).toBe('selected');
  });

  it('sets isVisible and hover variant when hover is called', () => {
    const { result } = renderHook(() => useSelectionHalo());
    act(() => result.current.hover());
    expect(result.current.isVisible).toBe(true);
    expect(result.current.variant).toBe('hover');
  });

  it('sets isVisible to false when deselect is called', () => {
    const { result } = renderHook(() => useSelectionHalo());
    act(() => result.current.select());
    act(() => result.current.deselect());
    expect(result.current.isVisible).toBe(false);
  });

  it('can switch from selected to hover', () => {
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
