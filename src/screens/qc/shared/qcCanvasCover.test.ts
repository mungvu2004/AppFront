import { describe, expect, it } from 'vitest';

import { revealDeltaOf } from './qcCanvasCover';

const FRAME = { width: 1000, height: 800 };

describe('revealDeltaOf', () => {
  it('mục còn thấy thì không dịch', () => {
    expect(revealDeltaOf({ x: 100, y: 100, width: 50, height: 50 }, FRAME, { right: 280, bottom: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('mục dưới panel phải thì dịch sang trái, chừa lề', () => {
    expect(revealDeltaOf({ x: 800, y: 100, width: 50, height: 50 }, FRAME, { right: 280, bottom: 0 })).toEqual({ x: 720 - 48 - 850, y: 0 });
  });

  it('mục dưới tấm đáy thì dịch lên', () => {
    expect(revealDeltaOf({ x: 100, y: 600, width: 50, height: 50 }, FRAME, { right: 0, bottom: 360 })).toEqual({ x: 0, y: 440 - 52 - 48 - 650 });
  });

  it('mục dài hơn phần thấy được: tâm còn thấy thì đứng yên, tâm bị che thì đưa vào giữa', () => {
    expect(revealDeltaOf({ x: 100, y: 10, width: 900, height: 20 }, FRAME, { right: 280, bottom: 0 }).x).toBe(0);
    expect(revealDeltaOf({ x: 300, y: 10, width: 900, height: 20 }, FRAME, { right: 280, bottom: 0 }).x).toBe(360 - 750);
  });
});
