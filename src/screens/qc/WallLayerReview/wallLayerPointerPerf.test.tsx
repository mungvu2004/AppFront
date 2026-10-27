import { act, render, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useFrameState } from '@/hooks/useFrameState';
import * as hatch from './wallLayerHatch';
import type { WallLayerCanvasShape, WallLayerPointerReading } from './wallLayerHatch';
import { WallShapeFigure, type WallShapeFigureProps } from './WallLayerShapeFigure';

/* Bọc `toSvgPoints` để đếm số lần WallShapeFigure thực sự render — không đổi hành vi. */
vi.mock('./wallLayerHatch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./wallLayerHatch')>();

  return { ...actual, toSvgPoints: vi.fn(actual.toSvgPoints) };
});

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const SHAPE = {
  id: 'W-001',
  outline: [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 200 },
    { x: 0, y: 200 },
  ],
  statusCode: 'detected',
  codeLabel: 'W-001',
  thicknessMm: 200,
  centrelinePx: { start: { x: 0, y: 100 }, end: { x: 4000, y: 100 } },
  boundsPx: { x: 0, y: 0, width: 4000, height: 200 },
  attentionDotPx: { x: 2000, y: 100 },
  isLowConfidence: false,
  isReviewed: false,
} as unknown as WallLayerCanvasShape;

const HANDLERS = { onHover: vi.fn(), onOpenMenu: vi.fn(), onSelect: vi.fn(), onToggleSelect: vi.fn() };

function figure(overrides: Partial<WallShapeFigureProps> = {}) {
  return (
    <svg>
      <WallShapeFigure
        {...HANDLERS}
        isHovered={false}
        isInteractive
        isSelected={false}
        shape={SHAPE}
        showCentrelines={false}
        unitPx={1}
        {...overrides}
      />
    </svg>
  );
}

describe('[PERF-03 P5] rê chuột không vẽ lại mọi tường', () => {
  it('WallShapeFigure không render lại khi cha render lại với props y hệt', () => {
    const renders = vi.mocked(hatch.toSvgPoints);
    renders.mockClear();
    const { rerender } = render(figure());

    rerender(figure());
    rerender(figure());
    expect(renders).toHaveBeenCalledTimes(1);

    rerender(figure({ isSelected: true }));
    expect(renders).toHaveBeenCalledTimes(2);
  });

  it('tường được chọn vẫn hiện viền chọn', () => {
    const { container } = render(figure({ isSelected: true }));
    const border = container.querySelectorAll('polygon');

    expect(border[border.length - 1]?.getAttribute('class')).toContain('opacity-100');
  });

  it('nhiều lần rê chuột trong một khung chỉ đặt toạ độ một lần, giữ giá trị mới nhất', async () => {
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;

      return useFrameState<WallLayerPointerReading | null>(null);
    });
    const before = renderCount;

    act(() => {
      result.current[1]({ xPx: 1, yPx: 1 });
      result.current[1]({ xPx: 2, yPx: 2 });
      result.current[1]({ xPx: 3, yPx: 3 });
    });
    expect(result.current[0]).toBeNull();

    await act(async () => {
      await nextFrame();
    });
    expect(result.current[0]).toEqual({ xPx: 3, yPx: 3 });
    expect(renderCount - before).toBe(1);

    await act(async () => {
      result.current[1](null);
      await nextFrame();
    });
    expect(result.current[0]).toBeNull();
  });
});
