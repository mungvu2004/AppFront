import { describe, expect, it, vi } from 'vitest';

import type { ModelDownloader } from '../assets';
import { isPresentationPlan } from '../plan';
import { loadPlan } from '../planLoader';

import { FIXTURE_PLAN } from './fixtures';

const encode = (value: unknown): ArrayBuffer => new TextEncoder().encode(JSON.stringify(value)).buffer as ArrayBuffer;

describe('isPresentationPlan', () => {
  it('takes the five lists and the ceiling lights, and nothing less', () => {
    expect(isPresentationPlan(FIXTURE_PLAN)).toBe(true);
    expect(isPresentationPlan({ ...FIXTURE_PLAN, extra: 'ignored' })).toBe(true);

    expect(isPresentationPlan(null)).toBe(false);
    expect(isPresentationPlan('plan')).toBe(false);
    expect(isPresentationPlan({ ...FIXTURE_PLAN, walls: 'none' })).toBe(false);
    expect(isPresentationPlan({ ...FIXTURE_PLAN, ceilingLights: null })).toBe(false);
    expect(isPresentationPlan({ ...FIXTURE_PLAN, ceilingLights: { roomIds: [] } })).toBe(false);
    expect(isPresentationPlan({ ...FIXTURE_PLAN, ceilingLights: { heightMm: 2300 } })).toBe(false);
  });
});

describe('loadPlan', () => {
  it('downloads, decodes and checks the plan, passing the signal through', async () => {
    const download = vi.fn(() => Promise.resolve(encode(FIXTURE_PLAN)));
    const controller = new AbortController();

    const plan = await loadPlan('/plans/flat.json', { download, signal: controller.signal });

    expect(plan).toEqual(FIXTURE_PLAN);
    expect(download).toHaveBeenCalledWith('/plans/flat.json', controller.signal);
  });

  it('hands the transport a signal even when the caller gave none', async () => {
    const download = vi.fn<ModelDownloader>(() => Promise.resolve(encode(FIXTURE_PLAN)));

    await loadPlan('/plans/flat.json', { download });

    expect(download.mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal);
  });

  it('rejects a body that is not JSON, and JSON that is not a plan', async () => {
    const garbage = vi.fn(() => Promise.resolve(new TextEncoder().encode('<html>').buffer as ArrayBuffer));
    await expect(loadPlan('/x', { download: garbage })).rejects.toBeInstanceOf(SyntaxError);

    const wrongShape = vi.fn(() => Promise.resolve(encode({ rooms: [] })));
    await expect(loadPlan('/x', { download: wrongShape })).rejects.toBeInstanceOf(TypeError);
  });

  it('passes a transport failure through untouched', async () => {
    const failing = vi.fn(() => Promise.reject(new Error('HTTP 404')));

    await expect(loadPlan('/x', { download: failing })).rejects.toThrow('HTTP 404');
  });

  it('reaches for the platform transport by default, and fails plainly without one', async () => {
    vi.stubGlobal('fetch', undefined);

    await expect(loadPlan('/x')).rejects.toThrow();

    vi.unstubAllGlobals();
  });
});
