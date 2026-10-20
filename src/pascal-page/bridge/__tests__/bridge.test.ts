import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { toPascalScene } from '@/lib/pascal/toPascal';
import { useStore } from '@/store';
import type { ProjectRole } from '@/types/project';

import { BRIDGE_EMPTY_ERROR, BRIDGE_LOAD_ERROR, BRIDGE_SESSION_ERROR, usePascalProjectBridge } from '..';

const session = vi.hoisted(() => ({ ok: true }));
const detail = vi.hoisted(() => ({ fail: false, levels: 1, walls: 1, role: 'engineer' as ProjectRole }));
/** Kết quả `onSceneCommit` giả: `reason` khác `null` = có lời từ chối qua `onRejected`. */
const commit = vi.hoisted(() => ({ ok: true, reason: null as string | null }));

vi.mock('@/routes/sessionSetup', () => ({ startAppSession: () => Promise.resolve(session.ok) }));
vi.mock('@/api/appClient', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createAppApiClient: () => ({ projects: {}, spatial: {} }),
  resolveUseMockApi: () => false,
}));
vi.mock('@/hooks/useAutosave', () => ({ useFloorLayerAutosave: () => ({}) }));
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

vi.mock('@/screens/viewer/PascalViewer/usePascalEdits', () => ({
  usePascalEdits: ({ onRejected }: { onRejected: (reason: string) => void }) => ({
    onSceneCommit: () => {
      if (commit.reason !== null) onRejected(commit.reason);

      return Promise.resolve(commit.ok);
    },
  }),
}));

describe('usePascalProjectBridge', () => {
  beforeEach(() => {
    session.ok = true;
    detail.fail = false;
    detail.levels = 1;
    detail.walls = 1;
    detail.role = 'engineer';
    commit.ok = true;
    commit.reason = null;
    /* eslint-disable-next-line local/no-direct-set -- đưa kho về rỗng giữa các bài */
    useStore.setState({ spatial: null, userRoles: [] });
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
});
