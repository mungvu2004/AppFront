/**
 * QA-06b F6 — bug báo cáo luật tìm ra ở run-061 (mỗi bài đỏ trên mã cũ trước khi sửa).
 */

import { act, cleanup, fireEvent, renderHook, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type * as AppClientModule from '@/api/appClient';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { CLEAN_BUILDING_SCENARIO, VIOLATED_BUILDING_SCENARIO } from '@/lib/testing/fixtures';
import { createTestQueryClient, renderWithProviders } from '@/lib/testing/render';
import { ROUTES } from '@/routes/paths';
import { useStore } from '@/store';

import { RulesRoute } from './RuleReport.container';
import { sheetFloorId } from './sheetFloorId';
import { useRuleReport } from './useRuleReport';
import { RuleReportFilterBar } from './RuleReportSummary';
import type { RuleReportGroup, RuleReportRow } from './types';

vi.mock('@/api/appClient', async (importOriginal) => {
  const actual = await importOriginal<typeof AppClientModule>();
  const { createMockApiClient } = await import('@/api/__mocks__/client');

  return { ...actual, createAppApiClient: () => createMockApiClient() };
});

beforeAll(async () => {
  await import('@/api/appClient');
});

afterEach(() => {
  cleanup();
});

function renderRoute(roles: readonly ('admin' | 'engineer' | 'viewer')[]) {
  act(() => {
    useStore.getState().setProject({ created_at: '', id: 'P-1', members: [], name: 'P-1', updated_at: '' });
    useStore.getState().setSpatial(normalizeSpatial(VIOLATED_BUILDING_SCENARIO.graph), 'qa06-f6');
    useStore.getState().setUserRoles([...roles]);
  });
  return renderWithProviders(
    <MemoryRouter initialEntries={[ROUTES.project.rules('P-1')]}>
      <Routes>
        <Route path="/projects/:projectId/rules" element={<RulesRoute />} />
      </Routes>
    </MemoryRouter>,
    { keepStore: true },
  );
}

async function openFirstViolation(container: HTMLElement): Promise<void> {
  const toggle = await waitFor(() => {
    const found = container.querySelector<HTMLButtonElement>('h3 button[aria-expanded="false"]');
    if (found === null) throw new Error('lượt chạy chưa xong');
    return found;
  });
  fireEvent.click(toggle);
  const message = await waitFor(() => {
    const found = container.querySelector<HTMLButtonElement>('tbody button, section li button');
    if (found === null) throw new Error('nhóm chưa mở');
    return found;
  });
  fireEvent.click(message);
  await waitFor(() => screen.getByRole('complementary', { name: 'Chi tiết vi phạm' }));
}

describe('28-D-004 / 28V-D-003 — route lấy quyền thật của người xem', () => {
  it('viewer: không có "Xác nhận đã xử lý" và tấm trượt không có "Lựa chọn xử lý"', async () => {
    const { container } = renderRoute(['viewer']);

    await openFirstViolation(container);

    expect(screen.queryByRole('button', { name: 'Xác nhận đã xử lý' })).toBeNull();
    expect(screen.queryByText('Lựa chọn xử lý')).toBeNull();
  });

  it('engineer: vẫn có "Xác nhận đã xử lý"', async () => {
    const { container } = renderRoute(['engineer']);

    await openFirstViolation(container);

    expect(screen.getByRole('button', { name: 'Xác nhận đã xử lý' })).toBeInTheDocument();
  });
});

describe('28-C-012 — Select "Tầng" không phụ thuộc bộ lọc khác', () => {
  const row = (levelId: string, levelLabel: string): RuleReportRow =>
    ({
      key: `R:${levelId}`, ruleCode: 'LEVEL-ELEVATION', severity: 'critical', message: 'm', suggestion: 's',
      entityId: levelId, entityCode: '#1', levelId, levelLabel, resolved: false,
    }) as unknown as RuleReportRow;
  const group = (rows: RuleReportRow[]): RuleReportGroup =>
    ({ ruleCode: 'LEVEL-ELEVATION', ruleName: 'n', group: 'structure', severity: 'critical', rows, openCount: rows.length, resolvedCount: 0 }) as unknown as RuleReportGroup;

  it('chọn "Tầng 2" rồi bộ lọc khác làm nhóm rỗng: ô vẫn hiện "Tầng 2" và vẫn liệt kê nó', () => {
    const noop = vi.fn();
    const filters = { level: 'all', group: 'all', levelId: 'L-2' } as const;
    const { rerender } = renderWithProviders(
      <RuleReportFilterBar filters={{ ...filters, levelId: 'all' }} groups={[group([row('L-1', 'Tầng 1'), row('L-2', 'Tầng 2')])]} resolvedRows={[]} onFilterChange={noop} />,
    );
    rerender(<RuleReportFilterBar filters={filters} groups={[]} resolvedRows={[]} onFilterChange={noop} />);

    const trigger = screen.getByRole('combobox', { name: 'Tầng' });
    expect(trigger).toHaveTextContent('Tầng 2');
    fireEvent.click(trigger);
    expect(screen.getByRole('option', { name: 'Tầng 1' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Tầng 2' })).toBeInTheDocument();
  });
});

describe('28-A-021 — hàng không tầng và không tầng đang mở vẫn mở được tấm trượt', () => {
  it('dự phòng cuối: tầng đầu tiên của mô hình; không có tầng nào thì mới null', () => {
    const graph = normalizeSpatial(VIOLATED_BUILDING_SCENARIO.graph);

    expect(sheetFloorId(null, null, graph)).toBe(graph.byKind.level[0]);
    expect(sheetFloorId('L-X', null, graph)).toBe('L-X');
    expect(sheetFloorId(null, 'L-Y', graph)).toBe('L-Y');
    expect(sheetFloorId(null, null, null)).toBeNull();
  });
});

describe('28V-E-008 — đóng tấm trả tiêu điểm về hàng đã mở nó', () => {
  it('Esc đóng tấm → nút mô tả của hàng đó giữ tiêu điểm', async () => {
    const { container } = renderRoute(['engineer']);

    await openFirstViolation(container);
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('complementary', { name: 'Chi tiết vi phạm' })).toBeNull();
    });
    expect(document.activeElement?.hasAttribute('data-row-key')).toBe(true);
  });
});

describe('QA-06b F13 — "Đã xử lý" tích luỹ qua nhiều lượt chạy (28-A-037/038, 28V-G-002)', () => {
  it('một lần sửa gây hai lượt chạy liên tiếp: hàng vừa sửa vẫn nằm ở nhóm đã xử lý', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { readonly children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
    act(() => {
      useStore.getState().setSpatial(normalizeSpatial(VIOLATED_BUILDING_SCENARIO.graph), 'f13-v1');
    });
    const { result } = renderHook(() => useRuleReport({ projectId: 'P-F13' }), { wrapper });
    const resolvedCount = () => result.current.groups.reduce((n, g) => n + g.resolvedCount, 0);
    await waitFor(() => {
      expect(result.current.groups.length).toBeGreaterThan(0);
    });
    expect(resolvedCount()).toBe(0);

    // Lượt 1: hàng biến mất (đã sửa).
    act(() => {
      useStore.getState().setSpatial(normalizeSpatial(CLEAN_BUILDING_SCENARIO.graph), 'f13-v2');
    });
    await waitFor(() => {
      expect(resolvedCount()).toBeGreaterThan(0);
    });
    const afterFirst = resolvedCount();

    // Lượt 2: cùng dữ liệu, chỉ khoá đổi (refetch sau rerunRules) — không được xoá hàng đã xử lý.
    act(() => {
      useStore.getState().setSpatial(normalizeSpatial(CLEAN_BUILDING_SCENARIO.graph), 'f13-v3');
    });
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(resolvedCount()).toBe(afterFirst);
  });
});

describe('28-A-040 — bấm lại hàng đã mở tấm sau khi tấm đã sang hàng khác (BUG-728 RF)', () => {
  it('J sang hàng kế rồi bấm lại hàng đầu: tấm quay về hàng đầu', async () => {
    const { container } = renderRoute(['engineer']);
    await openFirstViolation(container);
    const panel = (): HTMLElement => screen.getByRole('complementary', { name: 'Chi tiết vi phạm' });
    const first = container.querySelector<HTMLButtonElement>('button[data-row-key]');
    if (first === null) throw new Error('không có hàng nào');
    const firstMessage = first.textContent?.trim() ?? '';
    expect(within(panel()).getByRole('heading', { level: 2 })).toHaveTextContent(firstMessage);

    fireEvent.keyDown(window, { key: 'j' });
    await waitFor(() => {
      expect(within(panel()).getByRole('heading', { level: 2 })).not.toHaveTextContent(firstMessage);
    });

    // Cha giữ khoá của hàng đã mở lúc đầu: bấm lại hàng ấy không đổi `initialIndex` → tấm đứng yên (p06-rf 28-A-040).
    fireEvent.click(first);
    await waitFor(() => {
      expect(within(panel()).getByRole('heading', { level: 2 })).toHaveTextContent(firstMessage);
    });
  });
});
