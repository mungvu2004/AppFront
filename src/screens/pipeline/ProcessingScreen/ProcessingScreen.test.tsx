/**
 * Lượt kiểm của màn Xử lý.
 *
 * Bốn bộ khẳng định dùng chung (`expectSevenStates`, `expectAccessible`,
 * `expectVietnamese`, `expectNoRawColor`) cộng sáu phép đo của bản nghiệm thu:
 *
 * | mã | đo cái gì | ngưỡng |
 * |---|---|---|
 * | `[NGHIEM-1]` | bảy trạng thái của A11 | 7/7 |
 * | `[NGHIEM-3]` | sáu tên bước nguyên văn khoá `pipeline` của `vi.json` | 6/6, đủ dấu |
 * | `[NGHIEM-4]` | dãy trọng số và hằng nhịp KHÔNG bị chép vào thư mục màn | 0 lần |
 * | `[NGHIEM-C]` | huỷ xác nhận TẠI CHỖ, không một `role="dialog"` nào | 0 hộp thoại |
 * | `[NGHIEM-D]` | `canCancel` sai thì nút huỷ không tồn tại trong cây | ẩn hẳn |
 * | `[NGHIEM-E]` | `prefersReducedMotion` bật thì không lớp `animate-pipeline-sweep` | 0 phần tử |
 * | `[NGHIEM-F]` | nút "Để chạy nền và thông báo cho tôi" đẩy ra một thông báo THẤY ĐƯỢC | 1 thông báo |
 *
 * Hai lớp render, cố ý — cùng khuôn `InputQualityGate.test.tsx`:
 *
 * - **Chỉ props** cho bảy trạng thái và ba bộ soát. {@link ProcessingScreen} là
 *   một hàm của props (mục D), nên bảy trạng thái vẽ được mà không cần mạng.
 *   Dữ liệu đến từ `ProcessingScreen.stories.tsx`, một bộ duy nhất cho cả story
 *   lẫn test: hai bộ song song là hai bộ sẽ lệch nhau (R-70).
 * - **Qua container + cổng dữ liệu giả** cho lối huỷ. Nút huỷ chỉ tồn tại khi
 *   `gateway.supports.cancelProcessing` bật, mà bản cài đặt thật để `false` —
 *   repo chưa có `ENDPOINTS.drawings.cancel`. Cổng giả bật đúng khả năng đó lên
 *   để nhánh "có hỗ trợ" vẫn được kiểm; đó là điều `ProcessingGateway.supports`
 *   được dựng ra để cho phép, không phải một đường vòng.
 *
 * - **Qua hook thật + `NotificationHost` thật** cho `[NGHIEM-F]`. Nút chạy nền
 *   không có gì để nhìn nếu chỉ có view: nó đẩy một thông báo, và thông báo được
 *   vẽ ở một cây khác. Lượt render đó dựng cả hai mảnh, và tiêm bus riêng.
 *
 * Nửa "suy nghĩ" — SSE chết giữa chừng, tab ẩn, một tầng lỗi không dừng tầng
 * khác, rời màn rồi quay lại, và lượt chạy nền xong SAU khi màn đã tháo — nằm ở
 * `useProcessingScreen.test.ts` và không lặp lại ở đây.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationHost } from '@/components/feedback/NotificationHost';
import { createMockApiClient } from '@/api/__mocks__/client';
import viMessages from '@/i18n/vi.json';
import { createNotificationBus, type NotificationBus } from '@/lib/mutations/notificationBus';
import {
  createBackgroundWatchRegistry,
  type BackgroundWatchRegistry,
} from '@/lib/realtime/backgroundWatch';
import { PIPELINE_STAGES } from '@/lib/realtime/pipeline';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';
import {
  SEVEN_STATES,
  SEVEN_STATE_LABELS,
  type SevenStateScenario,
} from '@/lib/testing/sevenStateScenarios';

import { ProcessingScreen } from './ProcessingScreen';
import { ProcessingScreenContainer } from './ProcessingScreen.container';
import {
  cancelConfirmingScenario,
  PIPELINE_STEP_NAMES,
  reducedMotionScenario,
  RUNNING_FLOORS,
  scenarioFor,
} from './ProcessingScreen.stories';
import { createProcessingGateway, type ProcessingGateway } from './processingGateway';
import { useProcessingScreen } from './useProcessingScreen';

const SCREEN_DIRECTORY = 'src/screens/pipeline/ProcessingScreen';
const PROJECT_ID = 'project-1';

/** Nhãn của hàng hành động — hằng chuỗi thật của `ProcessingScreen.tsx`. */
const CANCEL_LABEL = 'Huỷ xử lý';
const RUN_IN_BACKGROUND_LABEL = 'Để chạy nền và thông báo cho tôi';
const CANCEL_CONFIRM_LABEL = 'Xác nhận huỷ';
const CANCEL_DISMISS_LABEL = 'Giữ nguyên';

