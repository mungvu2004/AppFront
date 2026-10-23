import { Object3D } from 'three';
import { afterEach, describe, expect, it } from 'vitest';

import { syncCeilingShadows } from '../daylight';
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

  it('không có trần → không lỗi', () => {
    expect(() => syncCeilingShadows({ nodes: new Map(), byType: {} }, 1, 'light')).not.toThrow();
  });
});
