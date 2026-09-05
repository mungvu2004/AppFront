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
 * - **D-01/D-02** — `useQuery({ queryKey: queryKeys.project.list(), queryFn })`
 *   against the shared `queryClient`. Its `defaultOptions.queries.staleTime`
 *   is already `CACHE_POLICY.default.staleTime` (30s, `src/lib/query/queryClient.ts`),
 *   and `project` is not one of `cachePolicy.ts`'s overridden domains, so a
 *   plain `useQuery` call inherits the 30s policy without this hook repeating
 *   the number anywhere.
 * - **D-05** — `prefetchOnHover` from `src/lib/query/prefetch.ts`, one instance
 *   per visible project, wired to each card's pointer events.
 * - **`can()`** from `src/lib/auth/permissions` decides `canCreate`, the same
 *   function `useShareLinks` already calls for the same reason.
 *
 * ## Why the data source is injected
 *
 * `fetchList`/`fetchDetail` default to `./projectsGateway`'s sample-backed
 * functions but are options, not imports, for the same reason
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

import { ENDPOINTS } from '@/api/endpoints';
import { useShortcut } from '@/hooks/useShortcut';
import { can } from '@/lib/auth/permissions';
import { formatArea } from '@/lib/format/measure';
import { formatNumber, formatPercent } from '@/lib/format/number';
import { formatTimestamp } from '@/lib/format/datetime';
import { createUuid } from '@/lib/http/ids';
import { prefetchOnHover, type PrefetchOnHoverHandlers } from '@/lib/query/prefetch';
import { queryKeys } from '@/lib/query/queryKeys';
import type { ProjectOpenSource, ProjectPipelineStatus as TelemetryPipelineStatus } from '@/lib/telemetry/events';
import { createBeaconTransport, createTelemetrySender } from '@/lib/telemetry/sender';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';
import { ROUTES } from '@/routes/paths';
import type { ProjectRole } from '@/types/project';

import { fetchProjectDetail, fetchProjectList, type DashboardProject, type DashboardProjectMember } from './projectsGateway';

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
  readonly duplicateProject: (id: string) => void;
  readonly requestDelete: (id: string) => void;
  readonly cancelDelete: () => void;
  readonly confirmDelete: () => void;
  readonly createProject: () => void;
  readonly retryLoad: () => void;
  readonly onCardPointerEnter: (id: string) => void;
  readonly onCardPointerLeave: (id: string) => void;
}

export interface UseProjectDashboardOptions {
  readonly role?: ProjectRole;
  readonly fetchList?: QueryFunction<readonly DashboardProject[]>;
  readonly forceNarrow?: boolean;
  readonly onOpenProject?: (path: string) => void;
  readonly onCreateProject?: () => void;
  readonly onToast?: (toast: { readonly message: string; readonly onUndo?: () => void }) => void;
}

/** Stable across renders, so a memo keyed on `allProjects` does not churn while `listQuery.data` is undefined. */
const EMPTY_PROJECTS: readonly DashboardProject[] = [];

function derivedStatusOf(project: DashboardProject): TelemetryPipelineStatus {
  const isFullyReviewed = project.wallsTotalCount > 0 && project.wallsReviewedCount >= project.wallsTotalCount;
  if (isFullyReviewed) return 'done';
  return project.status === 'processing' ? 'processing' : 'qc';
}