/** Lớp vạch quét. `[NGHIEM-E]` đếm số phần tử mang nó, nên nó phải viết đúng. */
const SWEEP_CLASS_SELECTOR = '.animate-pipeline-sweep';

/**
 * `Panel` là từ mượn, đã có mặt trong `vi.json` khoá `processingScreen` — nó là
 * chữ đầu câu `"Panel sẽ hiện bản vẽ ngay khi có tầng bắt đầu xử lý."` mà V6
 * viết cho trạng thái chưa có tầng nào. Ghi tên ở đây để nó là một quyết định
 * đọc được, không phải một chữ tiếng Anh lọt lưới.
 */
const ALLOWED_WORDS = ['panel'];

/**
 * Mã lỗi máy đọc — A6 cho phép chữ hoa ở đúng chỗ này, và chỉ ở đây.
 *
 * `PIPELINE_STAGE_FAILED` (mã của một bước hỏng) và `NETWORK` (mã kỹ thuật của
 * `describeError`) là chuỗi cho máy, không phải câu cho người: cả hai lần đều
 * đứng CẠNH một câu tiếng Việt nói rõ hậu quả, không bao giờ đứng một mình.
 * Bỏ qua theo hình dạng — CHỮ_HOA_CÓ_GẠCH_DƯỚI trọn chuỗi — chứ không liệt kê
 * từng từ, để `pipeline`/`failed`/`network` không lọt vào từ vựng được duyệt và
 * mở đường cho tiếng Anh thật ở chỗ khác.
 */
const MACHINE_ERROR_CODE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

/**
 * Một lượt xử lý đang chạy, để `onConfirmCancel` có cái để huỷ.
 *
 * Hook huỷ theo TỪNG lượt (`uploads.forEach`), nên danh sách rỗng nghĩa là
 * không lời gọi nào — đúng và trung thực, nhưng không kiểm được gì.
 */
const ONE_UPLOAD = [{ floorId: 'L1', floorName: 'Tầng 1', uploadId: 'upload-1' }] as const;

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

/** jsdom không có `EventSource`; cổng nhận bản tiêm, nên test không phải vá `globalThis`. */
class MockEventSource {
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;

  close(): void {
    /* Không có gì để đóng: test này không đẩy nhịp tiến độ nào qua kênh. */
  }
}

/** Mảng thứ hai của `expectSevenStates` chỉ để thoả kiểu; props thật đến từ `scenarioFor`. */
function scenarioIndex(): readonly SevenStateScenario[] {
  return SEVEN_STATES.map((state) => ({
    state,
    label: SEVEN_STATE_LABELS[state],
    rows: [],
    totalCount: RUNNING_FLOORS.length,
    isLoading: state === 'loading',
    isCollapsed: state === 'collapsed',
    canView: state !== 'forbidden',
    error: null,
  }));
}

/**
 * Cổng giả: bản THẬT dựng trên `createMockApiClient()`, chỉ bật thêm khả năng
 * huỷ.
 *
 * Không viết một cổng thứ hai từ đầu — làm vậy là dựng ý niệm thứ hai về hình
 * dạng câu trả lời, đúng thứ R-70 cấm. Chỉ đúng hai chỗ đổi: `supports.cancelProcessing`
 * và `requestCancel`, tức đúng cái endpoint repo còn thiếu.
 */
