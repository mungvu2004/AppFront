import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { CommandItem } from './useCommandPalette';
import { useRegisteredScreenCommands, useScreenCommands } from './useScreenCommands';

const command = (id: string): CommandItem => ({ id, label: id, group: 'Duyệt tầng', onSelect: () => {} });

describe('useScreenCommands', () => {
  it('màn đăng ký thì bảng lệnh thấy, rời màn thì gỡ', () => {
    const palette = renderHook(() => useRegisteredScreenCommands());
    const steps = [command('step-walls')];
    const queue = [command('queue-next')];

    const screenA = renderHook(() => useScreenCommands(steps));
    const screenB = renderHook(() => useScreenCommands(queue));
    expect(palette.result.current.map((item) => item.id)).toEqual(['step-walls', 'queue-next']);

    act(() => screenA.unmount());
    expect(palette.result.current.map((item) => item.id)).toEqual(['queue-next']);

    act(() => screenB.unmount());
    expect(palette.result.current).toEqual([]);
  });
});
