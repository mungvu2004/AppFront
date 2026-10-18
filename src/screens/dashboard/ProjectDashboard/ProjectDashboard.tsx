/**
 * `/`, the screen a project manager lands on: every digitization project they
 * hold, scanned in five seconds, landing on whichever one still has work
 * outstanding.
 *
 * Invariant D's split: {@link ProjectDashboardView} takes plain props and only
 * renders — no store, no network, no `Date` — which is why there is not one
 * `toFixed` or unit conversion below for `local/no-raw-number` to catch;
 * every string already arrived formatted from `useProjectDashboard`. The card
 * itself ({@link ProjectCardTile}), the table view ({@link ProjectTable}) and the status rail
 * ({@link DashboardSidebar}) live in sibling files — this file crossed R-22's 400-line cap once the grid
 * grew a sidebar, and mục D's answer is a folder, not a
 * shorter feature.
 *
 * Every card sits in one responsive grid at one size — the old featured
 * "hero" card for `rows[0]` made cards of three widths on one screen (BUG-119,
 * BUG-157).
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
import { AlertCircle, Folder, FolderPlus, Lock, Plus, Search } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Toast, useToast } from '@/components/feedback/Toast';
import { ContextMenu } from '@/components/canvas/ContextMenu';
import { motion } from '@/components/motion';
import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { useContextMenu } from '@/hooks/useContextMenu';
import { durationSeconds } from '@/lib/motion';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';

import { DashboardSidebar, DashboardSidebarSkeleton } from './DashboardSidebar';
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
 * (A6). Its own copy, like `ProjectSettings.tsx` and `CreateProjectModal.tsx`:
 * `SEVEN_STATE_LABELS` lives in test infrastructure that never ships.
 */
const STATE_ANNOUNCEMENT: Readonly<Record<SevenState, string>> = {
  empty: 'rỗng',
  loading: 'đang tải',
  partial: 'một phần',
  error: 'lỗi',
  success: 'thành công',
  forbidden: 'Danh sách dự án, chế độ chỉ xem.',
  collapsed: 'thu gọn',
};
/**
 * One grid for every card, so cards are the same size at every width: a 730 px hero beside 340 px side cards
 * above a two-column grid gave three card widths on one screen (BUG-119, BUG-157). One column below `sm`.
 */
const GRID_COLUMNS_CLASS = 'grid grid-cols-1 gap-5 sm:grid-cols-2 min-[1440px]:grid-cols-3 min-[1920px]:grid-cols-4';

export type ProjectDashboardViewProps = ProjectDashboardModel & ProjectDashboardActions;

