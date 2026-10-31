import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { MOCK_NOTIFICATIONS } from '@/api/__mocks__/client';
import { setAuthenticatedSession, setUnknownSession } from '@/lib/auth/state';
import { renderWithProviders } from '@/lib/testing/render';
import { AppLayout } from '@/routes/AppLayout';
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
/** Chuông và avatar nằm ở header chung (`AppLayout`), không còn trong màn danh sách. */
function renderDashboardInLayout() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<ProjectDashboardRoute />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

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
  window.sessionStorage.clear();
});

const noop = (): void => undefined;

const SAMPLE_ROW: ProjectCardModel = {
  id: 'p-hq-renovation',
  name: 'Toà nhà HQ Renovation',
  statsLabel: '4 tầng · 1.860,00 m²',
  updatedLabel: '2 giờ trước',
  statusVariant: 'attention',
  statusLabel: 'Cần duyệt',
  progressLabel: '30/48 tường đã duyệt',
  progressRatio: 30 / 48,
  progressPercentLabel: '63%',
  members: [{ id: 'm-an', initials: 'PA' }],
  planVariant: 0,
  hasPlan: true,
  actionLabel: 'Duyệt tường',
};

/** Every prop the view takes, at rest — written out so a scenario describes exactly what it changes. */
function baseProps(): ProjectDashboardViewProps {
  return {
    state: 'success',
    canCreate: true,
    canDelete: true,
    canDeleteProject: true,
    canDuplicate: false,
    errorMessage: null,
    canRetry: true,
    viewMode: 'grid',
    searchQuery: '',
    statusFilter: 'all',
    sortBy: 'updated',
    totalProjects: 0, statusCounts: { all: 0, noplan: 0, processing: 0, qc: 0, done: 0 },
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
    openProjectViewer: noop,
    openProjectPage: noop,
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
  partial: () => ({ ...baseProps(), state: 'partial', rows: [], searchQuery: 'không tồn tại', totalProjects: 1, statusCounts: { all: 1, noplan: 0, processing: 0, qc: 1, done: 0 } }),
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

  // BUG-228: the skeleton had no filter strip and no status line, so the page jumped when the list landed.
  it('holds the filter strip, the toolbar and the status line while loading', () => {
    const { container } = render(<ProjectDashboardView {...PROPS_BY_STATE.loading()} />);
    const placeholders = [...container.querySelectorAll('[aria-hidden="true"]')].map((element) => element.className);

    expect(placeholders.some((name) => name.includes('h-[22px]'))).toBe(true);
    expect(screen.getByRole('radiogroup', { name: 'Lọc theo trạng thái' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Tìm dự án' })).toBeInTheDocument();
  });

  // S-02: the page says what it is for with a verb, and holds one primary action.
  it('titles the page with a verb and offers one primary "Tạo dự án"', () => {
    render(<ProjectDashboardView {...PROPS_BY_STATE.success()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Chọn dự án để làm tiếp' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Tạo dự án/u })).toHaveLength(1);
  });

  // The create button is the page head's one primary action; the empty body only teaches (no second button).
  it('teaches, with the create button in the head, when there has never been a project', () => {
    render(<ProjectDashboardView {...PROPS_BY_STATE.empty()} />);

    expect(screen.getByText('Tạo dự án đầu tiên để bắt đầu số hoá bản vẽ.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Tạo dự án/u })).toHaveLength(1);
  });

  // QA-01 debt #10: a viewer cannot create, so the empty state must not tell them to.
  it('tells a role without create rights to wait for an invitation, not to create', () => {
    render(<ProjectDashboardView {...PROPS_BY_STATE.empty()} canCreate={false} />);

    expect(screen.queryByText('Tạo dự án đầu tiên để bắt đầu số hoá bản vẽ.')).not.toBeInTheDocument();
    expect(screen.getByText('Bạn chưa được thêm vào dự án nào. Khi được mời, dự án sẽ hiện ở đây.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Tạo dự án/u })).not.toBeInTheDocument();
  });

  it('offers to clear filters when a search matches nothing', () => {
    render(<ProjectDashboardView {...PROPS_BY_STATE.partial()} />);

    expect(screen.getByText('Không tìm thấy dự án phù hợp')).toBeInTheDocument();
  });

  // BUG-117: dropping the count line on a no-match search made the head jump up.
  it('says how many projects match when a search matches nothing, and drops the line only while loading', () => {
    const { rerender } = render(<ProjectDashboardView {...PROPS_BY_STATE.partial()} />);
    expect(screen.getByText('0/1 dự án khớp tìm kiếm và bộ lọc')).toBeInTheDocument();

    rerender(<ProjectDashboardView {...PROPS_BY_STATE.loading()} />);
    expect(screen.queryByText(/dự án khớp|^\d+ dự án$/u)).not.toBeInTheDocument();
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

  it('offers no retry when the list is forbidden: a second read would be refused just the same', () => {
    render(<ProjectDashboardView {...PROPS_BY_STATE.error()} canRetry={false} />);

    expect(screen.getByText('Không tải được danh sách dự án')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument();
  });

  it('hides "Tạo dự án" for a viewer, and keeps the grid', () => {
    render(<ProjectDashboardView {...PROPS_BY_STATE.forbidden()} />);

    expect(screen.queryByRole('button', { name: /Tạo dự án/u })).not.toBeInTheDocument();
    expect(screen.getByText('Toà nhà HQ Renovation')).toBeInTheDocument();
  });

  it('[9P-B-001] forbidden state shows the viewer role line; [9P-B-002] loading does not', () => {
    const forbidden = render(<ProjectDashboardView {...PROPS_BY_STATE.forbidden()} />);
    expect(screen.getByText(/Vai người xem/u)).toBeInTheDocument();
    forbidden.unmount();
    render(<ProjectDashboardView {...PROPS_BY_STATE.loading()} canCreate={false} />);
    expect(screen.queryByText(/Vai người xem/u)).not.toBeInTheDocument();
  });

  // [9P-F-001] FL-9P-U1: at 768 px the state is `collapsed`, which used to hide the viewer's role line.
  it('[9P-F-001] shows the viewer role line in the collapsed (narrow) state too', () => {
    render(<ProjectDashboardView {...PROPS_BY_STATE.collapsed()} canCreate={false} canDelete={false} />);

    expect(screen.getByText(/Vai người xem/u)).toBeInTheDocument();
  });

  it('[9P-F-001] collapsed with create rights shows no viewer role line', () => {
    render(<ProjectDashboardView {...PROPS_BY_STATE.collapsed()} />);

    expect(screen.queryByText(/Vai người xem/u)).not.toBeInTheDocument();
  });

  it('never colours a card verified unless the caller already resolved that (A5/A-constraint)', () => {
    render(
      <ProjectDashboardView
        {...PROPS_BY_STATE.success()}
        rows={[{ ...SAMPLE_ROW, statusVariant: 'attention', statusLabel: 'Cần duyệt', progressLabel: '30/48 tường đã duyệt' }]}
      />,
    );

    expect(screen.queryByText('hoàn thành')).not.toBeInTheDocument();
    expect(screen.getAllByText('Cần duyệt').length).toBeGreaterThan(0);
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
    expect(within(card).getByText('Chưa có bản vẽ')).toBeInTheDocument();
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

    expect(title).toEqual(['h-11', 'fine:h-6']);
    expect(heightClasses(screen.getByRole('textbox', { name: `Đổi tên ${SAMPLE_ROW.name}` }))).toEqual(title);
  });

  // BUG-153: at 375 px three columns left the name 98 px; below `sm` the row now stacks instead of hiding cells.
  it('keeps status, progress and update time in the table below `sm`, stacked under a name cell of its own', () => {
    render(<ProjectDashboardView {...PROPS_BY_STATE.success()} viewMode="table" />);

    const cells = within(screen.getByRole('row', { name: new RegExp(SAMPLE_ROW.name, 'u') })).getAllByRole('cell');
    expect(cells[0]?.textContent).toBe(SAMPLE_ROW.name);
    // Ô cuối là nút việc tiếp ("Duyệt tường") và "…", không có chữ cột.
    const shownBelowSm = cells.slice(0, -1).filter((cell) => !cell.className.split(' ').includes('hidden')).map((cell) => cell.textContent);
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
    // A1 P1: at 1024 px the name column broke names mid-word; it is now >= 16rem, one line, full name in `title`.
    expect(screen.getByRole('heading', { name: SAMPLE_ROW.name })).toHaveClass('truncate');
    expect(screen.getByRole('heading', { name: SAMPLE_ROW.name })).toHaveAttribute('title', SAMPLE_ROW.name);
    expect(screen.getByRole('heading', { name: SAMPLE_ROW.name }).closest('td')).toHaveClass('min-w-[16rem]');

    rerender(<ProjectDashboardView {...PROPS_BY_STATE.success()} viewMode="table" renamingId={SAMPLE_ROW.id} />);
    const field = screen.getByRole('textbox', { name: `Đổi tên ${SAMPLE_ROW.name}` });
    const box = document.querySelector('tbody h3');
    expect(box).toHaveClass('invisible', 'truncate', 'max-sm:line-clamp-1', 'max-sm:leading-8');
    expect(box).toHaveAttribute('aria-hidden', 'true');
    expect(field).toHaveClass('absolute', 'inset-0');
    // A 1-line name at >= sm is a 20 px box; the field reaches 2 px past it each way, so 24 px (WCAG 2.5.8) inside the 40 px row.
    expect(field).toHaveClass('sm:-inset-y-0.5');
    expect(field.className.split(' ').filter((name) => /(^|:)h-/u.test(name))).toEqual([]);
    expect(field.parentElement).toBe(box?.parentElement);
    expect(field.parentElement).toHaveClass('relative');
  });

  // BUG-211: the menu kept the spot read at open; narrowing the window moved the card under it. QA-02b closed it
  // instead, which lost the menu; it now stays open and moves with its button.
  it('keeps the card menu open under its button when the layout moves the button', async () => {
    for (const [key, value] of Object.entries({ clientWidth: 1440, clientHeight: 900 })) {
      Object.defineProperty(document.documentElement, key, { configurable: true, value });
    }
    try {
      render(<ProjectDashboardView {...PROPS_BY_STATE.success()} />);
      const trigger = screen.getByRole('button', { name: `Tuỳ chọn cho ${SAMPLE_ROW.name}` });
      const rect = vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(new DOMRect(600, 100, 32, 32));
      trigger.focus();
      fireEvent.click(trigger);
      const menu = screen.getByRole('menu', { name: 'Tuỳ chọn' });
      expect([menu.style.left, menu.style.top]).toEqual(['412px', '136px']);

      // 1440 -> 900: the card drops 60 px and moves 240 px left.
      rect.mockReturnValue(new DOMRect(360, 160, 32, 32));
      await waitFor(() => expect([menu.style.left, menu.style.top]).toEqual(['172px', '196px']));
      expect(screen.getByRole('menu', { name: 'Tuỳ chọn' })).toBe(menu);
    } finally {
      for (const key of ['clientWidth', 'clientHeight']) Reflect.deleteProperty(document.documentElement, key);
    }
  });

  // BUG-118 / vòng 7: a count shown in two places reads as two sets of numbers. It lives in the head's status
  // line only; the filter carries no counts.
  it('shows the status counts once, in the head, not on the filter', () => {
    const counts = { all: 5, noplan: 1, processing: 1, qc: 3, done: 0 };
    render(<ProjectDashboardView {...PROPS_BY_STATE.success()} totalProjects={5} statusCounts={counts} />);

    expect(screen.getByText('3 dự án cần duyệt')).toBeInTheDocument();
    expect(screen.getByText('5 dự án')).toBeInTheDocument();
    const filter = screen.getByRole('radiogroup', { name: 'Lọc theo trạng thái' });
    expect(within(filter).getAllByRole('radio')).toHaveLength(5);
    expect(filter.textContent).not.toMatch(/\d/u);
  });

  it('U37: a viewer is not nudged to review, nor told every project is reviewed', () => {
    const counts = { all: 5, noplan: 1, processing: 1, qc: 3, done: 1 };
    render(<ProjectDashboardView {...PROPS_BY_STATE.success()} canCreate={false} totalProjects={5} statusCounts={counts} />);

    expect(screen.queryByText(/cần duyệt$/u)).not.toBeInTheDocument();
    expect(screen.queryByText('Mọi dự án đã duyệt xong')).not.toBeInTheDocument();
    expect(screen.getByText('5 dự án')).toBeInTheDocument();
  });

  it('U39: a card whose AI is running says so, not "Chưa có bản vẽ"', () => {
    render(
      <ProjectDashboardView
        {...PROPS_BY_STATE.success()}
        rows={[{ ...SAMPLE_ROW, hasPlan: false, isProcessing: true, statusVariant: 'neutral', statusLabel: 'Đang xử lý', actionLabel: 'Xem tiến độ' }]}
      />,
    );

    expect(screen.getByText('AI đang đọc bản vẽ')).toBeInTheDocument();
  });

  it('U54: the status line says a sentence, never a bare "thành công"', () => {
    render(<ProjectDashboardView {...PROPS_BY_STATE.success()} />);

    expect(screen.getAllByRole('status').map((node) => node.textContent)).not.toContain('thành công');
  });

  // BUG-169: a scrolled query is cut mid-glyph at the field's edge; the fade that hides the cut is on only while scrolled.
  it('marks the search field as scrolled only while its text is scrolled', () => {
    render(<ProjectDashboardView {...PROPS_BY_STATE.success()} />);
    const search = screen.getByRole('searchbox', { name: 'Tìm dự án' });

    search.scrollLeft = 120;
    fireEvent.scroll(search);
    expect(search).toHaveAttribute('data-scrolled');

    search.scrollLeft = 0;
    fireEvent.scroll(search);
    expect(search).not.toHaveAttribute('data-scrolled');
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

    expect(await screen.findByRole('button', { name: /^Tạo dự án/u })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Tạo dự án/u }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Tạo dự án mới')).toBeInTheDocument();
  });

  it('shares one toast stack between the dashboard and the dialog it opens', async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={['/']}>
        <ProjectDashboardRoute />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /^Tạo dự án/u }));
    await screen.findByRole('dialog');

    // Two independent `Toast.Provider`s would each draw their own
    // `role="region", aria-label="Thông báo"` — exactly one means this file's
    // `DashboardWithCreateModal` really did share a single provider.
    expect(screen.getAllByRole('region', { name: 'Thông báo' })).toHaveLength(1);
  });

  it('bấm chuông "Thông báo" mở tấm trượt thông báo (B-V3-08)', async () => {
    renderDashboardInLayout();

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
      renderDashboardInLayout();

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
      renderDashboardInLayout();

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
    expect(sentence.closest('.wrap-break-word')).not.toBeNull();
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

    expect(screen.getByRole('menuitem', { name: /^Đổi tên/ })).toHaveAttribute('aria-disabled', 'true');
  });

  // [9P-C-003] BE DELETE /projects/{id} is admin-only (projects/access.py:95): an engineer can rename but not delete.
  it('[9P-C-003] khoá "Xoá" khi không phải admin dù vẫn đổi tên được', () => {
    render(<ProjectDashboardView {...baseProps()} rows={[SAMPLE_ROW]} canDelete canDeleteProject={false} />);

    fireEvent.click(screen.getByRole('button', { name: `Tuỳ chọn cho ${SAMPLE_ROW.name}` }));

    expect(screen.getByRole('menuitem', { name: /^Xoá/ })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', { name: 'Đổi tên' })).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('[9P-D-002] viewer: "Đổi tên" và "Xoá" đều khoá, Enter trên "Xoá" không mở hộp xác nhận', () => {
    render(<ProjectDashboardView {...baseProps()} rows={[SAMPLE_ROW]} canDelete={false} canDeleteProject={false} />);

    fireEvent.click(screen.getByRole('button', { name: `Tuỳ chọn cho ${SAMPLE_ROW.name}` }));

    for (const name of [/^Đổi tên/, /^Xoá/]) {
      expect(screen.getByRole('menuitem', { name })).toHaveAttribute('aria-disabled', 'true');
    }
    fireEvent.click(screen.getByRole('menuitem', { name: /^Xoá/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('[9P-C-003] admin: "Xoá" bật', () => {
    render(<ProjectDashboardView {...baseProps()} rows={[SAMPLE_ROW]} />);

    fireEvent.click(screen.getByRole('button', { name: `Tuỳ chọn cho ${SAMPLE_ROW.name}` }));

    expect(screen.getByRole('menuitem', { name: 'Xoá' })).not.toHaveAttribute('aria-disabled', 'true');
  });
});

describe('ProjectDashboardView — khe chuông', () => {
  it('không ai cắm chuông thì không vẽ nút "Thông báo" chết nào (A2, B-V3-08)', () => {
    render(<MemoryRouter><ProjectDashboardView {...baseProps()} /></MemoryRouter>);

    expect(screen.queryAllByRole('button', { name: 'Thông báo' })).toHaveLength(0);
  });
});

describe('ProjectDashboardView — xem 3D', () => {
  it('mục "Xem 3D" trong menu mở thẳng khung nhìn 3D, không mở bước đang dở', () => {
    const openProject = vi.fn();
    const openProjectViewer = vi.fn();
    render(<ProjectDashboardView {...PROPS_BY_STATE.success()} openProject={openProject} openProjectViewer={openProjectViewer} />);

    fireEvent.click(screen.getByRole('button', { name: `Tuỳ chọn cho ${SAMPLE_ROW.name}` }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Xem 3D' }));

    expect(openProjectViewer).toHaveBeenCalledOnce();
    expect(openProject).not.toHaveBeenCalled();
  });

  // Vòng 8: one verb per step — the tile's one action says the step's verb and opens the project there.
  it('mỗi thẻ có một nút việc tiếp, nói đúng động từ của bước', () => {
    const openProject = vi.fn();
    render(<ProjectDashboardView {...PROPS_BY_STATE.success()} openProject={openProject} />);

    const action = screen.getByRole('button', { name: `Duyệt tường ${SAMPLE_ROW.name}` });
    expect(action).toHaveTextContent('Duyệt tường');
    fireEvent.click(action);
    expect(openProject).toHaveBeenCalledWith(SAMPLE_ROW.id, 'card');
  });
});
