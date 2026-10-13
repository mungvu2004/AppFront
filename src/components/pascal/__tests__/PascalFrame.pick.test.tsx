/** Chạm chọn + đo hai điểm ở `view` (F-15 S2). Bus `emitter` thật, Viewer giả. */

import { emitter } from '@pascal-app/core';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { distanceM } from '../pascalPick';

vi.mock('@pascal-app/editor', () => ({
  Editor: () => null,
  appFrontEditorPanels: [],
  subscribeHistoryJumps: () => () => undefined,
}));
vi.mock('@pascal-app/viewer', () => ({
  Viewer: () => null,
  computeHeroFraming: () => null,
  heroCameraPose: () => null,
  useLevelExplode: { getState: () => ({ setAmount: () => undefined }) },
  useViewer: { getState: () => ({ setLevelMode: () => undefined }) },
}));
vi.mock('@react-three/fiber', () => ({ useThree: () => null }));
vi.mock('../pascalScene', () => ({
  BUILTIN_PLUGIN_ID: 'pascal.builtin',
  loadPascalPlugins: vi.fn(async () => undefined),
  loadSceneIntoPascal: vi.fn(async () => ({ nodeCount: 0, droppedIds: [] })),
}));

const { PascalFrame } = await import('../PascalFrame');

const scene = { nodes: {}, rootNodeIds: [] } as never;
const base = {
  mode: 'view' as const,
  readOnly: false,
  scene,
  sceneKey: 1,
  onSceneCommit: undefined,
  onSaveStatus: undefined,
  validateCommit: undefined,
  onCommitRejected: undefined,
  onReadyChange: undefined,
  onFatal: undefined,
  onSceneLoaded: undefined,
  onRendererUnavailable: undefined,
  onHistoryJump: undefined,
};
const click = (id: string | null, position: [number, number, number]) =>
  act(() => {
    if (id === null) emitter.emit('grid:click', { position } as never);
    else emitter.emit('node:click', { node: { id }, position } as never);
  });

describe('chạm chọn và đo ở khung xem', () => {
  it('distanceM là khoảng cách Euclid', () => {
    expect(distanceM([0, 0, 0], [3, 4, 0])).toBe(5);
  });

  it('chạm node gọi onPick(id), chạm nền gọi onPick(null)', () => {
    const onPick = vi.fn();
    render(<PascalFrame {...base} onPick={onPick} />);
    click('wall_1', [0, 0, 0]);
    click(null, [1, 0, 0]);
    expect(onPick.mock.calls).toEqual([['wall_1'], [null]]);
  });

  it('ở chế độ đo, hai chạm cho một số đo và không gọi onPick', () => {
    const onPick = vi.fn();
    const onMeasure = vi.fn();
    render(<PascalFrame {...base} measure onPick={onPick} onMeasure={onMeasure} />);
    click('wall_1', [0, 0, 0]);
    expect(onMeasure).not.toHaveBeenCalled();
    click(null, [0, 0, 2]);
    expect(onMeasure).toHaveBeenCalledWith({ distanceM: 2 });
    expect(onPick).not.toHaveBeenCalled();
  });
});