/** The dashboard as a function of its props — rendered directly by tests and stories. */
export function ProjectDashboardView(props: ProjectDashboardViewProps) {
  const { state, rows, errorMessage, pendingDeleteId, pendingDeleteName, shouldStagger, statusCounts, unreadNotice, deleteErrorMessage } = props;
  const contextMenu = useContextMenu();
  const isCollapsed = state === 'collapsed';
  const showSidebar = !isCollapsed && state !== 'loading';

  const openMenuFor = (project: ProjectCardModel, x: number, y: number): void =>
    contextMenu.openMenu(x, y, projectMenuGroups(project, props, props.canDelete, props.canDuplicate, props.canDeleteProject));

  const renderProjectGrid = (): ReactElement => (
    <div role="list" aria-label="Danh sách dự án" className={GRID_COLUMNS_CLASS}>
      {rows.map((project, index) => (
        <ProjectCardTile
          key={project.id}
          project={project}
          index={index}
          shouldStagger={shouldStagger}
          renamingId={props.renamingId}
          renameDraft={props.renameDraft}
          onOpen={(id) => props.openProject(id, 'card')}
          onOpenViewer={props.openProjectViewer}
          onMenu={openMenuFor}
          onRenameChange={props.setRenameDraft}
          onRenameCommit={props.commitRename}
          onRenameCancel={props.cancelRename}
        />
      ))}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-bg-app">
      {/* 16 px gutters below `sm`: 32 px left the 375 px status strip 311 px for 324 px of tabs (BUG-154). */}
      <div className="mx-auto flex w-full max-w-[1920px] flex-1 flex-col gap-6 p-4 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-semibold text-text-primary">Dự án của tôi</h1>
            {/* Every state that has a list says how many it shows — "0 dự án" for a search with no match
                included: dropping the line there made the whole column jump up 11 px (BUG-117). */}
            {state === 'error' && <div aria-hidden="true" className="h-5" />}
            {state !== 'loading' && state !== 'error' && <p className="text-[13px] text-text-secondary">{rows.length} dự án</p>}
            {/* Its line held while loading, so the toolbar and everything under it stay put (BUG-228). */}
            {state === 'loading' && (
              <div aria-hidden="true" className="flex h-5 items-center">
                <Skeleton preset="block" className="h-3 w-14" />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="search"
              aria-label="Tìm dự án"
              value={props.searchQuery}
              onChange={(event) => props.setSearchQuery(event.target.value)}
              placeholder="Tìm dự án theo tên..."
              // The 8 px after the icon is the icon's margin, not the input's padding (BUG-169); while scrolled
              // the first 12 px fade out so a cut glyph reads as "more text this way".
              prefix={<Search size={16} aria-hidden="true" className="mr-1" />}
              onScroll={(event) => event.currentTarget.toggleAttribute('data-scrolled', event.currentTarget.scrollLeft > 0)}
              className="pl-0 data-[scrolled]:[mask-image:linear-gradient(to_right,transparent,black_12px)]"
              wrapperClassName="w-full sm:w-72"
            />
            <Select
              options={PROJECT_SORT_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
              value={props.sortBy}
              onChange={(value) => props.setSortBy(value as ProjectSortOption)}
              className="w-[200px]"
            />
            {/* 56 px strip = 48 px segments below `sm` (≥ 44 px), the touch size `Button`/`Input` use (BUG-156). */}
            <SegmentedControl
              aria-label="Kiểu xem"
              className="h-14 sm:h-9"
              options={[
                { label: 'Lưới', value: 'grid' },
                { label: 'Bảng', value: 'table' },
              ]}
              value={props.viewMode}
              onChange={props.setViewMode}
            />
            {props.canCreate && (
              <Button variant="primary" size="sm" iconBefore={<Plus size={16} aria-hidden="true" />} onClick={props.createProject} shortcut="N">
                Dự án mới
              </Button>
            )}
          </div>
        </div>

        {(state === 'forbidden' || (isCollapsed && !props.canCreate)) && (
          <p className="flex items-center gap-2 text-[13px] text-text-secondary">
            <Lock size={14} aria-hidden="true" />
            Vai người xem: chỉ có thể mở dự án, không tạo hoặc xoá được.
          </p>
        )}

        {isCollapsed && (
          <SegmentedControl
            aria-label="Lọc theo trạng thái"
            className="h-14 sm:h-9 max-sm:[&>button]:px-2"
            options={PROJECT_STATUS_FILTER_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            value={props.statusFilter}
            onChange={props.setStatusFilter}
          />
        )}

        {state === 'loading' && <Skeleton preset="block" aria-hidden="true" className="h-14 w-full sm:h-9 lg:hidden" />}

        <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:items-start">
          {state === 'loading' && <DashboardSidebarSkeleton />}
          {showSidebar && (
            <DashboardSidebar statusCounts={statusCounts} countsHidden={state === 'error'} statusFilter={props.statusFilter} onStatusFilterChange={props.setStatusFilter} />
          )}

          <main className="flex min-w-0 flex-1 flex-col gap-5">
            {unreadNotice !== null && <InlineAlert level="attention" message={unreadNotice} />}
            {state === 'loading' ? (
              <div className={GRID_COLUMNS_CLASS}>
                {Array.from({ length: SKELETON_CARD_COUNT }, (_unused, index) => (
                  <Skeleton key={index} preset="project-card" />
                ))}
              </div>
            ) : state === 'error' ? (
              <InlineAlert
                level="violation"
                title="Không tải được danh sách dự án"
                message={errorMessage ?? 'Đã có lỗi xảy ra.'}
                {...(props.canRetry ? { action: { label: 'Thử lại', onClick: props.retryLoad, variant: 'secondary' as const } } : {})}
              />
            ) : rows.length === 0 && props.totalProjects === 0 && unreadNotice === null ? (
              // Never had a project — the `empty` rule of `useProjectDashboard`, read from the counts and not
              // from `state`: below 1024 px a filter or search with no match is `collapsed`, not `partial` (BUG-111).
              <EmptyState
                // Không tạo được thì không vẽ dấu cộng: nó hứa một nút không có (G2-12).
                icon={props.canCreate ? <FolderPlus aria-hidden="true" /> : <Folder aria-hidden="true" />}
                title="Chưa có dự án nào"
                description={
                  props.canCreate
                    ? 'Tạo dự án đầu tiên để bắt đầu số hoá bản vẽ.'
                    : 'Bạn chưa được thêm vào dự án nào. Khi được mời, dự án sẽ hiện ở đây.'
                }
                {...(props.canCreate ? { action: { label: 'Tạo dự án mới', onClick: props.createProject } } : {})}
              />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={<Search aria-hidden="true" />}
                title="Không tìm thấy dự án phù hợp"
                description="Không có dự án nào khớp với bộ lọc hiện tại."
                action={{ label: 'Xoá bộ lọc', onClick: props.clearFilters, variant: 'secondary' }}
              />
            ) : (
              <motion.div key={props.pulseKey} initial={{ opacity: 0.6 }} animate={{ opacity: 1 }} transition={{ duration: durationSeconds('fast') }}>
                {props.viewMode === 'grid' ? (
                  renderProjectGrid()
                ) : (
                  <ProjectTable
                    rows={rows}
                    renamingId={props.renamingId}
                    renameDraft={props.renameDraft}
                    onOpen={(id) => props.openProject(id, 'row')}
                    onOpenViewer={props.openProjectViewer}
                    onMenu={openMenuFor}
                    onRenameChange={props.setRenameDraft}
                    onRenameCommit={props.commitRename}
                    onRenameCancel={props.cancelRename}
                  />
                )}
              </motion.div>
            )}
          </main>
        </div>
      </div>

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
          <Button
            variant="danger"
            onClick={props.confirmDelete}
            loading={props.isDeleting}
          >
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
