import { Vector2 } from 'three';
import { describe, expect, it } from 'vitest';

import { catcherMaterial } from '../renderer';

describe('shadow catcher', () => {
  it('never writes depth, so transparent surfaces under or behind it (water, glass) still draw', () => {
    const m = catcherMaterial({ min: new Vector2(0, 0), max: new Vector2(1, 1) });
    expect(m.transparent).toBe(true);
    expect(m.depthWrite).toBe(false);
  });
});
