/** QA-06b F10 #4 — kết quả tìm kiếm được chọn phải hiện ra (mở tổ tiên). */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';

import { useSpatialJsonViewer } from './useSpatialJsonViewer';

afterEach(cleanup);

const GRAPH = createSampleBuilding();
const options = {
  canView: true,
  errorMessage: null,
  graph: GRAPH,
  isLoading: false,
  isNarrow: false,
  issues: [],
  onReopenFloors: () => undefined,
};
const WALL_ID = GRAPH.walls[2]?.id ?? '';

describe("31-C-006 tìm kiếm chọn kết quả đầu", () => {
  it("xoá ô tìm kiếm: hàng được chọn vẫn hiện (tổ tiên đã mở bền)", () => {
    const { result } = renderHook(() => useSpatialJsonViewer(options));

    act(() => {
      result.current[1].onSearchChange(WALL_ID);
    });

    act(() => {
      result.current[1].onSearchChange("");
    });

    const selected = result.current[0].selectedNodeId;
    expect(selected).not.toBeNull();
    expect(result.current[0].nodes.some((node) => node.id === selected)).toBe(true);
  });

  it('nút Kế tiếp cũng mở nhánh cha của kết quả', () => {
    const { result } = renderHook(() => useSpatialJsonViewer(options));

    act(() => {
      result.current[1].onSearchChange(WALL_ID);
    });
    act(() => {
      result.current[1].onNextMatch();
    });

    const selected = result.current[0].selectedNodeId;
    expect(result.current[0].nodes.some((node) => node.id === selected)).toBe(true);
  });
});
