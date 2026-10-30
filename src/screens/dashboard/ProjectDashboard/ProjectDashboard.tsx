/**
 * `/`, the screen a project manager lands on: every digitization project they
 * hold, scanned in five seconds, landing on whichever one still has work
 * outstanding.
 *
 * Invariant D's split: {@link ProjectDashboardView} takes plain props and only
 * renders — no store, no network, no `Date` — which is why there is not one
 * `toFixed` or unit conversion below for `local/no-raw-number` to catch;
 * every string already arrived formatted from `useProjectDashboard`. The head
 * ({@link DashboardHead}), the tile ({@link ProjectCardTile}) and the table view
 * ({@link ProjectTable}) live in sibling files (R-22's 400-line cap, mục D).
 *
 * Layout (S-02, NGUYEN-TAC-BO-CUC): `PageHead` answers the three questions — what this
 * screen is for, where the projects stand (one Badge + one sentence with real counts), and
 * the one primary action "Tạo dự án". Below it ONE `Section` holds the list; its head holds
 * search, sort and Lưới/Bảng, and the status filter opens its body. No side rail, no counter
 * tiles, no activity block: there is no activity log to fill one (CẦN BE).
 *
 * `ProjectDashboard` is the wired screen. It owns the one thing the pure
 * view cannot: a `Toast.Provider`. Nothing mounts one globally yet — the same
 * gap `ShareRoute` leaves for `useShareLinks`' `onToast` — and invariant A8's
 * undo toast is not optional just because the shell hasn't grown one, so this
 * screen carries its own. (O-01's `TelemetrySender` lives in the hook, not
 * here — `src/lib/http` is off-limits to a view file, and the sender needs
 * `createUuid` from it.)
 */

import { useEffect, useRef, type ReactElement } from 'react';
import { AlertCircle, Folder, FolderPlus, Search } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Toast, useToast } from '@/components/feedback/Toast';
import { ContextMenu } from '@/components/canvas/ContextMenu';
import { motion } from '@/components/motion';
import { Modal } from '@/components/overlay/Modal';
import { Section } from '@/components/shell/Section';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { useContextMenu } from '@/hooks/useContextMenu';
import { durationSeconds } from '@/lib/motion';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';

import { DashboardHead } from './DashboardHead';
import { projectMenuGroups } from './projectMenuGroups';
import { ProjectCardTile } from './ProjectCardTile';
import { ProjectTable } from './ProjectTable';
import {
  PROJECT_SORT_OPTIONS,
  PROJECT_STATUS_FILTER_OPTIONS,
  useProjectDashboard,
  type ProjectCardModel,
  type ProjectDashboardActions,
  type ProjectDashboardModel,
  type ProjectSortOption,
  type UseProjectDashboardOptions,
} from './useProjectDashboard';

const SKELETON_CARD_COUNT = 6;

/**
 * What the `sr-only` status line says — the screen reader's only way to learn
 * which of the seven states the dashboard is in. It used to print the raw
 * `SevenState` key ("success", "forbidden"), English in a Vietnamese product
 * (A6). `SEVEN_STATE_LABELS` lives in test infrastructure that never ships.
 */
const STATE_ANNOUNCEMENT: Readonly<Record<SevenState, string>> = {
  empty: 'Chưa có dự án nào.',
  loading: 'đang tải',
  partial: 'một phần',
  error: 'lỗi',
  success: 'thành công',
  forbidden: 'Danh sách dự án, chế độ chỉ xem.',
  collapsed: 'thu gọn',
};

/**
 * One grid for every tile, so tiles are the same size at every width (BUG-119, BUG-157): two columns
 * at 768–1279 px, three from 1280 (the 1280 content block leaves ~340 px a tile).
 */
const GRID_COLUMNS_CLASS = 'grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-3';

const STATUS_FILTER_SEGMENTS = PROJECT_STATUS_FILTER_OPTIONS.map((option) => ({ value: option.value, label: option.label }));
const SORT_SELECT_OPTIONS = PROJECT_SORT_OPTIONS.map((option) => ({ value: option.value, label: option.label }));

export type ProjectDashboardViewProps = ProjectDashboardModel & ProjectDashboardActions;

