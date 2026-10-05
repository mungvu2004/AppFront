import { act, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { HttpError } from '@/lib/http';
import { queryKeys } from '@/lib/query/queryKeys';
import { renderWithProviders } from '@/lib/testing/render';
import type { ProjectRole } from '@/types/project';

import type { DashboardProject, DashboardProjectList, DashboardProjectsGateway } from './projectsGateway';
import {
  useProjectDashboard,
  type ProjectDashboardActions,
  type ProjectDashboardModel,
  type UseProjectDashboardOptions,
} from './useProjectDashboard';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(cleanup);

const NAME_HQ = 'Tòa nhà HQ';

function project(patch: Partial<DashboardProject> = {}): DashboardProject {
  return {
    id: 'prj-1',
    name: NAME_HQ,
    floorCount: 2,
    areaM2: 100,
    status: 'qc',
    wallsReviewedCount: 1,
    wallsTotalCount: 10,
    updatedAtMs: Date.parse('2026-01-01T00:00:00.000Z'),
    members: [],
    planVariant: 0,
    defaultFloorId: 'floor-1',
    ...patch,
  };
}

function httpError(status: number, code: string): HttpError {
  return { kind: 'http', status, code, requestId: 'req-1', retryable: false, raw: {} };
}

interface FakeServer {
  readonly gateway: DashboardProjectsGateway;
  readonly rename: ReturnType<typeof vi.fn<(id: string, name: string) => Promise<void>>>;
  readonly remove: ReturnType<typeof vi.fn<(id: string) => Promise<void>>>;
  /** Deletes a row behind the gateway's back, as the server would. */
  readonly drop: (id: string) => void;
}

/** A server that remembers: a refetch after a write reads what the write left behind. */
function fakeServer(initial: DashboardProject[], droppedCount = 0): FakeServer {
  let rows = initial;
  const rename = vi.fn<(id: string, name: string) => Promise<void>>((id, name) => {
    rows = rows.map((row) => (row.id === id ? { ...row, name } : row));
    return Promise.resolve();
  });
  const remove = vi.fn<(id: string) => Promise<void>>((id) => {
    rows = rows.filter((row) => row.id !== id);
    return Promise.resolve();
  });
  return {
    rename,
    remove,
    drop: (id) => {
      rows = rows.filter((row) => row.id !== id);
    },
    gateway: {
      listSummaries: () => Promise.resolve<DashboardProjectList>({ projects: rows, droppedCount }),
      rename,
      remove,
    },
  };
}

let observed: { model: ProjectDashboardModel; actions: ProjectDashboardActions } | null = null;

function Probe({ options }: { readonly options: UseProjectDashboardOptions }) {
  observed = useProjectDashboard(options);
  return null;
}

function mount(options: UseProjectDashboardOptions) {
  observed = null;
  return renderWithProviders(
    <MemoryRouter>
      <Probe options={options} />
    </MemoryRouter>,
  );
}

function dash() {
  if (observed === null) throw new Error('hook did not run');
  return observed;
}

const names = (): string[] => dash().model.rows.map((row) => row.name);

describe('useProjectDashboard states', () => {
  it('does not say forbidden for a viewer while the list is still loading', () => {
    mount({ role: 'viewer', fetchList: () => new Promise(() => undefined) });

    expect(dash().model.state).toBe('loading');
  });

  it('says forbidden for a viewer once data has arrived, and keeps the rows', async () => {
    mount({ role: 'viewer', gateway: fakeServer([project()]).gateway });

    await waitFor(() => expect(dash().model.state).toBe('forbidden'));
    expect(names()).toEqual([NAME_HQ]);
    expect(dash().model.canDelete).toBe(false);
  });

  it('is partial with a notice when rows were dropped', async () => {
    mount({ gateway: fakeServer([project()], 2).gateway });

    await waitFor(() => expect(dash().model.state).toBe('partial'));
    expect(dash().model.unreadNotice).toBe('Có 2 dự án chưa đọc được');
    expect(names()).toEqual([NAME_HQ]);
  });

  it('is empty only when nothing was read and nothing dropped', async () => {
    mount({ gateway: fakeServer([]).gateway });

    await waitFor(() => expect(dash().model.state).toBe('empty'));
    expect(dash().model.unreadNotice).toBeNull();
    expect(dash().model.canDuplicate).toBe(false);
  });

  it('is error with the error message when the read fails', async () => {
    mount({ fetchList: () => Promise.reject(new Error('mạng hỏng')) });

    await waitFor(() => expect(dash().model.state).toBe('error'));
  });
});

describe('useProjectDashboard navigation', () => {
  it('opens the floors page for a qc project that has no floor yet', async () => {
    const onOpenProject = vi.fn();
    const { defaultFloorId: _unused, ...rest } = project();
    void _unused;
    mount({ gateway: fakeServer([rest]).gateway, onOpenProject });

    await waitFor(() => expect(dash().model.rows).toHaveLength(1));
    act(() => dash().actions.openProject('prj-1', 'card'));

    expect(onOpenProject).toHaveBeenCalledWith('/projects/prj-1/floors');
  });

  it('opens the walls page of the default floor for a qc project', async () => {
    const onOpenProject = vi.fn();
    mount({ gateway: fakeServer([project()]).gateway, onOpenProject });

    await waitFor(() => expect(dash().model.rows).toHaveLength(1));
    act(() => dash().actions.openProject('prj-1', 'card'));

    expect(onOpenProject).toHaveBeenCalledWith(expect.stringContaining('/floors/floor-1/'));
  });
});

const roleEngineer: ProjectRole = 'engineer';

describe('useProjectDashboard rename', () => {
  async function startRename(server: FakeServer, onToast = vi.fn()) {
    mount({ role: roleEngineer, gateway: server.gateway, onToast });
    await waitFor(() => expect(dash().model.rows).toHaveLength(1));
    act(() => dash().actions.startRename('prj-1'));
    return onToast;
  }

  it('shows the new name at once, calls #26, and offers an undo that calls #26 with the old name', async () => {
    const server = fakeServer([project()]);
    const onToast = await startRename(server);

    act(() => dash().actions.setRenameDraft('  Tên mới  '));
    act(() => dash().actions.commitRename());

    await waitFor(() => expect(names()).toEqual(['Tên mới']));
    await waitFor(() => expect(onToast).toHaveBeenCalledTimes(1));
    expect(server.rename).toHaveBeenCalledWith('prj-1', 'Tên mới');
    const toast = onToast.mock.calls[0]?.[0] as { message: string; onUndo?: () => void };
    expect(toast.message).toBe('Đã đổi tên thành "Tên mới"');

    act(() => toast.onUndo?.());
    await waitFor(() => expect(server.rename).toHaveBeenLastCalledWith('prj-1', NAME_HQ));
    await waitFor(() => expect(names()).toEqual([NAME_HQ]));
  });

  it('cancels in-flight summaries reads before the optimistic patch', async () => {
    const server = fakeServer([project()]);
    const { queryClient } = mount({ role: roleEngineer, gateway: server.gateway, onToast: vi.fn() });
    await waitFor(() => expect(dash().model.rows).toHaveLength(1));
    const cancel = vi.spyOn(queryClient, 'cancelQueries');
    act(() => dash().actions.startRename('prj-1'));
    act(() => dash().actions.setRenameDraft('Tên mới'));
    act(() => dash().actions.commitRename());

    expect(cancel).toHaveBeenCalledWith({ queryKey: queryKeys.project.summaries() });
    await waitFor(() => expect(names()).toEqual(['Tên mới']));
  });

  it('puts the old name back and says why when #26 fails', async () => {
    const server = fakeServer([project()]);
    server.rename.mockRejectedValueOnce(httpError(403, 'FORBIDDEN'));
    const onToast = await startRename(server);

    act(() => dash().actions.setRenameDraft('Tên mới'));
    act(() => dash().actions.commitRename());

    await waitFor(() => expect(onToast).toHaveBeenCalledWith({ message: 'Bạn không có quyền đổi tên dự án này.' }));
    expect(names()).toEqual([NAME_HQ]);
  });

  it('falls back to a generic sentence for an unknown code, never printing the code', async () => {
    const server = fakeServer([project()]);
    server.rename.mockRejectedValueOnce(httpError(500, 'SOMETHING_NEW'));
    const onToast = await startRename(server);

    act(() => dash().actions.setRenameDraft('Tên mới'));
    act(() => dash().actions.commitRename());

    await waitFor(() => expect(onToast).toHaveBeenCalledWith({ message: 'Không đổi được tên dự án. Hãy thử lại.' }));
  });

  it('refuses a name outside 3-80 characters without calling the server', async () => {
    const server = fakeServer([project()]);
    const onToast = await startRename(server);

    act(() => dash().actions.setRenameDraft('ab'));
    act(() => dash().actions.commitRename());

    expect(server.rename).not.toHaveBeenCalled();
    expect(onToast).toHaveBeenCalledWith({ message: 'Tên dự án cần từ 3 đến 80 ký tự.' });
    expect(names()).toEqual([NAME_HQ]);
  });
});

describe('useProjectDashboard delete', () => {
  it('removes the row only after #27 succeeded, and shows no undo toast', async () => {
    const server = fakeServer([project()]);
    let finish: () => void = () => undefined;
    server.remove.mockImplementationOnce(() => new Promise<void>((resolve) => {
        finish = () => {
          server.drop('prj-1');
          resolve();
        };
      }));
    const onToast = vi.fn();
    mount({ gateway: server.gateway, onToast });
    await waitFor(() => expect(dash().model.rows).toHaveLength(1));

    act(() => dash().actions.requestDelete('prj-1'));
    act(() => dash().actions.confirmDelete());

    expect(names()).toEqual([NAME_HQ]);
    expect(dash().model.pendingDeleteId).toBe('prj-1');

    await act(async () => {
      finish();
      await Promise.resolve();
    });
    await waitFor(() => expect(dash().model.rows).toHaveLength(0));
    expect(dash().model.pendingDeleteId).toBeNull();
    expect(onToast).not.toHaveBeenCalled();
  });

  it('keeps the dialog and the row, and explains, when #27 fails', async () => {
    const server = fakeServer([project()]);
    server.remove.mockRejectedValueOnce(httpError(500, 'SOMETHING_NEW'));
    mount({ gateway: server.gateway });
    await waitFor(() => expect(dash().model.rows).toHaveLength(1));

    act(() => dash().actions.requestDelete('prj-1'));
    act(() => dash().actions.confirmDelete());

    await waitFor(() => expect(dash().model.deleteErrorMessage).toBe('Không xoá được dự án. Hãy thử lại.'));
    expect(dash().model.pendingDeleteId).toBe('prj-1');
    expect(names()).toEqual([NAME_HQ]);

    act(() => dash().actions.cancelDelete());
    expect(dash().model.deleteErrorMessage).toBeNull();
  });

  it('treats 404 as already deleted', async () => {
    const server = fakeServer([project()]);
    server.remove.mockImplementationOnce(() => {
      server.drop('prj-1');
      return Promise.reject(httpError(404, 'NOT_FOUND'));
    });
    mount({ gateway: server.gateway });
    await waitFor(() => expect(dash().model.rows).toHaveLength(1));

    act(() => dash().actions.requestDelete('prj-1'));
    act(() => dash().actions.confirmDelete());

    await waitFor(() => expect(dash().model.pendingDeleteId).toBeNull());
    expect(dash().model.rows).toHaveLength(0);
  });
});
