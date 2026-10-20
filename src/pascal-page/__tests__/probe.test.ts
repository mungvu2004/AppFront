// @vitest-environment node
/**
 * Đầu dò `?probe=1` (I5): không cờ thì không gắn; có cờ thì đọc store Pascal.
 *
 * Store Pascal ở đây là bản giả: vitest không nạp được `@pascal-app/*` thật khi gói chưa
 * dựng `dist/*.js`, nên bài kiểm gọi thẳng `./createProbe` (phần `./probe` chỉ nối store thật).
 */
import { describe, expect, it, vi } from 'vitest';

import { installPascalProbe, type PascalProbe, type PascalProbeStores } from '../createProbe';

const fakeStores = () => {
  const registry = new Map<string, { userData: Record<string, unknown> }>();
  const stores = {
    useScene: {
      getState: () => ({
        nodes: {
          w1: { type: 'wall', slots: { interior: 'scene:plaster' }, skirting: { height: 0.1 } },
          w2: { type: 'wall' },
          s1: { type: 'slab', slots: { surface: 'scene:wood' } },
          s2: { type: 'slab', materialPreset: 'tile' },
          i1: { type: 'item' },
        },
      }),
    },
    useViewer: { getState: () => ({ itemLoadFailures: { i2: '/items/x/model.glb' }, shading: 'rendered' }) },
    sceneRegistry: { nodes: registry },
    emitter: { emit: vi.fn() },
  } satisfies PascalProbeStores;
  return { stores, registry };
};

const install = (search: string, stores: PascalProbeStores) => {
  const target: { __pascalProbe?: PascalProbe } = {};
  installPascalProbe(search, target, stores);
  return target.__pascalProbe;
};

describe('pascal probe', () => {
  it('không gắn khi thiếu ?probe=1', () => {
    const { stores } = fakeStores();
    expect(install('?project=p1', stores)).toBeUndefined();
    expect(install('?project=p1&probe=0', stores)).toBeUndefined();
  });

  it('counts() gom node theo loại; ready() chờ mọi item đã ổn; materials() đọc slot', () => {
    const { stores, registry } = fakeStores();
    const probe = install('?project=p1&probe=1', stores);

    expect(probe?.counts()).toEqual({ wall: 2, slab: 2, item: 1 });
    expect(probe?.materials().slabs).toEqual({ s1: 'scene:wood', s2: 'tile' });
    expect(probe?.materials().walls.w1).toEqual({
      slots: { interior: 'scene:plaster' },
      skirting: { height: 0.1 },
      crown: undefined,
    });
    expect(probe?.itemLoadFailures()).toEqual({ i2: '/items/x/model.glb' });
    expect(probe?.shading()).toBe('rendered');

    expect(probe?.ready()).toBe(false);
    registry.set('i1', { userData: { itemModelSettled: true } });
    expect(probe?.ready()).toBe(true);
  });

  it('setCamera phát apply-pose; top-ortho thành phép chiếu trực giao', () => {
    const { stores } = fakeStores();
    const probe = install('?probe=1', stores);
    probe?.setCamera([0, 30, 0], [0, 0, 0], 'top-ortho');
    probe?.setCamera([5, 5, 5], [0, 0, 0], 40);
    expect(stores.emitter.emit.mock.calls).toEqual([
      ['camera-controls:apply-pose', { position: [0, 30, 0], target: [0, 0, 0], projection: 'orthographic' }],
      ['camera-controls:apply-pose', { position: [5, 5, 5], target: [0, 0, 0], projection: 'perspective', fov: 40 }],
    ]);
  });
});
