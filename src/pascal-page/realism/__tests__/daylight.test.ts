import { BatchedMesh, Group, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { afterEach, describe, expect, it } from 'vitest';

import { isGlassLike, syncCeilingShadows } from '../daylight';
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

  it('trần đã gộp lô: bật/tắt bóng trên BatchedMesh cùng vật liệu, lô khác giữ nguyên', () => {
    useRealism.setState({ tier: 'medium' });
    const level = new Group();
    const mat = new MeshStandardMaterial();
    const ceiling = new Mesh(undefined, mat);
    ceiling.position.y = 2.4;
    const batch = new BatchedMesh(1, 3, 3, mat);
    const other = new BatchedMesh(1, 3, 3, new MeshStandardMaterial());
    level.add(ceiling, batch, other);
    level.updateMatrixWorld();
    const registry = { nodes: new Map([['c', ceiling as Object3D]]), byType: { ceiling: new Set(['c']) } };
    syncCeilingShadows(registry, 1.6, 'light');
    expect([batch.castShadow, other.castShadow]).toEqual([true, false]);
    syncCeilingShadows(registry, 9, 'light');
    expect(batch.castShadow).toBe(false);
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
