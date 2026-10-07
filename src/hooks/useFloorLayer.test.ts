import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetMockLayerState, createMockApiClient } from '@/api/__mocks__/client';
import type { FloorLayerDocument } from '@/api/schemas/spatialLayer';
import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Level, LevelId, SpatialGraph, Wall, WallId } from '@/domain/spatial/types';
import { millimetresPerPixel } from '@/domain/units/scale';
import { setAuthenticatedSession } from '@/lib/auth/state';
import { spatialLayerOf } from '@/lib/autosave/spatialLayerSave';
import { createTestQueryClient } from '@/lib/testing/render';
import { useStore } from '@/store';
import { commit } from '@/store/commit';

import { __resetFloorLayerSavers, flushAutosaves, useFloorLayerAutosave } from './useAutosave';
import { applyFloorLayerDocument, FLOOR_NOT_FOUND_MESSAGE, useFloorLayer, type ReadFloorLayerInput } from './useFloorLayer';

const PROJECT = 'project-1';
const BUILDING: SpatialGraph = { ...createSampleBuilding(), notes: [] };
const SAMPLE = normalizeSpatial(BUILDING);
const FLOOR = SAMPLE.byKind.level[0] as LevelId;
const OTHER = SAMPLE.byKind.level[1] as LevelId;
const LAST = SAMPLE.byKind.level[3] as LevelId;

/** Đồ thị mẫu thiếu một tầng — kho do một màn QC khác nạp. */
const withoutLevel = (levelId: LevelId): NormalizedSpatial => {
  const walls = BUILDING.walls.filter((wall) => wall.levelId !== levelId);
  const wallIds = new Set(walls.map((wall) => wall.id));

  return normalizeSpatial({
    ...BUILDING,
    axes: BUILDING.axes.filter((axis) => axis.levelId !== levelId),
    dimensions: BUILDING.dimensions.filter((dimension) => dimension.levelId !== levelId),
    furniture: BUILDING.furniture.filter((item) => item.levelId !== levelId),
    levels: BUILDING.levels.filter((level) => level.id !== levelId),
    openings: BUILDING.openings.filter((opening) => wallIds.has(opening.wallId)),
    rooms: BUILDING.rooms.filter((room) => room.levelId !== levelId),
    walls,
  });
};

const firstWallOf = (graph: NormalizedSpatial, levelId: LevelId): Wall =>
  graph.byKind.wall.map((id) => graph.byId[id] as Wall).find((wall) => wall.levelId === levelId) as Wall;

/** Tài liệu N16 của một tầng mẫu; `thicker` đổi một tường để thấy lượt thay. */
const documentOf = (
  levelId: LevelId,
  revision: number,
  extra: { scaleStatus?: 'unresolved'; thicker?: boolean } = {},
): FloorLayerDocument => {
  const layer = spatialLayerOf(SAMPLE, levelId);
  const walls =
    extra.thicker === true
      ? layer.walls.map((wall, index) => (index === 0 ? { ...wall, thicknessMm: wall.thicknessMm + 50 } : wall))
      : layer.walls;

  return {
    axes: [],
    dimensions: [],
    layer: { ...layer, walls },
    level: { ...(SAMPLE.byId[levelId] as Level), scaleMillimetresPerPixel: millimetresPerPixel(2) },
    revision,
    ...(extra.scaleStatus === undefined ? {} : { scaleStatus: extra.scaleStatus }),
  };
};

const seedStore = (graph: NormalizedSpatial, revisions: Record<string, number>): void => {
  useStore.getState().setSpatial(graph, null, { floorRevisions: revisions, projectId: PROJECT });
  useStore.temporal.getState().clear();
};

const allAt = (revision: number): Record<string, number> =>
  Object.fromEntries(SAMPLE.byKind.level.map((id) => [id, revision]));

const thickenFirstWall = (levelId: LevelId): void => {
  const wall = firstWallOf(useStore.getState().spatial as NormalizedSpatial, levelId);

  act(() => {
    commit({ changes: { thicknessMm: wall.thicknessMm + 10 }, id: wall.id as WallId, kind: 'wall', op: 'update' }, 'Đổi độ dày');
  });
};

const renderFloorLayer = (floorId: LevelId, read: (input: ReadFloorLayerInput) => Promise<FloorLayerDocument>) => {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);

  return renderHook(() => useFloorLayer({ floorId, projectId: PROJECT, read }), { wrapper });
};

/** Mã kích thước của một tầng trong kho. */
const dimensionIdsOn = (levelId: LevelId): string[] => {
  const spatial = useStore.getState().spatial;

  return (spatial?.byLevel[levelId] ?? []).filter((id) => spatial?.byKind.dimension.includes(id));
};

