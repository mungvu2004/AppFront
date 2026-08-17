import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useListReview, type WallData } from './useListReview';

interface CapturedToast {
  message: string;
  onUndo: () => void;
}

function wall(id: string): WallData {
  return { id, code: id, thickness: 220, confidence: 0.9, level: 'L-01', status: 'neutral' };
}

function ids(rows: readonly WallData[]): string[] {
  return rows.map((row) => row.id);
}

describe('useListReview', () => {
  it('restores the rows a delete removed', () => {
    const toasts: CapturedToast[] = [];
    const { result } = renderHook(() =>
      useListReview([wall('W-001'), wall('W-002')], (toast) => {
        toasts.push(toast);
      }),
    );

    act(() => {
      result.current.handleSelect('W-001', false);
    });
    act(() => {
      result.current.handleDeleteSelected();
    });

    expect(ids(result.current.data)).toEqual(['W-002']);

    act(() => {
      toasts[0]?.onUndo();
    });

    expect(ids(result.current.data)).toEqual(['W-001', 'W-002']);
  });

  /**
   * The buffer used to live at module scope, so every list on the page shared
   * one. Two lists were enough to make an undo restore the wrong rows into the
   * wrong list — and worse, to make the first list's toast silently undo
   * nothing, because the second delete had overwritten its backup.
   */
  it('keeps each list’s undo buffer to itself', () => {
    const toastsA: CapturedToast[] = [];
    const toastsB: CapturedToast[] = [];

    const listA = renderHook(() =>
      useListReview([wall('W-001'), wall('W-002')], (toast) => {
        toastsA.push(toast);
      }),
    );
    const listB = renderHook(() =>
      useListReview([wall('W-101'), wall('W-102')], (toast) => {
        toastsB.push(toast);
      }),
    );

    act(() => {
      listA.result.current.handleSelect('W-001', false);
    });
    act(() => {
      listA.result.current.handleDeleteSelected();
    });

    act(() => {
      listB.result.current.handleSelect('W-101', false);
    });
    act(() => {
      listB.result.current.handleDeleteSelected();
    });

    act(() => {
      toastsA[0]?.onUndo();
    });

    // A gets its own rows back...
    expect(ids(listA.result.current.data)).toEqual(['W-001', 'W-002']);
    // ...and B is untouched by A's undo.
    expect(ids(listB.result.current.data)).toEqual(['W-102']);

    act(() => {
      toastsB[0]?.onUndo();
    });

    expect(ids(listB.result.current.data)).toEqual(['W-101', 'W-102']);
  });
});