function routeForProject(project: DashboardProject, status: TelemetryPipelineStatus): string {
  switch (status) {
    case 'processing':
      return ROUTES.project.pipeline(project.id);
    case 'qc':
      return ROUTES.project.walls(project.id, project.defaultFloorId);
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
  const [pulseKey, setPulseKey] = useState(0);
  const [hasEnteredOnce, setHasEnteredOnce] = useState(false);
  const [telemetry] = useState(() =>
    createTelemetrySender({ transport: createBeaconTransport({ url: ENDPOINTS.telemetry }), sessionId: createUuid() }),
  );

  const detectedNarrow = useNarrowViewport();
  const isNarrow = options.forceNarrow ?? detectedNarrow;

  const listQuery = useQuery({
    queryKey: queryKeys.project.list(),
    queryFn: options.fetchList ?? fetchProjectList,
  });

  const allProjects = useMemo(() => listQuery.data ?? EMPTY_PROJECTS, [listQuery.data]);
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
        return list.sort((a, b) => a.updatedAgoMs - b.updatedAgoMs);
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
        const statusLabel = status === 'done' ? 'hoàn thành' : status === 'processing' ? 'đang xử lý' : 'cần QC';
        const reviewed = formatNumber(project.wallsReviewedCount, { grouping: false });
        const total = formatNumber(project.wallsTotalCount, { grouping: false });
        const progressRatio = project.wallsTotalCount > 0 ? project.wallsReviewedCount / project.wallsTotalCount : 0;

        return {
          id: project.id,
          name: project.name,
          statsLabel: `${formatNumber(project.floorCount, { grouping: false })} tầng · ${formatArea(project.areaM2)}`,
          updatedLabel: formatTimestamp(now - project.updatedAgoMs, now),
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

  const prefetchHandlers = useMemo(() => {
    const map = new Map<string, PrefetchOnHoverHandlers>();
    for (const project of allProjects) {
      map.set(
        project.id,
        prefetchOnHover(queryClient, queryKeys.project.detail(project.id), () => fetchProjectDetail(project.id)),
      );
    }
    return map;
  }, [allProjects, queryClient]);

  const errorMessage = listQuery.isError
    ? listQuery.error instanceof Error
      ? listQuery.error.message
      : 'Không tải được danh sách dự án.'
    : null;

  const state = useMemo<SevenState>(() => {
    if (isNarrow) return 'collapsed';
    if (role === 'viewer') return 'forbidden';
    if (listQuery.isPending) return 'loading';
    if (errorMessage !== null) return 'error';
    if (allProjects.length === 0) return 'empty';
    if (filteredProjects.length === 0) return 'partial';
    return 'success';
  }, [isNarrow, role, listQuery.isPending, errorMessage, allProjects.length, filteredProjects.length]);

  const setProjects = (updater: (previous: readonly DashboardProject[]) => readonly DashboardProject[]): void => {
    queryClient.setQueryData<readonly DashboardProject[]>(queryKeys.project.list(), (previous) => updater(previous ?? []));
  };

  const canCreate = can('create', 'project', { roles: [role] });
  const canDelete = role !== 'viewer';

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

  const commitRename = (): void => {
    if (renamingId === null) return;
    const project = projectById.get(renamingId);
    const trimmed = renameDraft.trim();
    if (project === undefined || trimmed === '' || trimmed === project.name) {
      setRenamingId(null);
      return;
    }
    const previousName = project.name;
    const id = renamingId;
    setProjects((previous) => previous.map((entry) => (entry.id === id ? { ...entry, name: trimmed } : entry)));
    options.onToast?.({
      message: `Đã đổi tên thành "${trimmed}"`,
      onUndo: () => setProjects((previous) => previous.map((entry) => (entry.id === id ? { ...entry, name: previousName } : entry))),
    });
    setRenamingId(null);
  };

  const duplicateProject = (id: string): void => {
    const project = projectById.get(id);
    if (project === undefined) return;
    const duplicateId = `${project.id}-copy-${createUuid()}`;
    setProjects((previous) => [{ ...project, id: duplicateId, name: `${project.name} (bản sao)` }, ...previous]);
    options.onToast?.({
      message: `Đã nhân bản "${project.name}"`,
      onUndo: () => setProjects((previous) => previous.filter((entry) => entry.id !== duplicateId)),
    });
  };

  const confirmDelete = (): void => {
    if (pendingDeleteId === null) return;
    const id = pendingDeleteId;
    setProjects((previous) => previous.filter((entry) => entry.id !== id));
    setPendingDeleteId(null);
  };

  const pendingDeleteProject = pendingDeleteId === null ? undefined : projectById.get(pendingDeleteId);

  const model: ProjectDashboardModel = {
    state,
    canCreate,
    canDelete,
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
    duplicateProject,
    requestDelete: (id) => setPendingDeleteId(id),
    cancelDelete: () => setPendingDeleteId(null),
    confirmDelete,
    createProject: () => options.onCreateProject?.(),
    retryLoad: () => void listQuery.refetch(),
    onCardPointerEnter: (id) => prefetchHandlers.get(id)?.onPointerEnter(),
    onCardPointerLeave: (id) => prefetchHandlers.get(id)?.onPointerLeave(),
  };

  return { model, actions };
}
