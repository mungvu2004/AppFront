/**
 * Đường lưu của màn Pascal, chạy đủ năm chặng trên store thật.
 *
 * Bài quan trọng nhất là bài thứ hai: **một lượt sửa trong Pascal phải tới được
 * `state.spatial`.** Hỏng nó thì màn hình hiện một bức tường mới, người dùng tin
 * là đã lưu, và không có nút lưu nào để họ thử lại — A7 không cho họ cơ hội ấy.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { SCENE_STYLES } from '@/lib/pascal/sceneStyles';
import { toPascalScene } from '@/lib/pascal/toPascal';
import type { PascalNode, PascalScene } from '@/lib/pascal/types';
import { useStore } from '@/store';

import {
  commitOfScenes,
  PASCAL_READ_ONLY_REASON,
  unsavedPascalEdits,
  usePascalEdits,
} from './usePascalEdits';

const BUILDING = createSampleBuilding();
const SPATIAL = normalizeSpatial(BUILDING);
const SCENE = toPascalScene(BUILDING).scene;

/** Tường, không phải `PascalNode` chung: nhánh hẹp mới spread thêm `thickness` được. */
const firstWall = (): Extract<PascalNode, { readonly type: 'wall' }> => {
  const wall = Object.values(SCENE.nodes).find((node) => node.type === 'wall');

  if (wall === undefined || wall.type !== 'wall') {
    throw new Error('bộ mẫu phải có ít nhất một tường');
  }

  return wall;
};

/** Cảnh nền, tường đầu tiên dày thêm 130 mm. */
const thickened = (): PascalScene => {
  const wall = firstWall();

  return {
    nodes: { ...SCENE.nodes, [wall.id]: { ...wall, thickness: 0.33 } },
    rootNodeIds: SCENE.rootNodeIds,
  };
};

const mount = (
  overrides: {
    readonly readOnly?: boolean;
    readonly onRejected?: (reason: string) => void;
    readonly onMassDelete?: (request: { nodeIds: readonly string[]; reason: string }) => void;
    readonly onUnsaved?: (labels: readonly string[]) => void;
    readonly onNotice?: (message: string) => void;
  } = {},
) =>
  renderHook(() =>
    usePascalEdits({
      spatial: useStore.getState().spatial,
      loadedScene: SCENE,
      readOnly: overrides.readOnly ?? false,
      onRejected: overrides.onRejected ?? (() => undefined),
      ...(overrides.onMassDelete === undefined ? {} : { onMassDelete: overrides.onMassDelete }),
      ...(overrides.onUnsaved === undefined ? {} : { onUnsaved: overrides.onUnsaved }),
      ...(overrides.onNotice === undefined ? {} : { onNotice: overrides.onNotice }),
    }),
  );

/** Cảnh nền bỏ hẳn mọi tường — đúng thứ `MASS_DELETE_RATIO` tồn tại để chặn. */
const gutted = (): PascalScene => ({
  nodes: Object.fromEntries(Object.entries(SCENE.nodes).filter(([, node]) => node.type !== 'wall')),
  rootNodeIds: SCENE.rootNodeIds,
});

beforeEach(() => {
  act(() => {
    useStore.getState().setSpatial(SPATIAL, null);
  });
});

afterEach(() => {
  act(() => {
    useStore.getState().setSpatial(null, null);
  });
});

describe('commitOfScenes', () => {
  it('hai cảnh y hệt: không có lượt ghi nào', () => {
    expect(commitOfScenes(SCENE, SCENE)).toBeNull();
  });

  it('một tường đổi: đúng node ấy vào danh sách đã đổi, danh sách xoá rỗng', () => {
    const commit = commitOfScenes(SCENE, thickened());

    expect(commit?.changedNodeIds).toEqual([firstWall().id]);
    expect(commit?.removedNodeIds).toEqual([]);
  });
});

/** Cảnh nền với node đầu tiên loại `type` được ghép thêm `patch`. */
const patched = (type: string, patch: Record<string, unknown>): PascalScene => {
  const node = Object.values(SCENE.nodes).find((candidate) => candidate.type === type);

  if (node === undefined) throw new Error(`bộ mẫu phải có ${type}`);

  return { nodes: { ...SCENE.nodes, [node.id]: { ...node, ...patch } as PascalNode }, rootNodeIds: SCENE.rootNodeIds };
};

/** Tham chiếu ghi được (phong cách dùng) và một màu ngoài luật ghi của `toSpatial`. */
const SAVEABLE = SCENE_STYLES['am-ap'].wall.interior;
const FOREIGN = 'library:khong-co-trong-thu-vien';

