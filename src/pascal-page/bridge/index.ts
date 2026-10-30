/**
 * `usePascalProjectBridge` — nối trang 3D riêng (`public/editor3d.html`) với AppBack.
 *
 * Trang không có router hay `SessionBootstrap` của AppFront, nên cầu tự làm đúng
 * các bước ấy bằng CHÍNH hàm của chúng: mở phiên qua cookie làm mới
 * (`startAppSession`), nạp #24 + N15 vào kho (`readProjectDetail`/`readProjectGraph`
 * → `loadProjectGraph`, như `useProjectSpatial`), đọc qua `selectViewerSpatial` như
 * `/3d`, và ghi qua `usePascalEdits.onSceneCommit` → kho → `useFloorLayerAutosave` (N16).
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { denormalizeSpatial } from '@/domain/spatial/normalize';
import type { SpatialGraph } from '@/domain/spatial/types';
import { useFloorLayerAutosave } from '@/hooks/useAutosave';
import { useSession } from '@/hooks/useSession';
import { can } from '@/lib/auth/permissions';
import { getSessionSnapshot } from '@/lib/auth/state';
import { readWireError } from '@/lib/errors/wireError';
import { readSceneStyle, type SceneStyle, type SceneStyleId } from '@/lib/pascal/sceneStyles';
import { toPascalId } from '@/lib/pascal/ids';
import { toPascalScene } from '@/lib/pascal/toPascal';
import type { PascalNode, PascalNodeId, PascalScene } from '@/lib/pascal/types';
import { startAppSession } from '@/routes/sessionSetup';
import { usePascalEdits } from '@/screens/viewer/PascalViewer/usePascalEdits';
import { selectViewerSpatial } from '@/screens/viewer/ViewerShell/viewerShellGateway';
import { useStore } from '@/store';
import type { ProjectRole } from '@/types/project';

import { scaleStatusOf } from '../useScaleStatus';
import { resolveBackHref } from './backHref';
import type { PascalBridge, PascalSaveStatus, PascalSceneGraph } from './types';

export { LAST_APP_PATH_KEY, rememberAppPath, RETURN_TO_PARAM } from './backHref';
export type { PascalBridge, PascalSaveStatus, PascalSceneGraph } from './types';

export const BRIDGE_SESSION_ERROR = 'Phiên đăng nhập đã hết. Đăng nhập lại rồi mở lại mô hình 3D.';
export const BRIDGE_NOT_FOUND_ERROR = 'Không tìm thấy dự án này, hoặc bạn chưa được thêm vào dự án.';
export const BRIDGE_LOAD_ERROR = 'Không tải được mô hình của dự án. Tải lại trang để thử lại.';
export const BRIDGE_EMPTY_ERROR = 'Dự án chưa có mô hình để mở trong 3D.';

/** Câu khi lượt gửi N16 hỏng mà không có dải khối nào nêu lý do. */
export const BRIDGE_SAVE_FAILED = 'Lưu thất bại. Kiểm tra mạng rồi sửa tiếp để thử lại.';

/** Câu báo một lần mỗi phiên cho phần sửa máy chủ chưa nhận (`unsavedPascalEdits`). */
export const unsavedNoticeOf = (labels: readonly string[]): string =>
  `Chưa lưu được: ${labels.join(', ')} — sẽ có ở bản sau.`;

/** Câu ném cho editor khi tầng bị khối (409/422/403) — lý do đầy đủ + "Tải lại tầng" ở thẻ trang. */
export const BRIDGE_SAVE_BLOCKED = 'Tầng này chưa lưu được lên máy chủ. Xem thẻ ở góc trên để tải lại tầng.';

class BridgeLoadError extends Error {}

/**
 * Cảnh 3D không dựng nội dung của tầng chưa có tỷ lệ (Codex P1): tỷ lệ mặc định 1 mm/px hay nhà
 * co dưới 3 m cho ra sàn cao mảnh, sai hẳn. Tầng vẫn còn trong danh sách tầng (trống); dải cảnh
 * báo nêu tên và dẫn tới "Đặt tỷ lệ". Hai cảnh trước/sau lượt sửa cùng bỏ tầng ấy, nên không có
 * lệnh xoá nào sinh ra cho nó.
 */
