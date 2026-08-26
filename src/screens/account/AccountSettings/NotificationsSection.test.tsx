/**
 * Bộ kiểm của khối thông báo — T5.
 *
 * Hai nửa, đúng như mục D chia: view dựng **chỉ từ props**, và viewmodel dựng
 * qua `renderHook` với một `AccountDraftPort` giả. Không nửa nào cần cả màn.
 *
 * Điều được soát kỹ nhất ở đây là [CẤM TUYỆT ĐỐI] **không tô màu ô nào trong
 * ma trận**: {@link expectNoTintedGrid} đọc từng thẻ cấu trúc của bảng và từ
 * chối bất kỳ lớp `bg-…` nào — kể cả biến thể `hover:`, `odd:` hay
 * `group-hover:`. Đó là lý do khối này không dùng compound `Table`, và một
 * lần ai đó đổi ý thì phép kiểm này đỏ ngay chứ không đợi người duyệt nhìn ra.
 */

import { cleanup, fireEvent, render, renderHook, screen, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';

import { NotificationsSection, type NotificationsSectionProps } from './NotificationsSection';
import {
  EMPTY_ACCOUNT_DRAFT,
  type AccountDraft,
  type AccountDraftFields,
  type AccountDraftPort,
  type AccountDraftSection,
} from './accountDraft';
import { NOTIFICATION_CHANNELS, useAccountTables } from './useAccountTables';

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

interface StagedCall {
  readonly section: AccountDraftSection;
  readonly fields: AccountDraftFields;
}

/** Cổng lưu giả: `saved` giữ nguyên tham chiếu, `stage` chỉ ghi vào một mảng. */
function createPort(saved: AccountDraft | undefined = EMPTY_ACCOUNT_DRAFT): {
  port: AccountDraftPort;
  staged: StagedCall[];
} {
  const staged: StagedCall[] = [];

  return {
    staged,
    port: {
      saved,
      stage: (section, fields) => {
        staged.push({ section, fields });
      },
    },
  };
}

/**
 * `matchMedia` cho jsdom, trả lời theo từng câu hỏi.
 *
 * jsdom không có `matchMedia`, và hai hook đọc nó với hai câu khác nhau — bề
 * rộng khung nhìn và "giảm chuyển động". Một bản giả trả `false` cho tất cả sẽ
 * không dựng được trạng thái 7.
 */
function stubMatchMedia(matches: (query: string) => boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) =>
      ({
        matches: matches(query),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}

const NARROW_QUERY = '(max-width: 639px)';

/** Props của view, dựng thẳng tay — mục D: view không cần hook nào để test. */
function viewProps(overrides: Partial<NotificationsSectionProps> = {}): NotificationsSectionProps {
  return {
    channels: NOTIFICATION_CHANNELS,
    events: [
      {
        id: 'aiCompleted',
        label: 'AI xử lý xong',
        cells: [
          { channelId: 'inApp', label: 'AI xử lý xong — Trong ứng dụng', isOn: true },
          { channelId: 'email', label: 'AI xử lý xong — Thư điện tử', isOn: false },
        ],
      },
      {
        id: 'morningDigest',
        label: 'Tổng hợp mỗi sáng',
        cells: [
          { channelId: 'inApp', label: 'Tổng hợp mỗi sáng — Trong ứng dụng', isOn: false },
          { channelId: 'email', label: 'Tổng hợp mỗi sáng — Thư điện tử', isOn: true },
        ],
      },
    ],
    isCollapsed: false,
    onChange: () => undefined,
    ...overrides,
  };
}

/**
 * Không một thẻ cấu trúc nào của lưới mang nền.
 *
 * Chỉ soát khung — `table`, `thead`, `tbody`, `tr`, `th`, `td`, `caption`,
 * `ul`, `li`, nhóm — chứ không soát bên trong `Checkbox` hay `Toggle`: hai
 * control ấy **là** thứ tương tác được và chúng mang màu nhấn của chúng theo
 * đúng A2. Thứ bị cấm là màu đặt lên ô và lên hàng.
 */
function expectNoTintedGrid(container: HTMLElement): void {
  const structural = container.querySelectorAll(
    'table, thead, tbody, tr, th, td, caption, ul, li, [role="group"]',
  );

  expect(structural.length).toBeGreaterThan(0);

  for (const element of structural) {
    for (const className of element.classList) {
      const bare = className.slice(className.lastIndexOf(':') + 1);

      if (bare.startsWith('bg-')) {
        throw new Error(
          `Ma trận thông báo bị tô màu: <${element.tagName.toLowerCase()}> mang lớp "${className}".`,
        );
      }
    }
  }
}

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, 'matchMedia');
});

