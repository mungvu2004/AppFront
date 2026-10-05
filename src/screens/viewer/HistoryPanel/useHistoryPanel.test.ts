import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createHistoryStack } from '@/lib/commands/history';
import { useStore } from '@/store';

import { useHistoryPanel } from './useHistoryPanel';

const bumpServerReplace = (): void => {
  /* eslint-disable-next-line local/no-direct-set -- dựng cảnh: giả lượt `replaceFloorLayer(…, { external: true })`. */
  useStore.setState((state) => ({ serverReplaceSeq: state.serverReplaceSeq + 1 }));
};

describe('useHistoryPanel — R14: máy chủ thay tầng thì ngăn xếp trống', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('xoá ngăn xếp đúng một lần mỗi lượt serverReplaceSeq đổi, không xoá lúc gắn', () => {
    const history = createHistoryStack();
    const clear = vi.spyOn(history, 'clear');

    renderHook(() => useHistoryPanel({ history }));
    expect(clear).not.toHaveBeenCalled();

    act(() => bumpServerReplace());
    expect(clear).toHaveBeenCalledTimes(1);

    act(() => bumpServerReplace());
    expect(clear).toHaveBeenCalledTimes(2);
  });
});
