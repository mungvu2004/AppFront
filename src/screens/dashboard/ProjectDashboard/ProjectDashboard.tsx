/**
 * `/`, the screen a project manager lands on: every digitization project they
 * hold, scanned in five seconds, landing on whichever one still has work
 * outstanding.
 *
 * Invariant D's split: {@link ProjectDashboardView} takes plain props and only
 * renders — no store, no network, no `Date` — which is why there is not one
 * `toFixed` or unit conversion below for `local/no-raw-number` to catch;
 * every string already arrived formatted from `useProjectDashboard`. The card
 * itself ({@link ProjectCardTile}) and the status rail ({@link DashboardSidebar})
 * live in sibling files — this file crossed R-22's 400-line cap once the grid
 * grew a hero card and a sidebar, and mục D's answer is a folder, not a
 * shorter feature.
 *
 * The most-recently-updated project (`rows[0]` — `sortBy: 'updated'` is the
 * default) is featured as a large card; the next two sit beside it; anything
 * further down still gets the plain responsive grid below.
 *
 * `ProjectDashboard` is the wired screen. It owns the one thing the pure
 * view cannot: a `Toast.Provider`. Nothing mounts one globally yet — the same
 * gap `ShareRoute` leaves for `useShareLinks`' `onToast` — and invariant A8's
 * undo toast is not optional just because the shell hasn't grown one, so this
 * screen carries its own. (O-01's `TelemetrySender` lives in the hook, not
 * here — `src/lib/http` is off-limits to a view file, and the sender needs
 * `createUuid` from it.)
 */

import type { ReactElement } from 'react';
import { AlertCircle, Bell, FolderPlus, Lock, Plus, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Toast, useToast } from '@/components/feedback/Toast';
import { ContextMenu } from '@/components/canvas/ContextMenu';
import { motion } from '@/components/motion';
import { Modal } from '@/components/overlay/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { Table } from '@/components/ui/Table';
import { useContextMenu } from '@/hooks/useContextMenu';
import { durationSeconds } from '@/lib/motion';
import { cn } from '@/lib/utils';

import { DashboardSidebar } from './DashboardSidebar';
import { ProjectCardTile } from './ProjectCardTile';
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
const GRID_COLUMNS_CLASS = 'grid grid-cols-2 gap-5 min-[1440px]:grid-cols-3 min-[1920px]:grid-cols-4';

export interface ProjectDashboardViewProps extends ProjectDashboardModel, ProjectDashboardActions {}

