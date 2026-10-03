import { useQuery } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import { useStore as useVanillaStore } from 'zustand';

import type { ApiClient } from '@/api/client';
import { CACHE_POLICY } from '@/lib/query/cachePolicy';
import { queryKeys } from '@/lib/query/queryKeys';
import { createScreenErrorRecorder, type ScreenErrorReport } from '@/lib/screen-state/screenErrorBoundary';
import { useStore, type RootState } from '@/store';

/**
 * Đường nạp kho của một dự án — B-V12-01 (Q1).
 *
 * Trước hook này, `setProject`/`setFloors` không có nơi gọi nào ngoài kho và bài
 * kiểm, nên mọi màn đọc kho (luật, xuất, dữ liệu, 3D, điện thoại) đứng ở `empty`
 * khi người dùng đi bằng đường sản phẩm. Hook đọc N3 + N16 qua
 * `readProjectSpatial` rồi ghi kho một lượt, đồng bộ.
 */

/** Telemetry của cổng — một mã cho mọi màn nó bọc. */
const SCREEN_ID = 'project-spatial';

/**
 * Kho có cần nạp cho `projectId` không.
 *
 * - Kho rỗng: nạp.
 * - Kho của dự án khác: nạp.
 * - Kho có đồ thị mà chưa có dự án (một màn QC đã nạp tầng của nó): chỉ nạp đè
 *   khi chưa có bản sửa nào trong lịch sử hoàn tác.
 *
 * ponytail: "chưa sửa" đọc bằng `pastStates`, cùng khuôn `floorManagerGateway`
 * ("kho có thì giữ, không đè sửa chưa lưu"); kho mang mã dự án theo đồ thị thì
 * thay vế này.
 */
export function needsProjectSpatial(
  state: Pick<RootState, 'project' | 'spatial'>,
  pastCount: number,
  projectId: string,
): boolean {
  if (state.spatial === null) {
    return true;
  }

  return state.project !== null ? state.project.id !== projectId : pastCount === 0;
}

export type ProjectSpatialStatus = 'idle' | 'loading' | 'error' | 'ready';

export interface UseProjectSpatialOptions {
  readonly projectId: string | undefined;
  /** Client cho bài kiểm; vắng thì là client của ứng dụng. */
  readonly api?: Pick<ApiClient, 'projects' | 'spatial'> | undefined;
}

export interface UseProjectSpatialResult {
  readonly status: ProjectSpatialStatus;
  /** Lỗi đã phân loại và đã ghi telemetry; `null` khi không lỗi. */
  readonly report: ScreenErrorReport | null;
  readonly retry: () => void;
}

const pastCountOf = (state: { pastStates: readonly unknown[] }): number => state.pastStates.length;

/**
 * Nạp lười client và bộ đọc: cổng bọc cả màn luật, xuất, dữ liệu, 3D, điện thoại, và
 * nhập tĩnh `appClient` (kèm client giả của bản dev) đẩy "chi phí thêm cho một màn"
 * của màn luật qua trần 280 KiB (`pnpm size`). Cả hai module vốn đã là chunk dùng chung.
 */
async function loadProjectSpatial(
  api: UseProjectSpatialOptions['api'],
  projectId: string,
  signal: AbortSignal,
) {
  const [{ readProjectSpatial }, client] = await Promise.all([
    import('@/api/floorLayerGraph'),
    api ?? import('@/api/appClient').then((module) => module.createAppApiClient()),
  ]);

  return readProjectSpatial(client, { projectId, signal });
}

export function useProjectSpatial({ api, projectId }: UseProjectSpatialOptions): UseProjectSpatialResult {
  const recorder = useMemo(() => createScreenErrorRecorder(SCREEN_ID), []);

  const project = useStore((state) => state.project);
  const spatial = useStore((state) => state.spatial);
  const setSpatialLoading = useStore((state) => state.setSpatialLoading);
  const pastCount = useVanillaStore(useStore.temporal, pastCountOf);

  const needsLoad = projectId !== undefined && needsProjectSpatial({ project, spatial }, pastCount, projectId);

  const query = useQuery({
    enabled: needsLoad,
    queryFn: ({ signal }) => loadProjectSpatial(api, projectId ?? '', signal),
    queryKey: [...queryKeys.project.detail(projectId ?? ''), 'spatial'] as const,
    staleTime: CACHE_POLICY.projectSpatialLoad.staleTime,
  });

  const failed = query.isError;

  /*
   * Bật cờ TRƯỚC lượt vẽ đầu, để màn con không kịp vẽ `empty` của kho rỗng.
   * Dọn dẹp là đường tắt cờ duy nhất ngoài `setSpatial`: lỗi, gỡ cổng, đổi dự án.
   */
  useLayoutEffect(() => {
    if (!needsLoad || failed) {
      return undefined;
    }

    setSpatialLoading(true);

    return () => {
      setSpatialLoading(false);
    };
  }, [failed, needsLoad, projectId, setSpatialLoading]);

  const { data, isFetchedAfterMount, isFetching } = query;

  useEffect(() => {
    /* Chỉ ghi câu trả lời của lượt đọc NÀY: bản đệm của lượt trước có thể là kho đã bị thay. */
    if (data === undefined || !isFetchedAfterMount || isFetching || data.project.id !== projectId) {
      return;
    }

    const state = useStore.getState();

    if (!needsProjectSpatial(state, pastCountOf(useStore.temporal.getState()), projectId)) {
      return;
    }

    /* Đồng bộ, không chen `await`: không lượt vẽ nào thấy dự án mới với đồ thị cũ. */
    state.setProject(data.project);
    state.setSpatial(data.graph, data.versionId);
    state.setFloors(data.levels);
  }, [data, isFetchedAfterMount, isFetching, projectId]);

  const report = useMemo(
    () => (failed ? recorder.receive(query.error, { screenId: SCREEN_ID }) : null),
    [failed, query.error, recorder],
  );

  const { refetch } = query;
  const retry = useMemo(
    () => () => {
      recorder.reset();
      void refetch();
    },
    [recorder, refetch],
  );

  const status: ProjectSpatialStatus =
    projectId === undefined ? 'idle' : failed ? 'error' : needsLoad ? 'loading' : 'ready';

  return { report, retry, status };
}
