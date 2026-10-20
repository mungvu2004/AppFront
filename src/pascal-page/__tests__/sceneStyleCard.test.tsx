import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SCENE_STYLE_STORAGE_KEY, SCENE_STYLES } from '@/lib/pascal/sceneStyles';

import { SceneStyleCard } from '../SceneStyleCard';

describe('SceneStyleCard', () => {
  beforeEach(() => localStorage.clear());

  it('năm phong cách, phong cách đang dùng được đánh dấu', () => {
    localStorage.setItem(SCENE_STYLE_STORAGE_KEY, 'go-am');
    render(<SceneStyleCard flushAutosaves={vi.fn()} reload={vi.fn()} saveNow={vi.fn()} />);

    const buttons = screen.getByRole('list', { name: 'Danh sách phong cách' }).querySelectorAll('button');
    expect([...buttons].map((b) => b.textContent)).toEqual(Object.values(SCENE_STYLES).map((s) => s.label));
    expect(screen.getByRole('button', { pressed: true }).textContent).toBe(SCENE_STYLES['go-am'].label);
  });

  it('chọn: ghi khoá, rồi Pascal lưu → xả tự lưu → nạp lại, đúng thứ tự', async () => {
    const calls: string[] = [];
    const saveNow = vi.fn(() => {
      calls.push(`save:${localStorage.getItem(SCENE_STYLE_STORAGE_KEY)}`);
      return Promise.resolve();
    });
    const flushAutosaves = vi.fn(() => (calls.push('flush'), Promise.resolve()));
    const reload = vi.fn(() => calls.push('reload'));
    render(<SceneStyleCard flushAutosaves={flushAutosaves} reload={reload} saveNow={saveNow} />);

    fireEvent.click(screen.getByRole('button', { name: SCENE_STYLES['toi-gian'].label }));

    await waitFor(() => expect(calls).toEqual(['save:toi-gian', 'flush', 'reload']));
  });

  it('lưu hỏng: không nạp lại, báo lỗi, mở lại nút', async () => {
    const reload = vi.fn();
    render(<SceneStyleCard flushAutosaves={vi.fn()} reload={reload} saveNow={() => Promise.reject(new Error('x'))} />);

    fireEvent.click(screen.getByRole('button', { name: SCENE_STYLES['go-am'].label }));

    expect((await screen.findByRole('alert')).textContent).toContain('Chưa lưu được');
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: SCENE_STYLES['go-am'].label }).hasAttribute('disabled')).toBe(false);
  });
});
