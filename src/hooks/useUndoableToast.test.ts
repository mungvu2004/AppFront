/**
 * The Undo button on the toast takes back the change the toast is about.
 *
 * The hook used to take the label from `historySlice` and then call zundo's
 * `temporal.undo()` for it, whatever kind of write had produced it. `temporal`
 * only tracks `spatial` (`store/index.ts`, `partialize`), and `commitRuleConfig`
 * writes rule configuration deliberately outside it — so merely opening the rule
 * settings screen, which commits `Nạp cài đặt bộ luật` on load, raised a toast
 * whose Undo rolled back the user's last wall edit and left the configuration
 * untouched. Two changes lost in one press, neither of them the one named on the
 * toast.
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Wall } from '@/domain/spatial/types';
import { commit } from '@/store/commit';
import { useStore } from '@/store/index';
import { INITIAL_RULE_CONFIG } from '@/store/ruleConfigSlice';

import { useUndoableToast } from './useUndoableToast';

const NOISY_RULE = 'WALL-DANGLING-END';

const firstSampleWall = (): Wall => {
  const wall = createSampleBuilding().walls.at(0);

  if (wall === undefined) {
    throw new Error('sample building has no walls');
  }

  return wall;
};

const storedThickness = (wallId: Wall['id']): number => {
  const wall = useStore.getState().spatial?.byId[wallId];

  if (wall === undefined || !('thicknessMm' in wall)) {
    throw new Error(`wall ${wallId} is missing from the store`);
  }

  return wall.thicknessMm;
};

describe('useUndoableToast', () => {
  beforeEach(() => {
    useStore.temporal.getState().clear();
    /* eslint-disable-next-line local/no-direct-set -- dựng cảnh trước mỗi bài
       kiểm, không phải một thao tác ghi của người dùng; đúng ngoại lệ
       `useAutosave.test.ts` đã dùng. */
    useStore.setState({
      spatial: normalizeSpatial(createSampleBuilding()),
      ruleConfig: INITIAL_RULE_CONFIG,
      lastCommitLabel: null,
      lastCommitTimestamp: null,
      lastCommitUndo: null,
    });
  });

  it('shows nothing until something is committed', () => {
    const { result } = renderHook(() => useUndoableToast());

    expect(result.current).toBeNull();
  });

  it('undoes the spatial edit a spatial commit announced', () => {
    const wall = firstSampleWall();
    const { result } = renderHook(() => useUndoableToast());

    act(() => {
      commit(
        { op: 'update', kind: 'wall', id: wall.id, changes: { thicknessMm: wall.thicknessMm + 100 } },
        'Đổi độ dày tường',
      );
    });

    expect(result.current?.label).toBe('Đổi độ dày tường');
    expect(storedThickness(wall.id)).toBe(wall.thicknessMm + 100);

    act(() => {
      result.current?.onUndo();
    });

    expect(storedThickness(wall.id)).toBe(wall.thicknessMm);
    expect(result.current).toBeNull();
  });

  it('undoes the rule configuration a rule commit announced, and touches no wall', () => {
    const wall = firstSampleWall();
    const { result } = renderHook(() => useUndoableToast());

    // The user's own edit, the one Ctrl+Z is meant to reach.
    act(() => {
      commit(
        { op: 'update', kind: 'wall', id: wall.id, changes: { thicknessMm: wall.thicknessMm + 100 } },
        'Đổi độ dày tường',
      );
    });

    // And then the rule settings screen opens and commits its loaded config.
    act(() => {
      useStore
        .getState()
        .commitRuleConfig(
          { overrides: { [NOISY_RULE]: { enabled: false } }, version: 0 },
          'Nạp cài đặt bộ luật',
        );
    });

    expect(result.current?.label).toBe('Nạp cài đặt bộ luật');

    act(() => {
      result.current?.onUndo();
    });

    // The rule configuration is the thing that went back.
    expect(useStore.getState().ruleConfig.overrides).toEqual(INITIAL_RULE_CONFIG.overrides);
    // The wall edit stayed exactly where the user left it.
    expect(storedThickness(wall.id)).toBe(wall.thicknessMm + 100);
  });

  it('offers no toast for a commit that hands over no way back', () => {
    const { result } = renderHook(() => useUndoableToast());

    act(() => {
      /* eslint-disable-next-line local/no-direct-set -- dựng đúng cái cảnh không
         đi qua `commit`: một nhãn lọt vào lịch sử mà không ai giao lại cách lùi
         nó. Đây là thứ bài kiểm này tồn tại để soi. */
      useStore.setState({ lastCommitLabel: 'Đã nạp bản vẽ', lastCommitTimestamp: 1 });
    });

    expect(result.current).toBeNull();
  });
});
