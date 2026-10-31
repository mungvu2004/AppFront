import { describe, expect, it } from 'vitest';

import { nextTypedBuffer, parseTypedLength, pointAtLength, snapLabelOf, toolHintOf } from '../typedLength';

describe('parseTypedLength', () => {
  it('đọc số trần theo cách ghi của editor', () => {
    expect(parseTypedLength('3500', 'millimeters')).toEqual({ mm: 3500, unit: 'mm' });
    expect(parseTypedLength('3,5', 'meters')).toEqual({ mm: 3500, unit: 'm' });
    expect(parseTypedLength('3.5', 'meters')).toEqual({ mm: 3500, unit: 'm' });
  });

  it('ghi mét mà gõ số lớn thì hiểu là mm', () => {
    expect(parseTypedLength('3500', 'meters')).toEqual({ mm: 3500, unit: 'mm' });
  });

  it('đơn vị gõ kèm thắng cách ghi của editor', () => {
    expect(parseTypedLength('350cm', 'millimeters')).toEqual({ mm: 3500, unit: 'cm' });
    expect(parseTypedLength('2 m', 'millimeters')).toEqual({ mm: 2000, unit: 'm' });
    expect(parseTypedLength('120mm', 'meters')).toEqual({ mm: 120, unit: 'mm' });
  });

  it('gõ dở hoặc bằng 0 thì chưa đọc được', () => {
    expect(parseTypedLength('3,5c', 'meters')).toBeNull();
    expect(parseTypedLength('0', 'meters')).toBeNull();
    expect(parseTypedLength('', 'meters')).toBeNull();
  });
});

describe('nextTypedBuffer', () => {
  it('chỉ chữ số mở ô gõ', () => {
    expect(nextTypedBuffer('', 'm')).toBeNull();
    expect(nextTypedBuffer('', ',')).toBeNull();
    expect(nextTypedBuffer('', 'Backspace')).toBeNull();
    expect(nextTypedBuffer('', '3')).toBe('3');
  });

  it('nhận dấu thập phân, đơn vị và xoá lùi khi đã gõ', () => {
    expect(nextTypedBuffer('3', ',')).toBe('3,');
    expect(nextTypedBuffer('35', 'M')).toBe('35m');
    expect(nextTypedBuffer('35', 'Backspace')).toBe('3');
    expect(nextTypedBuffer('35', 'x')).toBeNull();
  });
});

describe('pointAtLength', () => {
  it('đặt điểm đúng chiều dài theo hướng con trỏ', () => {
    const [x, z] = pointAtLength([1, 1], [4, 5], 10) ?? [0, 0];
    expect(x).toBeCloseTo(7);
    expect(z).toBeCloseTo(9);
  });

  it('chưa có hướng thì không đặt', () => {
    expect(pointAtLength([1, 1], [1, 1], 3)).toBeNull();
  });
});

describe('toolHintOf', () => {
  it('tường: trước và sau điểm đầu', () => {
    expect(toolHintOf({ mode: 'build', tool: 'wall', wallDrafting: false })).toMatch(/^Bấm để đặt điểm đầu tường/u);
    expect(toolHintOf({ mode: 'build', tool: 'wall', wallDrafting: true })).toMatch(/gõ chiều dài rồi Enter/u);
  });

  it('không cầm công cụ, hoặc thước đo (đã có dòng riêng) thì không nói gì', () => {
    expect(toolHintOf({ mode: 'select', tool: null, wallDrafting: false })).toBeNull();
    expect(toolHintOf({ mode: 'build', tool: 'measurement', wallDrafting: false })).toBeNull();
  });

  it('công cụ lạ vẫn có lối thoát', () => {
    expect(toolHintOf({ mode: 'build', tool: 'chimney', wallDrafting: false })).toBe('Esc để thoát công cụ');
  });
});

describe('snapLabelOf', () => {
  it('gọi tên điểm bị hút vào', () => {
    expect(snapLabelOf('endpoint', true)).toBe('Đầu tường');
    expect(snapLabelOf(null, true)).toBe('Thẳng hàng');
    expect(snapLabelOf(null, false)).toBeNull();
  });
});
