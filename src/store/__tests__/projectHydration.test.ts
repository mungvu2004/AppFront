import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __resetMockLayerState } from '@/api/__mocks__/client';
import type { SpatialGraphDocument } from '@/api/schemas/spatialGraph';
import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import type { Level, LevelId, Wall } from '@/domain/spatial/types';
import { useStore } from '@/store';
import { commit } from '@/store/commit';
import { hydrateProject, loadProjectGraph, refreshProjectGraph } from '@/store/projectHydration';
import type { Project } from '@/types/project';

/**
 * F-04x-2 [8].2 — nạp và làm mới đồ thị dự án từ N15, không mở bước hoàn tác. Bài "0 PUT với bộ
 * lưu thật" ở `src/hooks/useProjectSpatial.test.ts`: tầng `src/store` không được nhập hooks.
 */

const PROJECT_ID = 'project-1';
const PROJECT: Project = {
  created_at: '2026-01-01T00:00:00Z',
  id: PROJECT_ID,
  members: [],
  name: 'Dự án thử',
  updated_at: '2026-01-01T00:00:00Z',
};

let base: SpatialGraphDocument;
let first: LevelId;
let second: LevelId;

/** `floorId` lên `revision`, tường của nó dày thêm 10 mm (literal dây, không giải mã lại). */
const bump = (document: SpatialGraphDocument, floorId: LevelId, revision: number): SpatialGraphDocument => ({
  floorRevisions: document.floorRevisions.map((entry) => (entry.floorId === floorId ? { ...entry, revision } : entry)),
  graph: {
    ...document.graph,
    walls: document.graph.walls.map((wall) =>
      wall.levelId === floorId ? { ...wall, thicknessMm: wall.thicknessMm + 10 } : wall,
    ),
  },
});

const wallOn = (floorId: LevelId): Wall => {
  const spatial = useStore.getState().spatial;
  const id = spatial?.byLevel[floorId]?.find((candidate) => candidate.startsWith('W-'));

  return spatial?.byId[id ?? ''] as Wall;
};

const editWallOn = (floorId: LevelId): void => {
  const wall = wallOn(floorId);

  commit({ changes: { thicknessMm: wall.thicknessMm + 1 }, id: wall.id, kind: 'wall', op: 'update' }, 'Đổi độ dày');
};

const hydrate = (): void => hydrateProject({ document: base, project: PROJECT, roles: ['engineer'] });

beforeEach(() => {
  __resetMockLayerState();
  /* Bộ mẫu A14 làm literal dây: không giải mã (`notes[0].createdAt` là `+07:00`), `notes: []`. */
  const sample = createSampleBuilding();

  base = {
    floorRevisions: sample.levels.map((level) => ({ floorId: level.id, revision: 0 })),
    graph: { ...sample, notes: [] },
  };
  [first, second] = base.graph.levels.map((level) => level.id) as [LevelId, LevelId];
});

afterEach(() => {
  useStore.getState().setUnsavedFloorIds([]);
  useStore.getState().setSpatial(null, null);
  useStore.getState().setProject(null);
});

describe('hydrateProject', () => {
  it('đặt dự án, tầng theo `order`, vai, đồ thị, `floorMeta`; lịch sử rỗng', () => {
    hydrate();
    editWallOn(first);
    expect(useStore.temporal.getState().pastStates.length).toBeGreaterThan(0);

    hydrate();

    const state = useStore.getState();
    expect(state.project).toBe(PROJECT);
    expect(state.floors.map((level) => level.order)).toEqual([...state.floors.map((level) => level.order)].sort((a, b) => a - b));
    expect(state.floors).toHaveLength(base.graph.levels.length);
    expect(state.userRoles).toEqual(['engineer']);
    expect(state.spatialProjectId).toBe(PROJECT_ID);
    expect(Object.keys(state.floorMeta)).toHaveLength(base.floorRevisions.length);
    expect(state.versionId).toMatch(/^[0-9a-f]{16}$/u);
    expect(useStore.temporal.getState().pastStates).toHaveLength(0);
  });
});