export function withoutFloorContents(graph: SpatialGraph, floorIds: ReadonlySet<string>): SpatialGraph {
  if (floorIds.size === 0) return graph;
  const removed = new Set<string>();
  const kept = <T extends { readonly id: string }>(items: readonly T[], drop: (item: T) => boolean) =>
    items.filter((item) => {
      if (!drop(item)) return true;
      removed.add(item.id);
      return false;
    });
  const onFloor = (item: { readonly levelId: string }) => floorIds.has(item.levelId);
  const walls = kept(graph.walls, onFloor);
  const openings = kept(graph.openings, (opening) => removed.has(opening.wallId));
  const furniture = kept(graph.furniture, onFloor);
  const rooms = kept(graph.rooms, onFloor);
  const axes = kept(graph.axes, onFloor);
  const dimensions = kept(graph.dimensions, onFloor);
  const roofs = graph.roofs === undefined ? undefined : kept(graph.roofs, onFloor);

  return {
    ...graph,
    walls,
    openings,
    furniture,
    rooms,
    axes,
    dimensions,
    notes: graph.notes.filter((note) => !removed.has(note.entityId)),
    ...(roofs === undefined ? {} : { roofs }),
  };
}

/** Khoá siêu dữ liệu đánh dấu tầng bị bỏ nội dung — danh sách tầng của editor làm mờ nó và ghi "Chưa dựng". */
export const NOT_BUILT_KEY = 'appfrontNotBuilt';

/**
 * UX-R2 K36: gắn `metadata.appfrontNotBuilt` lên node tầng bị `withoutFloorContents` bỏ nội dung.
 * Chỉ để hiển thị: `toSpatial` không đọc khoá này, và cảnh trước/sau lượt sửa cùng mang nó.
 */
export function markNotBuilt(scene: PascalScene, floorIds: ReadonlySet<string>): PascalScene {
  if (floorIds.size === 0) return scene;
  const nodes: Record<PascalNodeId, PascalNode> = { ...scene.nodes };
  floorIds.forEach((floorId) => {
    const id = toPascalId('level', floorId);
    const node = nodes[id];
    if (node !== undefined) nodes[id] = { ...node, metadata: { ...node.metadata, [NOT_BUILT_KEY]: true } } as PascalNode;
  });
  return { ...scene, nodes };
}

/** Phong cách cảnh của lượt mở trang (W4a) — thẻ "Phong cách" đọc nó. */
export interface ProjectSceneStyle {
  readonly projectId: string;
  readonly id: SceneStyleId;
  /** Ghi phong cách vào dự án (PUT N6, ném khi hỏng); vắng khi không có quyền sửa cài đặt hoặc chưa đọc được cài đặt. */
  readonly saveToProject?: (id: SceneStyleId) => Promise<void>;
}

let projectSceneStyle: ProjectSceneStyle | null = null;

/** Phong cách của dự án đang mở; `null` trước khi cầu nạp xong. */
export const currentProjectSceneStyle = (): ProjectSceneStyle | null => projectSceneStyle;

/** Khoá cửa sổ mà bản vá danh sách tầng của vendor đọc (chỉ hiển thị, không vào cảnh nên không vào đường lưu). */
export const UNDRAWN_FLOORS_KEY = '__appfrontUndrawnFloors';

/** Tên các tầng của dự án chưa có trong đồ thị không gian (chưa có bản vẽ), tầng cao ở trên như danh sách tầng. */
export function undrawnFloorNames(
  floors: readonly { readonly id: string; readonly name: string; readonly order: number }[],
  drawnIds: ReadonlySet<string>,
): string[] {
  return floors
    .filter((floor) => !drawnIds.has(floor.id))
    .sort((a, b) => b.order - a.order)
    .map((floor) => floor.name);
}

let separateUnits = false;

/**
 * Thiết lập dự án "Đây là các căn hộ riêng" (`separateUnits` của N5), đọc lúc cầu nạp: bật thì
 * editor chỉ xem một tầng, không chồng tầng. Trang chỉ vẽ editor sau khi cầu nạp xong, nên đọc lúc
 * render là đủ. ponytail: đọc một lần mỗi lượt mở, đổi ở màn khác thì tải lại trang mới thấy.
 */
export const isSeparateUnits = (): boolean => separateUnits;

