import { useQuery } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import type { ApiClient, Project as ApiProject } from '@/api/client';
import type { SpatialGraphDocument } from '@/api/schemas/spatialGraph';
import { getSessionSnapshot } from '@/lib/auth/state';
import { readWireError } from '@/lib/errors/wireError';
import { CACHE_POLICY } from '@/lib/query/cachePolicy';
import { queryKeys } from '@/lib/query/queryKeys';
import { createScreenErrorRecorder, type ScreenErrorReport } from '@/lib/screen-state/screenErrorBoundary';
import { useStore } from '@/store';
import { loadProjectGraph } from '@/store/projectHydration';

/**
 * Đường nạp kho của một dự án — B-V12-01, đổi sang #24 + N15 ở F-04x-2.
 *
 * Hai truy vấn: #24 dưới `queryKeys.project.detail` (dự án thô, chung bộ đệm với
 * `mobileViewerQueries.ts`), N15 dưới `queryKeys.layer.graph` (`staleTime` 0, luôn bật: mỗi lần
 * cổng gắn và mỗi lượt F-05b/F-08 vô hiệu là một lượt làm mới). Quyết định nạp đè hay làm
 * mới nằm ở `loadProjectGraph` và chỉ đọc `spatialProjectId` — không bao giờ đọc lịch sử hoàn tác.
 */

/** Telemetry của cổng — một mã cho mọi màn nó bọc. */
const SCREEN_ID = 'project-spatial';

export type ProjectSpatialStatus = 'idle' | 'loading' | 'error' | 'notFound' | 'ready';

/**
 * 404 của chính dự án (không tồn tại, hoặc không phải thành viên — K08). Đọc theo
 * `resource` của dây, không theo `kind`: `kind: 'notFound'` còn đến từ regex /missing/.
 */
export function isProjectNotFound(error: unknown): boolean {
  const wire = readWireError(error);

  return wire?.status === 404 && wire.resource === 'project';
}

/** Client của cổng; `ruleConfig` vắng thì bỏ lượt nạp N21. */
export type ProjectSpatialApi = Pick<ApiClient, 'projects' | 'spatial'> & Partial<Pick<ApiClient, 'ruleConfig'>>;

export interface UseProjectSpatialOptions {
  readonly projectId: string | undefined;
  /** Client cho bài kiểm; vắng thì là client của ứng dụng. */
  readonly api?: ProjectSpatialApi | undefined;
}

export interface UseProjectSpatialResult {
  readonly status: ProjectSpatialStatus;
  /** Lỗi đã phân loại và đã ghi telemetry; `null` khi không lỗi. */
  readonly report: ScreenErrorReport | null;
  /** N15 hỏng khi kho đã có đồ thị của dự án: màn con còn, cổng hiện dải "Thử lại". */
  readonly refreshFailed: boolean;
  readonly retry: () => void;
}

/**
 * Nạp lười client và bộ đọc: cổng bọc cả màn luật, xuất, dữ liệu, 3D, điện thoại, và
 * nhập tĩnh `appClient` (kèm client giả của bản dev) đẩy "chi phí thêm cho một màn"
 * của màn luật qua trần 280 KiB (`pnpm size`). Cả hai module vốn đã là chunk dùng chung.
 */
const loadClient = async (api: ProjectSpatialApi | undefined): Promise<ProjectSpatialApi> =>
  api ?? (await import('@/api/appClient')).createAppApiClient();

const loadReaders = () => import('@/api/floorLayerGraph');

/** N21 một lần sau `hydrateProject`, khi chưa ai (RuleSettings) nạp cấu hình luật của dự án này. */
async function hydrateRuleConfigOnce(api: ProjectSpatialApi | undefined, projectId: string): Promise<void> {
  const client = await loadClient(api);

  if (client.ruleConfig === undefined) {
    return;
  }

  const result = await client.ruleConfig.read({ projectId });
  const state = useStore.getState();

  if (!result.ok || state.ruleConfigProjectId === projectId || state.spatialProjectId !== projectId) {
    return;
  }

  state.hydrateRuleConfig({ overrides: result.data.overrides, projectId, revision: result.data.revision });
}

