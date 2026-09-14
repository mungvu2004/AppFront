/**
 * Bộ kiểm của S-45 — lớp trạng thái kết nối.
 *
 * Bốn nhóm: quyết định trường hợp và tầng · bảy trạng thái · ba tầng không trộn ·
 * hook.
 *
 * ## Nhóm quan trọng nhất là nhóm thứ ba
 *
 * Lời hứa trung tâm của màn này không phải "hiện đúng chữ" mà là **mức ồn ào
 * tương ứng mức nghiêm trọng**: mạng chậm không được dựng dải, và không gì ngoài
 * phiên hết hạn được dựng tấm giữa màn. Đó là thứ dễ vỡ nhất khi mã lớn thêm, và
 * là thứ không ai nhìn thấy vỡ cho tới lúc một người dùng bị chặn giữa chừng.
 */

import { act, cleanup, fireEvent, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';
import { createSevenStateScenarios } from '@/lib/testing/sevenStateScenarios';

import { ConnectionStates } from './ConnectionStates';
import {
  buildConnectionStatesProps,
  buildQueueFullModel,
  buildSessionExpiredModel,
  NOOP_ACTIONS,
  SAMPLE_PENDING,
} from './connectionStatesFixtures';
import { isQueueFull } from './connectionStatesGateway';
import {
  actionLabelOf,
  decideConnectionCase,
  describePending,
  droppedLabelOf,
  headlineOf,
  replayLabelOf,
  SYNCED_NOTICE_MS,
  tierOf,
  toPendingRow,
  type ConnectionSignals,
} from './connectionStatesModel';
import { useConnectionStates } from './useConnectionStates';

/**
 * jsdom không có `matchMedia`, mà `Drawer` hỏi nó qua `useMediaQuery` và
 * `useReducedMotion`. `matches: false` là bản để bàn, chuyển động bật — cùng bản
 * `BillingScreen.test.tsx` và `WelcomeScreen.test.tsx` dựng.
 */
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
});

const ONLINE: ConnectionSignals = {
  browserOnline: true,
  isQueueFull: false,
  isReplaying: false,
  isSessionExpired: false,
  justSynced: false,
  pendingCommands: 0,
  pingOnline: true,
};

/* -------------------------------------------------------------------------- */
/* 1. Quyết định trường hợp.                                                   */
/* -------------------------------------------------------------------------- */

