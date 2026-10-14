/**
 * QA-06b F6 — bug báo cáo luật tìm ra ở run-061 (mỗi bài đỏ trên mã cũ trước khi sửa).
 */

import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type * as AppClientModule from '@/api/appClient';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { VIOLATED_BUILDING_SCENARIO } from '@/lib/testing/fixtures';
import { renderWithProviders } from '@/lib/testing/render';
import { ROUTES } from '@/routes/paths';
import { useStore } from '@/store';

import { RulesRoute } from './RuleReport.container';

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
