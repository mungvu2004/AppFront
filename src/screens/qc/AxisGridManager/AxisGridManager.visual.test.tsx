/**
 * Hai lỗi nhìn của SCR-19: đang tải mà cột phải in số liệu như thật (BUG-618), và nét trục dùng
 * `--border-default` ~1,2:1 nên hình chính của màn gần như không thấy (BUG-627).
 */

import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/lib/testing/render';

import { AxisGridCanvas } from './AxisGridCanvas';
import { AxisGridManager } from './AxisGridManager';
import { scenarioArgsFor } from './AxisGridManager.stories';
import { axisGridScenarioFor } from './axisGridManagerScenarios';

afterEach(cleanup);

describe('AxisGridManager — trạng thái nhìn', () => {
  it('[BUG-618] đang tải: cột phải là khung xương, không "Gốc toạ độ 0 px / 0 mm" hay danh sách tầng', () => {
    renderWithProviders(<AxisGridManager {...scenarioArgsFor('loading')} />);

    expect(screen.queryByText('Gốc toạ độ')).toBeNull();
    expect(screen.queryByText('Căn chỉnh giữa các tầng')).toBeNull();
  });

  it('[BUG-627] nét trục mặc định dùng --text-secondary, không --border-default', () => {
    const { container } = renderWithProviders(
      <AxisGridCanvas
        canvas={axisGridScenarioFor('success').canvas}
        isInteractive
        onAxisDrag={() => undefined}
        onAxisSelect={() => undefined}
        viewerRoleNotice={null}
      />,
    );

    const strokes = [...container.querySelectorAll('line')].map((line) => line.getAttribute('stroke'));

    expect(strokes.length).toBeGreaterThan(0);
    expect(strokes).not.toContain('var(--border-default)');
    expect(strokes).toContain('var(--text-secondary)');
  });
});
