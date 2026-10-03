import { describe, expect, it, vi } from 'vitest';

import type { SpatialApi, SpatialLayer } from '@/api/client';
import type { Furniture } from '@/domain/spatial/types';
import type { HttpError, Result } from '@/lib/http';

import {
  SAMPLE_BUILDING,
  sampleFurnitureId,
  sampleLevelId,
  sampleWindowId,
} from '@/domain/spatial/__fixtures__/sampleBuilding';
import { applyPatch, readEntity } from '@/domain/spatial/applyPatch';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { isTransientWireError } from '@/lib/errors/wireError';

import { createAutosave } from '../createAutosave';
import {
  changedLevelIds,
  createFloorLayerSave,
  createSpatialLayerSave,
  spatialLayerOf,
  type SpatialLayerChanges,
} from '../spatialLayerSave';

const EMPTY_LAYER: SpatialLayer = { furniture: [], openings: [], rooms: [], walls: [] };

const SAVED = { data: { layer: EMPTY_LAYER, revision: 4 }, ok: true } as const;

const changesOf = (layer: SpatialLayer = EMPTY_LAYER): SpatialLayerChanges => ({
  baseVersion: 3,
  floorId: 'floor-1',
  layer,
  projectId: 'project-1',
});

describe('createSpatialLayerSave', () => {
  it('resolves when writeLayer succeeds, passing baseVersion/floorId/projectId/body through', async () => {
    const writeLayer = vi.fn<SpatialApi['writeLayer']>().mockResolvedValue(SAVED);
    const save = createSpatialLayerSave({ writeLayer });

    await expect(save(changesOf())).resolves.toBeUndefined();
    expect(writeLayer).toHaveBeenCalledWith({
      baseVersion: 3,
      body: EMPTY_LAYER,
      floorId: 'floor-1',
      projectId: 'project-1',
    });
  });

  it('throws when writeLayer reports a failure, instead of silently swallowing it', async () => {
    const failure: Result<never, HttpError> = {
      error: { kind: 'network', raw: undefined, requestId: 'req-1', retryable: true },
      ok: false,
    };
    const writeLayer = vi.fn<SpatialApi['writeLayer']>().mockResolvedValue(failure);
    const save = createSpatialLayerSave({ writeLayer });

    await expect(save(changesOf())).rejects.toThrow();
  });

  it('plugs into createAutosave: a failed write is retried on the shared retry schedule, not a second one of its own', async () => {
    vi.useFakeTimers();

    try {
      const failure: Result<never, HttpError> = {
        error: { kind: 'network', raw: undefined, requestId: 'req-1', retryable: true },
        ok: false,
      };
      const writeLayer = vi.fn<SpatialApi['writeLayer']>().mockResolvedValue(failure);
      const save = createSpatialLayerSave({ writeLayer });

      let pending: SpatialLayerChanges | undefined = changesOf();
      const autosave = createAutosave<SpatialLayerChanges>({
        getChanges: () => pending,
        isOnline: () => true,
        save,
      });

      autosave.notifyChange();
      await vi.advanceTimersByTimeAsync(800);
      expect(writeLayer).toHaveBeenCalledTimes(1);
      expect(autosave.getState()).toBe('dirty');

      await vi.advanceTimersByTimeAsync(5_000);
      expect(writeLayer).toHaveBeenCalledTimes(2);

      writeLayer.mockResolvedValue(SAVED);
      pending = changesOf();
      await vi.advanceTimersByTimeAsync(15_000);
      expect(writeLayer).toHaveBeenCalledTimes(3);
      expect(autosave.getState()).toBe('saved');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not attempt a write when there is nothing pending', async () => {
    vi.useFakeTimers();

    try {
      const writeLayer = vi.fn<SpatialApi['writeLayer']>().mockResolvedValue(SAVED);
      const save = createSpatialLayerSave({ writeLayer });
      const autosave = createAutosave<SpatialLayerChanges>({ getChanges: () => undefined, save });

      await autosave.saveNow();

      expect(writeLayer).not.toHaveBeenCalled();
      expect(autosave.getState()).toBe('saved');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('createFloorLayerSave (B-V6-03)', () => {
  const FLOOR = sampleLevelId(1);
  const graph = normalizeSpatial(SAMPLE_BUILDING);
  const readOk = (revision: number) =>
    vi.fn<SpatialApi['readLayer']>().mockResolvedValue({
      data: {
        axes: [],
        dimensions: [],
        layer: EMPTY_LAYER,
        level: SAMPLE_BUILDING.levels[1]!,
        revision,
      },
      ok: true,
    });

  it('lượt đầu lấy baseVersion từ N16; lượt sau dùng revision vừa ghi, không đọc lại', async () => {
    const readLayer = readOk(7);
    const writeLayer = vi
      .fn<SpatialApi['writeLayer']>()
      .mockResolvedValueOnce({ data: { layer: EMPTY_LAYER, revision: 8 }, ok: true })
      .mockResolvedValueOnce({ data: { layer: EMPTY_LAYER, revision: 9 }, ok: true });
    const save = createFloorLayerSave({ readLayer, writeLayer });

    await save({ floorId: FLOOR, graph, projectId: 'project-1' });
    await save({ floorId: FLOOR, graph, projectId: 'project-1' });

    expect(readLayer).toHaveBeenCalledTimes(1);
    expect(writeLayer.mock.calls.map(([input]) => input.baseVersion)).toEqual([7, 8]);
    expect(writeLayer.mock.calls[0]?.[0].body).toEqual(spatialLayerOf(graph, FLOOR));
  });

  it('đồ thị không có tầng của URL thì KHÔNG ghi — một PUT rỗng là xoá sạch tầng ấy', async () => {
    const readLayer = readOk(1);
    const writeLayer = vi.fn<SpatialApi['writeLayer']>();
    const save = createFloorLayerSave({ readLayer, writeLayer });

    await expect(save({ floorId: 'L-OTHERFLOOR01', graph, projectId: 'project-1' })).rejects.toThrow(
      'L-OTHERFLOOR01',
    );
    expect(writeLayer).not.toHaveBeenCalled();
  });

  it('409 của máy chủ ném kèm HttpError gốc, nên tự lưu không thử lại vô ích', async () => {
    const conflict = { kind: 'http', raw: undefined, requestId: 'req-2', retryable: false, status: 409 } as const;
    const writeLayer = vi.fn<SpatialApi['writeLayer']>().mockResolvedValue({ error: conflict, ok: false });
    const save = createFloorLayerSave({ readLayer: readOk(1), writeLayer });

    const error: unknown = await save({ floorId: FLOOR, graph, projectId: 'project-1' }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect(isTransientWireError(error)).toBe(false);
  });
});

describe('changedLevelIds — B-V8-41: đích lưu là mọi tầng có thứ bị đổi', () => {
  const base = normalizeSpatial(SAMPLE_BUILDING);
  const furnitureId = sampleFurnitureId(0);
  const furniture = readEntity(base, 'furniture', furnitureId);

  if (furniture === null) {
    throw new Error('bộ mẫu thiếu đồ đạc 0');
  }

  it('cùng một đồ thị thì không tầng nào', () => {
    expect(changedLevelIds(base, base)).toEqual([]);
  });

  it('sửa một ô mở thì ra tầng của tường chủ', () => {
    const windowId = sampleWindowId(0);
    const opening = readEntity(base, 'opening', windowId);
    const host = opening === null ? null : readEntity(base, 'wall', opening.wallId);
    const next = applyPatch(base, [{ changes: { widthMm: 1234 }, id: windowId, kind: 'opening', op: 'update' }]);

    expect(changedLevelIds(base, next)).toEqual([host?.levelId]);
  });

  it('đồ đạc dời sang tầng khác thì ra cả tầng cũ lẫn tầng mới', () => {
    const target = furniture.levelId === sampleLevelId(2) ? sampleLevelId(3) : sampleLevelId(2);
    const next = applyPatch(base, [{ changes: { levelId: target }, id: furnitureId, kind: 'furniture', op: 'update' }]);

    expect([...changedLevelIds(base, next)].sort()).toEqual([furniture.levelId, target].sort());
  });

  it('thêm rồi xoá một đồ đạc thì vẫn ra tầng ấy — mảng byLevel đã đổi tham chiếu', () => {
    const extra: Furniture = { ...furniture, id: sampleFurnitureId(99) };
    const added = applyPatch(base, [{ entity: extra, kind: 'furniture', op: 'add' }]);
    const removed = applyPatch(added, [{ id: extra.id, kind: 'furniture', op: 'remove' }]);

    expect(changedLevelIds(base, removed)).toEqual([furniture.levelId]);
  });

  it('tầng đã bị xoá khỏi đồ thị mới thì không ra', () => {
    const levelId = furniture.levelId;
    const next = applyPatch(base, [{ id: levelId, kind: 'level', op: 'remove' }]);

    expect(changedLevelIds(base, next)).not.toContain(levelId);
  });
});
