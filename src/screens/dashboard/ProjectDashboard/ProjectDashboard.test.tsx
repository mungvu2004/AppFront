import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { renderWithProviders } from '@/lib/testing/render';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { SEVEN_STATES } from '@/lib/testing/sevenStateScenarios';

import { ProjectDashboardRoute } from './ProjectDashboard.container';
import { ProjectDashboardView, type ProjectDashboardViewProps } from './ProjectDashboard';
import type { ProjectCardModel } from './useProjectDashboard';

// jsdom has no matchMedia; matches: false renders the desktop layout, the one
// `ProjectDashboardRoute` (real hook, real viewport probe) needs below.
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

afterEach(() => {
  cleanup();
});

const noop = (): void => undefined;

const SAMPLE_ROW: ProjectCardModel = {
  id: 'p-hq-renovation',
  name: 'Tòa nhà HQ Renovation',
  statsLabel: '4 tầng · 1.860,00 m²',
  updatedLabel: '2 giờ trước',
  statusVariant: 'attention',
  statusLabel: 'cần QC',
  progressLabel: '30/48 tường đã duyệt',
  progressRatio: 30 / 48,
  progressPercentLabel: '63%',
  members: [{ id: 'm-an', initials: 'PA' }],
  planVariant: 0,
};

/** Every prop the view takes, at rest — written out so a scenario describes exactly what it changes. */
function baseProps(): ProjectDashboardViewProps {
  return {
    state: 'success',
    canCreate: true,
    canDelete: true,
    errorMessage: null,
    viewMode: 'grid',
    searchQuery: '',
    statusFilter: 'all',
    sortBy: 'updated',
    statusCounts: { all: 0, processing: 0, qc: 0, done: 0 },
    pulseKey: 0,
    shouldStagger: false,
    rows: [],
    renamingId: null,
    renameDraft: '',
    pendingDeleteId: null,
    pendingDeleteName: null,
    setSearchQuery: noop,
    setStatusFilter: noop,
    setSortBy: noop,
    setViewMode: noop,
    clearFilters: noop,
    openProject: noop,
    startRename: noop,
    setRenameDraft: noop,
    commitRename: noop,
    cancelRename: noop,
    duplicateProject: noop,
    requestDelete: noop,
    cancelDelete: noop,
    confirmDelete: noop,
    createProject: noop,
    retryLoad: noop,
    onCardPointerEnter: noop,
    onCardPointerLeave: noop,
  };
}

const PROPS_BY_STATE: Readonly<Record<(typeof SEVEN_STATES)[number], () => ProjectDashboardViewProps>> = {
  empty: () => ({ ...baseProps(), state: 'empty', rows: [] }),
  loading: () => ({ ...baseProps(), state: 'loading', rows: [] }),
  partial: () => ({ ...baseProps(), state: 'partial', rows: [], searchQuery: 'không tồn tại' }),
  error: () => ({ ...baseProps(), state: 'error', errorMessage: 'không kết nối được máy chủ' }),
  success: () => ({ ...baseProps(), state: 'success', rows: [SAMPLE_ROW] }),
  forbidden: () => ({ ...baseProps(), state: 'forbidden', canCreate: false, canDelete: false, rows: [SAMPLE_ROW] }),
  collapsed: () => ({ ...baseProps(), state: 'collapsed', rows: [SAMPLE_ROW] }),
};

describe('ProjectDashboardView, seven states', () => {
  it('renders something for every one of the seven', () => {
    expectSevenStates(
      (scenario) => render(<ProjectDashboardView {...PROPS_BY_STATE[scenario.state]()} />),
      SEVEN_STATES.map((state) => ({
        state,
        label: state,
        rows: [],
        totalCount: 0,
        isLoading: false,
        isCollapsed: false,
        canView: true,
        error: null,
      })),
    );
  });

  it('shows skeletons rather than an empty grid while loading', () => {
    render(<ProjectDashboardView {...PROPS_BY_STATE.loading()} />);

    expect(screen.queryByText('Chưa có dự án nào')).not.toBeInTheDocument();
  });

  it('teaches, with a create button, when there has never been a project', () => {
    render(<ProjectDashboardView {...PROPS_BY_STATE.empty()} />);

    expect(screen.getByText('Chưa có dự án nào. Tạo dự án đầu tiên để bắt đầu số hoá bản vẽ.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo dự án mới' })).toBeInTheDocument();
  });

  it('offers to clear filters when a search matches nothing', () => {
    render(<ProjectDashboardView {...PROPS_BY_STATE.partial()} />);

    expect(screen.getByText('Không tìm thấy dự án phù hợp')).toBeInTheDocument();
  });

  it('offers a retry when the list could not be loaded', () => {
    const retryLoad = vi.fn();
    render(<ProjectDashboardView {...PROPS_BY_STATE.error()} retryLoad={retryLoad} />);

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(retryLoad).toHaveBeenCalledTimes(1);
  });

  it('hides "Dự án mới" for a viewer, and keeps the grid', () => {
    render(<ProjectDashboardView {...PROPS_BY_STATE.forbidden()} />);

    expect(screen.queryByRole('button', { name: /Dự án mới/ })).not.toBeInTheDocument();
    expect(screen.getByText('Tòa nhà HQ Renovation')).toBeInTheDocument();
  });

  it('never colours a card verified unless the caller already resolved that (A5/A-constraint)', () => {
    render(
      <ProjectDashboardView
        {...PROPS_BY_STATE.success()}
        rows={[{ ...SAMPLE_ROW, statusVariant: 'attention', statusLabel: 'cần QC', progressLabel: '30/48 tường đã duyệt' }]}
      />,
    );

    expect(screen.queryByText('hoàn thành')).not.toBeInTheDocument();
    expect(screen.getByText('cần QC')).toBeInTheDocument();
  });

  it('opens a project on Enter, from the keyboard alone', () => {
    const openProject = vi.fn();
    render(<ProjectDashboardView {...PROPS_BY_STATE.success()} openProject={openProject} />);

    const card = screen.getByRole('listitem', { name: SAMPLE_ROW.name });
    card.focus();
    fireEvent.keyDown(card, { key: 'Enter' });

    expect(openProject).toHaveBeenCalledWith(SAMPLE_ROW.id, 'card');
  });
});

/* -------------------------------------------------------------------------- */
/* ProjectDashboardRoute — the wiring R-73 exists for.                         */
/* -------------------------------------------------------------------------- */

describe('ProjectDashboardRoute', () => {
  it('opens "tạo dự án mới" from its own button — the callback R-73 was written about', async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={['/']}>
        <ProjectDashboardRoute />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: /Dự án mới/ })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Dự án mới/ }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('tạo dự án mới')).toBeInTheDocument();
  });

  it('shares one toast stack between the dashboard and the dialog it opens', async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={['/']}>
        <ProjectDashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Dự án mới/ }));
    await screen.findByRole('dialog');

    // Two independent `Toast.Provider`s would each draw their own
    // `role="region", aria-label="Thông báo"` — exactly one means this file's
    // `DashboardWithCreateModal` really did share a single provider.
    expect(screen.getAllByRole('region', { name: 'Thông báo' })).toHaveLength(1);
  });
});
