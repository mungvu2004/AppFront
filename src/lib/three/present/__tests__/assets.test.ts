import type { Mesh, Object3D } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAssetService, noAssetService, platformDownloader } from '../assets';

import { fakeModel } from './fixtures';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const bytes = (): ArrayBuffer => new ArrayBuffer(8);

describe('createAssetService', () => {
  it('downloads and parses a model once, and hands out clones', async () => {
    const download = vi.fn(async () => bytes());
    const parse = vi.fn(async () => fakeModel());
    const service = createAssetService({ download, parse });

    const first = await service.load('/chair.glb');
    const second = await service.load('/chair.glb');

    expect(download).toHaveBeenCalledTimes(1);
    expect(parse).toHaveBeenCalledTimes(1);
    expect(first).not.toBe(second);
    expect(first.children).toHaveLength(1);
    expect(second.children).toHaveLength(1);
  });

  it('passes the caller signal to the download', async () => {
    const download = vi.fn(async () => bytes());
    const service = createAssetService({ download, parse: async () => fakeModel() });
    const aborter = new AbortController();

    await service.load('/chair.glb', aborter.signal);

    expect(download).toHaveBeenCalledWith('/chair.glb', aborter.signal);
  });

  it('rejects an empty URL before touching the network', async () => {
    const download = vi.fn(async () => bytes());
    const service = createAssetService({ download, parse: async () => fakeModel() });

    await expect(service.load('   ')).rejects.toBeInstanceOf(RangeError);
    expect(download).not.toHaveBeenCalled();
  });

  it('does not cache a failure: the next call tries again', async () => {
    let attempts = 0;
    const download = vi.fn(async (): Promise<ArrayBuffer> => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error('offline');
      }
      return bytes();
    });
    const service = createAssetService({ download, parse: async () => fakeModel() });

    await expect(service.load('/chair.glb')).rejects.toThrow('offline');
    await expect(service.load('/chair.glb')).resolves.toBeDefined();
    expect(download).toHaveBeenCalledTimes(2);
  });

  it('surfaces a parse failure as a rejection', async () => {
    const service = createAssetService({
      download: async () => bytes(),
      parse: async () => {
        throw new Error('not a glb');
      },
    });

    await expect(service.load('/broken.glb')).rejects.toThrow('not a glb');
  });

  it('disposes what it cached', async () => {
    const root = fakeModel();
    const mesh = root.children[0] as Mesh;
    const geometrySpy = vi.spyOn(mesh.geometry, 'dispose');
    const materialSpy = vi.spyOn(mesh.material as { dispose(): void }, 'dispose');
    const service = createAssetService({ download: async () => bytes(), parse: async (): Promise<Object3D> => root });

    await service.load('/chair.glb');
    service.dispose();
    await Promise.resolve();

    expect(geometrySpy).toHaveBeenCalled();
    expect(materialSpy).toHaveBeenCalled();
  });
});

describe('noAssetService', () => {
  it('rejects everything and disposes nothing', async () => {
    const service = noAssetService();

    await expect(service.load('/chair.glb')).rejects.toThrow();
    expect(() => {
      service.dispose();
    }).not.toThrow();
  });
});

describe('platformDownloader', () => {
  it('returns the body of an ok response', async () => {
    const body = bytes();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => body })),
    );

    const download = platformDownloader();

    await expect(download('/chair.glb', new AbortController().signal)).resolves.toBe(body);
  });

  it('rejects a response that is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, arrayBuffer: async () => bytes() })),
    );

    await expect(platformDownloader()('/missing.glb', new AbortController().signal)).rejects.toThrow('404');
  });

  it('rejects when the platform has no transport', async () => {
    vi.stubGlobal('fetch', undefined);

    await expect(platformDownloader()('/chair.glb', new AbortController().signal)).rejects.toThrow();
  });
});