describe('refreshProjectGraph', () => {
  beforeEach(() => {
    hydrate();
  });

  it('cùng revision → giữ nguyên tham chiếu kho, không ghi', () => {
    const before = useStore.getState();

    refreshProjectGraph(base);

    expect(useStore.getState().spatial).toBe(before.spatial);
    expect(useStore.getState().floorMeta).toBe(before.floorMeta);
  });

  it('kho trống → không làm gì', () => {
    useStore.getState().setSpatial(null, null);

    refreshProjectGraph(bump(base, first, 9));

    expect(useStore.getState().spatial).toBeNull();
  });

  it('revision lớn hơn → thay đúng tầng ấy, tầng khác giữ tham chiếu; `scaleStatus` giữ', () => {
    useStore.getState().updateFloorMeta(first, { revision: 0, scaleStatus: 'unresolved' });
    const before = useStore.getState().spatial;
    const oldWall = wallOn(first);

    refreshProjectGraph(bump(base, first, 4));

    const state = useStore.getState();
    expect(wallOn(first).thicknessMm).toBe(oldWall.thicknessMm + 10);
    expect(state.spatial?.byLevel[second]).toBe(before?.byLevel[second]);
    expect(state.floorMeta[first]).toEqual({ revision: 4, scaleStatus: 'unresolved' });
    expect(state.lastServerSpatial).toBe(state.spatial);
  });

  it('tầng vắng meta → thay, ghi meta', () => {
    useStore.setState((state) => ({
      floorMeta: Object.fromEntries(Object.entries(state.floorMeta).filter(([floorId]) => floorId !== first)),
    }));

    refreshProjectGraph(base);

    expect(useStore.getState().floorMeta[first]).toEqual({ revision: 0 });
  });

  it('tầng chưa lưu → giữ nguyên, kể cả `floorMeta`', () => {
    editWallOn(first);
    useStore.getState().setUnsavedFloorIds([first]);
    const edited = wallOn(first);
    const meta = useStore.getState().floorMeta[first];

    refreshProjectGraph(bump(bump(base, first, 5), second, 5));

    expect(wallOn(first)).toBe(edited);
    expect(useStore.getState().floorMeta[first]).toBe(meta);
    expect(useStore.getState().floorMeta[second]?.revision).toBe(5);
  });

  it('revision nhỏ hơn → bỏ qua', () => {
    useStore.getState().updateFloorMeta(first, { revision: 7 });
    const before = useStore.getState().spatial;

    refreshProjectGraph(bump(base, first, 3));

    expect(useStore.getState().spatial).toBe(before);
    expect(useStore.getState().floorMeta[first]?.revision).toBe(7);
  });

  it('cùng revision mà `Level` khác → chỉ thay `Level` và `floors`', () => {
    const level = base.graph.levels.find((candidate) => candidate.id === first) as Level;
    const reviewed: Level = { ...level, reviewed: !level.reviewed };
    const before = useStore.getState().spatial;
    const seq = useStore.getState().serverReplaceSeq;

    refreshProjectGraph({
      ...base,
      graph: { ...base.graph, levels: base.graph.levels.map((item) => (item.id === first ? reviewed : item)) },
    });

    const state = useStore.getState();
    expect(state.spatial?.byId[first]).toBe(reviewed);
    expect(state.spatial?.byLevel).toBe(before?.byLevel);
    expect(state.floors.find((item) => item.id === first)).toBe(reviewed);
    expect(state.serverReplaceSeq).toBe(seq);
  });

  it('thay tầng đã có meta → `temporal.undo()` không về bản cũ, `serverReplaceSeq` tăng', () => {
    const seq = useStore.getState().serverReplaceSeq;
    editWallOn(second);
    expect(useStore.temporal.getState().pastStates.length).toBeGreaterThan(0);

    refreshProjectGraph(bump(base, first, 2));
    const refreshed = useStore.getState().spatial;
    useStore.temporal.getState().undo();

    expect(useStore.getState().spatial).toBe(refreshed);
    expect(useStore.temporal.getState().pastStates).toHaveLength(0);
    expect(useStore.getState().serverReplaceSeq).toBe(seq + 1);
  });

  it('tầng biến mất (không chưa lưu) → gỡ khỏi kho, meta, `floors`; lịch sử xoá', () => {
    const gone = wallOn(second);
    const seq = useStore.getState().serverReplaceSeq;

    refreshProjectGraph({
      floorRevisions: base.floorRevisions.filter((entry) => entry.floorId !== second),
      graph: {
        ...base.graph,
        levels: base.graph.levels.filter((level) => level.id !== second),
        walls: base.graph.walls.filter((wall) => wall.levelId !== second),
      },
    });

    const state = useStore.getState();
    expect(state.spatial?.byId[second]).toBeUndefined();
    expect(state.spatial?.byId[gone.id]).toBeUndefined();
    expect(state.spatial?.byKind.level).not.toContain(second);
    expect(state.spatial?.byLevel[second]).toBeUndefined();
    expect(state.floorMeta[second]).toBeUndefined();
    expect(state.floors.map((level) => level.id)).not.toContain(second);
    expect(state.serverReplaceSeq).toBe(seq + 1);
  });

  it('tầng biến mất mà chưa lưu → giữ', () => {
    useStore.getState().setUnsavedFloorIds([second]);
    const before = useStore.getState().spatial;

    refreshProjectGraph({
      floorRevisions: base.floorRevisions.filter((entry) => entry.floorId !== second),
      graph: { ...base.graph, levels: base.graph.levels.filter((level) => level.id !== second) },
    });

    expect(useStore.getState().spatial).toBe(before);
  });

  it('tầng mới trong N15 → thêm, không xoá lịch sử', () => {
    const level = base.graph.levels.find((candidate) => candidate.id === second) as Level;
    const fresh: Level = { ...level, id: 'L-NEW', order: 99 };
    editWallOn(first);
    const seq = useStore.getState().serverReplaceSeq;

    refreshProjectGraph({
      floorRevisions: [...base.floorRevisions, { floorId: fresh.id, revision: 0 }],
      graph: { ...base.graph, levels: [...base.graph.levels, fresh] },
    });

    const state = useStore.getState();
    expect(state.spatial?.byId[fresh.id]).toBe(fresh);
    expect(state.floors.at(-1)).toBe(fresh);
    expect(state.serverReplaceSeq).toBe(seq);
    expect(useStore.temporal.getState().pastStates.length).toBeGreaterThan(0);
  });
});

