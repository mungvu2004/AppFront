import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SpatialLayer } from '@/api/client';
import { diffVersions } from '@/lib/versioning/diff';

import type { DiffGroupModel, PlanDiffModel } from './types';
import { VersionCompare } from './VersionCompare';
import { VersionPlanDiff } from './VersionPlanDiff';
import {
  buildCompareModel,
  NOOP_VERSION_HISTORY_ACTIONS,
  SAMPLE_DIFF_GROUP,
  WIRE_CURRENT_WALLS,
  WIRE_V2_WALLS,
  wireLayer,
} from './versionHistoryFixtures';
import { buildPlanDiffModel } from './versionHistoryPlan';
import { toVersionSnapshot, type VersionSnapshotSource } from './versionSnapshotAdapter';

afterEach(cleanup);

const sourceOf = (walls: readonly Record<string, unknown>[]): VersionSnapshotSource => ({
  dimensions: [],
  layer: wireLayer(walls) as unknown as SpatialLayer,
});

function planOf(left: VersionSnapshotSource, right: VersionSnapshotSource, focusId: string | null = null): PlanDiffModel {
  return buildPlanDiffModel({
    diff: diffVersions(toVersionSnapshot(left), toVersionSnapshot(right)),
    floorLabel: 'Tầng 1',
    focusId,
    left,
    right,
  });
}

const v2 = sourceOf(WIRE_V2_WALLS);
const current = sourceOf(WIRE_CURRENT_WALLS);
const noop = () => undefined;

describe('VersionPlanDiff', () => {
  it('mỗi hình mang data-tone + data-entity-id; chú giải có số đếm', () => {
    const { container } = render(<VersionPlanDiff plan={planOf(v2, current)} onHover={noop} onPick={noop} />);

    expect(container.querySelector('[data-entity-id="W-WALL000001"]')?.getAttribute('data-tone')).toBe('changed');
    expect(container.querySelector('[data-entity-id="W-WALL000002"]')?.getAttribute('data-tone')).toBe('added');
    expect(screen.getByText('Thêm: 1 hình')).toBeTruthy();
    expect(screen.getByText('Xoá: 0 hình')).toBeTruthy();
    expect(screen.getByText('Sửa: 1 hình')).toBeTruthy();
    // Nét viền không phình theo tỷ lệ mm.
    expect(container.querySelectorAll('[vector-effect="non-scaling-stroke"]').length).toBeGreaterThan(0);
  });

  it('xoá vẽ nét đứt, sửa nét chấm, thêm nét liền (không chỉ dựa vào màu)', () => {
    const removed = render(<VersionPlanDiff plan={planOf(current, v2)} onHover={noop} onPick={noop} />).container;
    const dashOf = (root: Element, id: string) =>
      root.querySelector(`[data-entity-id="${id}"] line[vector-effect]`)?.getAttribute('stroke-dasharray') ?? null;

    expect(removed.querySelector('[data-entity-id="W-WALL000002"]')?.getAttribute('data-tone')).toBe('removed');
    expect(dashOf(removed, 'W-WALL000002')).toBe('8 5');
    cleanup();

    const forward = render(<VersionPlanDiff plan={planOf(v2, current)} onHover={noop} onPick={noop} />).container;

    expect(dashOf(forward, 'W-WALL000001')).toBe('1 5');
    expect(dashOf(forward, 'W-WALL000002')).toBeNull();
  });

  it('bấm hình gọi onPick, trỏ hình gọi onHover; hình đang ghim có data-focused', () => {
    const onPick = vi.fn();
    const onHover = vi.fn();
    const { container } = render(
      <VersionPlanDiff plan={planOf(v2, current, 'V-W-WALL000002-start')} onHover={onHover} onPick={onPick} />,
    );
    const wall = container.querySelector('[data-entity-id="W-WALL000002"]');

    expect(wall?.getAttribute('data-focused')).toBe('true');
    fireEvent.click(wall as Element);
    expect(onPick).toHaveBeenCalledWith('W-WALL000002');
    fireEvent.pointerEnter(container.querySelector('[data-entity-id="W-WALL000001"]') as Element);
    expect(onHover).toHaveBeenCalledWith('W-WALL000001');
  });

  it('chưa có ảnh chụp ⇒ một câu giải thích, không SVG', () => {
    const { container } = render(<VersionPlanDiff plan={null} onHover={noop} onPick={noop} />);

    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByText(/Chưa vẽ được mặt bằng/)).toBeTruthy();
    expect(screen.queryByText(/bên dưới/)).toBeNull();
  });

  it('RV2#12: chưa tích đủ hai bản ⇒ nhắc tích, không báo thiếu ảnh chụp', () => {
    render(<VersionPlanDiff plan={null} isPairPicked={false} onHover={noop} onPick={noop} />);

    expect(screen.getByText(/Tích đủ hai phiên bản/)).toBeTruthy();
    expect(screen.queryByText(/chưa có ảnh chụp/)).toBeNull();
  });
});

describe('VersionCompare · tab Trực quan', () => {
  const firstRow = SAMPLE_DIFF_GROUP.rows[0];
  const group: DiffGroupModel = {
    ...SAMPLE_DIFF_GROUP,
    rows: firstRow === undefined ? [] : [{ ...firstRow, entityId: 'V-W-WALL000001-start' }],
  };

  function renderCompare(pinnedEntityId: string | null) {
    const pinDiffRow = vi.fn();
    const view = render(
      <VersionCompare
        model={buildCompareModel({ activeTab: 'visual', groups: [group], plan: planOf(v2, current), pinnedEntityId })}
        actions={{ ...NOOP_VERSION_HISTORY_ACTIONS, pinDiffRow }}
      />,
    );

    return { ...view, pinDiffRow };
  }

  it('mặc định là mặt bằng 2D, có công tắc 2D/3D', () => {
    const { container } = renderCompare(null);

    expect(screen.getByRole('radio', { name: 'Mặt bằng 2D' }).getAttribute('aria-checked')).toBe('true');
    expect(container.querySelector('svg[role="img"]')).not.toBeNull();
  });

  it('bấm dòng / Enter ghim; dòng khớp mã tường thì mang data-pinned; Esc bỏ ghim', () => {
    const { container, pinDiffRow } = renderCompare('W-WALL000001');
    const rows = container.querySelectorAll('li[data-entity-id="V-W-WALL000001-start"]');
    // Tab "Thay đổi" (ẩn) không ghim; chỉ tab "Trực quan" có hàng ghim.
    const pinnedRow = container.querySelector('li[data-pinned="true"]');

    expect(rows.length).toBe(2);
    expect(pinnedRow).not.toBeNull();
    fireEvent.click(pinnedRow as Element);
    expect(pinDiffRow).toHaveBeenCalledWith('V-W-WALL000001-start');
    fireEvent.keyDown(pinnedRow as Element, { key: 'Enter' });
    expect(pinDiffRow).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(pinnedRow as Element, { key: 'Escape' });
    expect(pinDiffRow).toHaveBeenLastCalledWith(null);
  });
});
