import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/query/queryKeys';
import { renderWithProviders } from '@/lib/testing/render';
import type { CreateProjectModalContainerProps } from '@/screens/project/CreateProjectModal';

import { ProjectDashboardRoute } from './ProjectDashboard.container';
import type { DashboardProject, DashboardProjectList } from './projectsGateway';

/** The project the stub dialog "creates", already in N1's cache the way the create's refetch leaves it. */
const CREATED: DashboardProject = {
  id: 'prj_01HZX3K9M2Q4R6T8V0W1Y3A5C7',
  name: 'Dự án vừa tạo',
  floorCount: 4,
  areaM2: 0,
  status: 'processing',
  wallsReviewedCount: 0,
  wallsTotalCount: 0,
  updatedAtMs: Date.parse('2026-10-11T00:00:00.000Z'),
  members: [],
  planVariant: 0,
};
const undoDelete = vi.fn();

// The real dialog's own flow is its suite's business; this file only needs what it hands the dashboard:
// `onToast` with an undo that deletes, then `onCreated` with the id (useCreateProjectModal.ts, submit).
vi.mock('@/screens/project/CreateProjectModal', () => ({
  CreateProjectModalContainer: (props: CreateProjectModalContainerProps) =>
    props.isOpen ? (
      <button
        type="button"
        onClick={() => {
          props.onToast?.({ message: `Đã tạo dự án "${CREATED.name}".`, onUndo: undoDelete });
          props.onCreated?.(CREATED.id);
          props.onDismiss();
        }}
      >
        Tạo thử
      </button>
    ) : null,
}));

// Same reason as ProjectDashboard.test.tsx: the real bell needs `EventSource`, which jsdom lacks.
vi.mock('@/screens/system/NotificationCenter', () => ({ NotificationBellContainer: () => null }));

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

afterEach(cleanup);

describe('ProjectDashboardRoute — create toast undo', () => {
  it('takes the card off the list when "Hoàn tác" deletes the project just created (BUG-112)', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    queryClient.setQueryData<DashboardProjectList>(queryKeys.project.summaries(), { projects: [CREATED], droppedCount: 0 });
    renderWithProviders(
      <MemoryRouter initialEntries={['/']}>
        <ProjectDashboardRoute />
      </MemoryRouter>,
      { queryClient },
    );
    expect(await screen.findByRole('listitem', { name: CREATED.name })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Dự án mới/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo thử' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Hoàn tác' }));

    expect(undoDelete).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('listitem', { name: CREATED.name })).not.toBeInTheDocument());
  });
});