describe('unsavedPascalEdits (v3 V3 + W3e — phần sửa máy chủ chưa nhận)', () => {
  it('không đổi gì, hay chỉ đổi thứ lưu được (độ dày tường, sơn sàn/tường/đồ bằng tham chiếu ghi được): không báo', () => {
    expect(unsavedPascalEdits(SCENE, SCENE)).toEqual([]);
    expect(unsavedPascalEdits(SCENE, thickened())).toEqual([]);
    expect(unsavedPascalEdits(SCENE, patched('slab', { slots: { surface: SAVEABLE } }))).toEqual([]);
    expect(unsavedPascalEdits(SCENE, patched('wall', { slots: { interior: SAVEABLE } }))).toEqual([]);
    expect(unsavedPascalEdits(SCENE, patched('item', { slots: { body: SAVEABLE } }))).toEqual([]);
  });

  it.each([
    ['slab', { slots: { surface: FOREIGN } }, 'màu sàn'],
    ['wall', { slots: { exterior: FOREIGN } }, 'màu tường'],
    ['wall', { material: { preset: 'tu-pha' } }, 'màu tường'],
    ['item', { slots: { body: FOREIGN } }, 'màu đồ đạc'],
    ['item', { materialPreset: 'tu-pha' }, 'màu đồ đạc'],
    ['door', { hingesSide: 'right' }, 'kiểu cửa'],
    ['door', { slots: { frame: SAVEABLE } }, 'màu cửa'],
  ])('%s đổi %j → "%s"', (type, patch, label) => {
    expect(unsavedPascalEdits(SCENE, patched(type, patch))).toEqual([label]);
  });

  it('đồ đạc: mẫu /items/… lưu được, mẫu lạ thì báo; màu lạ trên đồ mới; xoá đồ bày sẵn', () => {
    const item = { id: 'item_new', type: 'item', asset: { src: '/items/sofa/model.glb' } } as unknown as PascalNode;
    const added: PascalScene = { nodes: { ...SCENE.nodes, item_new: item }, rootNodeIds: SCENE.rootNodeIds };
    const swapped: PascalScene = {
      nodes: { ...added.nodes, item_new: { ...item, slots: { body: FOREIGN }, asset: { src: 'blob:http://x/ghe.glb' } } as unknown as PascalNode },
      rootNodeIds: SCENE.rootNodeIds,
    };
    const dressed: PascalScene = {
      nodes: { ...SCENE.nodes, 'item_DRESS-sofa-R-1': { ...item, id: 'item_DRESS-sofa-R-1' } as PascalNode },
      rootNodeIds: SCENE.rootNodeIds,
    };

    expect(unsavedPascalEdits(SCENE, added)).toEqual([]);
    expect(unsavedPascalEdits(added, swapped)).toEqual(['màu đồ đạc', 'mẫu đồ đạc']);
    expect(unsavedPascalEdits(SCENE, swapped)).toEqual(['màu đồ đạc', 'mẫu đồ đạc']);
    expect(unsavedPascalEdits(dressed, SCENE)).toEqual(['xoá đồ bày sẵn']);
  });
});

/** Cảnh nền + một vách mới vẽ giữa phòng đầu (0..4 m × 0..4,25 m), cùng tầng với tường đầu. */
const withNewWall = (): PascalScene => {
  const host = firstWall();
  const parent = host.parentId === null ? undefined : SCENE.nodes[host.parentId];
  const wall = { ...host, id: 'wall_w3d_new', children: [], start: [0.5, 2.1], end: [3.5, 2.1], metadata: {} } as PascalNode;

  if (parent === undefined || !('children' in parent)) throw new Error('tường đầu phải có tầng cha');

  return {
    nodes: { ...SCENE.nodes, [wall.id]: wall, [parent.id]: { ...parent, children: [...parent.children, wall.id] } as PascalNode },
    rootNodeIds: SCENE.rootNodeIds,
  };
};