/** The dashboard as a function of its props — rendered directly by tests and stories. */
export function ProjectDashboardView(props: ProjectDashboardViewProps) {
  const { state, rows, errorMessage, pendingDeleteId, pendingDeleteName, statusCounts, unreadNotice, deleteErrorMessage } = props;
  const contextMenu = useContextMenu();
  // Never had a project — read from the counts and not from `state`: below 1024 px a filter or
  // search with no match is `collapsed`, not `partial` (BUG-111).
  const neverHadProject =
    state !== 'loading' && state !== 'error' && rows.length === 0 && props.totalProjects === 0 && unreadNotice === null;
  const isFiltering = props.searchQuery.trim() !== '' || props.statusFilter !== 'all';

  const openMenuFor = (project: ProjectCardModel, x: number, y: number): void =>
    contextMenu.openMenu(x, y, projectMenuGroups(project, props, props.canDelete, props.canDuplicate, props.canDeleteProject));

  const renderProjectGrid = (): ReactElement => (
    <div role="list" aria-label="Danh sách dự án" className={GRID_COLUMNS_CLASS}>
      {rows.map((project, index) => (
        <ProjectCardTile
          key={project.id}
          project={project}
          index={index}
          shouldStagger={props.shouldStagger}
          renamingId={props.renamingId}
          renameDraft={props.renameDraft}
          onOpen={(id) => props.openProject(id, 'card')}
          onMenu={openMenuFor}
          onRenameChange={props.setRenameDraft}
          onRenameCommit={props.commitRename}
          onRenameCancel={props.cancelRename}
        />
      ))}
    </div>
  );

  const renderBody = (): ReactElement => {
    if (state === 'loading') {
      return (
        <div className={GRID_COLUMNS_CLASS}>
          {Array.from({ length: SKELETON_CARD_COUNT }, (_unused, index) => (
            <Skeleton key={index} preset="project-card" />
          ))}
        </div>
      );
    }
    if (state === 'error') {
      return (
        <InlineAlert
          level="violation"
          title="Không tải được danh sách dự án"
          message={errorMessage ?? 'Đã có lỗi xảy ra.'}
          {...(props.canRetry ? { action: { label: 'Thử lại', onClick: props.retryLoad, variant: 'secondary' as const } } : {})}
        />
      );
    }
    if (neverHadProject) {
      // No button here: "Tạo dự án" in the page head is the one primary action (vòng 6: two `.pri` on one screen).
      return (
        <EmptyState
          // Không tạo được thì không vẽ dấu cộng: nó hứa một nút không có (G2-12).
          icon={props.canCreate ? <FolderPlus aria-hidden="true" /> : <Folder aria-hidden="true" />}
          title="Chưa có dự án nào"
          description={
            props.canCreate
              ? 'Tạo dự án đầu tiên để bắt đầu số hoá bản vẽ.'
              : 'Bạn chưa được thêm vào dự án nào. Khi được mời, dự án sẽ hiện ở đây.'
          }
        />
      );
    }
    if (rows.length === 0) {
      // The one place "Xoá bộ lọc" lives (vòng 7: it sat in three).
      return (
        <EmptyState
          icon={<Search aria-hidden="true" />}
          title="Không tìm thấy dự án phù hợp"
          description="Không có dự án nào khớp với tìm kiếm và bộ lọc hiện tại."
          action={{ label: 'Xoá bộ lọc', onClick: props.clearFilters, variant: 'secondary' }}
        />
      );
    }
    return (
      <motion.div key={props.pulseKey} initial={{ opacity: 0.6 }} animate={{ opacity: 1 }} transition={{ duration: durationSeconds('fast') }}>
        {props.viewMode === 'grid' ? (
          renderProjectGrid()
        ) : (
          <ProjectTable
            rows={rows}
            renamingId={props.renamingId}
            renameDraft={props.renameDraft}
            onOpen={(id) => props.openProject(id, 'row')}
            onMenu={openMenuFor}
            onRenameChange={props.setRenameDraft}
            onRenameCommit={props.commitRename}
            onRenameCancel={props.cancelRename}
          />
        )}
      </motion.div>
    );
  };

  const toolbar = (
    <>
      <Input
        type="search"
        aria-label="Tìm dự án"
        value={props.searchQuery}
        onChange={(event) => props.setSearchQuery(event.target.value)}
        placeholder="Tìm theo tên"
        // The 8 px after the icon is the icon's margin, not the input's padding (BUG-169); while scrolled
        // the first 12 px fade out so a cut glyph reads as "more text this way".
        prefix={<Search size={16} aria-hidden="true" className="mr-1" />}
        onScroll={(event) => event.currentTarget.toggleAttribute('data-scrolled', event.currentTarget.scrollLeft > 0)}
        className="pl-0 data-scrolled:mask-[linear-gradient(to_right,transparent,black_12px)]"
        wrapperClassName="w-52 xl:w-64"
      />
      <Select
        options={SORT_SELECT_OPTIONS}
        value={props.sortBy}
        onChange={(value) => props.setSortBy(value as ProjectSortOption)}
        className="w-[184px]"
      />
      <SegmentedControl
        aria-label="Kiểu xem"
        className="h-11 shrink-0 fine:h-9"
        options={[
          { label: 'Lưới', value: 'grid' },
          { label: 'Bảng', value: 'table' },
        ]}
        value={props.viewMode}
        onChange={props.setViewMode}
      />
    </>
  );

  return (
    <div className="flex min-h-screen flex-col bg-bg-app">
      {/* The screen's one `<main>` (it sits outside the `ScreenMain` group, `mainLandmark.shell.test.tsx`). */}
      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col px-20 py-8 max-xl:px-8 max-lg:px-6">
        <DashboardHead
          state={state}
          statusCounts={statusCounts}
          totalProjects={props.totalProjects}
          visibleCount={rows.length}
          isFiltering={isFiltering}
          hasUnread={unreadNotice !== null}
          canCreate={props.canCreate}
          onCreate={props.createProject}
          onShowQc={() => props.setStatusFilter('qc')}
        />

        <Section flush title="Dự án" actions={neverHadProject ? undefined : toolbar}>
          <div className="flex flex-col gap-5 p-5">
            {!neverHadProject && state !== 'error' && (
              <SegmentedControl
                aria-label="Lọc theo trạng thái"
                // Segments size to their label: equal `flex-1` widths broke "Chưa có bản vẽ" onto two lines.
                className="h-11 self-start whitespace-nowrap fine:h-9 [&>button]:flex-none"
                options={STATUS_FILTER_SEGMENTS}
                value={props.statusFilter}
                onChange={props.setStatusFilter}
              />
            )}
            {unreadNotice !== null && <InlineAlert level="attention" message={unreadNotice} />}
            {renderBody()}
          </div>
        </Section>
      </main>

      <ContextMenu isVisible={contextMenu.isVisible} position={contextMenu.position} groups={contextMenu.groups} onClose={contextMenu.closeMenu} />

      {/* A9: xoá là hành động duy nhất trên màn này A8 không phủ được, nên đây
          là chỗ duy nhất được phép hỏi trước. Đổi tên hoàn tác được
          bằng toast (xem `commitRename`) nên không hỏi. */}
      <Modal.Root isOpen={pendingDeleteId !== null} onClose={props.cancelDelete} width={480} titleId="project-delete-title">
        <Modal.Header>
          <span id="project-delete-title">Xoá dự án?</span>
        </Modal.Header>
        {/* 24 px to the footer rule like the header and body gutters, not 8 (BUG-155). */}
        <Modal.Body className="pb-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-text-primary">
              {pendingDeleteName === null ? '' : `"${pendingDeleteName}" và toàn bộ bản vẽ, mô hình liên quan sẽ bị xoá vĩnh viễn.`}
            </p>
            <p className="flex items-start gap-2 text-sm text-text-secondary">
              <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              Không hoàn tác được.
            </p>
            {deleteErrorMessage !== null && <InlineAlert level="violation" message={deleteErrorMessage} />}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={props.cancelDelete}>
            Để nguyên
          </Button>
          <Button variant="danger" onClick={props.confirmDelete} loading={props.isDeleting}>
            Xoá dự án
          </Button>
        </Modal.Footer>
      </Modal.Root>

      <span className="sr-only" role="status">
        {STATE_ANNOUNCEMENT[state]}
      </span>
    </div>
  );
}

