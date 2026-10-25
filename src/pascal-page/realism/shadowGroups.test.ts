import { describe, expect, it, vi } from 'vitest';
import { keyShadowGroups, shadowGroupPassId } from './shadowGroups';

const shadow = { overrideMaterial: { isShadowPassMaterial: true } };
const multi = { material: [{}, {}] };

describe('shadowGroups', () => {
  it('tách passId theo group chỉ ở lượt bóng của mesh đa vật liệu', () => {
    expect(shadowGroupPassId(shadow, multi, { materialIndex: 0 }, null)).not.toBe(shadowGroupPassId(shadow, multi, { materialIndex: 1 }, null));
    expect(shadowGroupPassId(shadow, multi, { materialIndex: 2 }, 'x')).toBe('x|shadow-g2');
    expect(shadowGroupPassId({ overrideMaterial: null }, multi, { materialIndex: 1 }, null)).toBeNull();
    expect(shadowGroupPassId(shadow, { material: {} }, { materialIndex: 1 }, 'p')).toBe('p');
    expect(shadowGroupPassId(shadow, multi, null, undefined)).toBeUndefined();
  });

  it('bọc renderObject một lần, giữ this và tham số', () => {
    const calls: unknown[][] = [];
    const r = { renderObject: vi.fn(function (this: unknown, ...a: unknown[]) { calls.push([this, ...a]); }) };
    keyShadowGroups(r);
    const wrapped = r.renderObject;
    keyShadowGroups(r);
    expect(r.renderObject).toBe(wrapped);
    r.renderObject(multi, shadow, 'cam', 'geo', 'mat', { materialIndex: 3 }, 'lights');
    expect(calls[0]).toEqual([r, multi, shadow, 'cam', 'geo', 'mat', { materialIndex: 3 }, 'lights', null, '|shadow-g3']);
    keyShadowGroups(null);
  });
});
