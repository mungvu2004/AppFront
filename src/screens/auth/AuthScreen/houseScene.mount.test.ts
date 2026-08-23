/**
 * `mountHouseScene` with the engine faked: the plan is fetched, then mounted
 * — unless the screen went away first.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const { loadPlan, mountPresentation, createAssetService, presentation, assets } = vi.hoisted(() => {
  const presentation = { dispose: vi.fn() };
  const assets = { dispose: vi.fn(), load: vi.fn() };
  return {
    presentation,
    assets,
    loadPlan: vi.fn(),
    mountPresentation: vi.fn(() => presentation),
    createAssetService: vi.fn(() => assets),
  };
});

vi.mock('@/lib/three/present', () => ({ loadPlan, mountPresentation, createAssetService }));

import { mountHouseScene } from './houseScene';

afterEach(() => {
  vi.clearAllMocks();
});

describe('mountHouseScene', () => {
  it('fetches the plan by its asset URL, then mounts it with the asset service', async () => {
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
    expect(mountPresentation).toHaveBeenCalledWith(canvas, plan, { assets });

    handle.dispose();
    expect(presentation.dispose).toHaveBeenCalledTimes(1);
    expect(assets.dispose).toHaveBeenCalledTimes(1);
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

  it('lets a failed download surface through `ready`, with nothing mounted', async () => {
    loadPlan.mockRejectedValueOnce(new Error('HTTP 404'));

    const handle = mountHouseScene(document.createElement('canvas'));

    await expect(handle.ready).rejects.toThrow('HTTP 404');
    expect(mountPresentation).not.toHaveBeenCalled();
    handle.dispose();
  });
});