describe('NO-374 — kích thước N16 vào kho cùng lớp', () => {
  afterEach(() => {
    useStore.getState().setSpatial(null, null);
    useStore.getState().setUnsavedFloorIds([]);
  });

  it('kho thiếu tầng → tầng thêm vào mang kích thước của N16', () => {
    const own = BUILDING.dimensions.filter((dimension) => dimension.levelId === LAST);

    expect(own.length).toBeGreaterThan(0);
    seedStore(withoutLevel(LAST), { [FLOOR]: 1, [OTHER]: 1 });
    applyFloorLayerDocument(PROJECT, LAST, { ...documentOf(LAST, 1), dimensions: own });

    expect(dimensionIdsOn(LAST).sort()).toEqual(own.map((dimension) => dimension.id).sort());
  });

  it('revision lớn hơn (thay ngoài) → kích thước của tầng là của N16, không còn bản cũ', () => {
    seedStore(SAMPLE, allAt(1));
    expect(dimensionIdsOn(FLOOR).length).toBeGreaterThan(0);

    applyFloorLayerDocument(PROJECT, FLOOR, documentOf(FLOOR, 2));

    expect(dimensionIdsOn(FLOOR)).toEqual([]);
    expect(useStore.getState().floorMeta[FLOOR]?.revision).toBe(2);
  });
});

