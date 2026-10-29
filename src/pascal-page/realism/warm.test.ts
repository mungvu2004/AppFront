/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';

import { installAsyncPipelines, liveFrame, warmStats } from './warm';

describe('installAsyncPipelines', () => {
  it('chỉ vật của cảnh chính trong khung sống tạo pipeline bất đồng bộ, và đếm lúc xong', async () => {
    let resolve!: () => void;
    const getForRender = vi.fn((_ro: unknown, promises?: Promise<unknown>[] | null) => {
      promises?.push(new Promise<void>((r) => (resolve = r)));
    });
    const renderer: { _pipelines: { getForRender: typeof getForRender; updateForRender(ro: unknown): void } } = {
      _pipelines: { getForRender, updateForRender: () => undefined },
    };
    installAsyncPipelines(renderer, false);
    installAsyncPipelines(renderer, false); // gọi mỗi khung: chỉ bọc một lần
    const scene = {};
    renderer._pipelines.updateForRender({ scene });
    expect(getForRender).toHaveBeenLastCalledWith({ scene }); // ngoài khung sống: đồng bộ như cũ
    const quad = { scene: {} };
    liveFrame(scene, () => renderer._pipelines.updateForRender(quad));
    expect(getForRender).toHaveBeenLastCalledWith(quad); // quad hậu kỳ / cảnh khác: đồng bộ
    liveFrame(scene, () => renderer._pipelines.updateForRender({ scene }));
    expect(getForRender).toHaveBeenLastCalledWith({ scene }, expect.any(Array));
    expect(warmStats().pending).toBe(1);
    resolve();
    await Promise.resolve();
    expect(warmStats().pending).toBe(0);
  });

  it('?disable=warm thì không đụng renderer', () => {
    const original = () => undefined;
    const renderer = { _pipelines: { getForRender: vi.fn(), updateForRender: original } };
    installAsyncPipelines(renderer, true);
    expect(renderer._pipelines.updateForRender).toBe(original);
  });
});
