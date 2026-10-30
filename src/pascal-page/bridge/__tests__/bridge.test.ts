import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSampleBuilding, sampleLevelId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { UpdateProjectSettingsSchema } from '@/api/schemas/projectSettings';
import { SCENE_STYLE_STORAGE_KEY, SCENE_STYLES, sceneStylePreviewKey } from '@/lib/pascal/sceneStyles';
import { createPascalEditCommand } from '@/lib/pascal/fromPascal';
import { toPascalScene } from '@/lib/pascal/toPascal';
import type { PascalScene } from '@/lib/pascal/types';
import type * as ToPascal from '@/lib/pascal/toPascal';
import { useStore } from '@/store';
import type { ProjectRole } from '@/types/project';

import {
  BRIDGE_EMPTY_ERROR,
  BRIDGE_LOAD_ERROR,
  BRIDGE_SAVE_BLOCKED,
  BRIDGE_SAVE_FAILED,
  BRIDGE_SESSION_ERROR,
  currentProjectSceneStyle,
  isSeparateUnits,
  markNotBuilt,
  NOT_BUILT_KEY,
  savePascalNow,
  undrawnFloorNames,
  unsavedNoticeOf,
  usePascalProjectBridge,
  withoutFloorContents,
} from '..';

const session = vi.hoisted(() => ({ ok: true }));
/** N16 giả của từng tầng (Codex P1): mã tầng → `scaleSource`; vắng = tỷ lệ đã xác nhận. */
const scaleApi = vi.hoisted(() => ({ sources: {} as Record<string, 'pipeline' | 'project_default'> }));
/** N5/N6 giả (W4a): `read` = kết quả đọc cài đặt, `puts` = các lượt PUT đã gửi. */
const settingsApi = vi.hoisted(() => ({
  read: { ok: true, data: {} } as { ok: boolean; data?: unknown; error?: unknown },
  puts: [] as unknown[],
}));
const detail = vi.hoisted(() => ({ fail: false, levels: 1, walls: 1, role: 'engineer' as ProjectRole }));
/** Kết quả `onSceneCommit` giả: `reason` khác `null` = có lời từ chối qua `onRejected`. */
const commit = vi.hoisted(() => ({ ok: true, reason: null as string | null, unsaved: [] as string[], notices: [] as string[] }));
/** Bộ tự lưu tầng giả: trạng thái engine, tầng bị khối, câu khối. */
const saver = vi.hoisted(() => ({
  state: 'saved' as string,
  blocked: null as string | null,
  saveNow: { calls: 0 },
  reloaded: [] as string[],
}));

vi.mock('@/routes/sessionSetup', () => ({ startAppSession: () => Promise.resolve(session.ok) }));
vi.mock('@/api/appClient', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createAppApiClient: () => ({
    projects: {},
    spatial: {
      readLayer: ({ floorId }: { floorId: string }) => {
        const scaleSource = scaleApi.sources[floorId];
        return Promise.resolve({
          ok: true,
          data:
            scaleSource === undefined
              ? {}
              : { scaleStatus: 'unresolved', scaleSource, level: { scaleMillimetresPerPixel: 10 } },
        });
      },
    },
    projectSettings: {
      read: () => Promise.resolve(settingsApi.read),
      replace: (input: unknown) => (settingsApi.puts.push(input), Promise.resolve({ ok: true, data: {} })),
    },
  }),
  resolveUseMockApi: () => false,
}));
vi.mock('@/hooks/useAutosave', () => ({
  useFloorLayerAutosave: () => ({
    autosave: {
      subscribe: () => () => undefined,
      getState: () => saver.state,
      saveNow: () => {
        saver.saveNow.calls += 1;
        return Promise.resolve();
      },
    },
    label: saver.state === 'saved' ? 'Đã lưu lúc 10:00' : null,
    saveBlock: saver.blocked === null ? null : { kind: 'reload', message: saver.blocked, confirm: null },
    isFloorBlocked: (floorId: string) => saver.blocked !== null && floorId === 'L-1',
    reloadFloor: (floorId: string) => {
      saver.reloaded.push(floorId);
      return Promise.resolve();
    },
  }),
}));
vi.mock('@/api/floorLayerGraph', () => ({
  readProjectDetail: () =>
    detail.fail ? Promise.reject(new Error('mạng hỏng')) : Promise.resolve({ id: 'p1', name: 'Nhà mẫu' }),
  readProjectGraph: () =>
    Promise.resolve({
      graph: { levels: Array.from({ length: detail.levels }, () => ({})), walls: Array.from({ length: detail.walls }, () => ({})), rooms: [] },
    }),
  toProjectSpatial: () => ({}),
}));
vi.mock('@/store/projectHydration', () => ({
  loadProjectGraph: () => {
    /* eslint-disable-next-line local/no-direct-set -- giả lập kho vừa nạp, như `loadProjectGraph` thật */
    useStore.setState({
      spatial: normalizeSpatial(createSampleBuilding()),
      spatialLoading: false,
      userRoles: [detail.role],
    });

    return 'hydrated';
  },
}));

