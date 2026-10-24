import { Vector3 } from 'three';
import { afterEach, describe, expect, it } from 'vitest';

import { rotateSun } from '../sun';
import { useRealism } from '../store';

describe('hướng nắng', () => {
  afterEach(() => useRealism.setState({ sunAzimuth: 0 }));

  it('0° giữ nguyên; 90° xoay quanh trục đứng, giữ độ cao + khoảng cách', () => {
    const v = new Vector3(10, 20, 0);
    expect(rotateSun(v).toArray()).toEqual([10, 20, 0]);
    useRealism.setState({ sunAzimuth: 90 });
    rotateSun(v);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBe(20);
    expect(v.z).toBeCloseTo(-10);
  });
});
