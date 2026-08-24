/**
 * `mountHouseScene` with the engine faked: the plan is fetched, the geometry
 * cache is consulted, then the scene is mounted — unless the screen went away
 * first — and a cold build's geometry is written back for the next visit.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const { loadPlan, mountPresentation, createAssetService, createGeometryCache, planCacheKey, presentation, assets, cache } =
  vi.hoisted(() => {
    const presentation = {
      dispose: vi.fn(),
      report: { geometry: null as unknown, geometryRestored: false },
    };
    const assets = { dispose: vi.fn(), load: vi.fn() };
    const cache = {
      load: vi.fn((): Promise<unknown> => Promise.resolve(null)),
      store: vi.fn(() => Promise.resolve()),
    };
    return {
      presentation,
      assets,
      cache,
      loadPlan: vi.fn(),
      mountPresentation: vi.fn(() => presentation),
      createAssetService: vi.fn(() => assets),
      createGeometryCache: vi.fn(() => cache),
      planCacheKey: vi.fn(() => 'plan-abc'),
    };
  });

vi.mock('@/lib/three/present', () => ({
  loadPlan,
  mountPresentation,
  createAssetService,
  createGeometryCache,
  planCacheKey,
  DEFAULT_LIGHT_BUDGET: 8,
}));

import { mountHouseScene } from './houseScene';

afterEach(() => {
  vi.clearAllMocks();
  cache.load.mockImplementation(() => Promise.resolve(null));
  presentation.report = { geometry: null, geometryRestored: false };
});

describe('mountHouseScene', () => {
  it('fetches the plan by its asset URL, then mounts it with the asset service and the cache miss', async () => {
    const plan = { levels: [] };
    loadPlan.mockResolvedValueOnce(plan);
    const canvas = document.createElement('canvas');

    const handle = mountHouseScene(canvas);
    await handle.ready;

    expect(loadPlan).toHaveBeenCalledTimes(1);
    const [url, options] = loadPlan.mock.calls[0] as [string, { signal: AbortSignal }];
    expect(url).toMatch(/houseModel/);
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(createAssetService).toHaveBeenCalledWith({ dracoDecoderPath: '/draco/' });
    expect(planCacheKey).toHaveBeenCalledWith(plan, 8);
    expect(cache.load).toHaveBeenCalledWith('plan-abc');
    expect(mountPresentation).toHaveBeenCalledWith(canvas, plan, { assets, cachedGeometry: null });

    handle.dispose();
    expect(presentation.dispose).toHaveBeenCalledTimes(1);
    expect(assets.dispose).toHaveBeenCalledTimes(1);
  });

  it('hands a stored assembly to the mount, and does not write it back again', async () => {
    const stored = { fingerprint: 7, batches: [] };
    loadPlan.mockResolvedValueOnce({ levels: [] });
    cache.load.mockImplementationOnce(() => Promise.resolve(stored));
    presentation.report = { geometry: stored, geometryRestored: true };

    const handle = mountHouseScene(document.createElement('canvas'));
    await handle.ready;

    expect((mountPresentation.mock.calls[0] as unknown[])[2]).toMatchObject({ cachedGeometry: stored });
    expect(cache.store).not.toHaveBeenCalled();
    handle.dispose();
  });

  it('stores a cold build under the plan key, without waiting for the write', async () => {
    const baked = { fingerprint: 9, batches: [] };
    loadPlan.mockResolvedValueOnce({ levels: [] });
    presentation.report = { geometry: baked, geometryRestored: false };
    cache.store.mockImplementationOnce(() => new Promise(() => undefined));

    const handle = mountHouseScene(document.createElement('canvas'));
    await handle.ready;

    expect(cache.store).toHaveBeenCalledWith('plan-abc', baked);
    handle.dispose();
  });

  it('does not mount a plan that arrives after dispose, and aborts the download', async () => {
    let resolve: (plan: unknown) => void = () => undefined;
    loadPlan.mockImplementationOnce(
      (_url: string, options: { signal: AbortSignal }) =>
        new Promise((done) => {
          resolve = done;
          options.signal.addEventListener('abort', () => done({ levels: [] }));
        }),
    );

    const handle = mountHouseScene(document.createElement('canvas'));
    handle.dispose();
    resolve({ levels: [] });
    await handle.ready;

    expect(mountPresentation).not.toHaveBeenCalled();
    expect(assets.dispose).toHaveBeenCalledTimes(1);
  });

  it('does not mount when dispose lands while the cache is reading', async () => {
    loadPlan.mockResolvedValueOnce({ levels: [] });
    let settle: (value: null) => void = () => undefined;
    cache.load.mockImplementationOnce(() => new Promise<null>((done) => (settle = done)));

    const handle = mountHouseScene(document.createElement('canvas'));
    await Promise.resolve();
    handle.dispose();
    settle(null);
    await handle.ready;

    expect(mountPresentation).not.toHaveBeenCalled();
  });

  it('lets a failed download surface through `ready`, with nothing mounted', async () => {
    loadPlan.mockRejectedValueOnce(new Error('HTTP 404'));

    const handle = mountHouseScene(document.createElement('canvas'));

    await expect(handle.ready).rejects.toThrow('HTTP 404');
    expect(mountPresentation).not.toHaveBeenCalled();
    handle.dispose();
  });
});
