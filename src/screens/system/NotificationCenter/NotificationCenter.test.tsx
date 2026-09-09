/**
 * Bộ kiểm của `NotificationCenter` — viết song song với view và hook, theo
 * `notificationModel.ts` (hợp đồng đông cứng, chỉ đọc). View và hook CHƯA TỒN
 * TẠI trong worktree này lúc file này được viết — hai import dưới đây
 * (`./NotificationCenter`, `./useNotificationCenter`) sẽ đỏ ở `pnpm typecheck`
 * cho tới khi lớp gộp ghép bốn nhánh lại. Đó là điều đã biết trước, không phải
 * lỗi của bộ kiểm này.
 *
 * ## Hợp đồng props/hook GIẢ ĐỊNH bởi file này (chưa chốt)
 *
 * `NotificationCenterProps` (view thuần) và `useNotificationCenter` (hook) được
 * giả định xuất từ `./useNotificationCenter`, đúng khuôn `EditorTourProps` xuất
 * từ `useEditorTour.ts`. Hình dạng props giả định:
 *
 * ```
 * screenState, isOpen, groups, filter, unreadCount, unreadBadge, isCollapsed,
 * liveMessage, errorMessage,
 * onToggle, onClose, onFilterChange, onItemClick, onMarkAllRead, onRetry
 * ```
 *
 * Nếu tên trường thật lệch một chút, người ghép sửa — đây là hợp đồng đoán
 * trước (mục 1 của đặc tả), không phải bản đã chốt.
 *
 * ## Hai giả định về DOM (người ghép có thể cần chỉnh nếu view dựng khác)
 *
 * - Vùng cuộn của danh sách là phần tử mang class `overflow-y-auto` — đúng
 *   class `Drawer.Body` đặt sẵn (`src/components/overlay/Drawer.tsx:294`),
 *   với giả định view bọc danh sách trực tiếp trong `<Drawer.Body>`.
 * - Mỗi thông báo là một `<li>` trong danh sách.
 *
 * ## Ba cái bẫy đã đo bằng phép chạy thật (notes S3/S4, không đoán lại)
 *
 * (a) jsdom không có `window.matchMedia`; `Drawer.Root` gọi nó ngay lần render
 *     đầu. Polyfill toàn cục, `matches: false` (desktop), chép từ
 *     `AppShell.test.tsx:12-28`.
 * (b) `expectAccessible` phải nhận `ignoreSelector: '[role=dialog]'` — phần tử
 *     dialog của Drawer có `tabIndex={-1}` + `outline-none`, không phải lỗi
 *     tiêu điểm thật.
 * (c) Không dùng `installFakeClock` trong file này — không bài nào cần đồng
 *     hồ giả, nên không giẫm vào bẫy "đặt trước waitFor".
 */

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';
import { createSevenStateScenarios, SEVEN_STATES } from '@/lib/testing/sevenStateScenarios';
import type { SevenStateScenario } from '@/lib/testing/sevenStateScenarios';
import { ROUTES } from '@/routes/paths';

import { NotificationCenter } from './NotificationCenter';
import { UNREAD_DOT_SIZE_PX } from './notificationModel';
import type {
  NotificationCenterGateway,
  NotificationDayGroup,
  NotificationInlineAction,
  NotificationItemVm,
  NotificationKind,
} from './notificationModel';
import { useNotificationCenter } from './useNotificationCenter';
import type { NotificationCenterProps, UseNotificationCenterOptions } from './useNotificationCenter';

const noop = (): void => undefined;

