/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';

import { coversScreen, screenSize } from './build-order';
import { BUILD_BUDGET_MS, compileActiveSince, installAsyncNodeBuilds, installAsyncPipelines, installLazyDispose, liveFrame, warmStats } from './warm';

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
    const later = performance.now() + 60_000;
    expect(compileActiveSince(later)).toBe(later); // còn pipeline chờ: đang biên dịch
    resolve();
    await Promise.resolve();
    expect(warmStats().pending).toBe(0);
    expect(compileActiveSince(later)).toBeLessThan(later); // xong: mốc hoạt động cuối
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
    liveFrame(scene, () => draw(scene, a)); // khung đầu: xếp hạng (build-order)
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
    const frame = () => liveFrame(scene, () => draw(scene, { key: 'k' }, { key: 'k' }, { key: 'k' }));
    frame();
    frame();
    expect(seenTargets).toHaveLength(1);
  });

  it('hết ngân sách khung thì để vật còn lại cho khung sau', () => {
    const { draw, seenTargets } = setup(BUILD_BUDGET_MS + 2);
    const scene = {};
    const frame = () => liveFrame(scene, () => draw(scene, { key: 'x' }, { key: 'y' }));
    frame();
    frame();
    expect(seenTargets).toHaveLength(1);
    expect(warmStats().buildsPending).toBeGreaterThan(0);
  });
});

describe('thứ tự dựng (build-order)', () => {
  const sized = (key: string, radius: number) => ({
    key,
    matrixWorld: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
    geometry: { boundingSphere: { center: { x: 0, y: 0, z: -10 }, radius }, computeBoundingSphere: () => undefined },
  });
  const camera = { matrixWorld: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] } };

  it('vật lớn trên màn hình dựng trước; bóng đổ chờ lượt chính hết hàng', () => {
    const order: string[] = [];
    const nodes = {
      get: () => ({}),
      nodeBuilderCache: new Map<string, unknown>(),
      getForRenderCacheKey: (ro: unknown) => (ro as { key: string }).key,
      _createNodeBuilder: () => ({ renderer: null }),
      getForRenderAsync(ro: unknown) {
        order.push((ro as { key: string }).key);
        const until = performance.now() + BUILD_BUDGET_MS + 1;
        while (performance.now() < until) {
          /* một bản dựng đã hết ngân sách khung */
        }
        return new Promise<never>(() => undefined);
      },
    };
    const renderer = {
      _nodes: nodes,
      _objects: { get: (object: unknown, material: unknown) => (material ? { key: `shadow-${(object as { key: string }).key}` } : object) },
      _renderObjectDirect: vi.fn<(...args: unknown[]) => void>(),
      _currentRenderContext: null,
      contextNode: null,
      getRenderTarget: () => null,
      getMRT: () => null,
    };
    installAsyncNodeBuilds(renderer, false);
    const scene = {};
    const small = sized('small', 0.2);
    const room = sized('room', 5);
    const shadow = { isShadowPassMaterial: true };
    liveFrame(scene, () => undefined); // hàng chờ của test trước về 0
    const main = () =>
      liveFrame(scene, () => {
        renderer._renderObjectDirect(small, null, scene, camera);
        renderer._renderObjectDirect(room, null, scene, camera);
      });
    main();
    expect(order).toEqual([]); // khung đầu chỉ xếp hạng
    main();
    expect(order).toEqual(['room']); // khung sau: vật lớn nhất, dựng ngay tại chỗ vẽ
    const lamp = sized('lamp', 0.1);
    const frame = () =>
      liveFrame(scene, () => {
        renderer._renderObjectDirect(lamp, shadow, scene, camera); // bóng vẽ trước lượt chính trong khung
        renderer._renderObjectDirect(small, null, scene, camera);
      });
    frame();
    expect(order).toEqual(['room', 'small']); // khung trước còn hàng chờ chính → bóng đợi
    frame();
    expect(order).toEqual(['room', 'small', 'shadow-lamp']); // hết hàng chờ chính → dựng bóng
  });

  it('screenSize: bán kính / khoảng cách, 0 khi thiếu dữ liệu', () => {
    expect(screenSize(sized('a', 1), camera)).toBeCloseTo(0.1);
    expect(screenSize({}, camera)).toBe(0);
    expect(coversScreen({ frustumCulled: false })).toBe(true); // nền phủ màn hình: dựng ngay
    expect(coversScreen({ frustumCulled: false, isBatchedMesh: true })).toBe(false);
  });
});

describe('installLazyDispose', () => {
  it('render object chưa có bindings: chỉ xoá dữ liệu, không gọi đường xoá dựng shader', () => {
    const deleteForRender = vi.fn();
    const del = vi.fn();
    const renderer = { _bindings: { deleteForRender, delete: del } };
    installLazyDispose(renderer, false);
    installLazyDispose(renderer, false);
    const never = { _bindings: null };
    renderer._bindings.deleteForRender(never);
    expect(deleteForRender).not.toHaveBeenCalled();
    expect(del).toHaveBeenCalledWith(never);
    const built = { _bindings: [] };
    renderer._bindings.deleteForRender(built);
    expect(deleteForRender).toHaveBeenCalledWith(built);
  });
});
