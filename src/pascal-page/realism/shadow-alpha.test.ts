/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';

import { installShadowAlphaSkip, normalizeShadowPass } from './shadow-alpha';

const nodes = (colorNode: unknown) => ({ colorNode, depthNode: null, positionNode: null });

describe('installShadowAlphaSkip', () => {
  it('vật đục không cắt alpha: bỏ colorNode; cắt alpha/trong suốt/mask: giữ như three', () => {
    const cache = new Map<object, ReturnType<typeof nodes>>();
    const get = vi.fn((m: object) => cache.get(m) ?? cache.set(m, nodes({ id: 'alpha' })).get(m)!);
    const r = { _getShadowNodes: get, _renderObjectDirect: vi.fn(), shadowMap: { transmitted: false } };
    installShadowAlphaSkip(r, false);
    installShadowAlphaSkip(r, false);
    const opaque = {};
    const a = r._getShadowNodes(opaque);
    expect(a.colorNode).toBeNull();
    expect(r._getShadowNodes(opaque)).toBe(a); // cùng bộ nút → cùng bản đã bỏ
    expect(r._getShadowNodes({ alphaTest: 0.5 }).colorNode).not.toBeNull();
    expect(r._getShadowNodes({ transparent: true }).colorNode).not.toBeNull();
    expect(r._getShadowNodes({ maskNode: { isNode: true } }).colorNode).not.toBeNull();
    r.shadowMap.transmitted = true;
    expect(r._getShadowNodes({}).colorNode).not.toBeNull();
  });

  it('gộp transparent null/undefined và displacement không có map trên vật liệu bóng', () => {
    const m = { isShadowPassMaterial: true, transparent: null, displacementMap: null, displacementScale: 0, displacementBias: 0.2 };
    normalizeShadowPass(m);
    expect(m).toMatchObject({ transparent: false, displacementScale: 1, displacementBias: 0 });
    const glass = { isShadowPassMaterial: true, transparent: true, displacementMap: {}, displacementScale: 0 };
    normalizeShadowPass(glass);
    expect(glass).toMatchObject({ transparent: true, displacementScale: 0 });
    const own = { transparent: null };
    normalizeShadowPass(own);
    expect(own.transparent).toBeNull(); // không phải vật liệu bóng: không đụng
  });
});
