import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SCENE_STYLE_STORAGE_KEY, SCENE_STYLES, sceneStylePreviewKey } from '@/lib/pascal/sceneStyles';

import { SceneStyleCard } from '../SceneStyleCard';

describe('SceneStyleCard', () => {
  beforeEach(() => localStorage.clear());

  it('năm phong cách, phong cách đang dùng được đánh dấu', () => {
    render(<SceneStyleCard flushAutosaves={vi.fn()} reload={vi.fn()} saveNow={vi.fn()} source={{ projectId: 'p1', id: 'go-am' }} />);

    const buttons = screen.getByRole('list', { name: 'Danh sách phong cách' }).querySelectorAll('button');
    expect([...buttons].map((b) => b.textContent)).toEqual(Object.values(SCENE_STYLES).map((s) => s.label));
    expect(screen.getByRole('button', { pressed: true }).textContent).toBe(SCENE_STYLES['go-am'].label);
  });

  it('W4a — không sửa được cài đặt: chỉ máy này (khoá riêng dự án), rồi Pascal lưu → xả tự lưu → nạp lại', async () => {
    const calls: string[] = [];
    const saveNow = vi.fn(() => {
      calls.push(`save:${localStorage.getItem(sceneStylePreviewKey('p1'))}`);
      return Promise.resolve();
    });
    const flushAutosaves = vi.fn(() => (calls.push('flush'), Promise.resolve()));
    const reload = vi.fn(() => calls.push('reload'));
    render(<SceneStyleCard flushAutosaves={flushAutosaves} reload={reload} saveNow={saveNow} source={{ projectId: 'p1', id: 'am-ap' }} />);

    expect(screen.getByText('Chỉ áp dụng trên máy này')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: SCENE_STYLES['toi-gian'].label }));

    await waitFor(() => expect(calls).toEqual(['save:toi-gian', 'flush', 'reload']));
    expect(localStorage.getItem(SCENE_STYLE_STORAGE_KEY)).toBeNull();
  });

  it('W4a — sửa được cài đặt: PUT vào dự án trước, bỏ bản xem thử, rồi lưu → xả → nạp lại; không có câu "máy này"', async () => {
    localStorage.setItem(sceneStylePreviewKey('p1'), 'go-am');
    const calls: string[] = [];
    const saveToProject = vi.fn((id: string) => (calls.push(`put:${id}`), Promise.resolve()));
    render(
      <SceneStyleCard
        flushAutosaves={() => (calls.push('flush'), Promise.resolve())}
        reload={() => calls.push('reload')}
        saveNow={() => (calls.push('save'), Promise.resolve())}
        source={{ projectId: 'p1', id: 'am-ap', saveToProject }}
      />,
    );

    expect(screen.queryByText('Chỉ áp dụng trên máy này')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: SCENE_STYLES['sang-trong-toi'].label }));

    await waitFor(() => expect(calls).toEqual(['put:sang-trong-toi', 'save', 'flush', 'reload']));
    expect(localStorage.getItem(sceneStylePreviewKey('p1'))).toBeNull();
  });

  it('W4a — PUT hỏng (vd. 409): không lưu, không nạp lại, báo lỗi', async () => {
    const reload = vi.fn();
    const saveNow = vi.fn();
    render(
      <SceneStyleCard
        flushAutosaves={vi.fn()}
        reload={reload}
        saveNow={saveNow}
        source={{ projectId: 'p1', id: 'am-ap', saveToProject: () => Promise.reject(new Error('409')) }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: SCENE_STYLES['go-am'].label }));

    expect((await screen.findByRole('alert')).textContent).toContain('Chưa lưu được');
    expect(saveNow).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('lưu hỏng: không nạp lại, báo lỗi, mở lại nút', async () => {
    const reload = vi.fn();
    render(
      <SceneStyleCard
        flushAutosaves={vi.fn()}
        reload={reload}
        saveNow={() => Promise.reject(new Error('x'))}
        source={{ projectId: 'p1', id: 'am-ap' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: SCENE_STYLES['go-am'].label }));

    expect((await screen.findByRole('alert')).textContent).toContain('Chưa lưu được');
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: SCENE_STYLES['go-am'].label }).hasAttribute('disabled')).toBe(false);
  });
});