// Gián điệp quanh hàm thật: xem cầu trao phong cách nào cho `toPascalScene`.
vi.mock('@/lib/pascal/toPascal', async (importOriginal) => {
  const actual = await importOriginal<typeof ToPascal>();

  return { ...actual, toPascalScene: vi.fn(actual.toPascalScene) };
});

vi.mock('@/screens/viewer/PascalViewer/usePascalEdits', () => ({
  usePascalEdits: ({
    onRejected,
    onUnsaved,
    onNotice,
  }: {
    onRejected: (reason: string) => void;
    onUnsaved: (labels: readonly string[]) => void;
    onNotice: (message: string) => void;
  }) => ({
    onSceneCommit: () => {
      if (commit.reason !== null) onRejected(commit.reason);
      // Như hook thật (V9): mọi lượt không bị từ chối đều gọi onUnsaved, kể cả danh sách rỗng.
      else onUnsaved(commit.unsaved);
      commit.notices.forEach(onNotice);

      return Promise.resolve(commit.ok);
    },
  }),
}));

describe('usePascalProjectBridge', () => {
  beforeEach(() => {
    session.ok = true;
    scaleApi.sources = {};
    settingsApi.read = { ok: true, data: {} };
    settingsApi.puts = [];
    detail.fail = false;
    detail.levels = 1;
    detail.walls = 1;
    detail.role = 'engineer';
    commit.ok = true;
    commit.reason = null;
    commit.unsaved = [];
    commit.notices = [];
    saver.state = 'saved';
    saver.blocked = null;
    saver.saveNow.calls = 0;
    saver.reloaded = [];
    /* eslint-disable-next-line local/no-direct-set -- đưa kho về rỗng giữa các bài */
    useStore.setState({ spatial: null, userRoles: [] });
  });

  it.each([
    ['hien-dai-sang', SCENE_STYLES['hien-dai-sang']],
    ['khong-co', SCENE_STYLES['am-ap']],
  ])('phong cách đã lưu "%s" đi vào toPascalScene (lạ → mặc định)', async (stored, style) => {
    localStorage.setItem(SCENE_STYLE_STORAGE_KEY, stored);
    const { result } = renderHook(() => usePascalProjectBridge('p1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    vi.mocked(toPascalScene).mockClear();

    await act(() => result.current.onLoad());

    expect(toPascalScene).toHaveBeenCalledTimes(1);
    expect(toPascalScene).toHaveBeenCalledWith(expect.anything(), { style });
    localStorage.removeItem(SCENE_STYLE_STORAGE_KEY);
  });

  const wireSettings = {
    buildingType: 'residential',
    confidenceThreshold: 0.8,
    defaultScaleMmPerPx: 10,
    lengthUnit: 'mm',
    snapToleranceMm: 20,
    revision: 4,
  } as const;

  it('W4a — phong cách lưu ở dự án thắng khoá máy; N5 hỏng thì lùi về khoá máy', async () => {
    localStorage.setItem(SCENE_STYLE_STORAGE_KEY, 'go-am');
    settingsApi.read = { ok: true, data: { ...wireSettings, sceneStyle: 'toi-gian' } };
    const first = renderHook(() => usePascalProjectBridge('p1'));
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    vi.mocked(toPascalScene).mockClear();
    await act(() => first.result.current.onLoad());
    expect(toPascalScene).toHaveBeenCalledWith(expect.anything(), { style: SCENE_STYLES['toi-gian'] });
    expect(currentProjectSceneStyle()?.id).toBe('toi-gian');

    settingsApi.read = { ok: false, error: new Error('403') };
    const second = renderHook(() => usePascalProjectBridge('p1'));
    await waitFor(() => expect(second.result.current.status).toBe('ready'));
    vi.mocked(toPascalScene).mockClear();
    await act(() => second.result.current.onLoad());
    expect(toPascalScene).toHaveBeenCalledWith(expect.anything(), { style: SCENE_STYLES['go-am'] });
    expect(currentProjectSceneStyle()?.saveToProject).toBeUndefined();
    localStorage.removeItem(SCENE_STYLE_STORAGE_KEY);
  });

  it('UX-R2: separateUnits của N5 đọc lúc nạp; vắng hay N5 hỏng thì tắt', async () => {
    settingsApi.read = { ok: true, data: { ...wireSettings, separateUnits: true } };
    const first = renderHook(() => usePascalProjectBridge('p1'));
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    expect(isSeparateUnits()).toBe(true);

    settingsApi.read = { ok: false, error: new Error('403') };
    const second = renderHook(() => usePascalProjectBridge('p1'));
    await waitFor(() => expect(second.result.current.status).toBe('ready'));
    expect(isSeparateUnits()).toBe(false);
  });

  it('W4a — bản xem thử của người xem trên máy này thắng phong cách dự án', async () => {
    localStorage.setItem(sceneStylePreviewKey('p1'), 'hien-dai-sang');
    settingsApi.read = { ok: true, data: { ...wireSettings, sceneStyle: 'toi-gian' } };
    const { result } = renderHook(() => usePascalProjectBridge('p1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(currentProjectSceneStyle()?.id).toBe('hien-dai-sang');
    localStorage.removeItem(sceneStylePreviewKey('p1'));
  });

  it('W4a — người xem: không có lối PUT (chỉ máy này)', async () => {
    detail.role = 'viewer';
    settingsApi.read = { ok: true, data: { ...wireSettings } };
    const { result } = renderHook(() => usePascalProjectBridge('p1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(currentProjectSceneStyle()).toStrictEqual({ projectId: 'p1', id: 'am-ap' });
  });

  it('W4a — người sửa được cài đặt: PUT đủ thân + sceneStyle, đúng revision, qua schema strict', async () => {
    settingsApi.read = { ok: true, data: { ...wireSettings, notes: 'ghi chú', sceneStyle: 'go-am' } };
    const { result } = renderHook(() => usePascalProjectBridge('p1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await currentProjectSceneStyle()?.saveToProject?.('sang-trong-toi');

    expect(settingsApi.puts).toHaveLength(1);
    const { projectId, ...write } = settingsApi.puts[0] as { projectId: string };
    expect(projectId).toBe('p1');
    expect(UpdateProjectSettingsSchema.parse(write)).toStrictEqual({
      baseVersion: 4,
      body: {
        buildingType: 'residential',
        confidenceThreshold: 0.8,
        defaultScaleMmPerPx: 10,
        lengthUnit: 'mm',
        notes: 'ghi chú',
        sceneStyle: 'sang-trong-toi',
        snapToleranceMm: 20,
      },
    });
  });

  it('savePascalNow: Ctrl+S cho Pascal rồi đợi đúng lượt onSave ấy (ném khi bị từ chối)', async () => {
    const { result } = renderHook(() => usePascalProjectBridge('p1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    // Thay `useSaveShortcut` + `saveNow` của editor: bắt Ctrl+S ở pha capture, gọi `onSave` ngay.
    const pascal = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'KeyS') void result.current.onSave({ nodes: {}, rootNodeIds: [] }).catch(() => undefined);
    };
    window.addEventListener('keydown', pascal, true);

    await expect(savePascalNow()).resolves.toBeUndefined();
    commit.ok = false;
    commit.reason = 'Đồ gắn trần chưa lưu được.';
    await expect(savePascalNow()).rejects.toThrow('Đồ gắn trần chưa lưu được.');
    window.removeEventListener('keydown', pascal, true);
  });

  it('sẵn sàng: tên dự án, đường về, và cảnh từ toPascal', async () => {
    const { result } = renderHook(() => usePascalProjectBridge('p1'));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.projectName).toBe('Nhà mẫu');
    expect(result.current.backHref).toBe('/projects/p1/floors');
    expect(result.current.readOnly).toBe(false);

    let scene: Awaited<ReturnType<typeof result.current.onLoad>> | undefined;
    await act(async () => {
      scene = await result.current.onLoad();
    });
    expect(scene).toEqual(toPascalScene(createSampleBuilding()).scene);
  });

  it('vai người xem: chỉ đọc', async () => {
    detail.role = 'viewer';
    const { result } = renderHook(() => usePascalProjectBridge('p1'));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.readOnly).toBe(true);
  });

  it('nạp hỏng: lỗi tiếng Việt', async () => {
    detail.fail = true;
    const { result } = renderHook(() => usePascalProjectBridge('p1'));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe(BRIDGE_LOAD_ERROR);
  });

  it('chưa có tầng nào: trạng thái rỗng (C15)', async () => {
    detail.levels = 0;
    detail.walls = 0;
    const { result } = renderHook(() => usePascalProjectBridge('p1'));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe(BRIDGE_EMPTY_ERROR);
  });

  it('có tầng mà chưa có tường: vẫn mở để vẽ trong 3D (C15)', async () => {
    detail.walls = 0;
    const { result } = renderHook(() => usePascalProjectBridge('p1'));

    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('lượt bị từ chối: dựng lại cảnh từ kho (0 lệnh so với đồ thị); lượt hợp lệ không đặt lại', async () => {
    const applied: PascalScene[] = [];
    const { result } = renderHook(() => usePascalProjectBridge('p1', (scene) => applied.push(scene as PascalScene)));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    await expect(result.current.onSave({ nodes: {}, rootNodeIds: [] })).resolves.toBeUndefined();
    commit.ok = false;
    await expect(result.current.onSave({ nodes: {}, rootNodeIds: [] })).resolves.toBeUndefined();
    expect(applied).toHaveLength(0);

    commit.reason = 'Tường phải nằm trong tầng.';
    await expect(result.current.onSave({ nodes: {}, rootNodeIds: [] })).rejects.toThrow('Tường phải nằm trong tầng.');
    expect(applied).toHaveLength(1);

    const graph = useStore.getState().spatial;
    const restored = applied[0];
    if (graph === null || restored === undefined) throw new Error('thiếu kho hoặc cảnh dựng lại');
    const back = createPascalEditCommand({
      graph,
      scene: restored,
      commit: { origin: 'load', changedNodeIds: Object.keys(restored.nodes) },
      actorId: 'u1',
    });

    expect(back.ok ? null : back.error.code).toBe('PASCAL_NO_CHANGE');
  });

  it('máy chủ khối tầng: "Tải lại tầng" nạp lại tầng rồi dựng lại cảnh từ kho, không nạp lại trang', async () => {
    const applied: unknown[] = [];
    saver.blocked = 'Tầng đã đổi trên máy chủ.';
    const { result } = renderHook(() => usePascalProjectBridge('p1', (scene) => applied.push(scene)));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    /* eslint-disable-next-line local/no-direct-set -- tầng L-1 đang chờ lưu và bị khối */
    useStore.setState({ unsavedFloorIds: ['L-1'] });

    act(() => result.current.save?.onReloadFloor());

    await waitFor(() => expect(applied).toHaveLength(1));
    expect(saver.reloaded).toEqual(['L-1']);
    expect(result.current.save?.notice).toBe('Tầng đã đổi trên máy chủ.');
    /* eslint-disable-next-line local/no-direct-set -- dọn lại */
    useStore.setState({ unsavedFloorIds: [] });
  });

  it('lưu: "không có gì để ghi" là thành công, chỉ ném khi có lời từ chối', async () => {
    const { result } = renderHook(() => usePascalProjectBridge('p1'));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    commit.ok = false;
    await expect(result.current.onSave({ nodes: {}, rootNodeIds: [] })).resolves.toBeUndefined();

    commit.reason = 'Đồ gắn trần chưa lưu được.';
    await expect(result.current.onSave({ nodes: {}, rootNodeIds: [] })).rejects.toThrow('Đồ gắn trần chưa lưu được.');
  });

  it('phiên hết hạn: lỗi phiên', async () => {
    session.ok = false;
    const { result } = renderHook(() => usePascalProjectBridge('p1'));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe(BRIDGE_SESSION_ERROR);
  });

  it('v3 V3 — lượt vào kho đợi lượt PUT; hỏng/khối thì ném cho editor, thẻ hiện trạng thái thật', async () => {
    const { result } = renderHook(() => usePascalProjectBridge('p1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.save?.state).toBe('saved');
    expect(result.current.save?.label).toBe('Đã lưu lúc 10:00');
    await expect(result.current.onSave({ nodes: {}, rootNodeIds: [] })).resolves.toBeUndefined();
    expect(saver.saveNow.calls).toBe(1);

    saver.state = 'failed';
    await expect(result.current.onSave({ nodes: {}, rootNodeIds: [] })).rejects.toThrow(BRIDGE_SAVE_FAILED);

    saver.state = 'saved';
    saver.blocked = 'Bản vẽ đã đổi ở nơi khác.';
    /* eslint-disable-next-line local/no-direct-set -- tầng L-1 đang chờ lưu */
    useStore.setState({ unsavedFloorIds: ['L-1'] });
    await expect(result.current.onSave({ nodes: {}, rootNodeIds: [] })).rejects.toThrow(BRIDGE_SAVE_BLOCKED);

    const { result: blocked } = renderHook(() => usePascalProjectBridge('p1'));
    await waitFor(() => expect(blocked.current.status).toBe('ready'));
    expect(blocked.current.save?.state).toBe('blocked');
    expect(blocked.current.save?.blockMessage).toBe('Bản vẽ đã đổi ở nơi khác.');
    /* eslint-disable-next-line local/no-direct-set -- dọn */
    useStore.setState({ unsavedFloorIds: [] });
  });

  it('v3 V3 — phần sửa chưa lưu được: một câu, mỗi nhãn một lần mỗi phiên; vai xem không có thẻ lưu', async () => {
    const { result } = renderHook(() => usePascalProjectBridge('p1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    commit.ok = false;
    commit.unsaved = ['màu sàn', 'màu tường'];
    await act(async () => {
      await result.current.onSave({ nodes: {}, rootNodeIds: [] });
    });
    expect(result.current.save?.notice).toBe(unsavedNoticeOf(['màu sàn', 'màu tường']));
    expect(result.current.save?.notice).toBe('Chưa lưu được: màu sàn, màu tường — sẽ có ở bản sau.');

    act(() => result.current.save?.dismissNotice());
    await act(async () => {
      await result.current.onSave({ nodes: {}, rootNodeIds: [] });
    });
    expect(result.current.save?.notice).toBeNull();

    commit.unsaved = ['màu sàn', 'kiểu cửa'];
    await act(async () => {
      await result.current.onSave({ nodes: {}, rootNodeIds: [] });
    });
    expect(result.current.save?.notice).toBe('Chưa lưu được: kiểu cửa — sẽ có ở bản sau.');

    detail.role = 'viewer';
    const { result: viewer } = renderHook(() => usePascalProjectBridge('p1'));
    await waitFor(() => expect(viewer.current.readOnly).toBe(true));
    expect(viewer.current.save).toBeUndefined();
  });

  it('W3e — lời báo của lượt sửa (vách mới): lên thẻ như câu chưa lưu, mỗi câu một lần mỗi phiên', async () => {
    const split = 'Phòng "Khách" có vách mới — mở màn Phòng để tách.';
    const { result } = renderHook(() => usePascalProjectBridge('p1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    commit.notices = [split];
    await act(async () => {
      await result.current.onSave({ nodes: {}, rootNodeIds: [] });
    });
    expect(result.current.save?.notice).toBe(split);

    act(() => result.current.save?.dismissNotice());
    commit.notices = [split, 'Phòng "Ngủ" có vách mới — mở màn Phòng để tách.'];
    await act(async () => {
      await result.current.onSave({ nodes: {}, rootNodeIds: [] });
    });
    expect(result.current.save?.notice).toBe('Phòng "Ngủ" có vách mới — mở màn Phòng để tách.');
  });

  it('V9 — lượt lưu sau không còn gì chưa lưu: câu báo cũ được gỡ, nhãn ấy báo lại được', async () => {
    const { result } = renderHook(() => usePascalProjectBridge('p1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    commit.unsaved = ['màu sàn'];
    await act(async () => {
      await result.current.onSave({ nodes: {}, rootNodeIds: [] });
    });
    expect(result.current.save?.notice).toBe(unsavedNoticeOf(['màu sàn']));

    commit.unsaved = [];
    await act(async () => {
      await result.current.onSave({ nodes: {}, rootNodeIds: [] });
    });
    expect(result.current.save?.notice).toBeNull();

    commit.unsaved = ['màu sàn'];
    await act(async () => {
      await result.current.onSave({ nodes: {}, rootNodeIds: [] });
    });
    expect(result.current.save?.notice).toBe(unsavedNoticeOf(['màu sàn']));
  });

  it('N1 — lượt bị từ chối: lý do lên thẻ dạng cảnh báo, không im lặng "đã lưu"', async () => {
    const { result } = renderHook(() => usePascalProjectBridge('p1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    commit.ok = false;
    commit.reason = 'Món đồ này đã có trong bản vẽ.';
    await act(async () => {
      await expect(result.current.onSave({ nodes: {}, rootNodeIds: [] })).rejects.toThrow(commit.reason ?? '');
    });
    expect(result.current.save?.notice).toBe('Món đồ này đã có trong bản vẽ.');
    expect(result.current.save?.noticeTone).toBe('alert');
  });

  it('Codex P1 — tầng chưa có tỷ lệ: không dựng nội dung trong 3D, tầng vẫn còn; tỷ lệ máy đo vẫn dựng', async () => {
    scaleApi.sources = { [sampleLevelId(1)]: 'project_default', [sampleLevelId(2)]: 'pipeline' };
    const { result } = renderHook(() => usePascalProjectBridge('p1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let scene: Awaited<ReturnType<typeof result.current.onLoad>> | undefined;
    await act(async () => {
      scene = await result.current.onLoad();
    });
    const sample = createSampleBuilding();
    const hidden = new Set([sampleLevelId(1)]);
    expect(scene).toEqual(markNotBuilt(toPascalScene(withoutFloorContents(sample, hidden)).scene, hidden));
    // UX-R2 K36: danh sách tầng của editor đọc dấu này để ghi "Chưa dựng".
    const notBuilt = (levelId: string) =>
      (scene?.nodes[`level_${levelId}`] as { metadata?: Record<string, unknown> } | undefined)?.metadata?.[NOT_BUILT_KEY];
    expect(notBuilt(sampleLevelId(1))).toBe(true);
    expect(notBuilt(sampleLevelId(0))).toBeUndefined();
    expect(scene).not.toEqual(toPascalScene(sample).scene);
  });

  it('Codex P1 — mọi tầng chưa có tỷ lệ: cảnh trống nhưng vẫn mở (không báo lỗi nạp)', async () => {
    const sample = createSampleBuilding();
    scaleApi.sources = Object.fromEntries(sample.levels.map((level) => [level.id, 'project_default' as const]));
    const { result } = renderHook(() => usePascalProjectBridge('p1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let scene: Awaited<ReturnType<typeof result.current.onLoad>> | undefined;
    await act(async () => {
      scene = await result.current.onLoad();
    });
    const empty = withoutFloorContents(sample, new Set(sample.levels.map((level) => level.id)));
    expect(empty.levels).toHaveLength(sample.levels.length);
    expect([empty.walls, empty.openings, empty.rooms, empty.furniture].every((list) => list.length === 0)).toBe(true);
    expect(scene).toEqual(markNotBuilt(toPascalScene(empty).scene, new Set(sample.levels.map((level) => level.id))));
  });
});

describe('withoutFloorContents', () => {
  it('bỏ tường, ô mở trên tường ấy, phòng, đồ, trục, kích thước, ghi chú của tầng; giữ tầng và tầng khác', () => {
    const sample = createSampleBuilding();
    const hidden = sampleLevelId(0);
    const graph = withoutFloorContents(sample, new Set([hidden]));
    const hiddenWalls = new Set(sample.walls.filter((wall) => wall.levelId === hidden).map((wall) => wall.id));

    expect(graph.levels).toEqual(sample.levels);
    expect(graph.walls).toEqual(sample.walls.filter((wall) => wall.levelId !== hidden));
    expect(graph.openings).toEqual(sample.openings.filter((opening) => !hiddenWalls.has(opening.wallId)));
    expect(graph.rooms.some((room) => room.levelId === hidden)).toBe(false);
    expect(graph.furniture.some((item) => item.levelId === hidden)).toBe(false);
    expect(graph.dimensions.some((item) => item.levelId === hidden)).toBe(false);
    expect(graph.axes.some((item) => item.levelId === hidden)).toBe(false);
    expect(graph.notes.some((note) => hiddenWalls.has(note.entityId as never))).toBe(false);
    expect(withoutFloorContents(sample, new Set())).toBe(sample);
  });
});

describe('undrawnFloorNames (U52)', () => {
  it('chỉ lấy tầng chưa có trong đồ thị, tầng cao ở trên', () => {
    const floors = [
      { id: 'a', name: 'Tầng 1', order: 0 },
      { id: 'b', name: 'Tầng 2', order: 1 },
      { id: 'c', name: 'Tầng 3', order: 2 },
    ];
    expect(undrawnFloorNames(floors, new Set(['a']))).toEqual(['Tầng 3', 'Tầng 2']);
    expect(undrawnFloorNames(floors, new Set(['a', 'b', 'c']))).toEqual([]);
  });
});
