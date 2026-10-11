import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { MOCK_NOTIFICATIONS } from '@/api/__mocks__/client';
import { setAuthenticatedSession, setUnknownSession } from '@/lib/auth/state';
import { renderWithProviders } from '@/lib/testing/render';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { SEVEN_STATES } from '@/lib/testing/sevenStateScenarios';

import { ProjectDashboardRoute } from './ProjectDashboard.container';
import { ProjectDashboardView, type ProjectDashboardViewProps } from './ProjectDashboard';
import type { ProjectCardModel } from './useProjectDashboard';
import type * as NotificationGatewayModule from '@/screens/system/NotificationCenter/notificationCenterGateway';
import type { NotificationCenterGateway } from '@/screens/system/NotificationCenter/notificationModel';

// Chuông thật dựng cổng thông báo thật, mà jsdom không có `EventSource` — và ranh
// giới lỗi của chuông sẽ nuốt lỗi ấy, để bài hỏng mà không ai thấy. Khuôn
// `NotificationCenterRoute.test.tsx`.
vi.mock('@/screens/system/NotificationCenter/notificationCenterGateway', async (importActual) => {
  const actual = await importActual<typeof NotificationGatewayModule>();
  const items = MOCK_NOTIFICATIONS.map((wire) => actual.toNotificationItemVm(wire, Date.now()));
  const gateway: NotificationCenterGateway = {
    list: () => Promise.resolve(items),
    markRead: () => Promise.resolve(),
    markAllRead: () => Promise.resolve(),
    acceptInvite: () => Promise.resolve(),
    subscribe: () => () => undefined,
  };

  return { ...actual, createNotificationCenterGateway: () => gateway };
});

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
  name: 'Toà nhà HQ Renovation',
  statsLabel: '4 tầng · 1.860,00 m²',
  updatedLabel: '2 giờ trước',
  statusVariant: 'attention',
  statusLabel: 'Cần QC',
  progressLabel: '30/48 tường đã duyệt',
  progressRatio: 30 / 48,
  progressPercentLabel: '63%',
  members: [{ id: 'm-an', initials: 'PA' }],
  planVariant: 0,
  hasPlan: true,
};

/** Every prop the view takes, at rest — written out so a scenario describes exactly what it changes. */
function baseProps(): ProjectDashboardViewProps {
  return {
    state: 'success',
    canCreate: true,
    canDelete: true,
    canDuplicate: false,
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
    deleteErrorMessage: null,
    isDeleting: false,
    unreadNotice: null,
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
    requestDelete: noop,
    cancelDelete: noop,
    confirmDelete: noop,
    createProject: noop,
    retryLoad: noop,
    duplicateProject: noop,
  };
}