describe('usePascalEdits', () => {
  it('W3d — vách mới không khép thành hai phòng: tường vẫn lưu, báo mở màn Phòng để tách', async () => {
    const onNotice = vi.fn();
    const { result } = mount({ onNotice });
    const wallsBefore = useStore.getState().spatial?.byKind.wall.length ?? 0;
    let ok = false;

    await act(async () => {
      ok = await result.current.onSceneCommit(withNewWall());
    });

    expect(ok).toBe(true);
    expect(useStore.getState().spatial?.byKind.wall).toHaveLength(wallsBefore + 1);
    expect(onNotice).toHaveBeenCalledWith('Phòng "Room 0" có vách mới — mở màn Phòng để tách.');
  });

  it('v3 V3 — sửa chỉ màu đồ đạc: không có gì để ghi, nhưng báo "màu đồ đạc" chưa lưu được', async () => {
    const onUnsaved = vi.fn();
    const onRejected = vi.fn();
    const { result } = mount({ onUnsaved, onRejected });
    let ok = true;

    await act(async () => {
      ok = await result.current.onSceneCommit(patched('item', { slots: { body: FOREIGN } }));
    });

    expect(ok).toBe(false);
    expect(onRejected).not.toHaveBeenCalled();
    expect(onUnsaved).toHaveBeenCalledWith(['màu đồ đạc']);
  });

  it('nạp xong mà chưa ai sửa gì: KHÔNG ghi vào bản vẽ', async () => {
    const { result } = mount();
    const before = useStore.getState().spatial;

    await act(async () => {
      await result.current.onSceneCommit(SCENE);
    });

    expect(useStore.getState().spatial).toBe(before);
  });

  it('sửa độ dày một tường thì bản vẽ trong store đổi theo (A10 — qua commit)', async () => {
    const { result } = mount();
    const wallId = Object.keys(SPATIAL.byId).find((id) => id.startsWith('W-'));

    if (wallId === undefined) throw new Error('bản vẽ phải có tường');

    await act(async () => {
      await result.current.onSceneCommit(thickened());
    });

    const after = useStore.getState().spatial?.byId[wallId];

    expect(after !== undefined && 'thicknessMm' in after ? after.thicknessMm : null).toBe(330);
  });

  it('23H-A-016 — lượt sửa đã vào kho thành một bước trên ngăn lịch sử trả ra cho bảng', async () => {
    const { result } = mount();

    expect(result.current.history.undoSteps()).toHaveLength(0);

    await act(async () => {
      await result.current.onSceneCommit(thickened());
    });

    expect(result.current.history.undoSteps()).toHaveLength(1);
  });

  it('C2 — bức tường vừa sửa mất dấu xác minh', async () => {
    const { result } = mount();
    const wallId = Object.keys(SPATIAL.byId).find((id) => id.startsWith('W-'));

    if (wallId === undefined) throw new Error('bản vẽ phải có tường');

    await act(async () => {
      await result.current.onSceneCommit(thickened());
    });

    expect(useStore.getState().spatial?.byId[wallId]?.reviewed).toBe(false);
  });

  it('vai chỉ-xem: `validateCommit` từ chối và `onSceneCommit` không ghi gì', async () => {
    const onRejected = vi.fn();
    const { result } = mount({ readOnly: true, onRejected });
    const before = useStore.getState().spatial;

    expect(result.current.validateCommit(thickened())).toEqual({
      ok: false,
      message: PASCAL_READ_ONLY_REASON,
    });

    await act(async () => {
      await result.current.onSceneCommit(thickened());
    });

    expect(useStore.getState().spatial).toBe(before);
    expect(onRejected).not.toHaveBeenCalled();
  });

  it('6A — cổng chặn lượt xoá hàng loạt, và nói ra lý do bằng tiếng Việt', async () => {
    const onRejected = vi.fn();
    const { result } = mount({ onRejected });
    const before = useStore.getState().spatial;

    /* Bỏ hẳn mọi tường của cảnh: đúng thứ `MASS_DELETE_RATIO` tồn tại để chặn. */
    const gutted: PascalScene = {
      nodes: Object.fromEntries(
        Object.entries(SCENE.nodes).filter(([, node]) => node.type !== 'wall'),
      ),
      rootNodeIds: SCENE.rootNodeIds,
    };

    const verdict = result.current.validateCommit(gutted);

    expect(verdict.ok).toBe(false);
    expect(verdict.ok ? '' : verdict.message).toMatch(/\p{L}/u);

    await act(async () => {
      await result.current.onSceneCommit(gutted);
    });

    expect(useStore.getState().spatial).toBe(before);
    expect(onRejected).toHaveBeenCalledTimes(1);
  });

  it('23-A-026 — xoá hàng loạt: báo màn mở hộp xác nhận; xác nhận rồi thì đúng lượt xoá ấy được ghi', async () => {
    const onMassDelete = vi.fn();
    const { result } = mount({ onMassDelete });
    const wallIds = Object.values(SCENE.nodes)
      .filter((node) => node.type === 'wall')
      .map((node) => node.id);

    expect(result.current.validateCommit(gutted()).ok).toBe(false);
    expect(onMassDelete).toHaveBeenCalledTimes(1);

    const request = onMassDelete.mock.calls[0]?.[0] as { nodeIds: readonly string[]; reason: string };

    expect(request.nodeIds).toEqual(expect.arrayContaining(wallIds));
    expect(request.reason).toMatch(/xác nhận/u);

    act(() => {
      result.current.confirmMassDelete(request.nodeIds);
    });

    // Editor xoá lại sau khi người dùng bấm "Xoá": cảnh mới, cùng phần xoá.
    expect(result.current.validateCommit(gutted())).toEqual({ ok: true });

    await act(async () => {
      expect(await result.current.onSceneCommit(gutted())).toBe(true);
    });

    expect(useStore.getState().spatial?.byKind.wall ?? []).toHaveLength(0);
  });
});
