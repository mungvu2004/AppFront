/**
 * Thẻ "Ánh sáng" (`../LightingCard`): đổi chủ đề cảnh qua `setSceneTheme`, nhớ theo dự án,
 * lúc mở áp lựa chọn đã nhớ. `useViewer` là kho zustand giả cùng hình với của Pascal.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';

import { LightingCard, lightingKey } from '../LightingCard';

const viewerWith = (sceneTheme: string) => {
  const setSceneTheme = vi.fn<(id: string) => void>();
  const useViewer = create<{ sceneTheme: string; setSceneTheme: (id: string) => void }>((set) => ({
    sceneTheme,
    setSceneTheme: (id) => {
      setSceneTheme(id);
      /* eslint-disable-next-line local/no-direct-set -- kho giả đứng thay `useViewer` của Pascal (không phải kho
         AppFront), nên không có commit(patch, label) để đi qua. */
      set({ sceneTheme: id });
    },
  }));
  return { useViewer, setSceneTheme };
};

describe('LightingCard', () => {
  beforeEach(() => localStorage.clear());

  it('hai lựa chọn, đang dùng được đánh dấu; có data-appfront-menu để chip trợ giúp ẩn khi mở', () => {
    const { useViewer } = viewerWith('night');
    const { container } = render(<LightingCard projectId="p1" useViewer={useViewer} />);

    const buttons = screen.getByRole('list', { name: 'Danh sách ánh sáng' }).querySelectorAll('button');
    expect([...buttons].map((b) => b.textContent)).toEqual(['Buổi tối', 'Ban ngày', 'Nắng chiều']);
    expect(screen.getByRole('button', { pressed: true }).textContent).toBe('Buổi tối');
    expect(container.querySelector('details[data-appfront-menu]')).not.toBeNull();
  });

  it('chọn Ban ngày: setSceneTheme("studio"), nhớ cho dự án, đóng menu; Buổi tối: "night"', () => {
    const { useViewer, setSceneTheme } = viewerWith('night');
    const { container } = render(<LightingCard projectId="p1" useViewer={useViewer} />);
    const details = container.querySelector('details')!;
    details.open = true;

    fireEvent.click(screen.getByRole('button', { name: 'Ban ngày' }));
    expect(setSceneTheme).toHaveBeenLastCalledWith('studio');
    expect(localStorage.getItem(lightingKey('p1'))).toBe('day');
    expect(details.open).toBe(false);
    expect(screen.getByRole('button', { pressed: true }).textContent).toBe('Ban ngày');

    fireEvent.click(screen.getByRole('button', { name: 'Buổi tối' }));
    expect(setSceneTheme).toHaveBeenLastCalledWith('night');
    expect(localStorage.getItem(lightingKey('p1'))).toBe('night');
    expect(localStorage.getItem(lightingKey('p2'))).toBeNull();
  });

  it('lúc mở áp lựa chọn đã nhớ của dự án', () => {
    localStorage.setItem(lightingKey('p1'), 'day');
    const { useViewer, setSceneTheme } = viewerWith('night');
    render(<LightingCard projectId="p1" useViewer={useViewer} />);
    expect(setSceneTheme).toHaveBeenCalledWith('studio');
  });

  it('dự án chưa chọn: Ban ngày mang sang từ dự án khác về Buổi tối; chủ đề khác (vd. twilight) giữ nguyên', () => {
    const day = viewerWith('studio');
    render(<LightingCard projectId="p2" useViewer={day.useViewer} />);
    expect(day.setSceneTheme).toHaveBeenCalledWith('night');

    const other = viewerWith('twilight');
    render(<LightingCard projectId="p3" useViewer={other.useViewer} />);
    expect(other.setSceneTheme).not.toHaveBeenCalled();
  });
});