const PROPS_BY_STATE: Readonly<Record<(typeof SEVEN_STATES)[number], () => ProjectDashboardViewProps>> = {
  empty: () => ({ ...baseProps(), state: 'empty', rows: [] }),
  loading: () => ({ ...baseProps(), state: 'loading', rows: [] }),
  partial: () => ({ ...baseProps(), state: 'partial', rows: [], searchQuery: 'không tồn tại', statusCounts: { all: 1, processing: 0, qc: 1, done: 0 } }),
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

  // B-V3-01: the sr-only status used to read the raw key ("success") aloud — the one
  // screen of 49 that never ran `expectVietnamese` (questions.md Q10h).
  it.each(SEVEN_STATES)('says its state in Vietnamese to a screen reader — %s (A6)', (state) => {
    const { container } = render(<ProjectDashboardView {...PROPS_BY_STATE[state]()} />);

    expect(screen.getAllByRole('status').map((node) => node.textContent)).not.toContain(state);
    // The sample project's own name is user data, not product copy.
    expectVietnamese(container, { ignore: [SAMPLE_ROW.name] });
  });

  // B-V3-03: the in-place rename field had no accessible name — a screen reader
  // announced a bare "edit text" with no hint of which project it renames.
  it.each(['grid', 'table'] as const)('names the in-place rename field after its project — %s view', (viewMode) => {
    render(<ProjectDashboardView {...PROPS_BY_STATE.success()} viewMode={viewMode} renamingId={SAMPLE_ROW.id} />);

    expect(screen.getByRole('textbox', { name: `Đổi tên ${SAMPLE_ROW.name}` })).toBeInTheDocument();
  });

  it('shows skeletons rather than an empty grid while loading', () => {
    render(<ProjectDashboardView {...PROPS_BY_STATE.loading()} />);

    expect(screen.queryByText('Chưa có dự án nào')).not.toBeInTheDocument();
  });

  it('teaches, with a create button, when there has never been a project', () => {
    render(<ProjectDashboardView {...PROPS_BY_STATE.empty()} />);

    expect(screen.getByText('Tạo dự án đầu tiên để bắt đầu số hoá bản vẽ.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo dự án mới' })).toBeInTheDocument();
  });

  // QA-01 debt #10: a viewer cannot create, so the empty state must not tell them to.
  it('tells a role without create rights to wait for an invitation, not to create', () => {
    render(<ProjectDashboardView {...PROPS_BY_STATE.empty()} canCreate={false} />);

    expect(screen.queryByText('Tạo dự án đầu tiên để bắt đầu số hoá bản vẽ.')).not.toBeInTheDocument();
    expect(screen.getByText('Bạn chưa được thêm vào dự án nào. Khi được mời, dự án sẽ hiện ở đây.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tạo dự án mới' })).not.toBeInTheDocument();
  });

  it('offers to clear filters when a search matches nothing', () => {
    render(<ProjectDashboardView {...PROPS_BY_STATE.partial()} />);

    expect(screen.getByText('Không tìm thấy dự án phù hợp')).toBeInTheDocument();
  });

  // BUG-117: dropping the count line on a no-match search made the stats column jump up.
  it('keeps the "{n} dự án" line when a search matches nothing, and drops it only while loading', () => {
    const { rerender } = render(<ProjectDashboardView {...PROPS_BY_STATE.partial()} />);
    expect(screen.getByText('0 dự án')).toBeInTheDocument();

    rerender(<ProjectDashboardView {...PROPS_BY_STATE.loading()} />);
    expect(screen.queryByText(/^\d+ dự án$/u)).not.toBeInTheDocument();
  });

  // BUG-111: below 1024 px the state is `collapsed`, never `partial`; the no-match state used to hang on `partial`.
  it('offers to clear filters, not to create, when nothing matches below 1024 px', () => {
    render(<ProjectDashboardView {...PROPS_BY_STATE.partial()} state="collapsed" statusFilter="done" searchQuery="" />);

    expect(screen.getByText('Không tìm thấy dự án phù hợp')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xoá bộ lọc' })).toBeInTheDocument();
    expect(screen.queryByText('Chưa có dự án nào')).not.toBeInTheDocument();
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
    expect(screen.getByText('Toà nhà HQ Renovation')).toBeInTheDocument();
  });

  it('never colours a card verified unless the caller already resolved that (A5/A-constraint)', () => {
    render(
      <ProjectDashboardView
        {...PROPS_BY_STATE.success()}
        rows={[{ ...SAMPLE_ROW, statusVariant: 'attention', statusLabel: 'Cần QC', progressLabel: '30/48 tường đã duyệt' }]}
      />,
    );

    expect(screen.queryByText('hoàn thành')).not.toBeInTheDocument();
    expect(screen.getAllByText('Cần QC').length).toBeGreaterThan(0);
  });

  it('opens a project on Enter, from the keyboard alone', () => {
    const openProject = vi.fn();
    render(<ProjectDashboardView {...PROPS_BY_STATE.success()} openProject={openProject} />);

    const card = screen.getByRole('listitem', { name: SAMPLE_ROW.name });
    card.focus();
    fireEvent.keyDown(card, { key: 'Enter' });

    expect(openProject).toHaveBeenCalledWith(SAMPLE_ROW.id, 'card');
  });

  // BUG-147: Enter on the menu button bubbled to the card and opened the project.
  it('leaves Enter on the card menu button to that button', () => {
    const openProject = vi.fn();
    render(<ProjectDashboardView {...PROPS_BY_STATE.success()} openProject={openProject} />);

    fireEvent.keyDown(screen.getByRole('button', { name: `Tuỳ chọn cho ${SAMPLE_ROW.name}` }), { key: 'Enter' });

    expect(openProject).not.toHaveBeenCalled();
  });

  // BUG-119: a project with no traced plan drew a made-up floor plan with rooms.
  it('shows a placeholder instead of a plan outline until the project has a traced plan', () => {
    render(<ProjectDashboardView {...PROPS_BY_STATE.success()} rows={[{ ...SAMPLE_ROW, hasPlan: false }]} />);

    const card = screen.getByRole('listitem', { name: SAMPLE_ROW.name });
    expect(within(card).getByText('Chưa có mặt bằng')).toBeInTheDocument();
    expect(within(card).queryByRole('img', { name: 'Sơ đồ mặt bằng' })).not.toBeInTheDocument();
  });

  // BUG-119/157: a 730 px hero card, two 340 px side cards and a grid below drew three card widths on one screen.
  it('lays every card out in one grid, at one size', () => {
    const rows = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ ...SAMPLE_ROW, id, name: `Dự án ${id}` }));
    render(<ProjectDashboardView {...PROPS_BY_STATE.success()} rows={rows} />);

    const list = screen.getByRole('list', { name: 'Danh sách dự án' });
    const cards = within(list).getAllByRole('listitem');
    expect(cards).toHaveLength(rows.length);
    for (const card of cards) {
      expect(card.parentElement).toBe(list);
      expect(card.className).toBe(cards[0]?.className);
      expect(card.firstElementChild?.className).toContain('h-[132px]');
    }
  });

  // BUG-199: the 44 px rename field replaced a ~22 px title, so the card grew 16 px at 375 (2 px at 1440).
  it('gives the card title and its rename field the same box, so renaming does not move the card', () => {
    const heightClasses = (element: HTMLElement): string[] => element.className.split(' ').filter((name) => /(^|:)h-/u.test(name));
    const { rerender } = render(<ProjectDashboardView {...PROPS_BY_STATE.success()} />);
    const title = heightClasses(screen.getByRole('heading', { name: SAMPLE_ROW.name }));

    rerender(<ProjectDashboardView {...PROPS_BY_STATE.success()} renamingId={SAMPLE_ROW.id} />);

    expect(title).toEqual(['h-11', 'sm:h-6']);
    expect(heightClasses(screen.getByRole('textbox', { name: `Đổi tên ${SAMPLE_ROW.name}` }))).toEqual(title);
  });

  // BUG-153: at 375 px three columns left the name 98 px; below `sm` the row now stacks instead of hiding cells.
  it('keeps status, progress and update time in the table below `sm`, stacked under a name cell of its own', () => {
    render(<ProjectDashboardView {...PROPS_BY_STATE.success()} viewMode="table" />);

    const cells = within(screen.getByRole('row', { name: new RegExp(SAMPLE_ROW.name, 'u') })).getAllByRole('cell');
    expect(cells[0]?.textContent).toBe(SAMPLE_ROW.name);
    const shownBelowSm = cells.filter((cell) => !cell.className.split(' ').includes('hidden')).map((cell) => cell.textContent);
    // review-1 #19: the header row is hidden below `sm`, so each stacked cell names its column (sr-only, `sm:hidden`).
    expect(shownBelowSm).toEqual([
      SAMPLE_ROW.name,
      `Trạng thái: ${SAMPLE_ROW.statusLabel}`,
      `Tiến độ duyệt: ${SAMPLE_ROW.progressLabel}`,
      `Cập nhật: ${SAMPLE_ROW.updatedLabel}`,
    ]);
    expect(within(cells[1] as HTMLElement).getByText('Trạng thái:', { exact: false })).toHaveClass('sr-only', 'sm:hidden');
    expect(cells[0]?.closest('tr')?.className).toContain('max-sm:flex-wrap');
  });

  // Rename in the stacked table row (< sm): the 44 px field replaced a 20 px name, so the row grew 24 px.
  // ND-R3: at >= sm a 2-line name (43 px row) swapped for a 1-line field (40 px row) shrank the row 3 px.
  it('keeps the table name box while renaming, at every width: the field overlays it', () => {
    const { rerender } = render(<ProjectDashboardView {...PROPS_BY_STATE.success()} viewMode="table" />);
    expect(screen.getByRole('heading', { name: SAMPLE_ROW.name }).className).toContain('max-sm:leading-8');
    // The narrow name column at 1024 px cut "E2E-QA-20261011-0028" to "E2E-QA-202…": the name wraps to two lines first.
    expect(screen.getByRole('heading', { name: SAMPLE_ROW.name })).toHaveClass('line-clamp-2', 'whitespace-normal', 'break-words');
    expect(screen.getByRole('heading', { name: SAMPLE_ROW.name })).not.toHaveClass('truncate');

    rerender(<ProjectDashboardView {...PROPS_BY_STATE.success()} viewMode="table" renamingId={SAMPLE_ROW.id} />);
    const field = screen.getByRole('textbox', { name: `Đổi tên ${SAMPLE_ROW.name}` });
    const box = document.querySelector('tbody h3');
    expect(box).toHaveClass('invisible', 'line-clamp-2', 'max-sm:line-clamp-1', 'max-sm:leading-8');
    expect(box).toHaveAttribute('aria-hidden', 'true');
    expect(field).toHaveClass('absolute', 'inset-0');
    // A 1-line name at >= sm is a 20 px box; the field reaches 2 px past it each way, so 24 px (WCAG 2.5.8) inside the 40 px row.
    expect(field).toHaveClass('sm:-inset-y-0.5');
    expect(field.className.split(' ').filter((name) => /(^|:)h-/u.test(name))).toEqual([]);
    expect(field.parentElement).toBe(box?.parentElement);
    expect(field.parentElement).toHaveClass('relative');
  });

  // BUG-211: the menu kept the spot read at open; narrowing the window moved the card under it.
  it('closes the card menu when the window width changes, not when only the height does', () => {
    const setViewport = (clientWidth: number, clientHeight: number): void => {
      for (const [key, value] of Object.entries({ clientWidth, clientHeight })) {
        Object.defineProperty(document.documentElement, key, { configurable: true, value });
      }
    };
    setViewport(1440, 900);
    try {
      render(<ProjectDashboardView {...PROPS_BY_STATE.success()} />);
      fireEvent.click(screen.getByRole('button', { name: `Tuỳ chọn cho ${SAMPLE_ROW.name}` }));
      expect(screen.getByRole('menu', { name: 'Tuỳ chọn' })).toBeInTheDocument();

      setViewport(1440, 700);
      fireEvent(window, new Event('resize'));
      expect(screen.getByRole('menu', { name: 'Tuỳ chọn' })).toBeInTheDocument();

      setViewport(900, 700);
      fireEvent(window, new Event('resize'));
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    } finally {
      for (const key of ['clientWidth', 'clientHeight']) Reflect.deleteProperty(document.documentElement, key);
    }
  });

  // BUG-116/148: the menu opened where the pointer was (over its own button) or, from the keyboard, at 0,0.
  it('anchors the card menu under its button and gives focus back to it on Esc', async () => {
    const viewport = { clientWidth: 1440, clientHeight: 900 };
    for (const [key, value] of Object.entries(viewport)) {
      Object.defineProperty(document.documentElement, key, { configurable: true, value });
    }
    try {
      render(<ProjectDashboardView {...PROPS_BY_STATE.success()} />);
      const trigger = screen.getByRole('button', { name: `Tuỳ chọn cho ${SAMPLE_ROW.name}` });
      vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(new DOMRect(600, 100, 32, 32));

      trigger.focus();
      fireEvent.click(trigger, { clientX: 0, clientY: 0 });
      const menu = screen.getByRole('menu', { name: 'Tuỳ chọn' });

      expect(menu.style.left).toBe(`${String(632 - 220)}px`);
      expect(menu.style.top).toBe('136px');
      await waitFor(() => expect(within(menu).getAllByRole('menuitem')[0]).toHaveFocus());

      fireEvent.keyDown(menu, { key: 'Escape' });

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    } finally {
      for (const key of Object.keys(viewport)) Reflect.deleteProperty(document.documentElement, key);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* ProjectDashboardRoute — the wiring R-73 exists for.                         */
/* -------------------------------------------------------------------------- */

describe('ProjectDashboardRoute', () => {
  it('opens "Tạo dự án mới" from its own button — the callback R-73 was written about', async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={['/']}>
        <ProjectDashboardRoute />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: /Dự án mới/ })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Dự án mới/ }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Tạo dự án mới')).toBeInTheDocument();
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

  it('bấm chuông "Thông báo" mở tấm trượt thông báo (B-V3-08)', async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={['/']}>
        <ProjectDashboardRoute />
      </MemoryRouter>,
    );

    const bell = await screen.findByRole('button', { name: 'Thông báo' });
    expect(bell).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(bell);

    expect(await screen.findByRole('dialog', { name: 'Thông báo' })).toBeInTheDocument();
    expect(bell).toHaveAttribute('aria-expanded', 'true');
  });

  // BUG-031: the account avatar was an empty circle — nothing said who is signed in.
  it('vẽ chữ viết tắt của người đang đăng nhập lên avatar tài khoản', async () => {
    setAuthenticatedSession({ accessToken: 't', expiresAt: Date.now() + 3_600_000, roles: [], user: { id: 'u', name: 'Nguyễn Thu Hà' } });
    try {
      renderWithProviders(
        <MemoryRouter initialEntries={['/']}>
          <ProjectDashboardRoute />
        </MemoryRouter>,
      );

      expect(await screen.findByLabelText('Tài khoản của bạn')).toHaveTextContent('NH');
    } finally {
      setUnknownSession();
    }
  });

  it('tên rỗng thì lấy chữ viết tắt từ email, không để avatar trống', async () => {
    setAuthenticatedSession({
      accessToken: 't',
      expiresAt: Date.now() + 3_600_000,
      roles: [],
      user: { id: 'u', name: '', email: 'thuha@example.com' },
    });
    try {
      renderWithProviders(
        <MemoryRouter initialEntries={['/']}>
          <ProjectDashboardRoute />
        </MemoryRouter>,
      );

      expect(await screen.findByLabelText('Tài khoản của bạn')).toHaveTextContent('TH');
    } finally {
      setUnknownSession();
    }
  });
});