export type ProjectDashboardProps = Omit<UseProjectDashboardOptions, 'onOpenProject' | 'onToast'>;

/**
 * Wires the hook to the router and whichever `Toast.Provider` is nearest, then
 * renders the view.
 *
 * Exported (not just used below) so `ProjectDashboard.container.tsx` can mount
 * it under its own, wider `Toast.Provider` — shared with the create-project
 * dialog it opens — instead of the standalone one `ProjectDashboard` supplies
 * two lines down. Two independent `Toast.Provider`s would each draw their own
 * fixed-position stack in the same corner (R-73's container/props boundary).
 */
export function ProjectDashboardConnected(options: ProjectDashboardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();

  // G2-12: màn khác (nhận lời mời) gửi một câu chào qua state điều hướng; hiện một lần rồi xoá khỏi lịch sử.
  const welcomeToast = (location.state as { readonly welcomeToast?: unknown } | null)?.welcomeToast;
  const shownForKey = useRef<string | null>(null);
  useEffect(() => {
    if (typeof welcomeToast !== 'string' || shownForKey.current === location.key) return;
    shownForKey.current = location.key;
    addToast({ message: welcomeToast });
    void navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [addToast, location.key, location.pathname, location.search, navigate, welcomeToast]);

  const { model, actions } = useProjectDashboard({
    ...options,
    onOpenProject: (path) => navigate(path),
    onToast: addToast,
  });

  return <ProjectDashboardView {...model} {...actions} />;
}

/** `ProjectDashboard`, standalone — its own `Toast.Provider`. For stories, tests and the demo picker; the real route is `ProjectDashboardRoute` (`./ProjectDashboard.container`). */
export function ProjectDashboard(options: ProjectDashboardProps = {}) {
  return (
    <Toast.Provider>
      <ProjectDashboardConnected {...options} />
    </Toast.Provider>
  );
}
