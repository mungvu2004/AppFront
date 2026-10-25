/** QA-06b F7 — các bug 31-C-008, 31-A-024, 31-B-018, 31-B-019, 31-E-007. */

import { act, cleanup, fireEvent, renderHook, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import type { SpatialGraph } from '@/domain/spatial/types';
import { renderWithProviders } from '@/lib/testing/render';

import { SpatialJsonViewer } from './SpatialJsonViewer';
import { buildSpatialJsonViewerProps } from './spatialJsonViewerFixtures';
import { useSpatialJsonViewer } from './useSpatialJsonViewer';

afterEach(cleanup);

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

describe('31-C-008 đồ thị chỉ có ghi chú', () => {
  const notesOnly = {
    ...GRAPH,
    axes: [],
    dimensions: [],
    furniture: [],
    openings: [],
    rooms: [],
    walls: [],
    notes: [{ id: 'N-1', text: 'ghi chú' }],
  } as unknown as SpatialGraph;

  it('không rơi vào trạng thái rỗng và đếm ghi chú', () => {
    const { result } = renderHook(() => useSpatialJsonViewer({ ...baseOptions, graph: notesOnly }));

    expect(result.current[0].state).not.toBe('empty');
    expect(result.current[0].countsLabel).toContain('1 ghi chú');
  });
});

describe('31-A-024 hàng lỗi bấm được', () => {
  const wall = GRAPH.walls[2];
  const issue = { id: 'x', path: wall?.id ?? '', problem: 'p', severity: 'critical' as const };

  it('chọn nút cây của thực thể và mở tổ tiên', () => {
    const { result } = renderHook(() => useSpatialJsonViewer({ ...baseOptions, issues: [issue] }));

    act(() => {
      result.current[1].onSelectIssue(issue.path);
    });

    expect(result.current[0].selectedNodeId).toBe('walls[2]');
    expect(result.current[0].nodes.some((node) => node.id === 'walls[2]')).toBe(true);
  });

  it('bấm hàng lỗi gọi onSelectIssue với issue.path', () => {
    const props = buildSpatialJsonViewerProps('success');
    const onSelectIssue = vi.fn();
    const model = { ...props.model, validity: { ...props.model.validity, issues: [issue] } };

    renderWithProviders(<SpatialJsonViewer actions={{ ...props.actions, onSelectIssue }} model={model} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(issue.path, 'u') }));

    expect(onSelectIssue).toHaveBeenCalledWith(issue.path);
  });
});

describe('31-B-018 xem trước nút chứa', () => {
  it('không lặp tên nút gốc và không hiện "Giá trị —"', () => {
    const props = buildSpatialJsonViewerProps('success');
    const node = props.model.nodes.find((n) => n.id === 'walls');

    renderWithProviders(
      <SpatialJsonViewer actions={props.actions} model={{ ...props.model, activeTabId: 'preview', selectedNodeId: 'walls' }} />,
    );

    expect(node).toBeDefined();
    expect(screen.queryByText('Giá trị')).toBeNull();
    const detail = within(screen.getByRole('region', { name: 'Nội dung dữ liệu không gian' }));

    expect(detail.getAllByText('walls', { selector: 'code' })).toHaveLength(1);
  });
});

describe('31-B-019 chữ dải hợp lệ', () => {
  it('không có thuật ngữ nội bộ', () => {
    renderWithProviders(<SpatialJsonViewer {...buildSpatialJsonViewerProps('success')} />);

    expect(screen.getByText('Tệp đúng cấu trúc')).toBeTruthy();
  });
});

describe('31-E-007 thẻ là tab thật', () => {
  it('có tabpanel liên kết và phím mũi tên chuyển tab', () => {
    const props = buildSpatialJsonViewerProps('success');
    const onChangeTab = vi.fn();

    renderWithProviders(<SpatialJsonViewer actions={{ ...props.actions, onChangeTab }} model={props.model} />);
    const tab = screen.getByRole('tab', { name: 'JSON' });
    const panel = screen.getByRole('tabpanel');

    expect(tab.getAttribute('aria-controls')).toBe(panel.id);
    fireEvent.keyDown(tab, { key: 'ArrowRight' });
    expect(onChangeTab).toHaveBeenCalledWith('preview');
  });
});
