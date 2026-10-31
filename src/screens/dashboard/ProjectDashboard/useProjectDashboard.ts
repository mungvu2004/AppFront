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

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient, type QueryFunction } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { createAppApiClient } from '@/api/appClient';
import { ENDPOINTS } from '@/api/endpoints';
import { PROJECT_NAME_MAX_LENGTH, PROJECT_NAME_MIN_LENGTH } from '@/domain/project/limits';
import { useShortcut } from '@/hooks/useShortcut';
import { can } from '@/lib/auth/permissions';
import { describeError } from '@/lib/errors/describeError';
import type { AppErrorKind } from '@/lib/errors/kinds';
import { toAppError } from '@/lib/errors/toAppError';
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

import { CREATE_PROJECT_SHORTCUT } from './dashboardShortcuts';

import {
  createProjectsGateway,
  DASHBOARD_CAPABILITIES,
  planSketchOf,
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
export type ProjectStatusFilter = 'all' | 'noplan' | DashboardProject['status'];

export const PROJECT_STATUS_FILTER_OPTIONS: ReadonlyArray<{ value: ProjectStatusFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'noplan', label: 'Chưa có bản vẽ' },
  { value: 'processing', label: 'Đang xử lý' },
  { value: 'qc', label: 'Cần duyệt' },
  { value: 'done', label: 'Hoàn thành' },
];

export const PROJECT_SORT_OPTIONS: ReadonlyArray<{ value: ProjectSortOption; label: string }> = [
  { value: 'updated', label: 'Cập nhật gần đây' },
  { value: 'name', label: 'Tên A–Z' },
  { value: 'floors', label: 'Số tầng nhiều nhất' },
  { value: 'area', label: 'Diện tích lớn nhất' },
];

/**
 * U23: từ khoá, bộ lọc và cách sắp giữ trong phiên của thẻ trình duyệt, nên mở một dự án rồi bấm "Dự án"
 * quay về đúng danh sách vừa rời. `sessionStorage` có thể ném (chế độ riêng tư, chặn dữ liệu): khi đó bắt đầu trống.
 */
export const DASHBOARD_LIST_STATE_KEY = 'dashboard.listState';

interface StoredListState {
  readonly searchQuery: string;
  readonly statusFilter: ProjectStatusFilter;
  readonly sortBy: ProjectSortOption;
}

const DEFAULT_LIST_STATE: StoredListState = { searchQuery: '', statusFilter: 'all', sortBy: 'updated' };

export function readListState(): StoredListState {
  try {
    const raw: unknown = JSON.parse(window.sessionStorage.getItem(DASHBOARD_LIST_STATE_KEY) ?? 'null');
    if (typeof raw !== 'object' || raw === null) return DEFAULT_LIST_STATE;
    const stored = raw as Partial<Record<keyof StoredListState, unknown>>;
    return {
      searchQuery: typeof stored.searchQuery === 'string' ? stored.searchQuery : '',
      statusFilter: PROJECT_STATUS_FILTER_OPTIONS.find((option) => option.value === stored.statusFilter)?.value ?? 'all',
      sortBy: PROJECT_SORT_OPTIONS.find((option) => option.value === stored.sortBy)?.value ?? 'updated',
    };
  } catch {
    return DEFAULT_LIST_STATE;
  }
}

function writeListState(state: StoredListState): void {
  try {
    window.sessionStorage.setItem(DASHBOARD_LIST_STATE_KEY, JSON.stringify(state));
  } catch {
    // Không lưu được thì lần sau bắt đầu trống — không hỏng gì.
  }
}

const NARROW_VIEWPORT_QUERY = '(width < 1024px)';

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
  /** Per-project sketch (`planSketchOf`); absent → the fixed outline of `planVariant`. */
  readonly planSketch?: readonly (readonly [number, number, number, number])[];
  /** Whether a plan was traced yet (walls detected); without one the card shows a placeholder, not a made-up plan. */
  readonly hasPlan: boolean;
  /** U39: AI đang chạy mà chưa ra tường nào — thẻ nói "đang đọc bản vẽ", không nói "chưa có bản vẽ". Vắng = không. */
  readonly isProcessing?: boolean;
  /** Động từ của việc tiếp theo, một cho mỗi bước: "Duyệt tường", "Xem tiến độ", "Xem 3D" hoặc "Mở dự án". */
  readonly actionLabel: string;
}