/** Lượt `onSave` gần nhất của cầu — `savePascalNow` đợi nó. */
let lastSave: Promise<unknown> = Promise.resolve();

/**
 * Lưu NGAY cảnh Pascal rồi đợi lượt ghi qua cầu xong (ném nếu lượt ấy bị từ chối). Gói
 * editor không xuất `saveNow`, nên đi đúng lối phím tắt của nó: Ctrl+S (`use-save-shortcut.ts`,
 * bắt ở pha capture trên `window`) → `saveNow` → `executeSave` gọi `onSave` ngay trong lượt
 * phát sự kiện, trước khi `dispatchEvent` trả về.
 */
export async function savePascalNow(): Promise<void> {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', key: 's', ctrlKey: true, cancelable: true }));
  await lastSave;
}

const messageOf = (error: unknown): string => {
  if (error instanceof BridgeLoadError) return error.message;

  const wire = readWireError(error);
  if (wire?.status === 401) return BRIDGE_SESSION_ERROR;
  if (wire?.status === 404 || wire?.status === 403) return BRIDGE_NOT_FOUND_ERROR;

  return BRIDGE_LOAD_ERROR;
};

async function loadProject(projectId: string): Promise<{ readonly projectName: string; readonly style: SceneStyle }> {
  if (!(await startAppSession())) throw new BridgeLoadError(BRIDGE_SESSION_ERROR);

  const [{ createAppApiClient }, { readProjectDetail, readProjectGraph, toProjectSpatial }, { loadProjectGraph }] =
    await Promise.all([import('@/api/appClient'), import('@/api/floorLayerGraph'), import('@/store/projectHydration')]);
  const client = createAppApiClient();
  // N5 lỗi thì vẫn mở trang, phong cách lùi về bộ nhớ máy (W4a).
  const settingsRead = (async () => {
    const result = await client.projectSettings.read({ projectId });
    return result.ok ? result.data : null;
  })().catch(() => null);
  const floorsRead = (async () => {
    const result = await client.floors.list({ projectId });
    return result.ok ? result.data : [];
  })().catch(() => []);
  const project = await readProjectDetail(client.projects, { projectId });
  const document = await readProjectGraph(client.spatial, { projectId });
  /* Chưa có tầng nào thì không có chỗ để vẽ — báo trạng thái rỗng (C15). Có tầng mà chưa
     có tường thì vẫn mở: người dùng vẽ tường ngay trong 3D. */
  if (document.graph.levels.length === 0) {
    throw new BridgeLoadError(BRIDGE_EMPTY_ERROR);
  }
  const session = getSessionSnapshot();

  /* U52: tầng chưa có bản vẽ không có trong N15 nên danh sách tầng chỉ thấy tầng đã vẽ. Ghi tên để
     danh sách vẽ thêm dòng mờ "Chưa có bản vẽ" (chỉ hiển thị, không là node cảnh). */
  const drawn = new Set(document.graph.levels.map((level) => level.id));
  (window as unknown as Record<string, unknown>)[UNDRAWN_FLOORS_KEY] = undrawnFloorNames(await floorsRead, drawn);

  loadProjectGraph(toProjectSpatial(project, document, { roles: session.roles, userId: session.user?.id ?? null }));
  /* UX-R2 K39: bắt đầu xét tỷ lệ ngay khi kho có cảnh, song song với lượt tải gói editor — `onLoad`
     và dải cảnh báo dùng lại đúng lượt này (memo của `scaleStatusOf`), không đợi thêm một vòng. */
  void scaleStatusOf(projectId);

  const settings = await settingsRead;
  separateUnits = settings?.separateUnits === true;
  const style = readSceneStyle(() => localStorage, { id: projectId, style: settings?.sceneStyle });
  // Cùng cổng vai như hook: vai theo dự án vừa nạp trước, phiên dự phòng.
  const storeRoles = useStore.getState().userRoles;
  const canEditSettings = can('edit', 'project.settings', { roles: storeRoles.length > 0 ? storeRoles : session.roles });

  projectSceneStyle = {
    projectId,
    id: style.id,
    ...(settings !== null && canEditSettings
      ? {
          // Gửi đủ thân như màn Cài đặt, đúng `revision` vừa đọc; 409 thì ném, thẻ báo lỗi.
          saveToProject: async (id: SceneStyleId) => {
            const { revision, ...body } = settings;
            const result = await client.projectSettings.replace({
              projectId,
              baseVersion: revision,
              body: { ...body, sceneStyle: id },
            });
            if (!result.ok) throw result.error;
          },
        }
      : {}),
  };

  return { projectName: project.name, style };
}