beforeAll(() => {
  // Bẫy (a): jsdom không có matchMedia; Drawer.Root gọi nó ngay lần render đầu.
  // matches: false ép layout desktop — khuôn chép nguyên văn từ AppShell.test.tsx.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */
/* Dữ liệu mẫu — một dự án chính, tiếng Việt có dấu.                            */
/* -------------------------------------------------------------------------- */

const PROJECT_ID = 'p-nha-pho-nguyen-trai';
const PROJECT_NAME = 'Nhà phố Nguyễn Trãi';
const FLOOR_ID = 'f-tang-2';
const FIXED_CREATED_AT = new Date('2026-09-09T08:00:00+07:00').getTime();

interface ItemOverrides {
  readonly id?: string;
  readonly kind?: NotificationKind;
  readonly sentence?: string;
  readonly isRead?: boolean;
  readonly createdAt?: number;
  readonly relativeTime?: string;
  readonly excerpt?: string | undefined;
  readonly inlineAction?: NotificationInlineAction | undefined;
  readonly projectId?: string;
  readonly projectName?: string;
  readonly floorId?: string | undefined;
  readonly targetTo?: string;
  readonly targetLabel?: string;
}

let itemSeq = 0;

function buildItem(overrides: ItemOverrides = {}): NotificationItemVm {
  itemSeq += 1;

  const projectId = overrides.projectId ?? PROJECT_ID;
  const projectName = overrides.projectName ?? PROJECT_NAME;
  const floorId = 'floorId' in overrides ? overrides.floorId : FLOOR_ID;
  const to = overrides.targetTo ?? ROUTES.project.walls(projectId, floorId ?? FLOOR_ID);

  return {
    id: overrides.id ?? `n-${String(itemSeq)}`,
    kind: overrides.kind ?? 'aiCompleted',
    sentence: overrides.sentence ?? `${projectName}: AI đã xử lý xong một mục, tầng 2.`,
    target: {
      projectId,
      projectName,
      floorId,
      label: overrides.targetLabel ?? 'xem kết quả',
      to,
    },
    createdAt: overrides.createdAt ?? FIXED_CREATED_AT,
    relativeTime: overrides.relativeTime ?? '5 phút trước',
    isRead: overrides.isRead ?? false,
    excerpt: overrides.excerpt,
    inlineAction: overrides.inlineAction,
  };
}

function buildGroup(key: string, heading: string, items: readonly NotificationItemVm[]): NotificationDayGroup {
  return { key, heading, items };
}

function firstItem(groups: readonly NotificationDayGroup[]): NotificationItemVm {
  const item = groups[0]?.items[0];

  if (item === undefined) throw new Error('firstItem: không có mục nào trong groups');

  return item;
}

function allItems(groups: readonly NotificationDayGroup[]): readonly NotificationItemVm[] {
  return groups.flatMap((entry) => entry.items);
}

const TODAY_ITEMS: readonly NotificationItemVm[] = [
  buildItem({
    id: 'today-1',
    kind: 'aiCompleted',
    sentence: `${PROJECT_NAME}: AI đã dò xong lớp tường, tầng 2.`,
    isRead: false,
    relativeTime: '5 phút trước',
    targetTo: ROUTES.project.walls(PROJECT_ID, FLOOR_ID),
    targetLabel: 'xem kết quả',
  }),
  buildItem({
    id: 'today-2',
    kind: 'violationFound',
    sentence: `${PROJECT_NAME}: phát hiện 3 tường mỏng hơn tiêu chuẩn, tầng 2.`,
    isRead: true,
    relativeTime: '20 phút trước',
    targetTo: ROUTES.project.thickness(PROJECT_ID, FLOOR_ID),
    targetLabel: 'xem vi phạm',
  }),
];

const ALL_GROUPS: readonly NotificationDayGroup[] = [buildGroup('today', 'Hôm nay', TODAY_ITEMS)];

const UNREAD_COUNT = ALL_GROUPS.flatMap((entry) => entry.items).filter((entry) => !entry.isRead).length;

/** Mọi trường không đổi giữa các bài kiểm view-thuần, một chỗ (khuôn `EditorTour.test.tsx`). */
function baseProps(overrides: Partial<NotificationCenterProps> = {}): NotificationCenterProps {
  return {
    screenState: 'partial',
    isOpen: true,
    groups: ALL_GROUPS,
    filter: 'all',
    unreadCount: UNREAD_COUNT,
    unreadBadge: String(UNREAD_COUNT),
    isCollapsed: false,
    liveMessage: `có ${String(UNREAD_COUNT)} thông báo chưa đọc`,
    errorMessage: '',
    onToggle: noop,
    onClose: noop,
    onFilterChange: noop,
    onItemClick: noop,
    onMarkAllRead: noop,
    onRetry: noop,
    ...overrides,
  };
}

/** Kịch bản chung của bảy trạng thái → props của `NotificationCenter`. */
function propsFor(scenario: SevenStateScenario): NotificationCenterProps {
  switch (scenario.state) {
    case 'empty':
      return baseProps({
        screenState: 'empty',
        groups: [],
        unreadCount: 0,
        unreadBadge: '',
        liveMessage: 'không có thông báo nào',
      });
    case 'loading':
      return baseProps({ screenState: 'loading', groups: [], unreadCount: 0, unreadBadge: '' });
    case 'partial':
      return baseProps({ screenState: 'partial' });
    case 'error':
      return baseProps({
        screenState: 'error',
        groups: [],
        unreadCount: 0,
        unreadBadge: '',
        errorMessage: 'Không tải được thông báo. Thử lại sau.',
      });
    case 'success':
      return baseProps({ screenState: 'success' });
    case 'forbidden':
      return baseProps({
        screenState: 'forbidden',
        groups: [
          buildGroup(
            'today',
            'Hôm nay',
            TODAY_ITEMS.map((entry) => ({ ...entry, inlineAction: undefined })),
          ),
        ],
        liveMessage: 'vai người xem không thao tác được lời mời',
      });
    case 'collapsed':
      return baseProps({ screenState: 'collapsed', isCollapsed: true });
    default: {
      const exhaustive: never = scenario.state;

      throw new Error(`propsFor: trạng thái không xác định — ${String(exhaustive)}`);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Cổng giả — khuôn giống `accountSettingsGateway.ts` nhưng chỉ trong bộ nhớ    */
/* của phép thử, không phải file sản phẩm.                                     */
/* -------------------------------------------------------------------------- */

interface FakeGateway {
  readonly gateway: NotificationCenterGateway;
  readonly markRead: ReturnType<typeof vi.fn>;
  readonly markAllRead: ReturnType<typeof vi.fn>;
  readonly arrive: (item: NotificationItemVm) => void;
}

function createFakeGateway(initialItems: readonly NotificationItemVm[]): FakeGateway {
  let items = initialItems;
  let listener: ((arrived: NotificationItemVm) => void) | null = null;

  const markRead = vi.fn((ids: readonly string[]): Promise<void> => {
    items = items.map((entry) => (ids.includes(entry.id) ? { ...entry, isRead: true } : entry));

    return Promise.resolve();
  });

  const markAllRead = vi.fn((): Promise<void> => {
    items = items.map((entry) => ({ ...entry, isRead: true }));

    return Promise.resolve();
  });

  const gateway: NotificationCenterGateway = {
    list: () => Promise.resolve(items),
    markRead,
    markAllRead,
    subscribe: (fn) => {
      listener = fn;

      return () => {
        listener = null;
      };
    },
  };

  return {
    gateway,
    markRead,
    markAllRead,
    arrive: (item) => {
      items = [item, ...items];
      listener?.(item);
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Dựng qua hook thật — tiêm cổng giả (bốn bài nghiệm thu chạm tới logic hook). */
/* -------------------------------------------------------------------------- */

let observedProps: NotificationCenterProps | null = null;

function NotificationProbe({ options }: { readonly options: UseNotificationCenterOptions }) {
  const props = useNotificationCenter(options);

  observedProps = props;

  return <NotificationCenter {...props} />;
}

function mountNotificationCenter(options: UseNotificationCenterOptions) {
  observedProps = null;

  return renderWithProviders(<NotificationProbe options={options} />);
}

function notificationProps(): NotificationCenterProps {
  if (observedProps === null) throw new Error('useNotificationCenter chưa chạy lần nào');

  return observedProps;
}

/* -------------------------------------------------------------------------- */
/* (a) R-63 — bảy trạng thái.                                                  */
/* -------------------------------------------------------------------------- */

describe('R-63 — bảy trạng thái, đo trên cả màn', () => {
  it('dựng đủ bảy, không trạng thái nào ra màn trắng', () => {
    const covered: string[] = [];

    expectSevenStates((scenario) => {
      covered.push(scenario.label);

      return render(<NotificationCenter {...propsFor(scenario)} />);
    }, createSevenStateScenarios());

    expect(covered).toHaveLength(SEVEN_STATES.length);
  });
});

/* -------------------------------------------------------------------------- */
/* (b) R-72 — tiếp cận, tiếng Việt, không mã màu thô.                          */
/* -------------------------------------------------------------------------- */

describe('R-72 — mọi trạng thái tiếp cận được, tiếng Việt có dấu', () => {
  it.each(createSevenStateScenarios())(
    'trạng thái "$label" tiếp cận được và không sót tiếng Anh/mất dấu',
    (scenario) => {
      const { container } = render(<NotificationCenter {...propsFor(scenario)} />);

      // Bẫy (b): phần tử role="dialog" của Drawer có tabIndex={-1} +
      // outline-none — không phải lỗi tiêu điểm thật, phải bỏ qua đúng vùng đó.
      expectAccessible(container, { ignoreSelector: '[role=dialog]' });
      expectVietnamese(container);
    },
  );

  it('không một mã màu thô nào trong cả thư mục màn', () => {
    expect(() => {
      expectNoRawColor('src/screens/system/NotificationCenter');
    }).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* (c) BÀI NGHIỆM THU 1 — nhận 5 thông báo lúc đang cuộn thì vị trí không nhảy. */
/* -------------------------------------------------------------------------- */

describe('BÀI NGHIỆM THU — nhận 5 thông báo liên tiếp trong lúc đang cuộn thì vị trí cuộn KHÔNG nhảy', () => {
  it('scrollTop giữ nguyên (lệch không quá 1px) khi 5 thông báo mới được đẩy vào đầu danh sách', () => {
    const initialItems = Array.from({ length: 20 }, (_unused, index) =>
      buildItem({
        id: `scroll-${String(index)}`,
        sentence: `${PROJECT_NAME}: AI đã xử lý xong mục thứ ${String(index + 1)}, tầng 2.`,
        relativeTime: `${String(index + 1)} phút trước`,
      }),
    );

    const { container, rerender } = render(
      <NotificationCenter
        {...baseProps({
          groups: [buildGroup('today', 'Hôm nay', initialItems)],
          unreadCount: initialItems.length,
          unreadBadge: String(initialItems.length),
        })}
      />,
    );

    // Giả định DOM: vùng cuộn là phần tử mang class `overflow-y-auto` — đúng
    // class Drawer.Body đặt sẵn (Drawer.tsx:294).
    const scrollRegion = container.querySelector('.overflow-y-auto');

    expect(scrollRegion).not.toBeNull();

    const region = scrollRegion as HTMLElement;

    // jsdom không tự tính layout: scrollHeight/clientHeight/scrollTop phải giả
    // lập bằng Object.defineProperty (bẫy đã đo ở notes S3, không phải suy đoán).
    let scrollTopValue = 240;

    Object.defineProperty(region, 'scrollTop', {
      configurable: true,
      get: () => scrollTopValue,
      set: (value: number) => {
        scrollTopValue = value;
      },
    });
    Object.defineProperty(region, 'scrollHeight', { configurable: true, value: 2000 });
    Object.defineProperty(region, 'clientHeight', { configurable: true, value: 480 });

    const arriving = Array.from({ length: 5 }, (_unused, index) =>
      buildItem({
        id: `arrived-${String(index)}`,
        sentence: `${PROJECT_NAME}: có thông báo mới thứ ${String(index + 1)}, tầng 2.`,
        relativeTime: 'vừa xong',
      }),
    );

    rerender(
      <NotificationCenter
        {...baseProps({
          groups: [buildGroup('today', 'Hôm nay', [...arriving, ...initialItems])],
          unreadCount: initialItems.length + arriving.length,
          unreadBadge: String(initialItems.length + arriving.length),
        })}
      />,
    );

    expect(Math.abs(region.scrollTop - 240)).toBeLessThanOrEqual(1);
  });
});

/* -------------------------------------------------------------------------- */
/* (d) BÀI NGHIỆM THU 2 — mở tấm trượt rồi đóng: số chưa đọc không đổi.        */
/* -------------------------------------------------------------------------- */

describe('BÀI NGHIỆM THU — mở tấm trượt rồi đóng thì số chưa đọc KHÔNG đổi', () => {
  it('mở rồi đóng không tự đánh dấu đã đọc — unreadCount trước và sau bằng nhau', async () => {
    const unread = [
      buildItem({ id: 'u-1', isRead: false }),
      buildItem({ id: 'u-2', isRead: false }),
      buildItem({ id: 'u-3', isRead: true }),
    ];
    const fake = createFakeGateway(unread);

    mountNotificationCenter({ gateway: fake.gateway });

    await waitFor(() => {
      expect(allItems(notificationProps().groups)).toHaveLength(3);
    });

    const before = notificationProps().unreadCount;

    act(() => {
      notificationProps().onToggle();
    });
    act(() => {
      notificationProps().onClose();
    });

    const after = notificationProps().unreadCount;

    expect(after).toBe(before);
    expect(fake.markRead).not.toHaveBeenCalled();
    expect(fake.markAllRead).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* (e) BÀI NGHIỆM THU 3 — bấm thông báo AI xử lý xong: mở đúng màn của đúng tầng. */
/* -------------------------------------------------------------------------- */

describe('BÀI NGHIỆM THU — bấm một thông báo AI xử lý xong thì mở đúng màn duyệt của đúng tầng', () => {
  it('điều hướng tới đúng chuỗi do ROUTES.project.walls(projectId, floorId) sinh ra — không phải chuỗi viết tay', async () => {
    const expectedTo = ROUTES.project.walls('p-nha-pho-le-loi', 'f-tang-1');

    const target = buildItem({
      id: 'ai-1',
      kind: 'aiCompleted',
      isRead: false,
      projectId: 'p-nha-pho-le-loi',
      projectName: 'Nhà phố Lê Lợi',
      floorId: 'f-tang-1',
      targetTo: expectedTo,
      targetLabel: 'xem kết quả',
    });

    const fake = createFakeGateway([target]);
    const onNavigate = vi.fn();

    mountNotificationCenter({ gateway: fake.gateway, onNavigate });

    await waitFor(() => {
      expect(allItems(notificationProps().groups)).toHaveLength(1);
    });

    act(() => {
      notificationProps().onItemClick(firstItem(notificationProps().groups));
    });

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(expectedTo);
  });
});

/* -------------------------------------------------------------------------- */
/* (f) BÀI NGHIỆM THU 4 — không âm thanh, không nhấp nháy.                     */
/* -------------------------------------------------------------------------- */

describe('BÀI NGHIỆM THU — không âm thanh, không nhấp nháy', () => {
  it('thông báo mới tới không gọi new Audio, và cây đã render không mang animation lặp vô hạn', async () => {
    const audioConstructor = vi.fn();

    vi.stubGlobal('Audio', audioConstructor);

    const fake = createFakeGateway([buildItem({ id: 'seed', isRead: true })]);

    const { container } = mountNotificationCenter({ gateway: fake.gateway });

    await waitFor(() => {
      expect(allItems(notificationProps().groups)).toHaveLength(1);
    });

    act(() => {
      fake.arrive(
        buildItem({
          id: 'arrived-now',
          isRead: false,
          sentence: `${PROJECT_NAME}: có bản cập nhật mới nhất, tầng 2.`,
        }),
      );
    });

    await waitFor(() => {
      expect(container.textContent ?? '').toContain('có bản cập nhật mới nhất');
    });

    expect(audioConstructor).not.toHaveBeenCalled();

    const html = container.innerHTML;

    expect(html).not.toMatch(/animate-(?:pulse|ping|bounce|spin)/);
    expect(html).not.toMatch(/infinite/i);
  });
});

/* -------------------------------------------------------------------------- */
/* (g) Chưa đọc là chấm, không phải nền hàng.                                  */
/* -------------------------------------------------------------------------- */

describe('Chưa đọc là chấm, không phải nền hàng', () => {
  it(`hàng chưa đọc mang một chấm ${String(UNREAD_DOT_SIZE_PX)}px, không mang class nền tô màu`, () => {
    const unread = buildItem({
      id: 'dot-1',
      isRead: false,
      sentence: `${PROJECT_NAME}: còn một việc chưa xử lý xong, tầng 2.`,
    });

    const { container } = render(
      <NotificationCenter
        {...baseProps({
          groups: [buildGroup('today', 'Hôm nay', [unread])],
          unreadCount: 1,
          unreadBadge: '1',
        })}
      />,
    );

    const dotSizePx = `${String(UNREAD_DOT_SIZE_PX)}px`;

    const dot = Array.from(container.querySelectorAll<HTMLElement>('*')).find(
      (element) => element.style.width === dotSizePx && element.style.height === dotSizePx,
    );

    expect(dot).not.toBeUndefined();

    // Giả định DOM: mỗi thông báo là một <li> — nếu view dựng khác, người
    // ghép đổi selector này cho khớp.
    const row = screen.getByText(unread.sentence).closest('li');

    expect(row).not.toBeNull();
    expect(dot !== undefined && row !== null && row.contains(dot)).toBe(true);

    const rowClasses = (row?.getAttribute('class') ?? '').split(/\s+/);

    expect(rowClasses.some((token) => /^bg-/.test(token))).toBe(false);
  });
});
