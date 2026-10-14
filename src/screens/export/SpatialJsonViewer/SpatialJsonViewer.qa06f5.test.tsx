/** QA-06b F5 — các bug 31-A-022/023, 31-C-006, 31-E-002/003, 31-B-017. */

import { act, cleanup, fireEvent, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSampleBuilding, SAMPLE_WALL_COUNT } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { renderWithProviders } from '@/lib/testing/render';

import { SpatialJsonTree } from './SpatialJsonTree';
import { SpatialJsonViewer } from './SpatialJsonViewer';
import { buildSpatialJsonViewerProps } from './spatialJsonViewerFixtures';
import { useSpatialJsonViewer } from './useSpatialJsonViewer';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const GRAPH = createSampleBuilding();
const baseOptions = {
  canView: true,
  errorMessage: null,
  graph: GRAPH,
  isLoading: false,
  isNarrow: false,
  issues: [],
  onReopenFloors: () => undefined,
};

describe('31-A-022 sao chép nhánh đang chọn', () => {
  it('chép đúng nhánh đang chọn, không phải cả đồ thị', () => {
    const onCopy = vi.fn();
    const { result } = renderHook(() => useSpatialJsonViewer({ ...baseOptions, onCopy }));

    act(() => {
      result.current[1].onSelectNode('walls');
    });
    act(() => {
      result.current[1].onCopyBranch();
    });

    expect(onCopy).toHaveBeenCalledWith(JSON.stringify(GRAPH.walls, null, 2));
  });

  it('không cấp onCopy thì mặc định ghi vào clipboard', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const { result } = renderHook(() => useSpatialJsonViewer(baseOptions));

    act(() => {
      result.current[1].onCopyBranch();
    });

    expect(writeText).toHaveBeenCalledTimes(1);
  });
});

describe('31-A-023 tải xuống .json', () => {
  it('nút tải xuống có mặt khi không ai cấp onDownload, và tải đúng chữ thô', () => {
    const create = vi.fn(() => 'blob:x');

    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const { result } = renderHook(() => useSpatialJsonViewer(baseOptions));

    expect(result.current[0].canDownload).toBe(true);
    act(() => {
      result.current[1].onDownload?.();
    });

    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe('31-C-006 bộ đếm kết quả', () => {
  it('gõ từ khoá chọn kết quả 1; "Kết quả sau" sang 2', () => {
    const { result } = renderHook(() => useSpatialJsonViewer(baseOptions));

    act(() => {
      result.current[1].onSearchChange('thicknessMm');
    });
    const firstMatch = result.current[0].nodes.find((node) => node.isMatch);

    expect(result.current[0].matchLabel).toBe(`1 / ${SAMPLE_WALL_COUNT}`);
    expect(result.current[0].selectedNodeId).toBe(firstMatch?.id);

    act(() => {
      result.current[1].onNextMatch();
    });

    expect(result.current[0].matchLabel).toBe(`2 / ${SAMPLE_WALL_COUNT}`);
    expect(result.current[0].selectedNodeId).toBe(result.current[0].nodes.filter((n) => n.isMatch)[1]?.id);
  });
});

describe('31-E-002/003 cây một điểm dừng Tab và phím mũi tên', () => {
  const renderTree = () => {
    const props = buildSpatialJsonViewerProps('success');

    renderWithProviders(
      <SpatialJsonTree
        nodes={props.model.nodes}
        selectedNodeId={null}
        onToggle={() => undefined}
        onSelect={() => undefined}
      />,
    );

    return screen.getAllByRole('treeitem');
  };

  it('đúng một hàng có tabIndex 0', () => {
    const rows = renderTree();

    expect(rows.filter((row) => row.tabIndex === 0)).toHaveLength(1);
  });

  it('ArrowDown/ArrowUp/End/Home chuyển focus giữa các hàng', () => {
    const rows = renderTree();

    rows[0]?.focus();
    fireEvent.keyDown(rows[0] as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rows[1]);
    fireEvent.keyDown(rows[1] as HTMLElement, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(rows[0]);
    fireEvent.keyDown(rows[0] as HTMLElement, { key: 'End' });
    expect(document.activeElement).toBe(rows[rows.length - 1]);
    fireEvent.keyDown(rows[rows.length - 1] as HTMLElement, { key: 'Home' });
    expect(document.activeElement).toBe(rows[0]);
  });
});

describe('31-B-017 lời khuyên sau khi cắt 600 dòng', () => {
  it('không khuyên thu gọn cây (vô tác dụng); chỉ đường lấy toàn bộ', () => {
    const props = buildSpatialJsonViewerProps('success');
    const rawText = Array.from({ length: 700 }, (_, index) => `"k${String(index)}": 1`).join('\n');

    renderWithProviders(
      <SpatialJsonViewer actions={props.actions} model={{ ...props.model, rawText, activeTabId: 'json' }} />,
    );

    expect(screen.queryByText(/Thu gọn bớt nhánh/u)).toBeNull();
    expect(screen.getByText(/Bấm Tải xuống \.json để lấy toàn bộ/u)).toBeTruthy();
  });
});
