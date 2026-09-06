import { describe, expect, it, vi } from 'vitest';

import type { SpatialApi, SpatialLayer } from '@/api/client';
import type { HttpError, Result } from '@/lib/http';

import { createAutosave } from '../createAutosave';
import { createSpatialLayerSave, type SpatialLayerChanges } from '../spatialLayerSave';

const EMPTY_LAYER: SpatialLayer = { furniture: [], openings: [], rooms: [], walls: [] };

const changesOf = (layer: SpatialLayer = EMPTY_LAYER): SpatialLayerChanges => ({
  floorId: 'floor-1',
  layer,
  projectId: 'project-1',
});

describe('createSpatialLayerSave', () => {
  it('resolves when writeLayer succeeds, passing floorId/projectId/body through', async () => {
    const writeLayer = vi.fn<SpatialApi['writeLayer']>().mockResolvedValue({ data: EMPTY_LAYER, ok: true });
    const save = createSpatialLayerSave({ writeLayer });

    await expect(save(changesOf())).resolves.toBeUndefined();
    expect(writeLayer).toHaveBeenCalledWith({ body: EMPTY_LAYER, floorId: 'floor-1', projectId: 'project-1' });
  });

  it('throws when writeLayer reports a failure, instead of silently swallowing it', async () => {
    const failure: Result<SpatialLayer, HttpError> = {
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
      const failure: Result<SpatialLayer, HttpError> = {
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

      writeLayer.mockResolvedValue({ data: EMPTY_LAYER, ok: true });
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
      const writeLayer = vi.fn<SpatialApi['writeLayer']>().mockResolvedValue({ data: EMPTY_LAYER, ok: true });
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