/* -------------------------------------------------------------------------- */
/* View — ma trận.                                                             */
/* -------------------------------------------------------------------------- */

describe('ma trận thông báo', () => {
  it('vẽ một ô tích cho mỗi cặp sự việc × kênh, mỗi ô một tên đọc được', () => {
    const props = viewProps();

    render(<NotificationsSection {...props} />);

    const boxes = screen.getAllByRole('checkbox');

    expect(boxes).toHaveLength(props.events.length * props.channels.length);

    // Tên phải khác nhau từng ô: mười ô cùng tên là mười ô không dùng được
    // bằng trình đọc màn hình.
    const names = boxes.map((box) => box.getAttribute('aria-label'));

    expect(new Set(names).size).toBe(boxes.length);
    expect(screen.getByRole('checkbox', { name: 'AI xử lý xong — Thư điện tử' })).toBeTruthy();
  });

  it('đầu bảng và mọi ô đều không tô màu', () => {
    const { container } = render(<NotificationsSection {...viewProps()} />);

    expectNoTintedGrid(container);
  });

  it('nối hàng với cột bằng scope, nên đọc lên là "sự việc × kênh"', () => {
    render(<NotificationsSection {...viewProps()} />);

    const columnHeaders = screen.getAllByRole('columnheader');
    const rowHeaders = screen.getAllByRole('rowheader');

    expect(columnHeaders.map((cell) => cell.textContent)).toEqual([
      'sự việc',
      'Trong ứng dụng',
      'Thư điện tử',
    ]);
    expect(rowHeaders).toHaveLength(2);
  });

  it('bấm một ô báo lên đúng sự việc, đúng kênh, đúng giá trị mới', () => {
    const onChange = vi.fn();

    render(<NotificationsSection {...viewProps({ onChange })} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'AI xử lý xong — Thư điện tử' }));

    expect(onChange).toHaveBeenCalledWith('aiCompleted', 'email', true);
  });

  it('chuỗi là tiếng Việt có dấu và cây render tiếp cận được', () => {
    const { container } = render(<NotificationsSection {...viewProps()} />);

    expectVietnamese(container);
    expectAccessible(container);
  });
});

/* -------------------------------------------------------------------------- */
/* View — trạng thái 7, thu gọn.                                               */
/* -------------------------------------------------------------------------- */

describe('trạng thái 7 — thu gọn', () => {
  it('đổi ma trận thành danh sách sự việc, mỗi sự việc hai Toggle', () => {
    const props = viewProps({ isCollapsed: true });

    const { container } = render(<NotificationsSection {...props} />);

    // Không còn bảng nào…
    expect(container.querySelector('table')).toBeNull();
    // …và không còn ô tích nào: hai Toggle là `role="switch"`.
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);

    const switches = screen.getAllByRole('switch');

    expect(switches).toHaveLength(props.events.length * props.channels.length);

    // Mỗi sự việc là một nhóm có tên, nên hai Toggle "Trong ứng dụng" ở hai sự
    // việc khác nhau vẫn phân biệt được khi nghe.
    const groups = screen.getAllByRole('group');

    expect(groups).toHaveLength(props.events.length);
    expect(groups.map((group) => group.getAttribute('aria-labelledby'))).toEqual([
      'notification-aiCompleted-label',
      'notification-morningDigest-label',
    ]);
  });

  it('bấm một Toggle báo lên đúng như ô tích báo lên', async () => {
    const onChange = vi.fn();

    render(<NotificationsSection {...viewProps({ isCollapsed: true, onChange })} />);

    const switches = screen.getAllByRole('switch');
    const first = switches[0];

    expect(first).toBeDefined();

    // `Toggle.toggle` là `async`: nó dọn trạng thái lạc quan ở microtask sau,
    // nên lượt bấm phải nằm trong một `act` bất đồng bộ.
    await act(async () => {
      fireEvent.click(first as HTMLElement);
    });

    expect(onChange).toHaveBeenCalledWith('aiCompleted', 'inApp', false);
  });

  it('bản thu gọn cũng không tô màu, cũng tiếng Việt, cũng tiếp cận được', () => {
    const { container } = render(<NotificationsSection {...viewProps({ isCollapsed: true })} />);

    expectNoTintedGrid(container);
    expectVietnamese(container);
    expectAccessible(container);
  });

  it('hai file của khối không viết thẳng mã màu nào (A1)', () => {
    expectNoRawColor('src/screens/account/AccountSettings/NotificationsSection.tsx');
    expectNoRawColor('src/screens/account/AccountSettings/useAccountTables.ts');
  });
});

