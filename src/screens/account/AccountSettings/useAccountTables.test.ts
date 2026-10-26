import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useAccountTables } from './useAccountTables';

/** FIX-P0-03 — ma trận thông báo có hàng `aiFailed` và gửi đúng khoá. */
describe('useAccountTables — loại aiFailed', () => {
  it('có hàng "AI không xử lý được bản vẽ"', () => {
    const { result } = renderHook(() => useAccountTables({ saved: undefined, stage: vi.fn() }));
    const row = result.current.notifications.events.find((event) => event.id === 'aiFailed');

    expect(row?.label).toBe('AI không xử lý được bản vẽ');
  });

  it('bật/tắt ô gửi lên khối notifications với khoá aiFailed', () => {
    const stage = vi.fn();
    const { result } = renderHook(() => useAccountTables({ saved: undefined, stage }));

    act(() => {
      result.current.notifications.onChange('aiFailed', 'inApp', false);
    });

    expect(stage).toHaveBeenCalledWith(
      'notifications',
      expect.objectContaining({ aiFailed: expect.objectContaining({ inApp: false }) }),
    );
  });
});
