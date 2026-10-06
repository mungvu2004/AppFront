/**
 * The dashboard's whole mind: what is on it, what it says, what a click does.
 *
 * Invariant D's split: this hook holds state and does arithmetic; the view in
 * `ProjectDashboard.tsx` only renders. Every string a person reads — the
 * secondary line, the review-progress caption, the last-modified time — is
 * built here, so the view has no formatting to get wrong (invariant A15).
 *
 * ## What this hook actually calls, rather than reimplements
 *
 * - **D-01/D-02** — `useQuery({ queryKey: queryKeys.project.summaries(), queryFn })`
 *   against the shared `queryClient`. Its `defaultOptions.queries.staleTime`
 *   is already `CACHE_POLICY.default.staleTime` (30s, `src/lib/query/queryClient.ts`),
 *   and `project` is not one of `cachePolicy.ts`'s overridden domains, so a
 *   plain `useQuery` call inherits the 30s policy without this hook repeating
 *   the number anywhere.
 * - **`can()`** from `src/lib/auth/permissions` decides `canCreate`, the same
 *   function `useShareLinks` already calls for the same reason.
 *
 * ## Why the data source is injected
 *
 * `fetchList` defaults to `gateway.listSummaries` (N1, read to the last cursor) but
 * is an option, not an import, for the same reason
 * `useShareLinks` takes a `ShareLinkGateway`: a test drives every one of the
 * seven states by resolving, rejecting or never settling a promise, with no
 * network and no fake timers wired into the query cache.
 *
 * ## What this hook refuses to decide
 *
 * **Whether the green "hoàn thành" badge is earned.** `isFullyReviewed` is
 * computed from `wallsReviewedCount === wallsTotalCount`, never read off the
 * stored `status` field alone — the brief's own rule ("không dùng màu đã
 * duyệt cho dự án chưa có người duyệt") stays true even if a future project
 * ships with a stale `status: 'done'` and an unfinished review.
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient, type QueryFunction } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { createAppApiClient } from '@/api/appClient';
import { ENDPOINTS } from '@/api/endpoints';
import { PROJECT_NAME_MAX_LENGTH, PROJECT_NAME_MIN_LENGTH } from '@/domain/project/limits';
import { useShortcut } from '@/hooks/useShortcut';
import { can } from '@/lib/auth/permissions';
import { readWireError } from '@/lib/errors/wireError';
import { formatArea } from '@/lib/format/measure';
import { formatNumber, formatPercent } from '@/lib/format/number';
import { formatTimestamp } from '@/lib/format/datetime';
import { createUuid } from '@/lib/http/ids';
import { applyInvalidation } from '@/lib/query/invalidation';
import { queryKeys } from '@/lib/query/queryKeys';
import type { ProjectOpenSource, ProjectPipelineStatus as TelemetryPipelineStatus } from '@/lib/telemetry/events';
import { createBeaconTransport, createTelemetrySender } from '@/lib/telemetry/sender';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';
import { ROUTES } from '@/routes/paths';
import type { ProjectRole } from '@/types/project';

import {
  createProjectsGateway,
  DASHBOARD_CAPABILITIES,
  type DashboardProject,
  type DashboardProjectList,
  type DashboardProjectMember,
  type DashboardProjectsGateway,
} from './projectsGateway';

/* -------------------------------------------------------------------------- */
/* Filters, sort, view mode.                                                  */
/* -------------------------------------------------------------------------- */

export type ProjectViewMode = 'grid' | 'table';
export type ProjectSortOption = 'updated' | 'name' | 'floors' | 'area';
export type ProjectStatusFilter = 'all' | DashboardProject['status'];

export const PROJECT_STATUS_FILTER_OPTIONS: ReadonlyArray<{ value: ProjectStatusFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'processing', label: 'Đang xử lý' },
  { value: 'qc', label: 'Cần QC' },
  { value: 'done', label: 'Hoàn thành' },
];

export const PROJECT_SORT_OPTIONS: ReadonlyArray<{ value: ProjectSortOption; label: string }> = [
  { value: 'updated', label: 'Cập nhật gần đây' },
  { value: 'name', label: 'Tên A–Z' },
  { value: 'floors', label: 'Số tầng nhiều nhất' },
  { value: 'area', label: 'Diện tích lớn nhất' },
];