interface LoadState {
  readonly status: PascalBridge['status'];
  readonly error?: string;
  readonly projectName?: string;
  readonly style?: SceneStyle;
}

/**
 * `applyScene` — đặt cảnh vào editor đúng lối nạp (`applySceneGraphToEditor`: không bước hoàn tác,
 * không đụng camera). Cầu gọi nó khi một lượt sửa bị từ chối để cảnh 3D quay về khớp kho.
 */
export function usePascalProjectBridge(projectId: string, applyScene?: (scene: PascalSceneGraph) => void): PascalBridge {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const { style } = load;
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
      ({ projectName, style }) => !cancelled && setLoad({ status: 'ready', projectName, style }),
      (error: unknown) => !cancelled && setLoad({ status: 'error', error: messageOf(error) }),
    );

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  /* Bộ tự lưu tầng dùng chung (A7): mỗi `commit` của `usePascalEdits` đổi kho, saver gửi N16.
     Trạng thái thật của nó (đang lưu / đã lưu / bị khối) lên thẻ trang — "đã lưu" của Pascal chỉ
     là lượt vào kho, không phải lượt PUT (v3 BE.md major 1). */
  const { autosave, isFloorBlocked, label: savedLabel, reloadFloor, saveBlock } = useFloorLayerAutosave({ projectId });
  const engineState = useSyncExternalStore(autosave.subscribe, autosave.getState, autosave.getState);

  // Phần sửa chưa lưu được: mỗi nhãn báo một lần mỗi phiên, gộp vào một câu.
  const [notice, setNotice] = useState<{ readonly text: string; readonly tone: 'info' | 'alert' } | null>(null);
  const noticed = useRef(new Set<string>());
  const noticedMessages = useRef(new Set<string>());
  const onUnsaved = useCallback((labels: readonly string[]) => {
    /* V9 — lượt sửa không còn phần nào chưa lưu: gỡ câu báo cũ và cho các nhãn báo lại được.
       Lời báo của chính lượt này (`onNotice`) tới SAU câu gọi này nên không bị gỡ. */
    if (labels.length === 0) {
      noticed.current.clear();
      setNotice(null);
      return;
    }

    const fresh = labels.filter((item) => !noticed.current.has(item));

    if (fresh.length === 0) return;
    fresh.forEach((item) => noticed.current.add(item));
    setNotice({ text: unsavedNoticeOf(fresh), tone: 'info' });
  }, []);
  // Lời báo của lượt sửa (vd. vách mới cần tách phòng — W3d): mỗi câu một lần mỗi phiên, nối vào thẻ.
  const onNotice = useCallback((message: string) => {
    if (noticedMessages.current.has(message)) return;
    noticedMessages.current.add(message);
    setNotice((current) => (current === null ? { text: message, tone: 'info' } : { ...current, text: `${current.text} ${message}` }));
  }, []);
  const dismissNotice = useCallback(() => setNotice(null), []);


  const save: PascalSaveStatus = {
    state: saveBlock !== null ? 'blocked' : engineState === 'failed' ? 'failed' : engineState === 'saved' ? 'saved' : 'saving',
    label: savedLabel,
    blockMessage: saveBlock?.message ?? null,
    onReloadFloor: () => void reloadBlockedFloor(),
    notice: notice?.text ?? null,
    noticeTone: notice?.tone ?? 'info',
    dismissNotice,
  };

  // Mốc "trước" của lượt sửa đầu: đúng cảnh vừa trao cho Pascal ở `onLoad`.
  const [loadedScene, setLoadedScene] = useState<PascalScene | null>(null);
  const rejection = useRef<string | null>(null);
  const onRejected = useCallback((reason: string) => {
    rejection.current = reason;
    // N1 — lượt bị từ chối phải thấy được trên thẻ, không chỉ là lỗi ném cho editor (nó có thể nuốt).
    setNotice({ text: reason, tone: 'alert' });
  }, []);
  const { onSceneCommit } = usePascalEdits({
    spatial,
    loadedScene,
    readOnly,
    onRejected,
    onUnsaved,
    onNotice,
    ...(session.user?.id === undefined ? {} : { actorId: session.user.id }),
  });

  /* Đọc kho lúc gọi chứ không theo render: sau mỗi lượt sửa kho đổi, và một `onLoad`
     đổi danh tính sẽ khiến trang nạp lại cảnh đè lên việc đang làm. */
  /* Phong cách cảnh chốt MỘT lần mỗi lượt mở trang (J9, W4a: dự án → máy → mặc định): mọi
     `toPascalScene` dùng chung nó, không thì giá trị sinh ra lệch nhau → "sửa ma". */
  /* Tầng chưa có tỷ lệ (cùng danh sách của dải cảnh báo): chốt ở `onLoad`, mọi lượt dựng lại dùng chung. */
  const missingFloors = useRef<ReadonlySet<string>>(new Set());
  const sceneFromStore = useCallback((): PascalScene | null => {
    const current = selectViewerSpatial(useStore.getState());
    if (current === null) return null;

    const graph = withoutFloorContents(denormalizeSpatial(current), missingFloors.current);
    const scene = toPascalScene(graph, { style: style ?? readSceneStyle(() => localStorage) }).scene;

    return markNotBuilt(scene, missingFloors.current);
  }, [style]);

  /* Tải lại tầng bị khối (409/422/403): bỏ bản chưa lưu được, nạp lại tầng từ máy chủ vào kho rồi
     dựng lại cảnh từ kho. Không có `applyScene` thì nạp lại cả trang như trước. */
  const reloadBlockedFloor = useCallback(async () => {
    const target = useStore.getState().unsavedFloorIds.find(isFloorBlocked);
    const reason = saveBlock?.message ?? null;

    if (target !== undefined) await reloadFloor(target);
    const restored = applyScene === undefined ? null : sceneFromStore();
    if (restored === null) {
      window.location.reload();
      return;
    }
    applyScene?.(restored);
    if (reason !== null) setNotice({ text: reason, tone: 'alert' });
  }, [applyScene, isFloorBlocked, reloadFloor, saveBlock, sceneFromStore]);

  const onLoad = useCallback(async (): Promise<PascalSceneGraph> => {
    const scale = await scaleStatusOf(projectId);
    missingFloors.current = new Set(scale.status === 'unresolved' ? scale.missingIds : []);
    const scene = sceneFromStore();
    if (scene === null) throw new BridgeLoadError(BRIDGE_EMPTY_ERROR);
    setLoadedScene(scene);

    return scene;
  }, [projectId, sceneFromStore]);

  const onSave = useCallback(
    async (scene: unknown): Promise<void> => {
      if (readOnly) return;

      rejection.current = null;
      const pending = onSceneCommit(scene as PascalScene).then(async (ok) => {
        // `false` mà không có lời từ chối là "không có gì để ghi" (sửa node sinh ra) — vẫn là thành công.
        if (!ok && rejection.current !== null) {
          /* Lượt bị từ chối (luật toàn vẹn, node lạ, lệnh hỏng): kho không đổi, nên dựng lại cảnh
             từ kho để 3D khớp dữ liệu thật thay vì giữ phần sửa ma. */
          const restored = sceneFromStore();
          if (restored !== null) applyScene?.(restored);
          throw new Error(rejection.current);
        }
        if (!ok) return;
        /* Đợi đúng lượt PUT N16 rồi mới báo Pascal "đã lưu": lượt gửi hỏng hay tầng bị khối thì
           ném, để chỉ báo của editor không nói "đã lưu" khi máy chủ chưa nhận. */
        await autosave.saveNow().catch(() => undefined);
        if (useStore.getState().unsavedFloorIds.some(isFloorBlocked)) throw new Error(BRIDGE_SAVE_BLOCKED);
        if (autosave.getState() === 'failed') throw new Error(BRIDGE_SAVE_FAILED);
      });
      lastSave = pending;
      await pending;
    },
    [applyScene, autosave, isFloorBlocked, onSceneCommit, readOnly, sceneFromStore],
  );

  return {
    ...load,
    readOnly,
    backHref,
    onLoad,
    onSave,
    ...(readOnly ? {} : { save }),
  };
}
