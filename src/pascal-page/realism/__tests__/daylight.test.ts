import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Camera, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ceilingSkipsBatch, isGlassLike, subscribeCeilingBatch, syncCeilingShadows } from '../daylight';
import { useRealism } from '../store';

const ceilingAt = (y: number) => {
  const o = new Object3D();
  o.position.y = y;
  o.updateMatrixWorld();
  return o;
};

describe('daylight (gói 2B)', () => {
  const tier0 = useRealism.getState().tier;
  afterEach(() => useRealism.setState({ tier: tier0 }));

  it('bật castShadow cho trần trên camera, tắt cho trần dưới camera / chủ đề tối / mức Thấp', () => {
    useRealism.setState({ tier: 'medium' });
    const low = ceilingAt(2.4);
    const upper = ceilingAt(5.2);
    const registry = { nodes: new Map([['a', low], ['b', upper]]), byType: { ceiling: new Set(['a', 'b', 'gone']) } };
    syncCeilingShadows(registry, 3.5, 'light');
    expect([low.castShadow, upper.castShadow]).toEqual([false, true]);
    syncCeilingShadows(registry, 3.5, 'dark');
    expect(upper.castShadow).toBe(false);
    useRealism.setState({ tier: 'low' });
    syncCeilingShadows(registry, 1.6, 'light');
    expect([low.castShadow, upper.castShadow]).toEqual([false, false]);
  });

  it('Vừa/Cao: trần không vào lô → mesh trần tự vẽ, castShadow bật, camera bóng (lớp 0+4) thấy; Thấp: gộp như cũ', () => {
    // Camera bóng của nắng: mask lớp 0 (SCENE_LAYER) + 4. Lô gộp đẩy nguồn sang BATCHED_LAYER (5).
    const shadowCam = new Camera();
    shadowCam.layers.set(0);
    shadowCam.layers.enable(4);
    const ceiling = new Mesh(undefined, new MeshStandardMaterial());
    ceiling.position.y = 2.4;
    ceiling.updateMatrixWorld();
    const registry = { nodes: new Map([['c', ceiling as Object3D]]), byType: { ceiling: new Set(['c']) } };

    for (const tier of ['medium', 'high'] as const) {
      useRealism.setState({ tier });
      expect(ceilingSkipsBatch('ceiling')).toBe(true); // collectBatchCandidate → null, nguồn ở SCENE_LAYER
      syncCeilingShadows(registry, 1.6, 'light');
      expect(ceiling.castShadow).toBe(true);
      expect(shadowCam.layers.test(ceiling.layers)).toBe(true);
    }
    expect(['slab', 'item', 'door'].some(ceilingSkipsBatch)).toBe(false);

    useRealism.setState({ tier: 'low' });
    expect(ceilingSkipsBatch('ceiling')).toBe(false); // gộp lô như cũ
    syncCeilingShadows(registry, 1.6, 'light');
    expect(ceiling.castShadow).toBe(false);
  });

  it('đổi Thấp ↔ Vừa/Cao mới báo node-batch gom lại trần', () => {
    useRealism.setState({ tier: 'medium' });
    const onChange = vi.fn();
    const off = subscribeCeilingBatch(onChange);
    useRealism.setState({ tier: 'high' });
    expect(onChange).not.toHaveBeenCalled();
    useRealism.setState({ tier: 'low' });
    useRealism.setState({ tier: 'medium' });
    expect(onChange).toHaveBeenCalledTimes(2);
    off();
  });

  it('luật r9c khớp đúng mã vendor: collectBatchCandidate bỏ trần, system thả/gom khi đổi mức', async () => {
    // @ts-expect-error -- .mjs không có .d.ts
    const { RULES } = await import('../../../../scripts/realism/r9c-ceiling-batch.mjs');
    // @ts-expect-error -- .mjs không có .d.ts
    const { transformRealism } = await import('../../../../scripts/pascal-realism.mjs');
    const rules = Object.entries(RULES).map(([file, pairs]) => ({ source: 'r9c-ceiling-batch.mjs', file, pairs }));
    const root = path.resolve(__dirname, '../../../../vendor/pascal/packages');
    for (const file of Object.keys(RULES)) {
      const out = transformRealism(readFileSync(path.join(root, file), 'utf8'), `/x/packages/${file}`, rules);
      expect(out).toContain('@pascal-realism/daylight');
      if (file.endsWith('candidates.ts')) expect(out).toMatch(/ceilingSkipsBatch\(node\.type\)[^\n]*return null/);
      else expect(out).toContain('unsubscribeCeiling()');
    }
  });

  it('kính theo tên GLB thật', () => {
    const named = (name: string) => Object.assign(new MeshStandardMaterial(), { name });
    expect(['m_glass_door', 'Vetro', 'lamp_01_glass'].map((n) => isGlassLike(named(n)))).toEqual([true, true, true]);
    expect(isGlassLike(named('fabric'))).toBe(false);
  });

  it('không có trần → không lỗi', () => {
    expect(() => syncCeilingShadows({ nodes: new Map(), byType: {} }, 1, 'light')).not.toThrow();
  });
});