const NARROW_VIEWPORT_QUERY = '(max-width: 1023px)';

/** `< 1024px` — the floor of the brief's three column breakpoints. */
function useNarrowViewport(): boolean {
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(NARROW_VIEWPORT_QUERY).matches : false,
  );

  useEffect(() => {
    const media = window.matchMedia(NARROW_VIEWPORT_QUERY);
    setIsNarrow(media.matches);
    const listener = (event: MediaQueryListEvent): void => setIsNarrow(event.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  return isNarrow;
}

/* -------------------------------------------------------------------------- */
/* Model.                                                                      */
/* -------------------------------------------------------------------------- */

export interface ProjectCardModel {
  readonly id: string;
  readonly name: string;
  readonly statsLabel: string;
  readonly updatedLabel: string;
  readonly statusVariant: 'verified' | 'attention' | 'neutral';
  readonly statusLabel: string;
  readonly progressLabel: string;
  readonly progressRatio: number;
  readonly progressPercentLabel: string;
  readonly members: readonly DashboardProjectMember[];
  readonly planVariant: 0 | 1 | 2 | 3;
}

export interface ProjectStatusCounts {
  readonly all: number;
  readonly processing: number;
  readonly qc: number;
  readonly done: number;
}

export interface ProjectDashboardModel {
  readonly state: SevenState;
  readonly canCreate: boolean;
  readonly canDelete: boolean;
  readonly canDuplicate: boolean;
  readonly errorMessage: string | null;
  readonly viewMode: ProjectViewMode;
  readonly searchQuery: string;
  readonly statusFilter: ProjectStatusFilter;
  readonly sortBy: ProjectSortOption;
  readonly statusCounts: ProjectStatusCounts;
  readonly pulseKey: number;
  readonly shouldStagger: boolean;
  readonly rows: readonly ProjectCardModel[];
  readonly renamingId: string | null;
  readonly renameDraft: string;
  readonly pendingDeleteId: string | null;
  readonly pendingDeleteName: string | null;
  /** Why the delete dialog stays open after #27 failed; null otherwise. */
  readonly deleteErrorMessage: string | null;
  /** "Có {N} dự án chưa đọc được" when N1 dropped rows; null otherwise. */
  readonly unreadNotice: string | null;
}

export interface ProjectDashboardActions {
  readonly setSearchQuery: (value: string) => void;
  readonly setStatusFilter: (value: ProjectStatusFilter) => void;
  readonly setSortBy: (value: ProjectSortOption) => void;
  readonly setViewMode: (value: ProjectViewMode) => void;
  readonly clearFilters: () => void;
  readonly openProject: (id: string, source: ProjectOpenSource) => void;
  readonly startRename: (id: string) => void;
  readonly setRenameDraft: (value: string) => void;
  readonly commitRename: () => void;
  readonly cancelRename: () => void;
  readonly requestDelete: (id: string) => void;
  readonly cancelDelete: () => void;
  readonly confirmDelete: () => void;
  readonly createProject: () => void;
  readonly retryLoad: () => void;
  /** Only reachable from the menu when `canDuplicate`; no backend contract yet (R4). */
  readonly duplicateProject: (id: string) => void;
}

export interface UseProjectDashboardOptions {
  readonly role?: ProjectRole;
  readonly gateway?: DashboardProjectsGateway;
  readonly fetchList?: QueryFunction<DashboardProjectList>;
  readonly forceNarrow?: boolean;
  readonly onOpenProject?: (path: string) => void;
  readonly onCreateProject?: () => void;
  readonly onDuplicateProject?: (id: string) => void;
  readonly onToast?: (toast: { readonly message: string; readonly onUndo?: () => void }) => void;
}

/** Stable across renders, so a memo keyed on `allProjects` does not churn while `listQuery.data` is undefined. */
const EMPTY_PROJECTS: readonly DashboardProject[] = [];

function derivedStatusOf(project: DashboardProject): TelemetryPipelineStatus {
  const isFullyReviewed = project.wallsTotalCount > 0 && project.wallsReviewedCount >= project.wallsTotalCount;
  if (isFullyReviewed) return 'done';
  return project.status === 'processing' ? 'processing' : 'qc';
}

const RENAME_RANGE_MESSAGE = `Tên dự án cần từ ${String(PROJECT_NAME_MIN_LENGTH)} đến ${String(PROJECT_NAME_MAX_LENGTH)} ký tự.`;

/** #26 failures by wire `code` (prompt [2]); a code this screen does not know gets the fallback, never the code. */
function renameErrorMessage(error: unknown): string {
  switch (readWireError(error)?.code) {
    case 'VALIDATION':
      return RENAME_RANGE_MESSAGE;
    case 'FORBIDDEN':
      return 'Bạn không có quyền đổi tên dự án này.';
    case 'NOT_FOUND':
      return 'Dự án này không còn nữa.';
    default:
      return 'Không đổi được tên dự án. Hãy thử lại.';
  }
}

/** #27 failures by wire `code`. `NOT_FOUND` is handled before this: the project is already gone. */
function deleteErrorMessageOf(error: unknown): string {
  return readWireError(error)?.code === 'FORBIDDEN'
    ? 'Bạn không có quyền xoá dự án này.'
    : 'Không xoá được dự án. Hãy thử lại.';
}

function routeForProject(project: DashboardProject, status: TelemetryPipelineStatus): string {
  switch (status) {
    case 'processing':
      return ROUTES.project.pipeline(project.id);
    case 'qc':
      return project.defaultFloorId === undefined
        ? ROUTES.project.floors(project.id)
        : ROUTES.project.walls(project.id, project.defaultFloorId);
    case 'done':
      return ROUTES.project.viewer(project.id);
  }
}

export function useProjectDashboard(
  options: UseProjectDashboardOptions = {},
): { readonly model: ProjectDashboardModel; readonly actions: ProjectDashboardActions } {
  const role = options.role ?? 'engineer';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<ProjectViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>('all');
  const [sortBy, setSortBy] = useState<ProjectSortOption>('updated');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteErrorMessage, setDeleteError] = useState<string | null>(null);
  const [pulseKey, setPulseKey] = useState(0);
  const [hasEnteredOnce, setHasEnteredOnce] = useState(false);
  const [telemetry] = useState(() =>
    createTelemetrySender({ transport: createBeaconTransport({ url: ENDPOINTS.telemetry }), sessionId: createUuid() }),
  );

  const detectedNarrow = useNarrowViewport();
  const isNarrow = options.forceNarrow ?? detectedNarrow;

  const gateway = useMemo(() => options.gateway ?? createProjectsGateway(createAppApiClient()), [options.gateway]);

  const listQuery = useQuery({
    queryKey: queryKeys.project.summaries(),
    queryFn: options.fetchList ?? (({ signal }) => gateway.listSummaries(signal)),
  });

  const allProjects = useMemo(() => listQuery.data?.projects ?? EMPTY_PROJECTS, [listQuery.data]);
  const droppedCount = listQuery.data?.droppedCount ?? 0;
  const projectById = useMemo(() => new Map(allProjects.map((project) => [project.id, project])), [allProjects]);

  // A11's "collapsed"/"forbidden" are overlays, not blank screens (ShareScreen's
  // precedent: they change what a person may do, not whether the list is
  // there) — filtering and rendering below run the same regardless of `state`.
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredProjects = useMemo(
    () =>
      allProjects.filter((project) => {
        if (normalizedQuery !== '' && !project.name.toLowerCase().includes(normalizedQuery)) return false;
        if (statusFilter !== 'all' && derivedStatusOf(project) !== statusFilter) return false;
        return true;
      }),
    [allProjects, normalizedQuery, statusFilter],
  );

  const sortedProjects = useMemo(() => {
    const list = [...filteredProjects];
    switch (sortBy) {
      case 'name':
        return list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      case 'floors':
        return list.sort((a, b) => b.floorCount - a.floorCount);
      case 'area':
        return list.sort((a, b) => b.areaM2 - a.areaM2);
      case 'updated':
      default:
        return list.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
    }
  }, [filteredProjects, sortBy]);

  // A-02: 24ms/row, capped at 8 — and only for the list's first appearance.
  useEffect(() => {
    if (!hasEnteredOnce && listQuery.isSuccess) {
      setHasEnteredOnce(true);
    }
  }, [hasEnteredOnce, listQuery.isSuccess]);

  // The 180ms/60%-opacity acknowledgement a filter change gets instead of a
  // skeleton — bumped on every filter-affecting state change after mount.
  useEffect(() => {
    setPulseKey((key) => key + 1);
  }, [searchQuery, statusFilter, sortBy]);

  const now = Date.now();
  const rows = useMemo<readonly ProjectCardModel[]>(
    () =>
      sortedProjects.map((project) => {
        const status = derivedStatusOf(project);
        const statusVariant = status === 'done' ? 'verified' : status === 'processing' ? 'neutral' : 'attention';
        const statusLabel = status === 'done' ? 'Hoàn thành' : status === 'processing' ? 'Đang xử lý' : 'Cần QC';
        const reviewed = formatNumber(project.wallsReviewedCount, { grouping: false });
        const total = formatNumber(project.wallsTotalCount, { grouping: false });
        const progressRatio = project.wallsTotalCount > 0 ? project.wallsReviewedCount / project.wallsTotalCount : 0;

        return {
          id: project.id,
          name: project.name,
          statsLabel: `${formatNumber(project.floorCount, { grouping: false })} tầng · ${formatArea(project.areaM2)}`,
          updatedLabel: formatTimestamp(project.updatedAtMs, now),
          statusVariant,
          statusLabel,
          progressLabel: `${reviewed}/${total} tường đã duyệt`,
          progressRatio,
          progressPercentLabel: formatPercent(progressRatio, { fractionDigits: 0 }),
          members: project.members,
          planVariant: project.planVariant,
        };
      }),
    [sortedProjects, now],
  );

  const statusCounts = useMemo<ProjectStatusCounts>(() => {
    let processing = 0;
    let qc = 0;
    let done = 0;
    for (const project of allProjects) {
      const status = derivedStatusOf(project);
      if (status === 'processing') processing += 1;
      else if (status === 'qc') qc += 1;
      else done += 1;
    }
    return { all: allProjects.length, processing, qc, done };
  }, [allProjects]);

  const errorMessage = listQuery.isError
    ? listQuery.error instanceof Error
      ? listQuery.error.message
      : 'Không tải được danh sách dự án.'
    : null;

  const state = useMemo<SevenState>(() => {
    if (isNarrow) return 'collapsed';
    if (listQuery.isPending) return 'loading';
    if (errorMessage !== null) return 'error';
    if (allProjects.length === 0 && droppedCount === 0) return 'empty';
    // A viewer may read N1, so `forbidden` waits for data — it never hides the loading state.
    if (role === 'viewer') return 'forbidden';
    if (droppedCount > 0 || filteredProjects.length === 0) return 'partial';
    return 'success';
  }, [isNarrow, role, listQuery.isPending, errorMessage, allProjects.length, droppedCount, filteredProjects.length]);

  const setProjects = (updater: (previous: readonly DashboardProject[]) => readonly DashboardProject[]): void => {
    queryClient.setQueryData<DashboardProjectList>(queryKeys.project.summaries(), (previous) =>
      previous === undefined ? previous : { ...previous, projects: updater(previous.projects) },
    );
  };

  const canCreate = can('create', 'project', { roles: [role] });
  const canDelete = can('edit', 'project.settings', { roles: [role] });

  // Registry-arbitrated, so it never fires while a search box or the rename
  // field is focused (`isTextEntryTarget`, `shortcutRegistry.ts`).
  useShortcut(
    { id: 'dashboard.createProject', combo: 'N', scope: 'global', onTrigger: () => options.onCreateProject?.() },
    { enabled: canCreate },
  );

  const openProject = (id: string, source: ProjectOpenSource): void => {
    const project = projectById.get(id);
    if (project === undefined) return;
    const status = derivedStatusOf(project);
    telemetry.track({ name: 'project.open', source, status });
    const path = routeForProject(project, status);
    if (options.onOpenProject) {
      options.onOpenProject(path);
    } else {
      navigate(path);
    }
  };

  const startRename = (id: string): void => {
    const project = projectById.get(id);
    if (project === undefined) return;
    setRenamingId(id);
    setRenameDraft(project.name);
  };

  const setName = (id: string, name: string): void =>
    setProjects((previous) => previous.map((entry) => (entry.id === id ? { ...entry, name } : entry)));

  /** Optimistic #26: show the name now, put the old one back if the server says no. */
  const renameTo = async (id: string, name: string, previousName: string, canUndo: boolean): Promise<void> => {
    // An in-flight list read would land after the patch and bring the old name back.
    await queryClient.cancelQueries({ queryKey: queryKeys.project.summaries() });
    setName(id, name);
    try {
      await gateway.rename(id, name);
    } catch (error) {
      setName(id, previousName);
      options.onToast?.({ message: renameErrorMessage(error) });
      return;
    }
    applyInvalidation(queryClient, 'renameProject', { projectId: id });
    options.onToast?.({
      message: canUndo ? `Đã đổi tên thành "${name}"` : `Đã khôi phục tên "${name}"`,
      ...(canUndo ? { onUndo: () => void renameTo(id, previousName, name, false) } : {}),
    });
  };

  const commitRename = (): void => {
    if (renamingId === null) return;
    const project = projectById.get(renamingId);
    const trimmed = renameDraft.trim();
    setRenamingId(null);
    if (project === undefined || trimmed === '' || trimmed === project.name) return;
    if (trimmed.length < PROJECT_NAME_MIN_LENGTH || trimmed.length > PROJECT_NAME_MAX_LENGTH) {
      options.onToast?.({ message: RENAME_RANGE_MESSAGE });
      return;
    }
    void renameTo(project.id, trimmed, project.name, true);
  };

  /** #27 first; the row leaves only once the server has deleted it. A9 asked already, so no undo toast. */
  const confirmDelete = async (): Promise<void> => {
    if (pendingDeleteId === null) return;
    const id = pendingDeleteId;
    setDeleteError(null);
    try {
      await gateway.remove(id);
    } catch (error) {
      // 404: someone else already deleted it — the screen's wish is met.
      if (readWireError(error)?.code !== 'NOT_FOUND') {
        setDeleteError(deleteErrorMessageOf(error));
        return;
      }
    }
    setProjects((previous) => previous.filter((entry) => entry.id !== id));
    setPendingDeleteId(null);
    applyInvalidation(queryClient, 'deleteProject', { projectId: id });
  };

  const pendingDeleteProject = pendingDeleteId === null ? undefined : projectById.get(pendingDeleteId);

  const model: ProjectDashboardModel = {
    state,
    canCreate,
    canDelete,
    canDuplicate: DASHBOARD_CAPABILITIES.supportsDuplicate,
    errorMessage,
    viewMode,
    searchQuery,
    statusFilter,
    sortBy,
    statusCounts,
    pulseKey,
    shouldStagger: !hasEnteredOnce,
    rows,
    renamingId,
    renameDraft,
    pendingDeleteId,
    pendingDeleteName: pendingDeleteProject?.name ?? null,
    deleteErrorMessage,
    unreadNotice: droppedCount > 0 ? `Có ${formatNumber(droppedCount, { grouping: false })} dự án chưa đọc được` : null,
  };

  const actions: ProjectDashboardActions = {
    setSearchQuery,
    setStatusFilter,
    setSortBy,
    setViewMode,
    clearFilters: () => {
      setSearchQuery('');
      setStatusFilter('all');
    },
    openProject,
    startRename,
    setRenameDraft,
    commitRename,
    cancelRename: () => setRenamingId(null),
    requestDelete: (id) => {
      setDeleteError(null);
      setPendingDeleteId(id);
    },
    cancelDelete: () => {
      setDeleteError(null);
      setPendingDeleteId(null);
    },
    confirmDelete: () => void confirmDelete(),
    createProject: () => options.onCreateProject?.(),
    retryLoad: () => void listQuery.refetch(),
    duplicateProject: (id) => options.onDuplicateProject?.(id),
  };

  return { model, actions };
}
