import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PascalScene } from '@/lib/pascal/types';

import type { VisualDiffModel } from './types';
import { VersionVisualDiff } from './VersionVisualDiff';

const loadMount = vi.hoisted(() => vi.fn());

vi.mock('@/screens/viewer/PascalViewer/usePascalViewer', () => ({ defaultLoadMount: loadMount }));

const SCENE = {
  nodes: { wall_wall1: { id: 'wall_wall1' }, wall_wall2: { id: 'wall_wall2' } },
  rootNodeIds: ['wall_wall1'],
} as unknown as PascalScene;

const visual = (patch: Partial<VisualDiffModel> = {}): VisualDiffModel => ({
  isAvailable: true,
  unavailableReason: null,
  isBuilding: false,
  caption: 'Đây là mô hình hiện tại',
  scene: SCENE,
  changedEntityIds: ['wall1'],
  hoveredEntityId: null,
  ...patch,
});

afterEach(() => {
  cleanup();
  loadMount.mockReset();
});

describe('VersionVisualDiff trên Pascal', () => {
  it('dựng khung xem chỉ-xem và tô sáng đúng node đã đổi khi cảnh sẵn sàng', async () => {
    const setHighlight = vi.fn();
    const mount = vi.fn(() => ({ dispose: vi.fn(), setHighlight }));
    loadMount.mockResolvedValue({ mount });

    render(<VersionVisualDiff visual={visual({ hoveredEntityId: 'wall2' })} />);

    await waitFor(() => expect(mount).toHaveBeenCalledTimes(1));
    const options = (mount.mock.calls[0] as unknown as [HTMLElement, Record<string, unknown>])[1];
    expect(options).toMatchObject({ scene: SCENE, mode: 'view', readOnly: true });

    (options.onReadyChange as (ready: boolean) => void)(true);
    expect(setHighlight).toHaveBeenLastCalledWith(['wall_wall1', 'wall_wall2']);
    expect(screen.getByText('Đây là mô hình hiện tại')).toBeTruthy();
  });

  it('nói ra một câu bình thường khi máy không dựng được 3D', async () => {
    loadMount.mockRejectedValue(new Error('PASCAL-01'));

    render(<VersionVisualDiff visual={visual()} />);

    expect(await screen.findByText('Máy này không dựng được 3D')).toBeTruthy();
  });

  it('dựng lại khi cặp phiên bản đổi cảnh, và dispose cảnh cũ', async () => {
    const dispose = vi.fn();
    const mount = vi.fn(() => ({ dispose, setHighlight: vi.fn() }));
    loadMount.mockResolvedValue({ mount });
    const other = { nodes: {}, rootNodeIds: ['x'] } as unknown as PascalScene;

    const { rerender } = render(<VersionVisualDiff visual={visual()} />);
    await waitFor(() => expect(mount).toHaveBeenCalledTimes(1));

    rerender(<VersionVisualDiff visual={visual({ scene: other })} />);

    await waitFor(() => expect(mount).toHaveBeenCalledTimes(2));
    expect(dispose).toHaveBeenCalledTimes(1);
    expect((mount.mock.calls[1] as unknown as [HTMLElement, Record<string, unknown>])[1]).toMatchObject({ scene: other });
  });
});