describe('useFloorLayer — N16 một tầng vào kho theo revision', () => {
  beforeEach(() => {
    __resetFloorLayerSavers();
    __resetMockLayerState();
    useStore.getState().setSpatial(null, null);
    useStore.getState().setUnsavedFloorIds([]);
    useStore.temporal.getState().clear();
  });

  afterEach(() => {
    __resetFloorLayerSavers();
    useStore.getState().setSpatial(null, null);
    useStore.getState().setUnsavedFloorIds([]);
  });

  it('kho rỗng → nạp tầng, ghi dự án và revision', async () => {
    const { result } = renderFloorLayer(FLOOR, () => Promise.resolve(documentOf(FLOOR, 4)));

    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(useStore.getState().spatial).not.toBeNull());

    const state = useStore.getState();
    expect(state.spatialProjectId).toBe(PROJECT);
    expect(state.floorMeta[FLOOR]?.revision).toBe(4);
    expect(state.spatial?.byKind.level).toEqual([FLOOR]);
    expect(result.current.scaleStatus).toBeUndefined();
  });

  it('kho rỗng + N16 unresolved → scaleStatus vào meta cùng lượt nạp', async () => {
    const { result } = renderFloorLayer(FLOOR, () => Promise.resolve(documentOf(FLOOR, 1, { scaleStatus: 'unresolved' })));

    await waitFor(() => expect(result.current.scaleStatus).toBe('unresolved'));
    expect(useStore.getState().floorMeta[FLOOR]).toEqual({ revision: 1, scaleStatus: 'unresolved' });
  });

  it('kho của dự án khác → nạp đè', async () => {
    useStore.getState().setSpatial(SAMPLE, null, { floorRevisions: allAt(9), projectId: 'project-other' });

    renderFloorLayer(FLOOR, () => Promise.resolve(documentOf(FLOOR, 1)));

    await waitFor(() => expect(useStore.getState().spatialProjectId).toBe(PROJECT));
    expect(useStore.getState().spatial?.byKind.level).toEqual([FLOOR]);
    expect(useStore.getState().floorMeta[FLOOR]?.revision).toBe(1);
  });

  it('cùng dự án thiếu tầng → thêm tầng, tầng khác giữ tham chiếu, lịch sử giữ', async () => {
    const partial = withoutLevel(LAST);
    seedStore(partial, { [FLOOR]: 1, [OTHER]: 1 });
    thickenFirstWall(FLOOR);
    const before = useStore.getState().spatial as NormalizedSpatial;
    const keptWall = firstWallOf(before, OTHER);
    const pastBefore = useStore.temporal.getState().pastStates.length;

    renderFloorLayer(LAST, () => Promise.resolve(documentOf(LAST, 3)));

    await waitFor(() => expect(useStore.getState().spatial?.byId[LAST]).toBeDefined());
    const after = useStore.getState().spatial as NormalizedSpatial;
    expect(after.byId[keptWall.id]).toBe(keptWall);
    expect(after.byLevel[OTHER]).toBe(before.byLevel[OTHER]);
    expect(useStore.getState().floorMeta[LAST]?.revision).toBe(3);
    expect(pastBefore).toBeGreaterThan(0);
    expect(useStore.temporal.getState().pastStates.length).toBe(pastBefore);
  });

  it('cùng revision → chỉ cập nhật meta (scaleStatus vào meta), đồ thị giữ tham chiếu', async () => {
    seedStore(SAMPLE, allAt(2));
    const before = useStore.getState().spatial;

    const { result } = renderFloorLayer(FLOOR, () =>
      Promise.resolve(documentOf(FLOOR, 2, { scaleStatus: 'unresolved', thicker: true })),
    );

    await waitFor(() => expect(useStore.getState().floorMeta[FLOOR]?.scaleStatus).toBe('unresolved'));
    expect(useStore.getState().spatial).toBe(before);
    expect(result.current.scaleStatus).toBe('unresolved');
  });

  it('revision lớn hơn → thay tầng từ ngoài, xoá lịch sử, tăng serverReplaceSeq', async () => {
    seedStore(SAMPLE, allAt(2));
    thickenFirstWall(OTHER);
    const seq = useStore.getState().serverReplaceSeq;
    const original = firstWallOf(SAMPLE, FLOOR);

    renderFloorLayer(FLOOR, () => Promise.resolve(documentOf(FLOOR, 5, { thicker: true })));

    await waitFor(() => expect(useStore.getState().floorMeta[FLOOR]?.revision).toBe(5));
    const replaced = useStore.getState().spatial?.byId[original.id] as Wall;
    expect(replaced.thicknessMm).toBe(original.thicknessMm + 50);
    expect(useStore.getState().serverReplaceSeq).toBe(seq + 1);
    expect(useStore.temporal.getState().pastStates).toHaveLength(0);
  });

  it('revision lớn hơn → Level mới cùng lớp (tỉ lệ máy chủ đổi, review-1 P2-2)', async () => {
    seedStore(SAMPLE, allAt(2));
    const document = documentOf(FLOOR, 5, { thicker: true });

    expect((SAMPLE.byId[FLOOR] as Level).scaleMillimetresPerPixel).not.toBe(document.level.scaleMillimetresPerPixel);
    renderFloorLayer(FLOOR, () => Promise.resolve(document));

    await waitFor(() => expect(useStore.getState().floorMeta[FLOOR]?.revision).toBe(5));
    expect(useStore.getState().spatial?.byId[FLOOR]).toEqual(document.level);
  });

  it('vắng meta → thay tầng', async () => {
    seedStore(SAMPLE, { [OTHER]: 1 });
    const original = firstWallOf(SAMPLE, FLOOR);

    renderFloorLayer(FLOOR, () => Promise.resolve(documentOf(FLOOR, 0, { thicker: true })));

    await waitFor(() => expect(useStore.getState().floorMeta[FLOOR]?.revision).toBe(0));
    expect((useStore.getState().spatial?.byId[original.id] as Wall).thicknessMm).toBe(original.thicknessMm + 50);
  });

  it('revision lớn hơn mà tầng chưa lưu → không đụng đồ thị lẫn floorMeta', async () => {
    seedStore(SAMPLE, allAt(2));
    useStore.getState().setUnsavedFloorIds([FLOOR]);
    const spatial = useStore.getState().spatial;
    const meta = useStore.getState().floorMeta;
    const read = vi.fn(() => Promise.resolve(documentOf(FLOOR, 7, { scaleStatus: 'unresolved', thicker: true })));

    const { result } = renderFloorLayer(FLOOR, read);

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(useStore.getState().spatial).toBe(spatial);
    expect(useStore.getState().floorMeta).toBe(meta);
  });

  it('revision nhỏ hơn → bỏ', async () => {
    seedStore(SAMPLE, allAt(6));
    const spatial = useStore.getState().spatial;
    const meta = useStore.getState().floorMeta;

    const { result } = renderFloorLayer(FLOOR, () => Promise.resolve(documentOf(FLOOR, 3, { thicker: true })));

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(useStore.getState().spatial).toBe(spatial);
    expect(useStore.getState().floorMeta).toBe(meta);
  });

  it('404 resource:"floor" → câu cố định', async () => {
    const notFound = { kind: 'notFound', raw: { resource: 'floor' }, requestId: 'r', retryable: false, status: 404 };

    const { result } = renderFloorLayer(FLOOR, () => Promise.reject(notFound));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.errorMessage).toBe(FLOOR_NOT_FOUND_MESSAGE);
    expect(result.current.isPending).toBe(false);
  });

  it('lỗi khác → câu của describeError, không phải câu 404', async () => {
    const { result } = renderFloorLayer(FLOOR, () => Promise.reject(new Error('boom')));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.errorMessage).not.toBe(FLOOR_NOT_FOUND_MESSAGE);
    expect(result.current.errorMessage?.length).toBeGreaterThan(0);
  });

  it('nạp và thay tầng không sinh PUT (saver thật)', async () => {
    setAuthenticatedSession({ accessToken: 't', expiresAt: Date.now() + 3_600_000, roles: [], user: { id: 'u' } });
    seedStore(SAMPLE, allAt(2));
    const client = createMockApiClient();
    const writeLayer = vi.spyOn(client.spatial, 'writeLayer');
    renderHook(() => useFloorLayerAutosave({ apiClient: client, floorId: FLOOR, projectId: PROJECT }));

    renderFloorLayer(FLOOR, () => Promise.resolve(documentOf(FLOOR, 5, { thicker: true })));

    await waitFor(() => expect(useStore.getState().floorMeta[FLOOR]?.revision).toBe(5));
    await act(async () => {
      await vi.dynamicImportSettled();
      await flushAutosaves();
    });
    expect(writeLayer).not.toHaveBeenCalled();
  });
});
