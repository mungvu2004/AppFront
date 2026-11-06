/* eslint-disable local/no-direct-set -- store giả của Pascal (vendor), không phải store AppFront. */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';

import { OpeningKindCard, type OpeningKindStores } from '../OpeningKindCard';

const door = {
  object: 'node',
  id: 'door_D-1',
  type: 'door',
  parentId: 'wall_W-1',
  wallId: 'wall_W-1',
  position: [1.2, 1.05, 0],
  rotation: [0, 0, 0],
  width: 0.9,
  height: 2.1,
};

const setup = (selectedIds: string[], readOnly = false) => {
  const scene = create<{ nodes: Record<string, object>; deleteNode(id: string): void; createNode(node: object): void }>((set) => ({
    nodes: { [door.id]: door, 'wall_W-1': { id: 'wall_W-1', type: 'wall' } },
    deleteNode: (id) => set((s) => ({ nodes: Object.fromEntries(Object.entries(s.nodes).filter(([k]) => k !== id)) })),
    createNode: (node) => set((s) => ({ nodes: { ...s.nodes, [(node as { id: string }).id]: node } })),
  }));
  const viewer = create<{ selection: { selectedIds: string[] }; setSelection(sel: { selectedIds: string[] }): void }>((set) => ({
    selection: { selectedIds },
    setSelection: (sel) => set({ selection: sel }),
  }));
  const singleStep = vi.fn((run: () => void) => run());
  const stores = { useScene: scene, useViewer: viewer, parseNode: (n: object) => n, singleStep } as unknown as OpeningKindStores;
  render(<OpeningKindCard readOnly={readOnly} stores={stores} />);
  return { scene, viewer, singleStep };
};

describe('OpeningKindCard', () => {
  it('chọn một cửa: hiện hai nút, "Cửa đi" đang bật', () => {
    setup([door.id]);
    expect(screen.getByRole('group', { name: 'Loại ô mở' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cửa đi' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Cửa sổ' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('đổi sang cửa sổ: một bước hoàn tác, node mới được chọn lại', () => {
    const { scene, viewer, singleStep } = setup([door.id]);
    fireEvent.click(screen.getByRole('button', { name: 'Cửa sổ' }));
    expect(singleStep).toHaveBeenCalledTimes(1);
    const nodes = scene.getState().nodes as Record<string, { type?: string }>;
    expect(nodes[door.id]).toBeUndefined();
    expect(nodes['window_D-1']?.type).toBe('window');
    expect(viewer.getState().selection.selectedIds).toEqual(['window_D-1']);
    expect(screen.getByRole('button', { name: 'Cửa sổ' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('bấm đúng loại đang có thì không làm gì', () => {
    const { singleStep } = setup([door.id]);
    fireEvent.click(screen.getByRole('button', { name: 'Cửa đi' }));
    expect(singleStep).not.toHaveBeenCalled();
  });

  it('ẩn khi không chọn ô mở, chọn nhiều, hoặc chỉ xem', () => {
    setup(['wall_W-1']);
    setup([door.id, 'wall_W-1']);
    setup([door.id], true);
    expect(screen.queryByRole('group', { name: 'Loại ô mở' })).toBeNull();
  });
});
