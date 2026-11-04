import { describe, expect, it } from 'vitest';

import type { Point, Wall, WallId } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';

import { lockDrawAxis, resolveDrawPoint, wallDrawSnapTargets, withInheritedWallStyle } from './wallDrawSnap';
import { WALL_COMMAND_TYPES } from '@/lib/commands/business/commandTypes';
import type { ToolOutcome } from '@/lib/tools/toolMachine';

const at = (x: number, y: number): Point => ({ x: millimetres(x), y: millimetres(y) });
const wall = (id: string, start: Point, end: Point): Wall =>
  ({ id: id as WallId, centreline: { start, end }, thicknessMm: 220, heightMm: 3000, kind: 'envelope' }) as unknown as Wall;

const RADIUS = 100;
/* Tường ngang y=0, x 0→10000: đích bắt cho các ca dưới. */
const targets = wallDrawSnapTargets([wall('w-a', at(0, 0), at(10000, 0))]);

describe('lockDrawAxis', () => {
  it('lệch dưới ngưỡng thì nắn về trục gần hơn', () => {
    expect(lockDrawAxis(at(0, 0), at(5000, 200))).toEqual(at(5000, 0));
    expect(lockDrawAxis(at(0, 0), at(-200, 5000))).toEqual(at(0, 5000));
  });

  it('lệch quá ngưỡng thì giữ nguyên, trừ khi giữ Shift', () => {
    expect(lockDrawAxis(at(0, 0), at(3000, 2000))).toEqual(at(3000, 2000));
    expect(lockDrawAxis(at(0, 0), at(3000, 2000), true)).toEqual(at(3000, 0));
    expect(lockDrawAxis(at(0, 0), at(2000, 3000), true)).toEqual(at(0, 3000));
  });
});

describe('resolveDrawPoint', () => {
  it('chưa có điểm đầu: chỉ bắt tường, không khoá trục', () => {
    expect(resolveDrawPoint(at(5000, 5000), null, targets, RADIUS, true)).toMatchObject({ point: at(5000, 5000), kind: null });
  });

  it('điểm trống: khoá trục theo điểm đầu', () => {
    expect(resolveDrawPoint(at(4000, 2100), at(1000, 2000), targets, RADIUS)).toEqual({ point: at(4000, 2000), kind: null, wallId: null });
  });

  it('đầu tường thắng khoá trục, kể cả khi giữ Shift', () => {
    const snap = resolveDrawPoint(at(10010, 30), at(3000, 2000), targets, RADIUS, true);

    expect(snap.point).toEqual(at(10000, 0));
    expect(snap.kind).toBe('wallVertex');
  });

  it('thân tường, nhắm gần chân vuông góc: lấy chân, nhánh chữ T không xiên', () => {
    const snap = resolveDrawPoint(at(3150, 50), at(3000, 2000), targets, RADIUS);

    expect(snap.point).toEqual(at(3000, 0));
    expect(snap).toMatchObject({ kind: 'perpendicular', wallId: 'w-a' });
  });

  it('thân tường, chân vuông góc xa con trỏ hơn 2 lần bán kính bắt: giữ hình chiếu con trỏ, vẽ được nhánh xiên', () => {
    const snap = resolveDrawPoint(at(4000, 50), at(3000, 2000), targets, RADIUS);

    expect(snap.point).toEqual(at(4000, 0));
    expect(snap).toMatchObject({ kind: 'perpendicular', wallId: 'w-a' });
  });

  it('chân vuông góc rơi ngoài tường: giữ điểm bắt theo con trỏ', () => {
    const snap = resolveDrawPoint(at(4000, 50), at(-3000, 2000), targets, RADIUS);

    expect(snap.point).toEqual(at(4000, 0));
  });
});

describe('withInheritedWallStyle', () => {
  const outcome = {
    kind: 'command',
    request: { type: WALL_COMMAND_TYPES.draw, input: { thicknessMm: 110, heightMm: 2800, kind: 'partition' } },
  } as unknown as ToolOutcome;
  const inputOf = (result: ToolOutcome) => (result as unknown as { request: { input: Record<string, unknown> } }).request.input;
  const source = wall('w-a', at(0, 0), at(10000, 0));

  it('độ dày từ phím 1/2/3 thắng kế thừa; cao và loại vẫn theo tường nối', () => {
    expect(inputOf(withInheritedWallStyle(outcome, source, 100))).toMatchObject({ thicknessMm: 100, heightMm: 3000, kind: 'envelope' });
  });

  it('không đặt phím: kế thừa như cũ; không tường nối: giữ mặc định', () => {
    expect(inputOf(withInheritedWallStyle(outcome, source))).toMatchObject({ thicknessMm: 220 });
    expect(withInheritedWallStyle(outcome, null)).toBe(outcome);
  });
});