describe('decideConnectionCase', () => {
  it('trực tuyến và không lệnh chờ thì không có gì để nói', () => {
    expect(decideConnectionCase(ONLINE)).toBe('online');
  });

  it('trình duyệt báo có mạng nhưng ping không tới là "mạng chậm"', () => {
    expect(decideConnectionCase({ ...ONLINE, pingOnline: false })).toBe('degraded');
  });

  it('mất mạng mà có lệnh chờ là "ngoại tuyến"', () => {
    expect(
      decideConnectionCase({ ...ONLINE, browserOnline: false, pendingCommands: 12, pingOnline: false }),
    ).toBe('offline');
  });

  /**
   * Mất mạng mà KHÔNG còn việc chưa lưu thì không đáng một dải.
   *
   * Nó rơi xuống "mạng chậm" — đúng mức ồn ào của một chuyện chưa mất gì.
   */
  it('mất mạng mà không còn việc chưa lưu thì không dựng dải', () => {
    const result = decideConnectionCase({
      ...ONLINE,
      browserOnline: false,
      pendingCommands: 0,
      pingOnline: false,
    });

    expect(result).not.toBe('offline');
    expect(tierOf(result)).not.toBe('band');
  });

  it('đang phát lại che việc mất mạng', () => {
    expect(
      decideConnectionCase({ ...ONLINE, browserOnline: false, isReplaying: true, pendingCommands: 5 }),
    ).toBe('syncing');
  });

  it('hàng đợi đầy che việc đang phát lại', () => {
    expect(
      decideConnectionCase({ ...ONLINE, isQueueFull: true, isReplaying: true, pendingCommands: 200 }),
    ).toBe('queueFull');
  });

  it('phiên hết hạn kèm việc chưa lưu che tất cả', () => {
    expect(
      decideConnectionCase({
        ...ONLINE,
        browserOnline: false,
        isQueueFull: true,
        isReplaying: true,
        isSessionExpired: true,
        pendingCommands: 12,
        pingOnline: false,
      }),
    ).toBe('sessionExpired');
  });

  /**
   * Phiên hết hạn mà KHÔNG còn việc chưa lưu thì không được chặn màn.
   *
   * Tấm giữa màn dành cho lúc có thứ sắp mất. Đăng nhập lại lúc rảnh là việc của
   * người dùng, không phải một cửa chắn.
   */
  it('phiên hết hạn mà không còn việc chưa lưu thì không chặn màn', () => {
    const result = decideConnectionCase({ ...ONLINE, isSessionExpired: true, pendingCommands: 0 });

    expect(result).not.toBe('sessionExpired');
    expect(tierOf(result)).not.toBe('blocking');
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Ba tầng, không trộn.                                                     */
/* -------------------------------------------------------------------------- */

describe('ba tầng hiển thị', () => {
  it('chỉ phiên hết hạn được lên tầng chặn màn', () => {
    const blocking = (
      ['online', 'degraded', 'offline', 'syncing', 'synced', 'queueFull', 'sessionExpired'] as const
    ).filter((connectionCase) => tierOf(connectionCase) === 'blocking');

    expect(blocking).toEqual(['sessionExpired']);
  });

  it('mạng chậm chỉ được một chấm ở thanh trạng thái', () => {
    expect(tierOf('degraded')).toBe('statusBar');
  });

  it('trực tuyến thì không vẽ gì', () => {
    expect(tierOf('online')).toBe('none');

    const { container } = renderWithProviders(
      <ConnectionStates {...buildConnectionStatesProps('empty')} />,
    );

    expect(container.textContent).toBe('');
  });

  it('mạng chậm KHÔNG dựng dải và KHÔNG dựng tấm giữa màn', () => {
    renderWithProviders(
      <ConnectionStates
        actions={NOOP_ACTIONS}
        model={{
          ...buildConnectionStatesProps('empty').model,
          actionLabel: null,
          connectionCase: 'degraded',
          headline: headlineOf('degraded', 0),
          tier: 'statusBar',
        }}
      />,
    );

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Kết nối chậm');
  });

  it('phiên hết hạn dựng tấm giữa màn và nói đúng số việc chưa lưu', () => {
    renderWithProviders(
      <ConnectionStates actions={NOOP_ACTIONS} model={buildSessionExpiredModel()} />,
    );

    const dialog = screen.getByRole('alertdialog');

    expect(dialog.textContent).toContain('Đăng nhập lại để lưu 12 thay đổi chờ đồng bộ');
    expect(dialog.textContent).toContain('không mất gì cả');
  });

  it('hàng đợi đầy nói rõ nguy cơ nếu tiếp tục', () => {
    renderWithProviders(<ConnectionStates actions={NOOP_ACTIONS} model={buildQueueFullModel()} />);

    expect(screen.getByRole('status').textContent).toContain('có thể mất thay đổi mới');
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Bảy trạng thái.                                                          */
/* -------------------------------------------------------------------------- */

describe('bảy trạng thái', () => {
  /**
   * `expectSevenStates` từ chối một màn trắng, nhưng trạng thái "rỗng" của lớp
   * này ĐÚNG là không vẽ gì. Nên trạng thái ấy được dựng bằng cảnh có thật gần
   * nhất mà vẫn nói một câu: mạng chậm.
   */
  it('không trạng thái nào dựng ra màn trắng ngoài trạng thái cố ý im lặng', () => {
    expectSevenStates((scenario) => {
      const props = buildConnectionStatesProps(scenario.state);
      const model =
        scenario.state === 'empty'
          ? {
              ...props.model,
              connectionCase: 'degraded' as const,
              headline: headlineOf('degraded', 0),
              tier: 'statusBar' as const,
            }
          : props.model;

      const { container, unmount } = renderWithProviders(
        <ConnectionStates actions={props.actions} model={model} />,
      );

      return { container, unmount };
    }, createSevenStateScenarios());
  });

  it('trạng thái rỗng cố ý không vẽ gì', () => {
    const { container } = renderWithProviders(
      <ConnectionStates {...buildConnectionStatesProps('empty')} />,
    );

    expect(container.textContent).toBe('');
  });

  it('đi qua expectAccessible ở trạng thái một phần', () => {
    const { container } = renderWithProviders(
      <ConnectionStates {...buildConnectionStatesProps('partial')} />,
    );

    expectAccessible(container);
  });

  it('đi qua expectVietnamese ở trạng thái một phần', () => {
    const { container } = renderWithProviders(
      <ConnectionStates {...buildConnectionStatesProps('partial')} />,
    );

    expectVietnamese(container);
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Câu chữ và con số.                                                       */
/* -------------------------------------------------------------------------- */

describe('câu chữ', () => {
  it('mỗi trường hợp đúng một câu', () => {
    expect(headlineOf('offline', 12)).toBe('Đang làm việc ngoại tuyến · 12 thay đổi chờ đồng bộ.');
    expect(headlineOf('degraded', 0)).toBe('Kết nối chậm, thao tác có thể trễ.');
  });

  it('chỉ ba trường hợp có hành động, ba trường hợp còn lại không', () => {
    expect(actionLabelOf('sessionExpired')).toBe('Đăng nhập lại');
    expect(actionLabelOf('offline')).toBe('Xem chi tiết');
    expect(actionLabelOf('degraded')).toBeNull();
    expect(actionLabelOf('synced')).toBeNull();
    expect(actionLabelOf('online')).toBeNull();
  });

  it('dựng "8/12" khi đang phát lại', () => {
    expect(replayLabelOf(true, 4, 12)).toBe('8/12');
  });

  it('không dựng nhãn phát lại khi không phát lại', () => {
    expect(replayLabelOf(false, 4, 12)).toBeNull();
  });

  it('lệnh bị bỏ được nói ra, không gộp vào số lệnh chờ', () => {
    expect(droppedLabelOf(0)).toBeNull();
    expect(droppedLabelOf(3)).toContain('3 lệnh không phát lại được');
  });

  it('lệnh không mang nhãn thì nói thẳng là chưa đặt tên, không bịa', () => {
    const row = toPendingRow({ command: { foo: 1 }, createdAt: Date.now(), id: 7, sizeBytes: 900 });

    expect(row.label).toBe('thay đổi chưa đặt tên');
  });

  it('số lệnh chờ định dạng ở model, không ở view (A15)', () => {
    expect(describePending(1_200)).toBe('1.200 thay đổi chờ đồng bộ');
  });
});

/* -------------------------------------------------------------------------- */
/* 5. Trần hàng đợi — đọc từ T-09, không chép số.                              */
/* -------------------------------------------------------------------------- */

describe('isQueueFull', () => {
  const command = (sizeBytes: number, id: number) => ({
    command: null,
    createdAt: 0,
    id,
    isVolatile: false,
    projectId: 'p-1',
    sizeBytes,
  });

  it('hàng đợi thường thì chưa đầy', () => {
    expect(isQueueFull([command(1_000, 1), command(1_000, 2)])).toBe(false);
  });

  it('chạm trần số lệnh là đầy', () => {
    const many = Array.from({ length: 200 }, (_unused, index) => command(10, index));

    expect(isQueueFull(many)).toBe(true);
  });

  it('chạm trần dung lượng cũng là đầy, dù ít lệnh', () => {
    expect(isQueueFull([command(5 * 1024 * 1024, 1)])).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* 6. Hook.                                                                    */
/* -------------------------------------------------------------------------- */

const hookOptions = {
  browserOnline: true,
  canView: true,
  deadLetterCommands: 0,
  errorMessage: null,
  isCollapsed: false,
  isLoading: false,
  isQueueFull: false,
  isReplaying: false,
  isSessionExpired: false,
  lastSuccessfulSyncAt: null,
  onReplayNow: () => undefined,
  pendingCommands: SAMPLE_PENDING,
  pingOnline: true,
  replayTotal: SAMPLE_PENDING.length,
};

describe('useConnectionStates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Mốc giờ chốt MỘT lần ngoài `renderHook`.
   *
   * Bản đầu viết `lastSuccessfulSyncAt: Date.now()` ngay trong lời gọi, nên mỗi
   * lượt dựng lại cho ra một mốc mới, `useEffect` chạy lại và hẹn giờ được đặt
   * lại vô tận — bài kiểm không bao giờ thấy câu kia ẩn đi. Đó là lỗi của bài
   * kiểm, không phải của hook.
   */
  it('"đã đồng bộ xong" tự ẩn sau bốn giây', () => {
    const syncedAt = Date.now();
    const { result } = renderHook(() =>
      useConnectionStates({ ...hookOptions, lastSuccessfulSyncAt: syncedAt }),
    );

    expect(result.current[0].connectionCase).toBe('synced');

    act(() => {
      vi.advanceTimersByTime(SYNCED_NOTICE_MS);
    });

    expect(result.current[0].connectionCase).not.toBe('synced');
  });

  /**
   * Mốc neo là `lastSuccessfulSyncAt`, không phải `isReplaying` về `false`.
   *
   * Một lượt phát lại HỎNG cũng làm cờ ấy về `false`; nói "đã đồng bộ xong" lúc
   * đó là nói dối người đang lo mất việc.
   */
  it('không nói "đã đồng bộ xong" khi chưa lần nào đồng bộ được', () => {
    const { result } = renderHook(() =>
      useConnectionStates({ ...hookOptions, lastSuccessfulSyncAt: null }),
    );

    expect(result.current[0].connectionCase).not.toBe('synced');
    expect(result.current[0].lastSyncLabel).toBeNull();
  });

  it('không có quyền thì không rò một dòng hàng đợi nào', () => {
    const { result } = renderHook(() => useConnectionStates({ ...hookOptions, canView: false }));

    expect(result.current[0].state).toBe('forbidden');
    expect(result.current[0].pendingRows).toHaveLength(0);
  });

  it('mở rồi đóng tấm trượt chi tiết', () => {
    const { result } = renderHook(() => useConnectionStates(hookOptions));

    act(() => {
      result.current[1].onOpenDetail();
    });
    expect(result.current[0].isDetailOpen).toBe(true);

    act(() => {
      result.current[1].onCloseDetail();
    });
    expect(result.current[0].isDetailOpen).toBe(false);
  });

  it('phát lại ngay gọi thẳng ra ngoài, màn không tự thử lại', () => {
    const onReplayNow = vi.fn();
    const { result } = renderHook(() => useConnectionStates({ ...hookOptions, onReplayNow }));

    act(() => {
      result.current[1].onReplayNow();
    });

    expect(onReplayNow).toHaveBeenCalledTimes(1);
  });
});

/* -------------------------------------------------------------------------- */
/* 7. Tấm trượt chi tiết.                                                      */
/* -------------------------------------------------------------------------- */

describe('tấm trượt chi tiết', () => {
  it('liệt kê từng lệnh đang chờ kèm giờ và dung lượng', () => {
    const props = buildConnectionStatesProps('collapsed');

    renderWithProviders(
      <ConnectionStates
        actions={props.actions}
        model={{ ...props.model, isCollapsed: false, isDetailOpen: true }}
      />,
    );

    expect(screen.getByText('Việc đang chờ đồng bộ')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(SAMPLE_PENDING.length);
  });

  it('nút "Xem chi tiết" mở tấm trượt', () => {
    const onOpenDetail = vi.fn();
    const props = buildConnectionStatesProps('collapsed');

    renderWithProviders(
      <ConnectionStates
        actions={{ ...props.actions, onOpenDetail }}
        model={{ ...props.model, isCollapsed: false }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết' }));

    expect(onOpenDetail).toHaveBeenCalledTimes(1);
  });
});
