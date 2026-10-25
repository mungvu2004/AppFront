/** @vitest-environment node */
import { describe, expect, it } from 'vitest';

import { axisGridGateOf } from './axisGridGate';
import { axisGridScenarioFor } from './axisGridManagerScenarios';

describe('axisGridGateOf — cổng sang Mô hình 3D (Z/S-18)', () => {
  it('rỗng: chưa đủ điều kiện nào, việc thiếu là vẽ trục ngang', () => {
    const gate = axisGridGateOf(axisGridScenarioFor('empty'));

    expect(gate.conditions.map((condition) => condition.done)).toEqual([false, false, false]);
    expect(gate.isReady).toBe(false);
    expect(gate.missingDirection).toBe('horizontal');
  });

  it('một phần (chỉ trục dọc): thiếu trục ngang', () => {
    const gate = axisGridGateOf(axisGridScenarioFor('partial'));

    expect(gate.conditions[0]?.done).toBe(false);
    expect(gate.missingDirection).toBe('horizontal');
  });

  it('lỗi: không mời vẽ trục, không tầng lệch', () => {
    const gate = axisGridGateOf(axisGridScenarioFor('error'));

    expect(gate.isReady).toBe(false);
    expect(gate.missingDirection).toBeNull();
    expect(gate.laggingFloor).toBeNull();
  });

  it('xong: đủ ba điều kiện thì sẵn sàng sang 3D', () => {
    const gate = axisGridGateOf(axisGridScenarioFor('success'));

    expect(gate.missingDirection).toBeNull();
    expect(gate.isReady).toBe(gate.laggingFloor === null && gate.conditions[1]?.done === true);
  });
});
