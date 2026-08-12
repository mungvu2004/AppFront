import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContextMenu } from './useContextMenu';

describe('useContextMenu', () => {
  it('initializes with isVisible set to false', () => {
    const { result } = renderHook(() => useContextMenu());
    expect(result.current.isVisible).toBe(false);
    expect(result.current.groups).toHaveLength(0);
  });

  it('sets isVisible and position when openMenu is called', () => {
    const { result } = renderHook(() => useContextMenu());
    act(() =>
      result.current.openMenu(200, 300, [
        { id: 'g1', items: [{ id: 'a', label: 'Action', action: () => {} }] },
      ])
    );
    expect(result.current.isVisible).toBe(true);
    expect(result.current.position).toEqual({ x: 200, y: 300 });
  });

  it('stores groups when openMenu is called', () => {
    const { result } = renderHook(() => useContextMenu());
    act(() =>
      result.current.openMenu(0, 0, [
        { id: 'g1', items: [{ id: 'copy', label: 'Copy', action: () => {} }] },
        { id: 'g2', items: [{ id: 'del',  label: 'Delete', isDestructive: true, action: () => {} }] },
      ])
    );
    expect(result.current.groups).toHaveLength(2);
    expect(result.current.groups[0]!.items[0]!.label).toBe('Copy');
    expect(result.current.groups[1]!.items[0]!.isDestructive).toBe(true);
  });

  it('creates one default group when openMenuFlat is called', () => {
    const { result } = renderHook(() => useContextMenu());
    act(() =>
      result.current.openMenuFlat(0, 0, [
        { id: 'x', label: 'Item', action: () => {} },
      ])
    );
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.groups[0]!.id).toBe('default');
  });

  it('sets isVisible to false when closeMenu is called', () => {
    const { result } = renderHook(() => useContextMenu());
    act(() => result.current.openMenuFlat(0, 0, [{ id: 'x', label: 'X', action: () => {} }]));
    act(() => result.current.closeMenu());
    expect(result.current.isVisible).toBe(false);
  });

  it('stores the kbd field', () => {
    const { result } = renderHook(() => useContextMenu());
    act(() =>
      result.current.openMenuFlat(0, 0, [{ id: 'c', label: 'Copy', kbd: '⌘C', action: () => {} }])
    );
    expect(result.current.groups[0]!.items[0]!.kbd).toBe('⌘C');
  });
});
