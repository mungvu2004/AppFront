import { describe, expect, it } from 'vitest';

import { objectTypeLabelOf } from './objectLayerReviewGateway';

describe('objectTypeLabelOf (U34)', () => {
  it('đọc "Sofa" khi máy chủ đổi nhãn ghế dài thành sofa', () => {
    expect(objectTypeLabelOf({ subtype: 'otherFurniture', furnitureKind: 'chair', isSofa: true } as never)).toBe('Sofa');
  });

  it('ghế thường vẫn là "Ghế"', () => {
    expect(objectTypeLabelOf({ subtype: 'otherFurniture', furnitureKind: 'chair' } as never)).toBe('Ghế');
  });
});
