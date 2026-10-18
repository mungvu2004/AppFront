import { describe, expect, it } from 'vitest';

import { provisionalFloorsMessageOf } from './provisionalScale';

describe('provisionalFloorsMessageOf', () => {
  it('không tầng → null; một tầng gọi tên; nhiều tầng thì đếm', () => {
    expect(provisionalFloorsMessageOf([])).toBeNull();
    expect(provisionalFloorsMessageOf(['Tầng 1'])).toBe('Tầng 1 chưa hiệu chỉnh tỷ lệ — kích thước 3D có thể sai');
    expect(provisionalFloorsMessageOf(['Tầng 1', 'Tầng 2'])).toBe(
      '2 tầng chưa hiệu chỉnh tỷ lệ — kích thước 3D có thể sai',
    );
  });
});
