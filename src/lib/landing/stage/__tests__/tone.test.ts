// @vitest-environment node
import { Color } from 'three';
import { describe, expect, it } from 'vitest';

import { LANDING_PALETTE } from '../../palette';
import { inverseNeutral, neutral } from '../tone';

describe('neutral tone curve', () => {
  it('leaves mid tones alone and compresses the top', () => {
    expect(neutral(new Color(0.5, 0.4, 0.3)).r).toBeCloseTo(0.46, 5);
    expect(neutral(new Color(2, 2, 2)).r).toBeLessThan(1);
  });

  it('inverse lands Paper Ivory on screen', () => {
    const paper = new Color(LANDING_PALETTE.paper);
    const back = neutral(inverseNeutral(paper));
    expect(back.getHexString()).toBe(paper.getHexString());
  });
});
