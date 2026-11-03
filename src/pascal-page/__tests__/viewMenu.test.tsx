/**
 * Menu "Xem" (`../ViewMenu`): một menu duy nhất chứa các mục Phong cách, Ánh sáng, Chất lượng hình,
 * và Nướng ánh sáng chỉ khi sửa được.
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';

import { ViewMenu } from '../ViewMenu';

vi.mock('../useLightingBake', () => ({
  bakeStatusLabel: () => null,
  isBakeActive: () => false,
  useLightingBake: () => ({ bake: null, busy: false, error: null, previewing: false, start: vi.fn(), view: vi.fn(), hide: vi.fn() }),
}));

const useViewer = create<{ sceneTheme: string; setSceneTheme: (id: string) => void }>(() => ({
  sceneTheme: 'night',
  setSceneTheme: () => {},
}));

const base = {
  flushAutosaves: vi.fn(async () => {}),
  projectId: 'p1',
  reload: vi.fn(),
  saveNow: vi.fn(async () => {}),
  source: { projectId: 'p1', id: 'go-am' } as const,
  useViewer,
};

describe('ViewMenu', () => {
  beforeEach(() => localStorage.clear());

  it('một menu, các mục là phần của nó (không menu lồng)', () => {
    const { container } = render(<ViewMenu {...base} exportGlb={async () => null} />);
    expect(container.querySelectorAll('details[data-appfront-menu]')).toHaveLength(1);
    expect(screen.getByLabelText(/^Xem/)).not.toBeNull();
    for (const name of ['Phong cách', 'Ánh sáng', 'Chất lượng hình', 'Nướng ánh sáng']) {
      expect(screen.getByRole('region', { name })).not.toBeNull();
    }
  });

  it('mục Hiển thị (cài đặt của Pascal) nằm cuối cùng menu, không thành nút riêng', () => {
    const { container } = render(<ViewMenu {...base} display={<button type="button">Lưới, bóng</button>} />);
    const details = container.querySelector('details[data-appfront-menu]')!;
    expect(details.textContent).toContain('Hiển thị');
    expect(screen.getByRole('button', { name: 'Lưới, bóng' }).closest('details')).toBe(details);
  });

  it('chỉ xem: không có mục Nướng ánh sáng', () => {
    render(<ViewMenu {...base} />);
    expect(screen.queryByRole('region', { name: 'Nướng ánh sáng' })).toBeNull();
  });
});
