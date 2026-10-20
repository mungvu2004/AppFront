import { describe, expect, it } from 'vitest';

import { catcherMaterial } from '../renderer';

describe('shadow catcher', () => {
  it('never writes depth, so transparent surfaces under or behind it (water, glass) still draw', () => {
    const m = catcherMaterial();
    expect(m.transparent).toBe(true);
    expect(m.depthWrite).toBe(false);
  });
});