/* -------------------------------------------------------------------------- */
/* Viewmodel.                                                                  */
/* -------------------------------------------------------------------------- */

describe('useAccountTables — nửa thông báo', () => {
  it('dựng năm sự việc nhân hai kênh, và ghép nhãn cho trình đọc màn hình', () => {
    const { port } = createPort();

    const { result } = renderHook(() => useAccountTables(port));
    const model = result.current.notifications;

    expect(model.channels).toBe(NOTIFICATION_CHANNELS);
    expect(model.events).toHaveLength(5);

    for (const event of model.events) {
      expect(event.cells.map((cell) => cell.channelId)).toEqual(
        NOTIFICATION_CHANNELS.map((channel) => channel.id),
      );

      for (const cell of event.cells) {
        expect(cell.label.startsWith(event.label)).toBe(true);
      }
    }
  });

  it('đọc giá trị đã lưu, và lấy mặc định cho ô máy chủ chưa nói', () => {
    const { port } = createPort({
      ...EMPTY_ACCOUNT_DRAFT,
      notifications: { morningDigest: { inApp: true } },
    });

    const { result } = renderHook(() => useAccountTables(port));
    const digest = result.current.notifications.events.find(
      (event) => event.id === 'morningDigest',
    );

    expect(digest).toBeDefined();
    // Máy chủ nói `inApp: true`…
    expect(digest?.cells.find((cell) => cell.channelId === 'inApp')?.isOn).toBe(true);
    // …và không nói gì về thư điện tử, nên ô đó lấy mặc định của sự việc.
    expect(digest?.cells.find((cell) => cell.channelId === 'email')?.isOn).toBe(true);
  });

  it('bỏ qua giá trị đã lưu không phải boolean thay vì ép kiểu', () => {
    const { port } = createPort({
      ...EMPTY_ACCOUNT_DRAFT,
      notifications: { aiCompleted: { email: 'có' } },
    });

    const { result } = renderHook(() => useAccountTables(port));
    const cell = result.current.notifications.events
      .find((event) => event.id === 'aiCompleted')
      ?.cells.find((entry) => entry.channelId === 'email');

    expect(cell?.isOn).toBe(false);
  });

  it('một lượt bấm gửi TRỌN khối notifications qua port.stage, không gửi một ô', () => {
    const { port, staged } = createPort();

    const { result } = renderHook(() => useAccountTables(port));
    const eventIds = result.current.notifications.events.map((event) => event.id);

    act(() => {
      result.current.notifications.onChange('aiCompleted', 'email', true);
    });

    expect(staged).toHaveLength(1);
    expect(staged[0]?.section).toBe('notifications');

    // `mergeAccountDraft` gộp NÔNG, nên khối gửi lên phải đủ cả năm sự việc —
    // gửi thiếu là xoá mất phần còn lại của ma trận ở lượt lưu sau.
    expect(Object.keys(staged[0]?.fields ?? {}).sort()).toEqual([...eventIds].sort());
    expect(staged[0]?.fields['aiCompleted']).toEqual({ inApp: true, email: true });
  });

  it('giá trị mới hiện ra ngay, không đợi 800 ms của bộ tự lưu', () => {
    const { port } = createPort();

    const { result } = renderHook(() => useAccountTables(port));

    const before = result.current.notifications.events
      .find((event) => event.id === 'aiCompleted')
      ?.cells.find((cell) => cell.channelId === 'email')?.isOn;

    expect(before).toBe(false);

    act(() => {
      result.current.notifications.onChange('aiCompleted', 'email', true);
    });

    // `port.saved` KHÔNG đổi khi `stage` chạy; nếu view đọc thẳng từ nó thì ô
    // vừa bấm sẽ bật ngược lại trong lúc chờ lưu.
    expect(
      result.current.notifications.events
        .find((event) => event.id === 'aiCompleted')
        ?.cells.find((cell) => cell.channelId === 'email')?.isOn,
    ).toBe(true);
  });

  it('trạng thái 7 bật khi khung nhìn hẹp hơn 640 px', () => {
    stubMatchMedia((query) => query === NARROW_QUERY);

    const { port } = createPort();
    const { result } = renderHook(() => useAccountTables(port));

    expect(result.current.notifications.isCollapsed).toBe(true);
  });

  it('khung nhìn rộng thì ma trận ở nguyên là ma trận', () => {
    stubMatchMedia(() => false);

    const { port } = createPort();
    const { result } = renderHook(() => useAccountTables(port));

    expect(result.current.notifications.isCollapsed).toBe(false);
  });
});
