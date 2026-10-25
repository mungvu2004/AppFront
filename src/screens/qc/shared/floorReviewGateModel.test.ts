/** @vitest-environment node */
import { describe, expect, it } from 'vitest';

import { floorReviewConditionLabel, floorReviewGateOf, nextFloorOf, scaleIsConfirmed } from './floorReviewGateModel';

const count = (reviewed: number, total: number) => ({ reviewed, total });

describe('floorReviewGateOf', () => {
  it('chỉ lớp bắt buộc đầu tiên chưa xong làm bước tiếp', () => {
    const gate = floorReviewGateOf({ walls: count(81, 81), objects: count(0, 12), rooms: count(0, 2) });

    expect(gate.layers.map(floorReviewConditionLabel)).toEqual(['Tường 81/81', 'Cửa 0/12', 'Phòng 0/2']);
    expect(gate.next?.key).toBe('objects');
  });

  it('tường và phòng trống thì chưa xong, cửa và nội thất trống thì xong', () => {
    const gate = floorReviewGateOf({ walls: count(0, 0), objects: count(0, 0), rooms: count(0, 0) });

    expect(gate.layers.map((layer) => layer.done)).toEqual([false, true, false]);
    expect(gate.next?.key).toBe('walls');
  });

  it('cả ba xong thì không còn bước duyệt', () => {
    expect(floorReviewGateOf({ walls: count(3, 3), objects: count(0, 0), rooms: count(2, 2) }).next).toBeNull();
  });
});

describe('scaleIsConfirmed', () => {
  it('tỷ lệ tạm hoặc chưa có tỷ lệ thì chưa kiểm', () => {
    expect(scaleIsConfirmed('unresolved', 23.1)).toBe(false);
    expect(scaleIsConfirmed(undefined, undefined)).toBe(false);
    expect(scaleIsConfirmed(undefined, 23.1)).toBe(true);
  });
});

describe('nextFloorOf', () => {
  const floors = [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }];

  it('tầng sau chưa xong trước, rồi vòng lại; hết thì null', () => {
    expect(nextFloorOf(floors, 'f2', () => false)?.id).toBe('f3');
    expect(nextFloorOf(floors, 'f2', (id) => id === 'f3')?.id).toBe('f1');
    expect(nextFloorOf(floors, 'f2', () => true)).toBeNull();
    expect(nextFloorOf([{ id: 'f1' }], 'f1', () => false)).toBeNull();
  });
});
