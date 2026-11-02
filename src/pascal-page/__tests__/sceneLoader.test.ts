/** `onLoad` của trang 3D: giữ danh tính qua các lần vẽ (đổi danh tính = Editor dỡ + nạp lại cả cảnh). */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useSceneLoader } from '../sceneLoader';

describe('useSceneLoader', () => {
  it('giữ nguyên hàm khi trang vẽ lại với cùng cầu (02/11: hàm mới mỗi lần vẽ làm trang treo)', () => {
    const load = vi.fn();
    const rebase = vi.fn();
    const { result, rerender } = renderHook(() => useSceneLoader(load, rebase));
    const first = result.current;
    rerender();
    rerender();
    expect(result.current).toBe(first);
    expect(load).not.toHaveBeenCalled();
  });
});
