/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';

import { BUILD_BUDGET_MS, compileActiveSince, installAsyncNodeBuilds, installAsyncPipelines, liveFrame, warmStats } from './warm';

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
    expect(compileActiveSince(123_456)).toBe(123_456); // còn pipeline chờ: đang biên dịch
    resolve();
    await Promise.resolve();
    expect(warmStats().pending).toBe(0);
    expect(compileActiveSince(123_456)).toBeLessThan(123_456); // xong: mốc hoạt động cuối
  });

  it('?disable=warm thì không đụng renderer', () => {
    const original = () => undefined;
    const renderer = { _pipelines: { getForRender: vi.fn(), updateForRender: original } };
    installAsyncPipelines(renderer, true);
    expect(renderer._pipelines.updateForRender).toBe(original);
  });
});

describe('installAsyncNodeBuilds', () => {
  const setup = (buildMs = 0) => {
    const cache = new Map<string, unknown>();
    const data = new Map<unknown, { nodeBuilderState?: unknown }>();
    const seenTargets: unknown[] = [];
    const drawn: unknown[] = [];
    const nodes = {
      get: (ro: unknown) => data.get(ro) ?? (data.set(ro, {}), data.get(ro)!),
      nodeBuilderCache: cache,
      getForRenderCacheKey: (ro: unknown) => String((ro as { key: string }).key),
      // three: `_createNodeBuilder(renderObject, material)`; bản giả không cần tham số.
      _createNodeBuilder: (): { renderer: unknown } => ({ renderer }),
      getForRenderAsync(ro: unknown) {
        const builder = (this._createNodeBuilder as (r: unknown, m: unknown) => { renderer: unknown })(ro, null);
        seenTargets.push((builder.renderer as { getRenderTarget(): unknown }).getRenderTarget());
        const until = performance.now() + buildMs;
        while (performance.now() < until) {
          /* đoạn dựng đồng bộ đầu */
        }
        return Promise.resolve().then(() => cache.set(String((ro as { key: string }).key), {}));
      },
    };
    const renderer = {
      _nodes: nodes,
      _objects: { get: (object: unknown) => object },
      _renderObjectDirect: (...args: unknown[]) => void drawn.push(args[0]),
      _currentRenderContext: null,
      contextNode: null,
      target: 'pass-target' as unknown,
      getRenderTarget() {
        return this.target;
      },
      getMRT: () => 'pass-mrt',
    };
    installAsyncNodeBuilds(renderer, false);
    const draw = (scene: unknown, ...objects: unknown[]) => {
      for (const o of objects) renderer._renderObjectDirect(o, null, scene);
    };
    return { renderer, draw, drawn, seenTargets };
  };

  it('ngoài khung sống vẽ như cũ; trong khung sống bỏ qua vật chưa có shader, dựng với đích của khung', async () => {
    const { renderer, draw, drawn, seenTargets } = setup();
    const scene = {};
    const a = { key: 'a' };
    draw(scene, a);
    expect(drawn).toEqual([a]);
    liveFrame(scene, () => draw(scene, a));
    expect(drawn).toEqual([a]); // chưa vẽ: đang dựng
    renderer.target = null; // khung đã xong, renderer trả đích về
    await Promise.resolve();
    await Promise.resolve();
    expect(seenTargets).toEqual(['pass-target']);
    liveFrame(scene, () => draw(scene, a));
    expect(drawn).toEqual([a, a]); // dựng xong → vẽ
  });

  it('nhiều vật cùng khoá shader chỉ dựng một lần', () => {
    const { draw, seenTargets } = setup();
    const scene = {};
    liveFrame(scene, () => draw(scene, { key: 'k' }, { key: 'k' }, { key: 'k' }));
    expect(seenTargets).toHaveLength(1);
  });

  it('hết ngân sách khung thì để vật còn lại cho khung sau', () => {
    const { draw, seenTargets } = setup(BUILD_BUDGET_MS + 2);
    const scene = {};
    liveFrame(scene, () => draw(scene, { key: 'x' }, { key: 'y' }));
    expect(seenTargets).toHaveLength(1);
    expect(warmStats().buildsPending).toBeGreaterThan(0);
  });
});