export interface ProjectStatusCounts {
  readonly all: number;
  readonly noplan: number;
  readonly processing: number;
  readonly qc: number;
  readonly done: number;
}

export interface ProjectDashboardModel {
  readonly state: SevenState;
  readonly canCreate: boolean;
  readonly canDelete: boolean;
  /** "Xoá" only: BE DELETE /projects/{id} is admin-only, narrower than `canDelete` (which gates rename). */
  readonly canDeleteProject: boolean;
  readonly canDuplicate: boolean;
  readonly errorMessage: string | null;
  /** False when the failed read was a 403: reading again is refused just the same, so no "Thử lại". */
  readonly canRetry: boolean;
  readonly viewMode: ProjectViewMode;
  readonly searchQuery: string;
  readonly statusFilter: ProjectStatusFilter;
  readonly sortBy: ProjectSortOption;
  readonly statusCounts: ProjectStatusCounts;
  /** Số dự án không tính tìm kiếm: 0 nghĩa là chưa từng có dự án. */
  readonly totalProjects: number;
  readonly pulseKey: number;
  readonly shouldStagger: boolean;
  readonly rows: readonly ProjectCardModel[];
  readonly renamingId: string | null;
  readonly renameDraft: string;
  readonly pendingDeleteId: string | null;
  readonly pendingDeleteName: string | null;
  /** Why the delete dialog stays open after #27 failed; null otherwise. */
  readonly deleteErrorMessage: string | null;
  /** #27 is in flight: "Xoá dự án" waits, so a second click sends nothing. */
  readonly isDeleting: boolean;
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
  /** Thẳng tới khung nhìn 3D, bỏ qua bước đang dở mà `openProject` chọn. */
  readonly openProjectViewer: (id: string) => void;
  /** Tới thẳng một trang của dự án từ menu thẻ: xuất, thành viên, cài đặt; "share" mở hộp chia sẻ nếu nơi dùng có. */
  readonly openProjectPage: (id: string, page: ProjectPage) => void;
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

export type ProjectPage = 'export' | 'members' | 'settings' | 'share';

export interface UseProjectDashboardOptions {
  readonly role?: ProjectRole;
  readonly gateway?: DashboardProjectsGateway;
  readonly fetchList?: QueryFunction<DashboardProjectList>;
  readonly forceNarrow?: boolean;
  readonly onOpenProject?: (path: string) => void;
  readonly onCreateProject?: () => void;
  readonly onDuplicateProject?: (id: string) => void;
  /** U33: mở hộp "Chia sẻ dự án" ngay trên danh sách; vắng thì "Chia sẻ" về màn Xuất (có nút Chia sẻ). */
  readonly onShareProject?: (id: string) => void;
  /** `state` marks a failure (`violation`) or a refused input (`attention`); a plain notice has none (BUG-207). */
  readonly onToast?: (toast: { readonly message: string; readonly onUndo?: () => void; readonly state?: 'attention' | 'violation' }) => void;
}

/** Stable across renders, so a memo keyed on `allProjects` does not churn while `listQuery.data` is undefined. */
const EMPTY_PROJECTS: readonly DashboardProject[] = [];

function derivedStatusOf(project: DashboardProject): TelemetryPipelineStatus {
  const isFullyReviewed = project.wallsTotalCount > 0 && project.wallsReviewedCount >= project.wallsTotalCount;
  if (isFullyReviewed) return 'done';
  return project.status === 'processing' ? 'processing' : 'qc';
}

/** Khoá lọc/đếm: dự án chưa có tường nào và chưa xong bước xử lý là "chưa có bản vẽ", không phải "đang xử lý". */
function filterKeyOf(project: DashboardProject): ProjectStatusFilter {
  const status = derivedStatusOf(project);
  return status === 'processing' && project.wallsTotalCount === 0 && project.jobActive !== true ? 'noplan' : status;
}

const RENAME_RANGE_MESSAGE = `Tên dự án cần từ ${String(PROJECT_NAME_MIN_LENGTH)} đến ${String(PROJECT_NAME_MAX_LENGTH)} ký tự.`;

/**
 * #26 `VALIDATION`. `commitRename` refuses a name outside 3–80 characters before sending, so a name the
 * server still refuses has characters it does not take — a bidi or control mark (BUG-168, as BUG-016).
 */
const RENAME_CHARS_MESSAGE =
  'Tên dự án có ký tự không dùng được, như ký tự điều khiển hoặc ký tự đảo chiều chữ. Tên cũ đã được giữ lại.';

/** #26 failures by wire `code` (prompt [2]); a code this screen does not know gets the fallback, never the code. */
function renameErrorMessage(error: unknown): string {
  switch (readWireError(error)?.code) {
    case 'VALIDATION':
      return RENAME_CHARS_MESSAGE;
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

/** Kinds whose shared sentence is about the link, the server's pace or the session — true of a page load too. */
const LOAD_ERROR_KINDS_WITH_OWN_SENTENCE: ReadonlySet<AppErrorKind> = new Set(['network', 'timeout', 'rateLimited', 'unauthenticated']);

/**
 * N1 failed while the page opened. Every other kind's shared sentence speaks of an action the person took
 * ("Hãy thử lại thao tác vừa làm" for a 500, "làm thao tác này" for a 403) — they took none, so say what
 * happened to the list instead (BUG-209). A 403 is not a server fault: it keeps the rights cause (review-1 #10).
 */
function listErrorMessageOf(error: unknown): string {
  const appError = toAppError(error);
  if (appError.kind === 'forbidden') return 'Tài khoản của bạn chưa được phép xem danh sách dự án. Liên hệ quản trị dự án.';
  return LOAD_ERROR_KINDS_WITH_OWN_SENTENCE.has(appError.kind)
    ? describeError(appError).description
    : 'Máy chủ gặp lỗi khi đọc danh sách. Bấm "Thử lại" để tải lại.';
}

/** Một động từ cho mỗi bước, khớp nơi `routeForProject` đưa tới (vòng 8: ba động từ cho cùng một bước). */
function actionLabelOf(status: TelemetryPipelineStatus, hasPlan: boolean, isViewer = false): string {
  // UX41 U46: người xem không duyệt được — việc của họ ở bước duyệt là xem mô hình.
  if (status === 'done' || (isViewer && status === 'qc')) return 'Xem 3D';
  if (status === 'qc') return 'Duyệt tường';
  // Chưa có bản vẽ vẫn tới màn tiến trình (`routeForProject`), nên chưa hứa "Tải bản vẽ".
  return hasPlan ? 'Xem tiến độ' : 'Tải bản vẽ';
}

function routeForProject(project: DashboardProject, status: TelemetryPipelineStatus, isViewer = false): string {
  if (isViewer && status === 'qc') return ROUTES.project.viewer(project.id);
  switch (status) {
    case 'processing':
      // Chưa có bản vẽ thì việc cần làm là tải bản vẽ lên.
      return project.wallsTotalCount > 0 || project.jobActive === true ? ROUTES.project.pipeline(project.id) : ROUTES.project.upload(project.id);
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
  const [initialListState] = useState(readListState);
  const [searchQuery, setSearchQuery] = useState(initialListState.searchQuery);
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>(initialListState.statusFilter);
  const [sortBy, setSortBy] = useState<ProjectSortOption>(initialListState.sortBy);
  useEffect(() => {
    writeListState({ searchQuery, statusFilter, sortBy });
  }, [searchQuery, statusFilter, sortBy]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteErrorMessage, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // A ref, not the state: a double click lands twice before React re-renders (BUG-146).
  const deleteInFlight = useRef(false);
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
  // NFC on both sides: a pasted NFD query (letter + separate mark) never matched the name it shows (BUG-210).
  const normalizedQuery = searchQuery.trim().normalize('NFC').toLowerCase();
  const filteredProjects = useMemo(
    () =>
      allProjects.filter((project) => {
        if (normalizedQuery !== '' && !project.name.normalize('NFC').toLowerCase().includes(normalizedQuery)) return false;
        if (statusFilter !== 'all' && filterKeyOf(project) !== statusFilter) return false;
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
        // U39: "Cập nhật gần đây" nghĩa đúng như chữ — dự án vừa sửa lên đầu. Việc cần làm đã có chip và bộ lọc riêng.
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
        const hasPlan = project.wallsTotalCount > 0;
        const running = project.jobActive === true;
        // Chưa có bản vẽ nào thì chưa có gì để xử lý: không gắn "Đang xử lý" (G1-17, G3-02).
        const statusLabel = !hasPlan && !running && status === 'processing' ? 'Chưa có bản vẽ' : status === 'done' ? 'Hoàn thành' : status === 'processing' ? 'Đang xử lý' : 'Cần duyệt';
        const reviewed = formatNumber(project.wallsReviewedCount, { grouping: false });
        const total = formatNumber(project.wallsTotalCount, { grouping: false });
        const progressRatio = project.wallsTotalCount > 0 ? project.wallsReviewedCount / project.wallsTotalCount : 0;

        return {
          id: project.id,
          name: project.name,
          // U03: chưa đặt tỷ lệ thì diện tích chỉ là số tạm tính — nói rõ, không in như số thật.
          statsLabel: `${formatNumber(project.floorCount, { grouping: false })} tầng, ${project.hasScale === false ? `~${formatArea(project.areaM2)} tạm tính, chưa đặt tỷ lệ` : formatArea(project.areaM2)}`,
          updatedLabel: formatTimestamp(project.updatedAtMs, now),
          statusVariant,
          statusLabel,
          progressLabel: `${reviewed}/${total} tường đã duyệt`,
          progressRatio,
          progressPercentLabel: formatPercent(progressRatio, { fractionDigits: 0 }),
          members: project.members,
          planVariant: project.planVariant,
          planSketch: planSketchOf(project.id, project.wallsTotalCount, project.areaM2),
          hasPlan,
          isProcessing: running,
          actionLabel: actionLabelOf(status, hasPlan || running, role === 'viewer'),
        };
      }),
    [sortedProjects, now, role],
  );

  const statusCounts = useMemo<ProjectStatusCounts>(() => {
    let noplan = 0;
    let processing = 0;
    let qc = 0;
    let done = 0;
    // Đếm trên mọi dự án, không theo ô tìm: số chỉ còn ở dòng trạng thái đầu trang, nói về cả danh sách
    // (ô lọc không còn mang số — luật "mỗi số một chỗ"), nên gõ tìm không được đổi nó.
    for (const project of allProjects) {
      const status = filterKeyOf(project);
      if (status === 'noplan') noplan += 1;
      else if (status === 'processing') processing += 1;
      else if (status === 'qc') qc += 1;
      else done += 1;
    }
    return { all: noplan + processing + qc + done, noplan, processing, qc, done };
  }, [allProjects]);

  // The cause and the next step, under the view's "Không tải được danh sách dự án" heading — the old
  // fallback repeated that heading word for word, and `Error.message` could be raw English (BUG-130).
  const errorMessage = listQuery.isError ? listErrorMessageOf(listQuery.error) : null;
  const canRetry = !listQuery.isError || toAppError(listQuery.error).kind !== 'forbidden';

  const state = useMemo<SevenState>(() => {
    // Loading and a failed read beat the narrow overlay: with no list there is nothing
    // to re-lay out, and a narrow screen must still say the read failed (BUG-072).
    if (listQuery.isPending) return 'loading';
    if (errorMessage !== null) return 'error';
    if (isNarrow) return 'collapsed';
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
  const canDeleteProject = canDelete && role === 'admin';

  // Registry-arbitrated, so it never fires while a search box or the rename
  // field is focused (`isTextEntryTarget`, `shortcutRegistry.ts`).
  useShortcut(
    { ...CREATE_PROJECT_SHORTCUT, onTrigger: () => options.onCreateProject?.() },
    { enabled: canCreate },
  );

  const openProject = (id: string, source: ProjectOpenSource): void => {
    const project = projectById.get(id);
    if (project === undefined) return;
    const status = derivedStatusOf(project);
    telemetry.track({ name: 'project.open', source, status });
    const path = routeForProject(project, status, role === 'viewer');
    if (options.onOpenProject) {
      options.onOpenProject(path);
    } else {
      navigate(path);
    }
  };

  const openProjectViewer = (id: string): void => {
    const path = ROUTES.project.viewer(id);
    if (options.onOpenProject) {
      options.onOpenProject(path);
    } else {
      navigate(path);
    }
  };

  const openProjectPage = (id: string, page: ProjectPage): void => {
    if (page === 'share' && options.onShareProject) {
      options.onShareProject(id);
      return;
    }
    const path = page === 'export' || page === 'share' ? ROUTES.project.export(id) : page === 'members' ? `${ROUTES.project.settings(id)}?tab=members` : ROUTES.project.settings(id);
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
      options.onToast?.({ message: renameErrorMessage(error), state: 'violation' });
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
    // Trim then NFC, as the server counts (AppBack projects/schemas.py): a pasted NFD name is not refused as too long.
    const trimmed = renameDraft.trim().normalize('NFC');
    setRenamingId(null);
    if (project === undefined || trimmed === '' || trimmed === project.name) return;
    if (trimmed.length < PROJECT_NAME_MIN_LENGTH || trimmed.length > PROJECT_NAME_MAX_LENGTH) {
      options.onToast?.({ message: RENAME_RANGE_MESSAGE, state: 'attention' });
      return;
    }
    void renameTo(project.id, trimmed, project.name, true);
  };

  /** #27 first; the row leaves only once the server has deleted it. A9 asked already, so the toast only confirms (G1-32), no undo. */
  const confirmDelete = async (): Promise<void> => {
    if (pendingDeleteId === null || deleteInFlight.current) return;
    const id = pendingDeleteId;
    deleteInFlight.current = true;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await gateway.remove(id);
    } catch (error) {
      // 404: someone else already deleted it — the screen's wish is met.
      if (readWireError(error)?.code !== 'NOT_FOUND') {
        setDeleteError(deleteErrorMessageOf(error));
        return;
      }
    } finally {
      deleteInFlight.current = false;
      setIsDeleting(false);
    }
    const deletedName = projectById.get(id)?.name;
    setProjects((previous) => previous.filter((entry) => entry.id !== id));
    setPendingDeleteId(null);
    applyInvalidation(queryClient, 'deleteProject', { projectId: id });
    // G1-32: thẻ biến mất thôi thì người dùng không chắc đã xoá xong. Không có "Hoàn tác": xoá đã hỏi trước (A9).
    options.onToast?.({ message: deletedName === undefined ? 'Đã xoá dự án.' : `Đã xoá dự án "${deletedName}".` });
  };

  const pendingDeleteProject = pendingDeleteId === null ? undefined : projectById.get(pendingDeleteId);

  const model: ProjectDashboardModel = {
    state,
    canCreate,
    canDelete,
    canDeleteProject,
    canDuplicate: DASHBOARD_CAPABILITIES.supportsDuplicate,
    errorMessage,
    canRetry,
    viewMode,
    searchQuery,
    statusFilter,
    sortBy,
    statusCounts,
    totalProjects: allProjects.length,
    pulseKey,
    shouldStagger: !hasEnteredOnce,
    rows,
    renamingId,
    renameDraft,
    pendingDeleteId,
    pendingDeleteName: pendingDeleteProject?.name ?? null,
    deleteErrorMessage,
    isDeleting,
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
    openProjectViewer,
    openProjectPage,
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