function gatewayWithCancel(onCancel: () => void): ProcessingGateway {
  const real = createProcessingGateway(createMockApiClient(), {
    EventSourceImpl: MockEventSource as unknown as typeof EventSource,
  });

  return {
    ...real,
    supports: { ...real.supports, cancelProcessing: true },
    requestCancel: async () => {
      onCancel();
      return { supported: true, value: undefined };
    },
  };
}

/** jsdom không có `matchMedia`; `matches: false` là khung rộng, không giảm chuyển động. */
beforeEach(() => {
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
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-1] Bảy trạng thái (A11, R-63).                                      */
/* -------------------------------------------------------------------------- */

describe('ProcessingScreen — bảy trạng thái (A11, R-63)', () => {
  it('vẽ đủ bảy trạng thái, không lần nào ném lỗi và không lần nào ra màn trắng', () => {
    let rendered = 0;

    expectSevenStates((scenario) => {
      const { container, unmount } = renderWithProviders(
        <ProcessingScreen {...scenarioFor(scenario.state)} />,
      );
      rendered += 1;
      return { container, unmount };
    }, scenarioIndex());

    expect(rendered).toBe(SEVEN_STATES.length);
    expect(rendered).toBe(7);
  });

  it('trạng thái một phần nói rõ xử lý VẪN tiếp tục, và dãy chip mang tầng lỗi', () => {
    const partial = scenarioFor('partial');

    renderWithProviders(<ProcessingScreen {...partial} />);

    expect(partial.floors.filter((floor) => floor.status === 'failed')).toHaveLength(1);
    expect(partial.floors.filter((floor) => floor.status === 'running').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Tầng 2 gặp lỗi. Các tầng còn lại vẫn đang được xử lý.'),
    ).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* Khả năng tiếp cận, tiếng Việt, màu (R-72).                                   */
/* -------------------------------------------------------------------------- */

describe('ProcessingScreen — khả năng tiếp cận, tiếng Việt, màu (R-72)', () => {
  it('đi qua expectAccessible ở trạng thái đầy đủ nhất', () => {
    const { container } = renderWithProviders(<ProcessingScreen {...scenarioFor('success')} />);

    expectAccessible(container);
  });

  it('đi qua expectAccessible ở trạng thái một phần, nơi có cả lỗi lẫn tiến độ', () => {
    const { container } = renderWithProviders(<ProcessingScreen {...scenarioFor('partial')} />);

    expectAccessible(container);
  });

  it('mọi chuỗi hiển thị là tiếng Việt có dấu', () => {
    const { container } = renderWithProviders(<ProcessingScreen {...scenarioFor('success')} />);

    expectVietnamese(container, { allowWords: ALLOWED_WORDS, ignore: [MACHINE_ERROR_CODE] });
  });

  it('mọi chuỗi hiển thị của trạng thái lỗi cũng là tiếng Việt có dấu', () => {
    const { container } = renderWithProviders(<ProcessingScreen {...scenarioFor('error')} />);

    expectVietnamese(container, { allowWords: ALLOWED_WORDS, ignore: [MACHINE_ERROR_CODE] });
  });

  it('không mã màu thô trong bất kỳ file nào của thư mục màn (A1)', () => {
    for (const file of readdirSync(SCREEN_DIRECTORY)) {
      expectNoRawColor(`${SCREEN_DIRECTORY}/${file}`);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-3] Sáu tên bước, nguyên văn.                                        */
/* -------------------------------------------------------------------------- */

describe('ProcessingScreen — sáu tên bước [NGHIEM-3]', () => {
  it('hiện đúng sáu chuỗi của khoá `pipeline` trong vi.json, không viết tắt', () => {
    const expected = Object.values(viMessages.pipeline);

    expect(expected).toHaveLength(6);
    expect(PIPELINE_STEP_NAMES).toEqual(expected);

    renderWithProviders(<ProcessingScreen {...scenarioFor('success')} />);

    for (const name of expected) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-4] Hằng của tầng lib không được chép sang thư mục màn.               */
/* -------------------------------------------------------------------------- */

describe('ProcessingScreen — không chép hằng của tầng lib [NGHIEM-4]', () => {
  it('không file nào trong thư mục màn chép lại dãy trọng số hay hằng nhịp giả', () => {
    // Hai mẫu dựng TỪ DỮ LIỆU, không gõ tay: gõ tay thì chính file test này
    // thành file vi phạm đầu tiên, và phép kiểm tự bắn vào chân mình.
    const weightSequence = new RegExp(
      PIPELINE_STAGES.map((stage) => String(stage.weight)).join('\\s*,\\s*'),
    );
    const fakeTickMs = new RegExp(`\\b${String(25 * 100)}\\b`);
    const offenders: string[] = [];

    for (const file of readdirSync(SCREEN_DIRECTORY)) {
      const source = readFileSync(`${SCREEN_DIRECTORY}/${file}`, 'utf8');

      if (weightSequence.test(source) || fakeTickMs.test(source)) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-C] Huỷ xác nhận tại chỗ — không hộp thoại chặn.                      */
/* -------------------------------------------------------------------------- */

describe('ProcessingScreen — huỷ xử lý [NGHIEM-C]', () => {
  it('không trạng thái nào dựng ra phần tử role="dialog" hay aria-modal', () => {
    for (const state of SEVEN_STATES) {
      const { container, unmount } = renderWithProviders(
        <ProcessingScreen {...scenarioFor(state)} />,
      );

      expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(0);
      expect(container.querySelectorAll('[role="alertdialog"]')).toHaveLength(0);
      expect(container.querySelectorAll('[aria-modal]')).toHaveLength(0);
      unmount();
    }
  });

  it('lớp xác nhận đang mở vẫn không phải hộp thoại, và có cả lối rút lui', () => {
    const { container } = renderWithProviders(
      <ProcessingScreen {...cancelConfirmingScenario()} />,
    );

    expect(screen.getByRole('button', { name: CANCEL_CONFIRM_LABEL })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: CANCEL_DISMISS_LABEL })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: CANCEL_LABEL })).not.toBeInTheDocument();
    expect(container.querySelectorAll('[role="dialog"], [aria-modal]')).toHaveLength(0);
  });

  it('bấm huỷ qua container thật ra xác nhận TẠI CHỖ, không mở hộp thoại nào', () => {
    let cancelled = 0;
    const gateway = gatewayWithCancel(() => {
      cancelled += 1;
    });

    const { container } = renderWithProviders(
      <ProcessingScreenContainer
        floorUploads={ONE_UPLOAD}
        gateway={gateway}
        projectId={PROJECT_ID}
        roles={['engineer']}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: CANCEL_LABEL }));

    expect(screen.getByRole('button', { name: CANCEL_CONFIRM_LABEL })).toBeInTheDocument();
    expect(container.querySelectorAll('[role="dialog"], [aria-modal]')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: CANCEL_CONFIRM_LABEL }));

    expect(cancelled).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-D] canCancel sai thì nút huỷ không tồn tại.                          */
/* -------------------------------------------------------------------------- */

describe('ProcessingScreen — quyền huỷ [NGHIEM-D]', () => {
  it('canCancel sai thì nút huỷ KHÔNG có trong cây, không phải khoá mờ', () => {
    const { container } = renderWithProviders(<ProcessingScreen {...scenarioFor('forbidden')} />);

    expect(screen.queryByRole('button', { name: CANCEL_LABEL })).not.toBeInTheDocument();
    expect(container.querySelectorAll('button[disabled]')).toHaveLength(0);
  });

  it('canCancel đúng thì nút huỷ có mặt và bấm được', () => {
    const requested = vi.fn();

    renderWithProviders(
      <ProcessingScreen {...scenarioFor('partial')} onRequestCancel={requested} />,
    );

    fireEvent.click(screen.getByRole('button', { name: CANCEL_LABEL }));

    expect(requested).toHaveBeenCalledTimes(1);
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-E] Chuyển động rút gọn.                                             */
/* -------------------------------------------------------------------------- */

describe('ProcessingScreen — chuyển động rút gọn [NGHIEM-E]', () => {
  it('prefersReducedMotion bật thì không phần tử nào mang lớp animate-pipeline-sweep', () => {
    const { container } = renderWithProviders(<ProcessingScreen {...reducedMotionScenario()} />);

    expect(container.querySelectorAll(SWEEP_CLASS_SELECTOR)).toHaveLength(0);
  });

  it('prefersReducedMotion tắt thì vạch quét có mặt — phép kiểm trên đo được thứ thật', () => {
    const { container } = renderWithProviders(<ProcessingScreen {...scenarioFor('partial')} />);

    expect(container.querySelectorAll(SWEEP_CLASS_SELECTOR).length).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/* R-73 — mở được màn này từ một màn khác bằng một dòng.                        */
/* -------------------------------------------------------------------------- */

describe('ProcessingScreenContainer — R-73', () => {
  it('nhận đủ mọi thứ qua props và dựng ra màn không trắng', () => {
    const { container } = renderWithProviders(
      <ProcessingScreenContainer
        floorUploads={[]}
        gateway={gatewayWithCancel(() => undefined)}
        onGoToSupport={() => undefined}
        onNavigate={() => undefined}
        projectId={PROJECT_ID}
        roles={['engineer']}
      />,
    );

    expect(container.textContent?.trim()).not.toBe('');
    expect(screen.getByText('Xử lý')).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* Nút "Để chạy nền và thông báo cho tôi" — nó phải LÀM được một việc.          */
/* -------------------------------------------------------------------------- */

/**
 * Hook + view + chỗ hiện thông báo, dựng ngay tại test.
 *
 * Không dùng `ProcessingScreenContainer` ở đây, vì container không có khe tiêm
 * bus thông báo (và mở một khe như vậy chỉ để test nhìn được là đổi hình dạng
 * sản phẩm cho tiện lợi của test). Cả ba mảnh dưới đây là mảnh THẬT — cùng hook,
 * cùng view, cùng `NotificationHost` mà `src/main.tsx` gắn — chỉ có bus và sổ
 * theo dõi nền là bản cách ly, để lượt kiểm này không thấy thông báo của lượt
 * kiểm khác.
 */
function WiredWithNotifications({
  backgroundWatches,
  notifications,
}: {
  backgroundWatches: BackgroundWatchRegistry;
  notifications: NotificationBus;
}) {
  const gateway = createProcessingGateway(createMockApiClient(), {
    EventSourceImpl: MockEventSource as unknown as typeof EventSource,
    backgroundWatches,
  });

  const props = useProcessingScreen({
    projectId: PROJECT_ID,
    floorUploads: ONE_UPLOAD,
    gateway,
    notifications,
    roles: ['engineer'],
  });

  return (
    <>
      <ProcessingScreen {...props} />
      <NotificationHost bus={notifications} />
    </>
  );
}

describe('ProcessingScreen — nút chạy nền', () => {
  it('bấm "Để chạy nền và thông báo cho tôi": thông báo HIỆN RA, và lượt vào sổ theo dõi nền', async () => {
    const backgroundWatches = createBackgroundWatchRegistry();
    const notifications = createNotificationBus();

    renderWithProviders(
      <WiredWithNotifications
        backgroundWatches={backgroundWatches}
        notifications={notifications}
      />,
    );

    expect(screen.queryByText(/Sẽ báo cho bạn khi xử lý xong/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: RUN_IN_BACKGROUND_LABEL }));

    // Câu người dùng đọc, đúng nguyên văn, và nó nói luôn ranh giới thật: đóng
    // thẻ trình duyệt là hết.
    const notice = await screen.findByText(/Sẽ báo cho bạn khi xử lý xong/);

    expect(notice).toBeInTheDocument();
    expect(notice.textContent).toContain('Đóng thẻ trình duyệt thì không báo được nữa.');

    // Và trình đọc màn hình đọc được nó (R-72).
    expect(notice.closest('[role="status"]')).not.toBeNull();
    expect(screen.getByRole('region', { name: 'Thông báo' })).toBeInTheDocument();

    expect(backgroundWatches.has(`${PROJECT_ID}:${ONE_UPLOAD[0].uploadId}`)).toBe(true);

    backgroundWatches.releaseAll();
  });
});
