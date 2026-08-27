/**
 * Bộ kiểm của màn thanh toán — bốn bộ khẳng định dùng chung, cộng phần logic mà
 * một ảnh chụp bảy trạng thái không với tới.
 *
 * Hai nửa, đúng theo mục D:
 *
 * - **Nửa view.** Bảy trạng thái dựng thẳng từ props, không provider nào. Bảy
 *   `props` ấy KHÔNG viết tay: chúng là view model **thật** của
 *   `useBillingScreen`, chụp lại từ năm lượt chạy hook với năm hạt giống của
 *   `billingGateway`, rồi ghép vào bảy kịch bản của `createSevenStateScenarios()`.
 *   Nhờ vậy không một chuỗi tiền hay diện tích nào phải viết thẳng ở đây — đúng
 *   lệnh của người duyệt ở mục 0 hợp đồng — và bộ kịch bản chung đổi hình thì
 *   file này đỏ thay vì lặng lẽ trôi.
 * - **Nửa hook.** `useBillingScreen` chạy thật, dữ liệu tiêm qua `gateway`, và
 *   những gì được đo là những thứ ảnh chụp không thấy: ngưỡng hạn mức đổi sắc
 *   thái, giá **chạy** chứ không **nhảy** khi đổi kỳ, hai vai không đổi được gói,
 *   bảng tóm tắt xác nhận hiện ra TRƯỚC khi lệnh đi (A9), và lượt tải hoá đơn hỏng.
 *
 * Phiên đăng nhập là thứ duy nhất bị thay: `useSession` đọc một kho ngoài React
 * mà bài kiểm không có đường đặt vào, và ba vai cần đo — quản trị viên, kỹ sư,
 * người xem — chỉ khác nhau ở đúng giá trị đó.
 *
 * ## Vì sao có một cái đồng hồ riêng ở đây
 *
 * `installFakeClock` là đồng hồ dùng chung của repo, nhưng `toFake` mặc định của
 * Vitest **không** giả `performance` và `requestAnimationFrame`. `useCountUp`
 * chạy trên `requestAnimationFrame` và đo bước bằng dấu thời gian của khung
 * hình; để nguyên thì mọi khung hình mang cùng một dấu thời gian đông cứng, số
 * không nhích một bước nào, và bài kiểm "giá chạy số" sẽ xanh mà không khẳng
 * định gì cả — đúng thứ E.10 tồn tại để chặn. Nên {@link installCountUpClock}
 * dựng đúng bộ giả ấy, vẫn neo vào `FAKE_CLOCK_START` của đồng hồ chung để hai
 * file định dạng cùng một mốc ra cùng một chuỗi.
 */

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionSnapshot } from '@/lib/auth/types';
import { formatArea } from '@/lib/format/measure';
import { durationMs } from '@/lib/motion';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { FAKE_CLOCK_START } from '@/lib/testing/fakeClock';
import { renderWithProviders } from '@/lib/testing/render';
import {
  SEVEN_STATES,
  createSevenStateScenarios,
  type SevenState,
  type SevenStateScenario,
} from '@/lib/testing/sevenStateScenarios';

import { BillingScreen } from './BillingScreen';
import { BillingScreenContainer } from './BillingScreen.container';
import {
  BILLING_SCENARIO_SEEDS,
  createBillingGateway,
  resetBillingStore,
  type BillingGateway,
  type BillingGatewaySeed,
} from './billingGateway';
import {
  formatMoney,
  useBillingScreen,
  type BillingScreenViewModel,
  type UseBillingScreenOptions,
} from './useBillingScreen';

/* -------------------------------------------------------------------------- */
/* Môi trường — phiên đăng nhập, và hai thứ jsdom không có.                    */
/* -------------------------------------------------------------------------- */