/** The dashboard as a function of its props — rendered directly by tests and stories. */
export function ProjectDashboardView(props: ProjectDashboardViewProps) {
  const { state, rows, errorMessage, pendingDeleteId, pendingDeleteName, shouldStagger, statusCounts } = props;
  const contextMenu = useContextMenu();
  const isCollapsed = state === 'collapsed';
  const showSidebar = !isCollapsed && state !== 'loading' && state !== 'error';

  const openMenuFor = (project: ProjectCardModel, x: number, y: number): void => {
    contextMenu.openMenu(x, y, [
      {
        id: 'project-actions',
        items: [
          { id: 'open', label: 'Mở', action: () => props.openProject(project.id, 'card') },
          { id: 'duplicate', label: 'Nhân bản', action: () => props.duplicateProject(project.id) },
          { id: 'rename', label: 'Đổi tên', action: () => props.startRename(project.id) },
          {
            id: 'delete',
            label: 'Xoá',
            isDestructive: true,
            isDisabled: !props.canDelete,
            action: () => props.requestDelete(project.id),
          },
        ],
      },
    ]);
  };

  const nameField = (project: ProjectCardModel, className: string) =>
    props.renamingId === project.id ? (
      <input
        autoFocus
        value={props.renameDraft}
        onChange={(event) => props.setRenameDraft(event.target.value)}
        onBlur={props.commitRename}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter') props.commitRename();
          if (event.key === 'Escape') props.cancelRename();
        }}
        className={cn(className, 'rounded border border-accent bg-bg-surface px-1 outline-none')}
      />
    ) : (
      <h3 className={cn(className, 'truncate')}>{project.name}</h3>
    );

  const renderCard = (project: ProjectCardModel, index: number, size: 'hero' | 'compact') => (
    <ProjectCardTile
      key={project.id}
      project={project}
      index={index}
      size={size}
      shouldStagger={shouldStagger}
      renamingId={props.renamingId}
      renameDraft={props.renameDraft}
      onOpen={(id) => props.openProject(id, 'card')}
      onMenu={openMenuFor}
      onPointerEnter={props.onCardPointerEnter}
      onPointerLeave={props.onCardPointerLeave}
      onRenameChange={props.setRenameDraft}
      onRenameCommit={props.commitRename}
      onRenameCancel={props.cancelRename}
    />
  );

  const renderProjectGrid = (): ReactElement | null => {
    const heroProject = rows[0];
    if (heroProject === undefined) return null;
    const restProjects = rows.slice(1);
    const sideProjects = restProjects.slice(0, 2);
    const overflowProjects = restProjects.slice(2);

    return (
      <div role="list" aria-label="Danh sách dự án" className="flex flex-col gap-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          {renderCard(heroProject, 0, 'hero')}
          {sideProjects.length > 0 && (
            <div className="flex flex-col gap-5 lg:w-[340px] lg:shrink-0">
              {sideProjects.map((project, index) => renderCard(project, index + 1, 'compact'))}
            </div>
          )}
        </div>
        {overflowProjects.length > 0 && (
          <div className={GRID_COLUMNS_CLASS}>
            {overflowProjects.map((project, index) => renderCard(project, index + 3, 'compact'))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg-app">
      <header className="flex h-14 items-center gap-4 border-b border-border-default bg-bg-surface px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-wash text-accent" aria-hidden="true">
          <FolderPlus size={18} />
        </div>
        <Input
          type="search"
          aria-label="Tìm dự án"
          value={props.searchQuery}
          onChange={(event) => props.setSearchQuery(event.target.value)}
          placeholder="Tìm dự án theo tên..."
          prefix={<Search size={16} aria-hidden="true" />}
          wrapperClassName="w-[320px] max-w-full"
        />
        <div className="ml-auto flex items-center gap-3">
          <button type="button" aria-label="Thông báo" className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary">
            <Bell size={18} aria-hidden="true" />
          </button>
          <Avatar alt="Tài khoản của bạn" />
          {props.canCreate && (
            <Button variant="primary" size="sm" iconBefore={<Plus size={16} aria-hidden="true" />} onClick={props.createProject} shortcut="N">
              Dự án mới
            </Button>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1920px] flex-1 flex-col gap-6 p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-semibold text-text-primary">Dự án của tôi</h1>
            {(state === 'success' || state === 'collapsed' || state === 'forbidden') && (
              <p className="text-[13px] text-text-secondary">{rows.length} dự án</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Select
              options={PROJECT_SORT_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
              value={props.sortBy}
              onChange={(value) => props.setSortBy(value as ProjectSortOption)}
              className="w-[200px]"
            />
            <SegmentedControl
              aria-label="Kiểu xem"
              options={[
                { label: 'Lưới', value: 'grid' },
                { label: 'Bảng', value: 'table' },
              ]}
              value={props.viewMode}
              onChange={props.setViewMode}
            />
          </div>
        </div>

        {state === 'forbidden' && (
          <p className="flex items-center gap-2 text-[13px] text-text-secondary">
            <Lock size={14} aria-hidden="true" />
            Vai người xem: chỉ có thể mở dự án, không tạo hoặc xoá được.
          </p>
        )}

        {isCollapsed && (
          <SegmentedControl
            aria-label="Lọc theo trạng thái"
            options={PROJECT_STATUS_FILTER_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            value={props.statusFilter}
            onChange={props.setStatusFilter}
          />
        )}

        <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:items-start">
          {showSidebar && (
            <DashboardSidebar statusCounts={statusCounts} statusFilter={props.statusFilter} onStatusFilterChange={props.setStatusFilter} />
          )}

          <main className="flex min-w-0 flex-1 flex-col gap-5">
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
                action={{ label: 'Thử lại', onClick: props.retryLoad, variant: 'secondary' }}
              />
            ) : rows.length === 0 && state !== 'partial' ? (
              <EmptyState
                icon={<FolderPlus aria-hidden="true" />}
                title="Chưa có dự án nào"
                description="Chưa có dự án nào. Tạo dự án đầu tiên để bắt đầu số hoá bản vẽ."
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
                  <Table.Root>
                    <Table.Header>
                      <tr>
                        <Table.Head>tên dự án</Table.Head>
                        <Table.Head>trạng thái</Table.Head>
                        <Table.Head>chi tiết</Table.Head>
                        <Table.Head>tiến độ duyệt</Table.Head>
                        <Table.Head>cập nhật</Table.Head>
                      </tr>
                    </Table.Header>
                    <Table.Body>
                      {rows.map((project) => (
                        <Table.Row
                          key={project.id}
                          tabIndex={0}
                          className="cursor-pointer"
                          onClick={() => props.openProject(project.id, 'row')}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') props.openProject(project.id, 'row');
                          }}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            openMenuFor(project, event.clientX, event.clientY);
                          }}
                          onPointerEnter={() => props.onCardPointerEnter(project.id)}
                          onPointerLeave={() => props.onCardPointerLeave(project.id)}
                        >
                          <Table.Cell className="font-medium">{nameField(project, 'text-[14px] font-medium text-text-primary')}</Table.Cell>
                          <Table.Cell>
                            <Badge variant={project.statusVariant}>{project.statusLabel}</Badge>
                          </Table.Cell>
                          <Table.Cell className="text-text-secondary">{project.statsLabel}</Table.Cell>
                          <Table.Cell className="text-text-secondary">{project.progressLabel}</Table.Cell>
                          <Table.Cell className="text-text-muted">{project.updatedLabel}</Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                )}
              </motion.div>
            )}
          </main>
        </div>
      </div>

      <ContextMenu isVisible={contextMenu.isVisible} position={contextMenu.position} groups={contextMenu.groups} onClose={contextMenu.closeMenu} />

      {/* A9: xoá là hành động duy nhất trên màn này A8 không phủ được, nên đây
          là chỗ duy nhất được phép hỏi trước. Nhân bản và đổi tên hoàn tác được
          bằng toast (xem `duplicateProject`/`commitRename`) nên không hỏi. */}
      <Modal.Root isOpen={pendingDeleteId !== null} onClose={props.cancelDelete} width={480} titleId="project-delete-title">
        <Modal.Header>
          <span id="project-delete-title">Xoá dự án?</span>
        </Modal.Header>
        <Modal.Body>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-text-primary">
              {pendingDeleteName === null ? '' : `"${pendingDeleteName}" và toàn bộ bản vẽ, mô hình liên quan sẽ bị xoá vĩnh viễn.`}
            </p>
            <p className="flex items-start gap-2 text-sm text-text-secondary">
              <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              Không hoàn tác được.
            </p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={props.cancelDelete}>
            Để nguyên
          </Button>
          <Button variant="danger" onClick={props.confirmDelete}>
            Xoá dự án
          </Button>
        </Modal.Footer>
      </Modal.Root>

      <span className="sr-only" role="status">
        {state}
      </span>
    </div>
  );
}

export interface ProjectDashboardProps extends Omit<UseProjectDashboardOptions, 'onOpenProject' | 'onToast'> {}

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
  const { addToast } = useToast();

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