describe('loadProjectGraph', () => {
  it('kho rỗng hoặc dự án khác → nạp đè', () => {
    expect(loadProjectGraph({ document: base, project: PROJECT, roles: [] })).toBe('hydrated');
    expect(
      loadProjectGraph({ document: base, project: { ...PROJECT, id: 'project-2' }, roles: [] }),
    ).toBe('hydrated');
    expect(useStore.getState().spatialProjectId).toBe('project-2');
  });

  it('cùng dự án mà kho chưa có `project` (màn QC nạp) → làm mới, thay toà nhà, đặt dự án và vai, giữ tầng đang xem', () => {
    hydrate();
    useStore.setState({ activeFloorId: second, floors: [], project: null, userRoles: [] });
    const building = { ...base.graph.building, name: 'Toà mới' };

    expect(
      loadProjectGraph({ document: { ...base, graph: { ...base.graph, building } }, project: PROJECT, roles: ['viewer'] }),
    ).toBe('refreshed');

    const state = useStore.getState();
    expect(state.spatial?.building).toBe(building);
    expect(state.project).toBe(PROJECT);
    expect(state.userRoles).toEqual(['viewer']);
    expect(state.floors).toHaveLength(base.graph.levels.length);
    expect(state.activeFloorId).toBe(second);
  });

  it('cùng dự án đã có `project` → chỉ làm mới', () => {
    hydrate();
    useStore.getState().setUserRoles(['admin']);

    expect(loadProjectGraph({ document: base, project: PROJECT, roles: ['viewer'] })).toBe('refreshed');
    expect(useStore.getState().userRoles).toEqual(['admin']);
  });
});