/**
 * jsdom không có `matchMedia`, mà hộp thoại xác nhận và `useReducedMotion` đều
 * hỏi nó. `matches: false` là bản để bàn, chuyển động bật — cùng bản
 * `WelcomeScreen.test.tsx` dựng.
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

const auth = vi.hoisted(() => ({
  session: {
    status: 'authenticated',
    user: { id: 'u-quan-tri', name: 'Quân' },
    roles: ['admin'],
  } as SessionSnapshot,
}));

vi.mock('@/hooks/useSession', () => ({
  useSession: (): SessionSnapshot => auth.session,
}));

function signInAs(roles: SessionSnapshot['roles']): void {
  auth.session = {
    status: 'authenticated',
    user: { id: 'u-quan-tri', name: 'Quân' },
    roles,
  };
}

beforeEach(() => {
  signInAs(['admin']);
  resetBillingStore();
});

afterEach(() => {
  cleanup();
  resetBillingStore();
});

/* -------------------------------------------------------------------------- */
/* Dựng hook thật, và chụp lại view model nó trả ra.                           */
/* -------------------------------------------------------------------------- */

let observed: BillingScreenViewModel | null = null;

function Probe({ options }: { readonly options: UseBillingScreenOptions }) {
  observed = useBillingScreen(options);

  return null;
}

/** Dựng hook thật trong query client thật, không dựng view. */
function mountHook(options: UseBillingScreenOptions) {
  observed = null;

  return renderWithProviders(<Probe options={options} />);
}

/** View model mới nhất, hoặc một lỗi đọc được thay cho `null` lặng lẽ. */
function vm(): BillingScreenViewModel {
  if (observed === null) throw new Error('hook chưa chạy lần nào');

  return observed;
}

/** Hạt giống cảnh của `billingGateway`, hoặc một lỗi nói rõ tên nào thiếu. */
function seedOf(name: keyof typeof BILLING_SCENARIO_SEEDS): BillingGatewaySeed {
  const seed = BILLING_SCENARIO_SEEDS[name];

  if (seed === undefined) throw new Error(`cổng không có hạt giống "${String(name)}"`);

  return seed;
}

/** Chạy hook tới lúc truy vấn về, chụp view model, rồi gỡ màn. */
async function captureSettled(options: UseBillingScreenOptions): Promise<BillingScreenViewModel> {
  const mounted = mountHook(options);

  await waitFor(() => {
    expect(vm().state).not.toBe('loading');
  });

  const captured = vm();

  mounted.unmount();

  return captured;
}

/** Chụp đúng lượt vẽ đầu, lúc truy vấn còn đang bay — trạng thái 2. */
function captureLoading(options: UseBillingScreenOptions): BillingScreenViewModel {
  const mounted = mountHook(options);
  const captured = vm();

  mounted.unmount();

  return captured;
}

/* -------------------------------------------------------------------------- */
/* i. Bảy trạng thái, đo trên view thuần với view model thật.                   */
/* -------------------------------------------------------------------------- */

const stateViewModels = new Map<SevenState, BillingScreenViewModel>();

beforeAll(async () => {
  signInAs(['admin']);

  stateViewModels.set('loading', captureLoading({}));
  stateViewModels.set('success', await captureSettled({}));
  stateViewModels.set('empty', await captureSettled({ gateway: createBillingGateway(seedOf('emptyInvoices')) }));
  stateViewModels.set('partial', await captureSettled({ gateway: createBillingGateway(seedOf('partialDegraded')) }));
  stateViewModels.set('error', await captureSettled({ gateway: createBillingGateway(seedOf('readFails')) }));
  stateViewModels.set('collapsed', await captureSettled({ forceCollapsed: true }));

  signInAs(['viewer']);
  stateViewModels.set('forbidden', await captureSettled({}));
  signInAs(['admin']);

  cleanup();
  resetBillingStore();
});

/** View model của một trạng thái, hoặc một lỗi nói rõ trạng thái nào thiếu. */
function viewModelOf(state: SevenState): BillingScreenViewModel {
  const captured = stateViewModels.get(state);

  if (captured === undefined) throw new Error(`chưa chụp được view model của "${state}"`);

  return captured;
}

/** Kịch bản chung → props của view. Bộ kịch bản gọi trạng thái 5 là `success`,
 *  hợp đồng mục 4 gọi nó là `ready`; ánh xạ nằm ở đúng một chỗ, ngay đây. */
function propsFor(scenario: SevenStateScenario): BillingScreenViewModel {
  return viewModelOf(scenario.state);
}

