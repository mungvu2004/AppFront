import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMiniMap } from './useMiniMap';

describe('useMiniMap', () => {
  it('initializes with default values', () => {
    const { result } = renderHook(() => useMiniMap());
    expect(result.current.viewport).toEqual({ x: 20, y: 20, width: 40, height: 30 });
    expect(result.current.isDragging).toBe(false);
    expect(result.current.isHovered).toBe(false);
  });

  it('initializes with initialViewport', () => {
    const { result } = renderHook(() =>
      useMiniMap({ initialViewport: { x: 10, y: 10, width: 20, height: 20 } })
    );
    expect(result.current.viewport).toEqual({ x: 10, y: 10, width: 20, height: 20 });
  });

  it('updates isHovered on mouse enter and leave', () => {
    const { result } = renderHook(() => useMiniMap());
    act(() => result.current.handleMouseEnter());
    expect(result.current.isHovered).toBe(true);
    act(() => result.current.handleMouseLeave());
    expect(result.current.isHovered).toBe(false);
  });

  it('keeps viewport coordinates within 0-100%', () => {
    // Để test logic clampViewport, ta có thể gọi jumpTo hoặc xem code internal
    // Mock mapRef bounding client rect
    const { result } = renderHook(() => useMiniMap({ initialViewport: { width: 40, height: 30 } }));
    
    // Tạo một mock div
    const div = document.createElement('div');
    vi.spyOn(div, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 150,
      right: 200,
      bottom: 150,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    // Ép ref
    Object.defineProperty(result.current.mapRef, 'current', { value: div });

    // Click vào góc (0, 0)
    act(() => {
      result.current.handleClick({ clientX: 0, clientY: 0 } as unknown as React.MouseEvent);
    });

    // Tâm viewport (width 40, height 30) muốn đặt ở (0,0) -> top-left sẽ là x: -20, y: -15
    // Sau khi clamp, x, y phải là 0, 0
    expect(result.current.viewport.x).toBe(0);
    expect(result.current.viewport.y).toBe(0);

    // Click vào góc xa (200, 150) tức là 100%, 100%
    // Tâm muốn ở 100%, 100% -> top-left sẽ là x: 80, y: 85
    // Clamp x <= 100 - 40 = 60, y <= 100 - 30 = 70
    act(() => {
      result.current.handleClick({ clientX: 200, clientY: 150 } as unknown as React.MouseEvent);
    });

    expect(result.current.viewport.x).toBe(60);
    expect(result.current.viewport.y).toBe(70);
  });

  it('calls onViewportChange when jumpTo is called', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useMiniMap({ onViewportChange: onChange }));

    const div = document.createElement('div');
    vi.spyOn(div, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => {},
    });
    Object.defineProperty(result.current.mapRef, 'current', { value: div });

    act(() => {
      result.current.handleClick({ clientX: 50, clientY: 50 } as unknown as React.MouseEvent);
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      width: 40,
      height: 30,
    }));
  });
});
