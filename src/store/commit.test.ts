import { describe, it, expect, beforeEach } from 'vitest';
import { commit } from './commit';
import { useStore } from './index';

describe('store/commit.ts', () => {
  beforeEach(() => {
    useStore.temporal.getState().clear();
    useStore.setState({
      spatial: {
        project_metadata: { scale_ratio_mm_per_px: 12 },
        levels: [],
        global_anchor: { axis_intersection: 'A-1', x_offset: 0, y_offset: 0 },
        geometry: {}
      }
    });
  });

  it('commits changes and supports undo', () => {
    const result = commit((draft) => {
      draft.project_metadata.scale_ratio_mm_per_px = 24;
    }, 'Đổi tỷ lệ');

    expect(result.label).toBe('Đổi tỷ lệ');
    expect(useStore.getState().spatial?.project_metadata.scale_ratio_mm_per_px).toBe(24);
    expect(useStore.getState().lastCommitLabel).toBe('Đổi tỷ lệ');

    result.undo();

    expect(useStore.getState().spatial?.project_metadata.scale_ratio_mm_per_px).toBe(12);
  });
});