describe('ProjectDashboardView — F-07', () => {
  it('vẽ dải "chưa đọc được" trên lưới khi có dòng hỏng', () => {
    render(<ProjectDashboardView {...baseProps()} state="partial" rows={[SAMPLE_ROW]} unreadNotice="Có 2 dự án chưa đọc được" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Có 2 dự án chưa đọc được');
    expect(screen.getByText(SAMPLE_ROW.name)).toBeInTheDocument();
  });

  it('giữ hộp thoại xoá và hiện câu lỗi trong hộp khi xoá hỏng', () => {
    render(
      <ProjectDashboardView
        {...baseProps()}
        rows={[SAMPLE_ROW]}
        pendingDeleteId={SAMPLE_ROW.id}
        pendingDeleteName={SAMPLE_ROW.name}
        deleteErrorMessage="Không xoá được dự án. Hãy thử lại."
      />,
    );

    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('Không xoá được dự án');
  });

  // BUG-195: an 80-char name with no space ran out of the sentence and scrolled the dialog body sideways at 375 px.
  it('wraps a long unbroken name inside the delete sentence', () => {
    const name = 'X'.repeat(80);
    render(<ProjectDashboardView {...baseProps()} rows={[SAMPLE_ROW]} pendingDeleteId={SAMPLE_ROW.id} pendingDeleteName={name} />);

    const sentence = within(screen.getByRole('dialog')).getByText(new RegExp(name, 'u'));
    expect(sentence.closest('.break-words')).not.toBeNull();
  });

  it('không có "Nhân bản" trong menu của dự án', () => {
    render(<ProjectDashboardView {...baseProps()} rows={[SAMPLE_ROW]} />);

    fireEvent.click(screen.getByRole('button', { name: `Tuỳ chọn cho ${SAMPLE_ROW.name}` }));

    expect(screen.getByRole('menuitem', { name: 'Đổi tên' })).toBeInTheDocument();
    expect(screen.queryByText('Nhân bản')).not.toBeInTheDocument();
  });

  it('khoá "Đổi tên" của người không sửa được', () => {
    render(<ProjectDashboardView {...baseProps()} rows={[SAMPLE_ROW]} canDelete={false} />);

    fireEvent.click(screen.getByRole('button', { name: `Tuỳ chọn cho ${SAMPLE_ROW.name}` }));

    expect(screen.getByRole('menuitem', { name: 'Đổi tên' })).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('ProjectDashboardView — khe chuông', () => {
  it('không ai cắm chuông thì không vẽ nút "Thông báo" chết nào (A2, B-V3-08)', () => {
    render(<MemoryRouter><ProjectDashboardView {...baseProps()} /></MemoryRouter>);

    expect(screen.queryAllByRole('button', { name: 'Thông báo' })).toHaveLength(0);
  });
});
