import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { isValidRegion, moveRect, rectFromPoints, uploadsOf, useSheetRegions } from './useSheetRegions';

const FLOORS = [
  { id: 'L1', name: 'Tầng 1' },
  { id: 'L2', name: 'Tầng 2' },
  { id: 'L3', name: 'Tầng 3' },
];

describe('sheet region geometry', () => {
  it('builds a clamped rect from two corners in any order', () => {
    expect(rectFromPoints({ xRatio: 0.6, yRatio: 1.4 }, { xRatio: -0.2, yRatio: 0.5 })).toEqual({
      xRatio: 0,
      yRatio: 0.5,
      widthRatio: 0.6,
      heightRatio: 0.5,
    });
  });

  it('moves without leaving the page', () => {
    const rect = { xRatio: 0.5, yRatio: 0.5, widthRatio: 0.5, heightRatio: 0.25 };
    expect(moveRect(rect, 0.3, -0.9)).toEqual({ ...rect, xRatio: 0.5, yRatio: 0 });
  });

  it('rejects regions under 1% of the page', () => {
    expect(isValidRegion({ xRatio: 0, yRatio: 0, widthRatio: 0.09, heightRatio: 0.1 })).toBe(false);
    expect(isValidRegion({ xRatio: 0, yRatio: 0, widthRatio: 0.1, heightRatio: 0.1 })).toBe(true);
  });

  it('uploads only floors with a valid rect, in floor order', () => {
    const big = { xRatio: 0, yRatio: 0, widthRatio: 0.5, heightRatio: 1 };
    const tiny = { xRatio: 0, yRatio: 0, widthRatio: 0.01, heightRatio: 0.01 };
    const regions = new Map([
      ['L3', big],
      ['L2', tiny],
      ['L1', big],
    ]);
    expect(uploadsOf(FLOORS, regions).map((upload) => upload.floorId)).toEqual(['L1', 'L3']);
  });
});

describe('useSheetRegions', () => {
  const setup = () => {
    const onConfirm = vi.fn();
    const hook = renderHook(() =>
      useSheetRegions({ floors: FLOORS, previewUrlFor: () => 'blob:sheet', onConfirm }),
    );
    return { hook, onConfirm };
  };

  it('is closed until opened, then selects the first floor and cannot confirm empty', () => {
    const { hook } = setup();
    expect(hook.result.current.model).toBeNull();

    act(() => hook.result.current.open('file-1'));

    expect(hook.result.current.model?.selectedFloorId).toBe('L1');
    expect(hook.result.current.model?.canConfirm).toBe(false);
    expect(hook.result.current.model?.floors[0]?.note).toBe('Chưa khoanh');
  });

  it('confirm sends one upload per floor with its crop, then closes', () => {
    const { hook, onConfirm } = setup();
    const left = { xRatio: 0, yRatio: 0, widthRatio: 0.5, heightRatio: 1 };
    const right = { xRatio: 0.5, yRatio: 0, widthRatio: 0.5, heightRatio: 1 };

    act(() => hook.result.current.open('file-1'));
    act(() => {
      hook.result.current.setRegion('L1', left);
      hook.result.current.setRegion('L2', right);
    });

    expect(hook.result.current.model?.confirmLabel).toBe('Tải lên 2 tầng');
    act(() => hook.result.current.confirm());

    expect(onConfirm).toHaveBeenCalledWith('file-1', [
      { floorId: 'L1', crop: left },
      { floorId: 'L2', crop: right },
    ]);
    expect(hook.result.current.model).toBeNull();
  });
});