export function useProjectSpatial({ api, projectId }: UseProjectSpatialOptions): UseProjectSpatialResult {
  const recorder = useMemo(() => createScreenErrorRecorder(SCREEN_ID), []);
  const ruleConfigRequested = useRef(new Set<string>());
  /** Tài liệu N15 đã áp: #24 về sau (đổi tên, thành viên) không áp lại N15 cũ (review-1 P2-1). */
  const appliedDocumentRef = useRef<SpatialGraphDocument | null>(null);

  /*
   * Đồ thị của dự án này: mang `spatialProjectId` của nó, hoặc không nguồn (`setSpatial(…, null)`,
   * nạp ngoài đường sản phẩm) mà `project` là nó. Vế sau chỉ thôi `loading` ([4]); `loadProjectGraph`
   * vẫn nạp đè khi N15 về vì kho chưa mang `spatialProjectId`.
   */
  const hasGraph = useStore(
    (state) =>
      state.spatial !== null &&
      (state.spatialProjectId === projectId || (state.spatialProjectId === null && state.project?.id === projectId)),
  );
  const setSpatialLoading = useStore((state) => state.setSpatialLoading);
  const enabled = projectId !== undefined;

  const projectQuery = useQuery({
    enabled,
    queryFn: async ({ signal }): Promise<ApiProject> => {
      const [{ readProjectDetail }, client] = await Promise.all([loadReaders(), loadClient(api)]);

      return readProjectDetail(client.projects, { projectId: projectId ?? '', signal });
    },
    queryKey: queryKeys.project.detail(projectId ?? ''),
  });

  const graphQuery = useQuery({
    enabled,
    queryFn: async ({ signal }): Promise<SpatialGraphDocument> => {
      const [{ readProjectGraph }, client] = await Promise.all([loadReaders(), loadClient(api)]);

      return readProjectGraph(client.spatial, { projectId: projectId ?? '', signal });
    },
    queryKey: queryKeys.layer.graph(projectId ?? ''),
    staleTime: CACHE_POLICY.projectSpatialLoad.staleTime,
  });

  const projectFailed = projectQuery.isError;
  const graphFailed = graphQuery.isError;
  const blocked = projectFailed || (graphFailed && !hasGraph);
  const needsLoad = enabled && !hasGraph;

  /*
   * Bật cờ TRƯỚC lượt vẽ đầu, để màn con không kịp vẽ `empty` của kho rỗng. Chỉ khi kho chưa
   * có đồ thị của dự án: làm mới nền không bật cờ. Dọn dẹp là đường tắt cờ duy nhất ngoài
   * `setSpatial`: lỗi, gỡ cổng, đổi dự án.
   */
  useLayoutEffect(() => {
    if (!needsLoad || blocked) {
      return undefined;
    }

    setSpatialLoading(true);

    return () => {
      setSpatialLoading(false);
    };
  }, [blocked, needsLoad, projectId, setSpatialLoading]);

  const project = projectQuery.data;
  const { data: document, isFetchedAfterMount, isFetching } = graphQuery;

  useEffect(() => {
    /* Chỉ ghi câu trả lời N15 của lượt đọc NÀY: bản đệm của lượt trước có thể là kho đã bị thay. */
    if (project === undefined || document === undefined || !isFetchedAfterMount || isFetching || project.id !== projectId) {
      return undefined;
    }

    const latest = useStore.getState();
    if (document === appliedDocumentRef.current && latest.spatial !== null && latest.spatialProjectId === projectId) {
      return undefined;
    }

    let cancelled = false;

    void loadReaders().then(({ toProjectSpatial }) => {
      if (cancelled) {
        return;
      }

      const session = getSessionSnapshot();
      const loaded = loadProjectGraph(
        toProjectSpatial(project, document, { roles: session.roles, userId: session.user?.id ?? null }),
      );
      appliedDocumentRef.current = document;

      if (loaded === 'hydrated' && !ruleConfigRequested.current.has(project.id)) {
        ruleConfigRequested.current.add(project.id);
        void hydrateRuleConfigOnce(api, project.id).catch(() => undefined);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [api, document, isFetchedAfterMount, isFetching, project, projectId]);

  const blockingError = projectFailed ? projectQuery.error : graphFailed && !hasGraph ? graphQuery.error : null;
  const report = useMemo(
    () => (blockingError === null ? null : recorder.receive(blockingError, { screenId: SCREEN_ID })),
    [blockingError, recorder],
  );

  const refetchProject = projectQuery.refetch;
  const refetchGraph = graphQuery.refetch;
  const retry = useMemo(
    () => () => {
      recorder.reset();

      if (projectFailed) {
        void refetchProject();
      }

      void refetchGraph();
    },
    [projectFailed, recorder, refetchGraph, refetchProject],
  );

  const status: ProjectSpatialStatus = !enabled
    ? 'idle'
    : projectFailed && isProjectNotFound(projectQuery.error)
      ? 'notFound'
      : blocked
        ? 'error'
        : needsLoad
          ? 'loading'
          : 'ready';

  return { refreshFailed: enabled && !blocked && graphFailed, report, retry, status };
}
