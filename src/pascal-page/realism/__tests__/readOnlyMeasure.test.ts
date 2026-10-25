import { describe, expect, it } from 'vitest';
import { readOnlyAllowsCreate, readOnlyAllowsIds } from '../readOnlyMeasure';

describe('V1 viewer-measure: chặn readOnly chỉ mở cho vạch đo', () => {
  const nodes = { measurement_a: { type: 'measurement' }, wall_a: { type: 'wall' } };

  it('viewer tạo vạch đo được', () => {
    expect(readOnlyAllowsCreate([{ node: { type: 'measurement' } }])).toBe(true);
  });

  it('tạo tường (hoặc lệnh trộn tường + vạch đo) vẫn bị chặn', () => {
    expect(readOnlyAllowsCreate([{ node: { type: 'wall' } }])).toBe(false);
    expect(readOnlyAllowsCreate([{ node: { type: 'measurement' } }, { node: { type: 'wall' } }])).toBe(false);
    expect(readOnlyAllowsCreate([{ node: { type: 'construction-dimension' } }])).toBe(false);
    expect(readOnlyAllowsCreate([])).toBe(false);
  });

  it('sửa/xoá: chỉ id của vạch đo; id lạ hay tường bị chặn', () => {
    expect(readOnlyAllowsIds(['measurement_a'], nodes)).toBe(true);
    expect(readOnlyAllowsIds(['wall_a'], nodes)).toBe(false);
    expect(readOnlyAllowsIds(['measurement_a', 'wall_a'], nodes)).toBe(false);
    expect(readOnlyAllowsIds(['missing'], nodes)).toBe(false);
  });
});
