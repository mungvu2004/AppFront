import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MISSING_SCALE_MESSAGE } from '@/lib/viewmodel/provisionalScale';
import { useStore } from '@/store';

import { IMPLAUSIBLE_SCALE_MESSAGE, useProvisionalScaleNotice } from './provisionalScaleNotice';
import { useScaleLock } from './useScaleLock';

vi.mock('./useScaleLock', () => ({ useScaleLock: vi.fn() }));

const lockMock = vi.mocked(useScaleLock);

function setLocked(locked: boolean): void {
  lockMock.mockReturnValue(locked ? { locked: true, reason: 'khoá' } : { locked: false, reason: null });
}

beforeEach(() => {
  /* eslint-disable-next-line local/no-direct-set -- giả lập kho vừa nạp, như bridge.test.ts */
  useStore.setState({ floorMeta: {} });
  setLocked(false);
});

describe('useProvisionalScaleNotice — dải đỏ theo useScaleLock', () => {
  it('tỷ lệ máy đo mà hình vô lý (khoá): dải đỏ, không còn dải vàng', () => {
    /* eslint-disable-next-line local/no-direct-set -- giả lập kho vừa nạp, như bridge.test.ts */
    useStore.setState({ floorMeta: { f1: { revision: 1, scaleStatus: 'unresolved', scaleSource: 'pipeline' } } });
    setLocked(true);

    const { result } = renderHook(() => useProvisionalScaleNotice('unresolved', 'p', 'f1', undefined));

    expect(result.current).toMatchObject({ level: 'violation', message: IMPLAUSIBLE_SCALE_MESSAGE });
  });

  it('máy không đo được tỷ lệ: dải đỏ với câu "không đo được"', () => {
    /* eslint-disable-next-line local/no-direct-set -- giả lập kho vừa nạp, như bridge.test.ts */
    useStore.setState({ floorMeta: { f1: { revision: 1, scaleStatus: 'unresolved', scaleSource: 'project_default' } } });
    setLocked(true);

    const { result } = renderHook(() => useProvisionalScaleNotice('unresolved', 'p', 'f1', undefined));

    expect(result.current).toMatchObject({ level: 'violation', message: MISSING_SCALE_MESSAGE });
  });

  it('khoá dù N16 chưa báo tạm: vẫn hiện dải đỏ (cùng câu với thanh bước)', () => {
    setLocked(true);

    const { result } = renderHook(() => useProvisionalScaleNotice(undefined, 'p', 'f1', undefined));

    expect(result.current?.level).toBe('violation');
  });

  it('tỷ lệ máy đo hợp lý (không khoá): dải vàng; tỷ lệ đã xác nhận: không dải', () => {
    const { result, rerender } = renderHook(
      ({ status }: { status: 'unresolved' | undefined }) => useProvisionalScaleNotice(status, 'p', 'f1', undefined),
      { initialProps: { status: 'unresolved' as 'unresolved' | undefined } },
    );

    expect(result.current).not.toBeNull();
    expect(result.current?.level).toBeUndefined();

    rerender({ status: undefined });
    expect(result.current).toBeNull();
  });
});
