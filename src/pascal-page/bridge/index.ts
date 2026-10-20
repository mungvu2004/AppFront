/**
 * `usePascalProjectBridge` — nối trang 3D riêng (`public/editor3d.html`) với AppBack.
 *
 * Trang không có router hay `SessionBootstrap` của AppFront, nên cầu tự làm đúng
 * các bước ấy bằng CHÍNH hàm của chúng: mở phiên qua cookie làm mới
 * (`startAppSession`), nạp #24 + N15 vào kho (`readProjectDetail`/`readProjectGraph`
 * → `loadProjectGraph`, như `useProjectSpatial`), đọc qua `selectViewerSpatial` như
 * `/3d`, và ghi qua `usePascalEdits.onSceneCommit` → kho → `useFloorLayerAutosave` (N16).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { denormalizeSpatial } from '@/domain/spatial/normalize';
import { useFloorLayerAutosave } from '@/hooks/useAutosave';
import { useSession } from '@/hooks/useSession';
import { can } from '@/lib/auth/permissions';
import { getSessionSnapshot } from '@/lib/auth/state';
import { readWireError } from '@/lib/errors/wireError';
import { toPascalScene } from '@/lib/pascal/toPascal';
import type { PascalScene } from '@/lib/pascal/types';
import { startAppSession } from '@/routes/sessionSetup';
import { PASCAL_REJECTED_FALLBACK, usePascalEdits } from '@/screens/viewer/PascalViewer/usePascalEdits';
import { selectViewerSpatial } from '@/screens/viewer/ViewerShell/viewerShellGateway';
import { useStore } from '@/store';
import type { ProjectRole } from '@/types/project';

import { resolveBackHref } from './backHref';
import type { PascalBridge, PascalSceneGraph } from './types';

export { LAST_APP_PATH_KEY, rememberAppPath, RETURN_TO_PARAM } from './backHref';
export type { PascalBridge, PascalSceneGraph } from './types';

export const BRIDGE_SESSION_ERROR = 'Phiên đăng nhập đã hết. Đăng nhập lại rồi mở lại mô hình 3D.';
export const BRIDGE_NOT_FOUND_ERROR = 'Không tìm thấy dự án này, hoặc bạn chưa được thêm vào dự án.';
export const BRIDGE_LOAD_ERROR = 'Không tải được mô hình của dự án. Tải lại trang để thử lại.';
export const BRIDGE_EMPTY_ERROR = 'Dự án chưa có mô hình để mở trong 3D.';

class BridgeLoadError extends Error {}

const messageOf = (error: unknown): string => {
  if (error instanceof BridgeLoadError) return error.message;

  const wire = readWireError(error);
  if (wire?.status === 401) return BRIDGE_SESSION_ERROR;
  if (wire?.status === 404 || wire?.status === 403) return BRIDGE_NOT_FOUND_ERROR;

  return BRIDGE_LOAD_ERROR;
};

async function loadProject(projectId: string): Promise<string> {
  if (!(await startAppSession())) throw new BridgeLoadError(BRIDGE_SESSION_ERROR);

  const [{ createAppApiClient }, { readProjectDetail, readProjectGraph, toProjectSpatial }, { loadProjectGraph }] =
    await Promise.all([import('@/api/appClient'), import('@/api/floorLayerGraph'), import('@/store/projectHydration')]);
  const client = createAppApiClient();
  const project = await readProjectDetail(client.projects, { projectId });
  const document = await readProjectGraph(client.spatial, { projectId });
  // Chưa có tường lẫn phòng thì Pascal chỉ mở lưới trống không lời nào — báo trạng thái rỗng (C15).
  if (document.graph.walls.length === 0 && document.graph.rooms.length === 0) {
    throw new BridgeLoadError(BRIDGE_EMPTY_ERROR);
  }
  const session = getSessionSnapshot();

  loadProjectGraph(toProjectSpatial(project, document, { roles: session.roles, userId: session.user?.id ?? null }));

  return project.name;
}

interface LoadState {
  readonly status: PascalBridge['status'];
  readonly error?: string;
  readonly projectName?: string;
}

export function usePascalProjectBridge(projectId: string): PascalBridge {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  // Đọc một lần lúc mở trang: màn vừa rời (N1-01, N5-13, N3-09), không có thì Quản lý tầng.
  const [backHref] = useState(() => resolveBackHref(projectId));
  const session = useSession();
  const storeRoles = useStore((state) => state.userRoles);
  const spatial = useStore((state) => state.spatial);

  // Cùng cổng quyền với `PascalViewer.container`: vai theo dự án trước, phiên dự phòng.
  const roles: readonly ProjectRole[] = storeRoles.length > 0 ? storeRoles : session.roles;
  const readOnly = !can('edit', 'layer', { roles });

  useEffect(() => {
    let cancelled = false;

    setLoad({ status: 'loading' });
    loadProject(projectId).then(
      (projectName) => !cancelled && setLoad({ status: 'ready', projectName }),
      (error: unknown) => !cancelled && setLoad({ status: 'error', error: messageOf(error) }),
    );

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Bộ tự lưu tầng dùng chung (A7): mỗi `commit` của `usePascalEdits` đổi kho, saver gửi N16.
  useFloorLayerAutosave({ projectId });

  // Mốc "trước" của lượt sửa đầu: đúng cảnh vừa trao cho Pascal ở `onLoad`.
  const [loadedScene, setLoadedScene] = useState<PascalScene | null>(null);
  const rejection = useRef<string | null>(null);
  const onRejected = useCallback((reason: string) => {
    rejection.current = reason;
  }, []);
  const { onSceneCommit } = usePascalEdits({
    spatial,
    loadedScene,
    readOnly,
    onRejected,
    ...(session.user?.id === undefined ? {} : { actorId: session.user.id }),
  });

  /* Đọc kho lúc gọi chứ không theo render: sau mỗi lượt sửa kho đổi, và một `onLoad`
     đổi danh tính sẽ khiến trang nạp lại cảnh đè lên việc đang làm. */
  const onLoad = useCallback(async (): Promise<PascalSceneGraph> => {
    const current = selectViewerSpatial(useStore.getState());
    if (current === null) throw new BridgeLoadError(BRIDGE_EMPTY_ERROR);

    const { scene } = toPascalScene(denormalizeSpatial(current));
    setLoadedScene(scene);

    return scene;
  }, []);

  const onSave = useCallback(
    async (scene: unknown): Promise<void> => {
      if (readOnly) return;

      rejection.current = null;
      if (!(await onSceneCommit(scene as PascalScene))) {
        throw new Error(rejection.current ?? PASCAL_REJECTED_FALLBACK);
      }
    },
    [onSceneCommit, readOnly],
  );

  return {
    ...load,
    readOnly,
    backHref,
    onLoad,
    onSave,
  };
}