describe('A11 — bảy trạng thái, đo trên cả màn', () => {
  it('dựng đủ bảy, không trạng thái nào ra màn trắng', () => {
    const covered: string[] = [];

    expectSevenStates((scenario) => {
      covered.push(scenario.label);

      return render(<BillingScreen {...propsFor(scenario)} />);
    }, createSevenStateScenarios());

    console.log(
      `[T7] expectSevenStates = ${String(covered.length)}/${String(SEVEN_STATES.length)} — ${covered.join(', ')}`,
    );

    expect(covered).toHaveLength(SEVEN_STATES.length);
  });

  it('mỗi trạng thái vẽ ra thứ riêng của nó, không phải bảy lần cùng một trang', () => {
    const byState = new Map<string, string>();

    for (const scenario of createSevenStateScenarios()) {
      const { container, unmount } = render(<BillingScreen {...propsFor(scenario)} />);

      byState.set(scenario.state, container.innerHTML);
      unmount();
    }

    for (const state of ['empty', 'loading', 'partial', 'error', 'forbidden', 'collapsed']) {
      expect(byState.get(state)).not.toEqual(byState.get('success'));
    }
  });

  it('trạng thái 1 nói "chưa có hoá đơn nào", và ba khối trên vẫn còn', () => {
    render(<BillingScreen {...viewModelOf('empty')} />);

    expect(screen.getByText('Chưa có hoá đơn nào')).toBeInTheDocument();
    // "Gói hiện tại" hiện hai chỗ: chữ dẫn của khối 1, và nhãn nút của thẻ gói đang dùng.
    expect(screen.getAllByText('Gói hiện tại').length).toBeGreaterThan(0);
    expect(screen.getByText('So sánh gói')).toBeInTheDocument();
    expect(screen.getByText('Ước tính')).toBeInTheDocument();
  });

  it('trạng thái 3 đặt dải cảnh báo trong đúng khối của nó', () => {
    const partial = viewModelOf('partial');

    expect(partial.degraded.map((notice) => notice.block)).toEqual(['quota', 'invoices']);

    render(<BillingScreen {...partial} />);

    expect(screen.getByText('Đang tính lại hạn mức.')).toBeInTheDocument();
    expect(screen.getByText('Không lấy được lịch sử hoá đơn.')).toBeInTheDocument();
  });

  it('trạng thái 4 nêu lý do, in mã lỗi, và mời thử lại', () => {
    const failed = viewModelOf('error');

    render(<BillingScreen {...failed} />);

    expect(failed.error).not.toBeNull();
    expect(screen.getByText(failed.error?.code ?? '')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('trạng thái 7 chỉ còn tên gói, mức đã dùng và thanh hạn mức', () => {
    const collapsed = viewModelOf('collapsed');

    render(<BillingScreen {...collapsed} />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('So sánh gói')).not.toBeInTheDocument();
    expect(screen.queryByText('Hoá đơn')).not.toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* ii. Tiếng Việt, khả năng tiếp cận, và màu.                                  */
/* -------------------------------------------------------------------------- */

describe('cả màn: tiếng Việt có dấu, tiếp cận được, không mã màu thô', () => {
  it('expectVietnamese và expectAccessible chạy trên cây render của trạng thái đầy đủ', () => {
    const { container } = render(<BillingScreen {...viewModelOf('success')} />);

    // Tên sản phẩm là tên riêng; mã hoá đơn (`HD-2026-08`) là ngoại lệ chữ hoa
    // mà A6 mở sẵn cho mã — cả hai không phải câu chữ của giao diện.
    // Tên sản phẩm là tên riêng; mã hoá đơn là ngoại lệ chữ hoa A6 mở cho mã; còn
    // "Trang sau" là câu của hợp đồng mục 5 — tiếng Việt đúng chính tả, chỉ tình cờ
    // không âm tiết nào mang dấu, đúng điểm mù `expectVietnamese` tự khai ở đầu file
    // của nó. Ba ngoại lệ, cả ba nêu tên, không cái nào là một luật bị nới.
    expectVietnamese(container, {
      allowWords: ['AppFront'],
      ignore: [/HD-\d{4}-\d{2}/u, 'Trang sau'],
    });
    // **Nợ A-12b — nợ CỦA REPO, không phải của màn `/billing`.**
    // `Table.Row` (`src/components/ui/Table.tsx:84`) đặt `outline-none` kèm
    // `tabIndex={-1}` mà không vẽ viền tiêu điểm thay thế. Đó là component DÙNG
    // CHUNG của cả repo; màn này chỉ tình cờ là màn đầu tiên chạy
    // `expectAccessible` trên một cây có `<Table>` nên nó lộ ra ở đây, và
    // `src/components/**` là thư mục màn này không được sửa (hợp đồng mục 8).
    // Bỏ qua ĐÚNG các thẻ `<tr>` ấy, không bỏ qua thứ gì bên trong chúng:
    // `ignoreSelector` chỉ loại chính phần tử khớp (`expectAccessible.ts:798-806`),
    // nên mọi nút tải PDF trong bảng vẫn được soát.
    // Cách trả nợ: thêm `focus-visible:ring-2 focus-visible:ring-offset-2` vào
    // `rowClassName` của `Table.tsx:84`, rồi xoá đúng dòng `ignoreSelector` này.
    expectAccessible(container, { ignoreSelector: 'tbody > tr' });
  });

  it('không một mã màu thô nào trong cả thư mục màn', () => {
    expect(() => {
      expectNoRawColor('src/screens/billing/BillingScreen');
    }).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* iii. Năm chuỗi nghiệm thu của hợp đồng mục 3.1.                             */
/* -------------------------------------------------------------------------- */

describe('định dạng — năm chuỗi nghiệm thu, in ra nguyên văn', () => {
  it('cả năm ra đúng chuỗi hợp đồng ghi', () => {
    const cases: readonly (readonly [string, string, string])[] = [
      ['formatArea(2480)', formatArea(2480), '2.480,00 m²'],
      ['formatMoney(1240000)', formatMoney(1_240_000), '1.240.000 ₫'],
      ['formatArea(620, { fractionDigits: 0 })', formatArea(620, { fractionDigits: 0 }), '620 m²'],
      ['formatArea(1842, { fractionDigits: 0 })', formatArea(1842, { fractionDigits: 0 }), '1.842 m²'],
      ['formatMoney(200000)', formatMoney(200_000), '200.000 ₫'],
    ];

    for (const [call, actual, expected] of cases) {
      console.log(`[T7] ${call} = "${actual}" (hợp đồng: "${expected}")`);
      expect(actual).toBe(expected);
    }

    expect(cases).toHaveLength(5);
  });
});

/* -------------------------------------------------------------------------- */
/* iv. Hạn mức qua ngưỡng — cảnh 4380/5000.                                    */
/* -------------------------------------------------------------------------- */

describe('hạn mức gần đầy đổi sang thang cần chú ý', () => {
  it('4380/5000: sắc thái đổi, và dải cảnh báo nói còn bao nhiêu', async () => {
    const near = await captureSettled({ gateway: createBillingGateway(seedOf('quotaNearLimit')) });

    expect(near.plan?.tone).toBe('attention');
    expect(near.quotaAlert?.message).toBe('Sắp hết hạn mức. Còn 620 m².');

    console.log(
      `[T7] hạn mức 4380/5000 → tone="${String(near.plan?.tone)}" · cảnh báo="${String(near.quotaAlert?.message)}"`,
    );

    render(<BillingScreen {...near} />);

    expect(screen.getByText('Sắp hết hạn mức. Còn 620 m².')).toBeInTheDocument();
  });

  it('hạn mức mặc định 1842/5000 thì không có cảnh báo nào', () => {
    const ready = viewModelOf('success');

    expect(ready.plan?.tone).toBe('normal');
    expect(ready.quotaAlert).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* v. Đổi kỳ thanh toán — giá CHẠY, không NHẢY.                                */
/* -------------------------------------------------------------------------- */

/** Bộ giả `useCountUp` cần: `performance` và `requestAnimationFrame` — xem đầu file. */
function installCountUpClock(): void {
  vi.useFakeTimers({
    now: FAKE_CLOCK_START,
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'Date',
      'performance',
      'requestAnimationFrame',
      'cancelAnimationFrame',
    ],
  });
}

/**
 * Một khung hình của jsdom, và số khung một lượt chạy số cần.
 *
 * Đồng hồ phải nhích **từng khung**, không nhảy một phát 260 ms: bộ lập lịch của
 * React chạy trên `MessageChannel`, thứ đồng hồ giả không giả và cũng không quay
 * vòng trong lúc `advanceTimersByTimeAsync` chạy. Nhảy một phát thì mọi khung
 * hình rơi hết TRƯỚC khi React kịp vẽ dữ liệu vừa về, hiệu ứng chạy số mới bắt
 * đầu lúc đồng hồ đã đứng, và số nằm im ở 0 — một bài kiểm xanh mà không khẳng
 * định gì. Mỗi lượt `act` là một vòng sự kiện thật, đó là chỗ React vẽ.
 */
const FRAME_MS = 16;
const RUN_FRAMES = Math.ceil(durationMs('standard') / FRAME_MS) * 2;

/** Nhích đồng hồ đúng `count` khung hình, mỗi khung một lượt vẽ của React. */
async function runFrames(count: number): Promise<void> {
  for (let frame = 0; frame < count; frame += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FRAME_MS);
    });
  }
}

/** "1.240.000 ₫" → 1240000. Chỉ đọc chữ số, không đọc dấu nhóm hay hậu tố. */
function amountOf(priceLabel: string): number {
  return Number(priceLabel.replace(/\D/gu, ''));
}

describe('đổi kỳ thanh toán làm giá chạy số, không nhảy', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('giá đi qua ít nhất một giá trị trung gian giữa giá cũ và giá mới', async () => {
    installCountUpClock();

    const mounted = mountHook({ gateway: createBillingGateway() });

    // Truy vấn về, rồi lượt chạy số đầu tiên (0 → giá tháng) chạy xong hẳn.
    await runFrames(RUN_FRAMES);

    const monthlyLabel = vm().plans[0]?.priceLabel ?? '';
    const monthlyAmount = amountOf(monthlyLabel);

    expect(monthlyAmount).toBeGreaterThan(0);

    act(() => {
      vm().onPeriodChange('yearly');
    });

    const observedAmounts: number[] = [];

    for (let frame = 0; frame < RUN_FRAMES; frame += 1) {
      await runFrames(1);
      observedAmounts.push(amountOf(vm().plans[0]?.priceLabel ?? ''));
    }

    const yearlyLabel = vm().plans[0]?.priceLabel ?? '';
    const yearlyAmount = amountOf(yearlyLabel);

    expect(yearlyAmount).toBeGreaterThan(monthlyAmount);

    const intermediates = observedAmounts.filter(
      (amount) => amount > monthlyAmount && amount < yearlyAmount,
    );

    console.log(
      `[T7] chạy số: "${monthlyLabel}" → "${yearlyLabel}" · ${String(intermediates.length)} giá trị trung gian, ví dụ ${intermediates
        .slice(0, 3)
        .map((amount) => formatMoney(amount))
        .join(' · ')}`,
    );

    expect(intermediates.length).toBeGreaterThan(0);

    mounted.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* vi. Vai Kỹ sư và vai Người xem — chế độ đọc.                                */
/* -------------------------------------------------------------------------- */

describe('vai không đổi được gói thì cả màn ở chế độ đọc', () => {
  it.each([['engineer'], ['viewer']] as const)('vai %s: trạng thái 6, và nói ra vì sao', async (role) => {
    signInAs([role]);

    const readOnly = await captureSettled({});

    expect(readOnly.state).toBe('forbidden');
    expect(readOnly.isReadOnly).toBe(true);
    expect(readOnly.readOnlyNotice).toBe('Chỉ quản trị viên có thể thay đổi gói.');
    expect(readOnly.plan?.canChangePlan).toBe(false);
    expect(readOnly.plans.every((plan) => plan.isActionDisabled)).toBe(true);

    render(<BillingScreen {...readOnly} />);

    expect(screen.getByText('Chỉ quản trị viên có thể thay đổi gói.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đổi gói' })).toBeDisabled();
  });

  it('vai người xem bấm chọn gói cũng không thành một lượt gọi máy chủ', async () => {
    signInAs(['viewer']);

    const gateway = spyGateway();
    const readOnly = await captureSettled({ gateway });

    act(() => {
      readOnly.plans[1]?.onSelect();
    });

    expect(gateway.quoteChangePlan).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* vii. Nâng gói — A9: hỏi trước, có số tiền, rồi mới chốt.                    */
/* -------------------------------------------------------------------------- */

interface SpyGateway extends BillingGateway {
  readonly quoteChangePlan: ReturnType<typeof vi.fn>;
  readonly confirmChangePlan: ReturnType<typeof vi.fn>;
  readonly downloadInvoice: ReturnType<typeof vi.fn>;
}

/** Cổng thật, mỗi lượt gọi đếm được — không thay hành vi, chỉ ghi lại. */
function spyGateway(seed: BillingGatewaySeed = {}): SpyGateway {
  const real = createBillingGateway(seed);

  return {
    read: real.read,
    quoteChangePlan: vi.fn(real.quoteChangePlan),
    confirmChangePlan: vi.fn(real.confirmChangePlan),
    downloadInvoice: vi.fn(real.downloadInvoice),
  };
}

describe('nâng gói hỏi trước bằng bảng tóm tắt có số tiền (A9)', () => {
  it('bảng tóm tắt hiện ra TRƯỚC khi lệnh đổi gói đi', async () => {
    const gateway = spyGateway();

    renderWithProviders(<BillingScreenContainer gateway={gateway} />);

    const upgrade = await screen.findAllByRole('button', { name: 'Nâng gói' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(upgrade[0] as HTMLElement);

    const dialog = await screen.findByRole('dialog');

    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Xác nhận nâng gói')).toBeInTheDocument();
    expect(screen.getByText('Gói mới')).toBeInTheDocument();
    expect(screen.getByText('Phần còn lại của chu kỳ')).toBeInTheDocument();
    expect(screen.getByText('Thanh toán ngay')).toBeInTheDocument();

    // Số tiền chia theo tỷ lệ, lấy thẳng từ báo giá cổng vừa trả.
    const quote = await (gateway.quoteChangePlan.mock.results[0]?.value as Promise<{
      readonly dueNowVnd: number;
    }>);

    // Trong ĐÚNG hộp thoại: phần trả trước của một chu kỳ trọn vẹn bằng đúng giá
    // trọn kỳ, nên cùng chuỗi tiền ấy cũng đang nằm trên thẻ gói ở khối 2.
    expect(within(dialog).getByText(formatMoney(quote.dueNowVnd))).toBeInTheDocument();
    expect(gateway.confirmChangePlan).not.toHaveBeenCalled();

    console.log(
      `[T7] nâng gói: bảng tóm tắt hiện trước, thanh toán ngay = "${formatMoney(quote.dueNowVnd)}", confirmChangePlan đã gọi ${String(gateway.confirmChangePlan.mock.calls.length)} lần`,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }));

    await waitFor(() => {
      expect(gateway.confirmChangePlan).not.toHaveBeenCalled();
    });
  });

  it('chốt rồi thì lệnh mới đi, và đi đúng một lần', async () => {
    const gateway = spyGateway();

    const mounted = mountHook({ gateway });

    await waitFor(() => {
      expect(vm().state).not.toBe('loading');
    });

    act(() => {
      vm().plans[1]?.onSelect();
    });

    await waitFor(() => {
      expect(vm().confirm).not.toBeNull();
    });

    expect(gateway.confirmChangePlan).not.toHaveBeenCalled();

    act(() => {
      vm().onConfirmAccept();
    });

    await waitFor(() => {
      expect(gateway.confirmChangePlan).toHaveBeenCalledTimes(1);
    });

    mounted.unmount();
  });

  it('nút "Đổi gói" của khối 1 chỉ báo bước tiếp theo, không tự chọn gói', async () => {
    const gateway = spyGateway();
    const announced: string[] = [];

    const ready = await captureSettled({
      gateway,
      announcer: {
        announce: (message: string) => {
          announced.push(message);
        },
        destroy: () => undefined,
      },
    });

    act(() => {
      ready.onChangePlanRequest();
    });

    expect(announced).toEqual(['Bảng so sánh gói ở ngay bên dưới, chọn một gói để nâng.']);
    expect(gateway.quoteChangePlan).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* viii. Tải hoá đơn — nhánh hỏng (nợ T-11 vẫn là dây thật).                   */
/* -------------------------------------------------------------------------- */

describe('tải hoá đơn', () => {
  it('lượt tải chạy thật, đúng mã hoá đơn của dòng được bấm', async () => {
    const gateway = spyGateway();
    const mounted = mountHook({ gateway });

    await waitFor(() => {
      expect(vm().state).not.toBe('loading');
    });

    const firstRow = vm().invoices[0];

    act(() => {
      firstRow?.onDownload();
    });

    await waitFor(() => {
      expect(gateway.downloadInvoice).toHaveBeenCalledWith(firstRow?.id);
    });

    expect(vm().error).toBeNull();

    mounted.unmount();
  });

  it('lượt tải hỏng thì view model có câu lỗi, mã lỗi và lối thử lại', async () => {
    const gateway = spyGateway({ failDownloadInvoice: true });
    const mounted = mountHook({ gateway });

    await waitFor(() => {
      expect(vm().state).not.toBe('loading');
    });

    act(() => {
      vm().invoices[0]?.onDownload();
    });

    await waitFor(() => {
      expect(vm().error).not.toBeNull();
    });

    const failure = vm().error;

    expect(failure?.retryLabel).toBe('Thử lại');
    expect(failure?.code.length).toBeGreaterThan(0);

    // Thử lại đúng thứ vừa hỏng: lượt tải, không phải cả màn.
    act(() => {
      failure?.onRetry();
    });

    await waitFor(() => {
      expect(gateway.downloadInvoice).toHaveBeenCalledTimes(2);
    });

    console.log(
      `[T7] tải hoá đơn hỏng → mã lỗi "${String(failure?.code)}" · câu lỗi "${String(failure?.message)}"`,
    );

    mounted.unmount();
  });

  it('lượt tải hỏng hiện ra TRÊN MÀN: câu lỗi, mã lỗi, nút thử lại', async () => {
    const gateway = spyGateway({ failDownloadInvoice: true });

    renderWithProviders(<BillingScreenContainer gateway={gateway} />);

    const downloads = await screen.findAllByRole('button', { name: /^Tải hoá đơn .+ dạng PDF$/u });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.click(downloads[0] as HTMLElement);

    const alert = await screen.findByRole('alert');
    const retry = await screen.findByRole('button', { name: 'Thử lại' });

    // Bốn khối vẫn còn nguyên: lệnh hỏng, không phải cả màn hỏng.
    expect(screen.getByText('So sánh gói')).toBeInTheDocument();
    expect(screen.getByText('Hoá đơn')).toBeInTheDocument();

    const message = alert.textContent ?? '';

    expect(message.length).toBeGreaterThan(0);
    expect(gateway.downloadInvoice).toHaveBeenCalledTimes(1);

    // Mã lỗi đứng ngay dưới dải, chữ đều nhỏ — hợp đồng mục 4 trạng thái 4.
    const code = alert.parentElement?.querySelector('.font-mono')?.textContent ?? '';

    expect(code.length).toBeGreaterThan(0);

    console.log(`[T7] dải lỗi trên màn: "${message}" · mã "${code}"`);

    // Thử lại chạy lại ĐÚNG lệnh vừa hỏng, không tải lại cả màn.
    fireEvent.click(retry);

    await waitFor(() => {
      expect(gateway.downloadInvoice).toHaveBeenCalledTimes(2);
    });
  });
});

/* -------------------------------------------------------------------------- */
/* ix. R-73 — container mở được bằng một dòng.                                 */
/* -------------------------------------------------------------------------- */

describe('BillingScreenContainer — mối nối R-73', () => {
  it('mở được bằng một dòng, không router và không tham số đường dẫn', async () => {
    renderWithProviders(<BillingScreenContainer />);

    expect(await screen.findByRole('heading', { name: 'Thanh toán' })).toBeInTheDocument();
    expect(await screen.findByText('So sánh gói')).toBeInTheDocument();
  });

  it('nhận cổng tiêm vào, nên một chủ khác dựng được cảnh của mình', async () => {
    renderWithProviders(
      <BillingScreenContainer gateway={createBillingGateway(seedOf('emptyInvoices'))} />,
    );

    expect(await screen.findByText('Chưa có hoá đơn nào')).toBeInTheDocument();
  });

  it('cổng đọc hỏng thì màn nói ra lý do, không ra màn trắng', async () => {
    renderWithProviders(
      <BillingScreenContainer gateway={createBillingGateway(seedOf('readFails'))} />,
    );

    expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });
});
