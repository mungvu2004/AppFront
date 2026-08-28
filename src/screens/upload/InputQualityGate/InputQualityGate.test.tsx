/**
 * Lượt kiểm của màn Cổng chất lượng đầu vào.
 *
 * Bốn bộ khẳng định dùng chung (`expectSevenStates`, `expectAccessible`,
 * `expectVietnamese`, `expectNoRawColor`) cộng bốn phép đo của bản nghiệm thu:
 *
 * | mã | đo cái gì | ngưỡng |
 * |---|---|---|
 * | `[NGHIEM-A]` | bảy trạng thái của A11 | 7/7 |
 * | `[NGHIEM-E]` | cổng xác nhận khi có chỉ số mức Kém | chặn → tích ô → qua |
 * | `[NGHIEM-F]` | liên kết hai chiều thẻ phát hiện ↔ vùng ảnh | đúng 1 vùng sáng |
 * | `[NGHIEM-G]` | ArrowLeft/ArrowRight đổi tầng đang xem | đúng 1 tầng đang xem |
 *
 * Hai lớp render, cố ý:
 *
 * - **Chỉ props** cho bảy trạng thái và ba bộ soát — `InputQualityGateView` là
 *   một hàm của props (mục D), nên bảy trạng thái vẽ được mà không cần mạng.
 *   Dữ liệu đến từ `InputQualityGate.stories.tsx`, một bộ duy nhất cho cả story
 *   lẫn test: hai bộ song song là hai bộ sẽ lệch nhau (R-70).
 * - **Qua container + cổng dữ liệu giả** cho bốn tiêu chí tương tác. Cổng xác
 *   nhận, liên kết hai chiều, phím mũi tên và toast hoàn tác đều là hành vi của
 *   hook; chứng minh chúng bằng cách gọi thẳng hook thì chứng minh chưa xong —
 *   phải bấm được trên giao diện thì mới là thứ người dùng có.
 *
 * `expectNoRawColor` quét **cả thư mục** màn, không một file, vì A1 nói về tầng
 * giao diện chứ không về một file cụ thể.
 */

import { readdirSync } from 'node:fs';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockApiClient } from '@/api/__mocks__/client';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { installFakeClock, type FakeClock } from '@/lib/testing/fakeClock';
import { renderWithProviders } from '@/lib/testing/render';
import {
  SEVEN_STATES,
  SEVEN_STATE_LABELS,
  type SevenStateScenario,
} from '@/lib/testing/sevenStateScenarios';

import { InputQualityGateView } from './InputQualityGate';
import { InputQualityGateContainer } from './InputQualityGate.container';
import {
  acknowledgedScenario,
  highlightedScenario,
  regionIdOf,
  SAMPLE_FINDINGS,
  SAMPLE_FLOORS,
  scenarioFor,
} from './InputQualityGate.stories';
import { createInputQualityGateway } from './inputQualityGateway';
import type { InputQualityToast } from './useInputQualityGate';

const SCREEN_DIRECTORY = 'src/screens/upload/InputQualityGate';
const PROJECT_ID = 'project-1';

/**
 * Một nhịp nhỏ để react-query đi hết vòng promise của nó.
 *
 * Cùng con số và cùng lý do như `FloorUploadScreen.test.tsx`: lượt đọc danh
 * sách tầng cộng lượt đọc kết quả đo là hai lượt nối tiếp, mỗi lượt vài vòng
 * microtask cộng một nhịp hẹn giờ — vét microtask một lần là chưa đủ.
 */
const SETTLE_STEP_MS = 10;

/**
 * `px` là đơn vị, không phải chữ tiếng Anh sót lại.
 *
 * Nó có mặt trong câu khuyến nghị độ phân giải và trong câu hậu quả của phát
 * hiện `RESOLUTION_TOO_LOW`, cả hai đều do hook ghép từ số đo thật.
 */
const UNIT_WORDS = ['px'];

/**
 * **Nợ A-6b — nợ CỦA REPO, không phải của màn Cổng chất lượng đầu vào.**
 *
 * `ZoomCluster` (`src/components/canvas/ZoomCluster.tsx:48` và `:71`) viết
 * `aria-label="Điều khiển zoom"` và `aria-label="Zoom hiện tại 100%…"` — hai
 * chữ tiếng Anh THẬT trong một component DÙNG CHUNG. Ba dòng dưới đây là chỗ
 * ghi nợ, **không** phải chỗ chấp nhận nó. `src/components/**` là thư mục màn
 * này không được sửa (R-68), và `InputQualityGateImagePanel` chỉ tình cờ là màn
 * đầu tiên chạy `expectVietnamese` trên một cây có `<ZoomCluster>` nên nợ lộ ra
 * ở đây. Cùng khuôn ghi nợ với `BillingScreen.test.tsx:317-328`.
 *
 * `to` là chuyện khác: `"Phóng to"` là tiếng Việt đúng, `expectVietnamese` chấm
 * nhầm nó thành từ tiếng Anh còn sót — một dương tính giả, không phải một lỗi.
 *
 * Cách trả nợ: đổi `ZoomCluster.tsx:48` thành `"Điều khiển thu phóng"` và
 * `:71` thành `"Mức thu phóng hiện tại…"`, rồi xoá đúng ba từ dưới đây.
 */
const SHARED_COMPONENT_DEBT_WORDS = ['zoom', 'to'];

/** Mọi từ được cho qua khi soát tiếng Việt — đơn vị thật, cộng nợ đã nêu tên. */
const ALLOWED_WORDS = [...UNIT_WORDS, ...SHARED_COMPONENT_DEBT_WORDS];

/**
 * **Nợ A-12b — nợ CỦA REPO, không phải của màn Cổng chất lượng đầu vào.**
 *
 * `Table.Row` (`src/components/ui/Table.tsx:84`) đặt `outline-none` kèm
 * `tabIndex={-1}` và chỉ vẽ viền tiêu điểm khi prop `focused` bật — viền vẽ
 * theo TRẠNG THÁI chứ không theo `:focus-visible`, nên bàn phím không có viền
 * nào. `BillingScreen.test.tsx:317-328` đã ghi đúng nợ này và bỏ qua
 * `'tbody > tr'`.
 *
 * Màn này cần thêm `'thead > tr'`: bảng bốn tầng có hàng tiêu đề, và
 * `Table.Header` cũng dựng bằng `Table.Row` nên hàng ấy dính cùng một
 * `rowClassName`. Nêu đích danh hai chỗ thay vì bỏ qua trơn `'tr'`, để một
 * `<tr>` nào khác mọc lên sau này vẫn bị soát.
 *
 * `ignoreSelector` chỉ loại **chính** phần tử khớp
 * (`expectAccessible.ts:798-806`), nên mọi thứ bên trong hàng — badge mức, ô
 * tên tầng — vẫn được soát đầy đủ.
 *
 * Cách trả nợ: thêm `focus-visible:ring-2 focus-visible:ring-offset-2` vào
 * `rowClassName` của `Table.tsx:84`, rồi xoá đúng hằng này và mọi nơi dùng nó.
 */
const TABLE_ROW_DEBT_SELECTOR = 'tbody > tr, thead > tr';

/** Tên tầng đã đo, mang đúng ba phát hiện — mọi tiêu chí tương tác đứng ở đây. */
const MEASURED_FLOOR_NAME = 'Tầng 1';
/** Tầng mở màn: tầng đầu danh sách dự án, và tầng đó chưa đo. */
const SEED_FLOOR_NAME = 'Tầng hầm';

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

/** Mảng thứ hai của `expectSevenStates` chỉ để thoả kiểu; props thật đến từ `scenarioFor`. */
function scenarioIndex(): readonly SevenStateScenario[] {
  return SEVEN_STATES.map((state) => ({
    state,
    label: SEVEN_STATE_LABELS[state],
    rows: [],
    totalCount: SAMPLE_FLOORS.length,
    isLoading: state === 'loading',
    isCollapsed: state === 'collapsed',
    canView: state !== 'forbidden',
    error: null,
  }));
}

interface MountOptions {
  readonly onToast?: (toast: InputQualityToast) => void;
}

/**
 * Màn thật, đã nối vào cổng dữ liệu giả, đọc xong lượt đầu.
 *
 * Cổng dựng bằng `createInputQualityGateway(createMockApiClient())` — đúng phép
 * ánh xạ bản sản phẩm dùng, chỉ khác nguồn dữ liệu (R-70). Không có bản giả nào
 * viết riêng cho test, nên một lỗi trong tầng ánh xạ vẫn bị bắt ở đây.
 */
async function mountScreen(clock: FakeClock, options: MountOptions = {}) {
  const gateway = createInputQualityGateway(createMockApiClient());
  const rendered = renderWithProviders(
    <InputQualityGateContainer
      gateway={gateway}
      projectId={PROJECT_ID}
      {...(options.onToast !== undefined ? { onToast: options.onToast } : {})}
    />,
  );

  // Ba nhịp, không một: lượt đọc danh sách tầng và lượt đọc kết quả đo là hai
  // lượt NỐI TIẾP — lượt sau chỉ bắt đầu khi lượt trước đã cho ra mã tầng mồi —
  // nên một nhịp mới chỉ đủ cho lượt đầu và bảng tầng vẫn chưa có gì để vẽ.
  await settle(clock);
  await settle(clock);
  await settle(clock);

  return rendered;
}

async function settle(clock: FakeClock): Promise<void> {
  await act(async () => {
    await clock.advance(SETTLE_STEP_MS);
    await clock.flushMicrotasks();
    await clock.advance(SETTLE_STEP_MS);
    await clock.flushMicrotasks();
  });
}

/** Hàng bảng tầng đang được xem — `aria-current` là dấu duy nhất của nó. */
function activeFloorNames(): readonly string[] {
  return screen
    .getAllByRole('row')
    .filter((row) => row.getAttribute('aria-current') === 'true')
    .map((row) => row.textContent ?? '');
}

/** Đổi tầng đang xem sang tầng đã đo, qua đúng lối người dùng bấm. */
async function selectMeasuredFloor(clock: FakeClock): Promise<void> {
  fireEvent.click(screen.getByText(MEASURED_FLOOR_NAME));
  await settle(clock);
}

/** Vùng ảnh đang được tô sáng — panel ảnh vẽ vùng sáng bằng viền dày hơn. */
function highlightedRegionLabels(): readonly string[] {
  return screen
    .getAllByRole('button')
    .filter((button) => button.className.includes('border-2'))
    .map((button) => button.getAttribute('aria-label') ?? '');
}

/**
 * jsdom không cài `matchMedia`, và `useNarrowViewport` gọi nó ngay lúc mount.
 *
 * Cùng bản giả và cùng lý do như `FloorUploadScreen.test.tsx`: trả `matches:
 * false` nghĩa là khung nhìn rộng, nên `isCollapsed` do dữ liệu quyết chứ
 * không do môi trường test quyết.
 */
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
/* (a) Bảy trạng thái.                                                         */
/* -------------------------------------------------------------------------- */

describe('InputQualityGateView — bảy trạng thái (A11, R-63)', () => {
  it('vẽ đủ bảy trạng thái, không lần nào ném lỗi và không lần nào ra màn trắng', () => {
    let rendered = 0;

    expectSevenStates((scenario) => {
      const { container, unmount } = renderWithProviders(
        <InputQualityGateView {...scenarioFor(scenario.state)} />,
      );

      rendered += 1;

      return { container, unmount };
    }, scenarioIndex());

    console.log(`[NGHIEM-A] trang-thai-ve-duoc=${String(rendered)}/${String(SEVEN_STATES.length)}`);
    expect(rendered).toBe(SEVEN_STATES.length);
  });

  it('không mã lỗi nào đứng một mình: mỗi phát hiện có câu giải thích bên cạnh', () => {
    renderWithProviders(<InputQualityGateView {...scenarioFor('success')} />);

    for (const finding of scenarioFor('success').model.findings) {
      expect(screen.getByText(finding.title)).toBeInTheDocument();
      expect(finding.consequence.length).toBeGreaterThan(finding.title.length);
      expect(screen.getByText(finding.consequence)).toBeInTheDocument();
    }
  });

  it('không quyền thì hai nút hành động biến mất hẳn, nhưng báo cáo vẫn đọc được', () => {
    renderWithProviders(<InputQualityGateView {...scenarioFor('forbidden')} />);

    expect(screen.queryByRole('button', { name: /tiếp tục xử lý/iu })).toBeNull();
    expect(screen.queryByRole('button', { name: /tải bản vẽ khác/iu })).toBeNull();
    expect(screen.getAllByText(/độ phân giải/iu).length).toBeGreaterThan(0);
  });

  it('kết quả do máy chấm không bao giờ mang màu "đã xác minh" của người duyệt (A5)', () => {
    const { model } = scenarioFor('success').model.metrics.length > 0
      ? scenarioFor('success')
      : scenarioFor('partial');

    for (const metric of model.metrics) {
      expect(metric.statusCode).not.toBe('verified');
    }

    for (const finding of model.findings) {
      expect(finding.statusCode).not.toBe('verified');
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Dữ liệu kịch bản không được trôi khỏi cổng dữ liệu giả (R-70).              */
/* -------------------------------------------------------------------------- */

describe('InputQualityGate — kịch bản bám vào cổng dữ liệu giả', () => {
  it('bốn tầng và ba phát hiện của story khớp từng số với createMockApiClient()', async () => {
    const client = createMockApiClient();
    const result = await client.quality.assess({ floorId: 'L1', projectId: PROJECT_ID });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.floors.map((floor) => floor.floorId)).toEqual(
      SAMPLE_FLOORS.map((floor) => floor.id),
    );

    for (const [index, floor] of result.data.floors.entries()) {
      const sample = SAMPLE_FLOORS[index];

      expect(sample).toBeDefined();
      expect(floor.floorName).toBe(sample?.name);
      expect(floor.isMeasured).toBe(sample?.isMeasured);
      expect(floor.measurement ?? null).toEqual(
        sample?.measurement === null || sample?.measurement === undefined
          ? null
          : {
              contrastScore: sample.measurement.contrastScore,
              heightPx: sample.measurement.heightPx,
              noiseScore: sample.measurement.noiseScore,
              skewDeg: sample.measurement.skewDeg,
              widthPx: sample.measurement.widthPx,
            },
      );
    }

    const measured = result.data.floors.find((floor) => floor.floorId === 'L1');

    expect(measured?.findings.map((finding) => finding.id)).toEqual(
      SAMPLE_FINDINGS.map((finding) => finding.id),
    );
    expect(measured?.findings.map((finding) => finding.code)).toEqual(
      SAMPLE_FINDINGS.map((finding) => finding.code),
    );
    expect(measured?.findings.map((finding) => finding.severity)).toEqual(
      SAMPLE_FINDINGS.map((finding) => finding.severity),
    );
  });
});

/* -------------------------------------------------------------------------- */
/* (b, c, d) Bộ khẳng định dùng chung (R-72).                                  */
/* -------------------------------------------------------------------------- */

describe('InputQualityGateView — khả năng tiếp cận, tiếng Việt, màu (R-72)', () => {
  it('đi qua expectAccessible ở trạng thái đầy đủ nhất', () => {
    const { container } = renderWithProviders(<InputQualityGateView {...scenarioFor('success')} />);

    expectAccessible(container, { ignoreSelector: TABLE_ROW_DEBT_SELECTOR });
  });

  it('đi qua expectAccessible ở trạng thái không có quyền', () => {
    const { container } = renderWithProviders(
      <InputQualityGateView {...scenarioFor('forbidden')} />,
    );

    expectAccessible(container, { ignoreSelector: TABLE_ROW_DEBT_SELECTOR });
  });

  it('đi qua expectAccessible khi một vùng ảnh đang được tô sáng', () => {
    const { container } = renderWithProviders(
      <InputQualityGateView {...highlightedScenario(regionIdOf('finding-skew'))} />,
    );

    expectAccessible(container, { ignoreSelector: TABLE_ROW_DEBT_SELECTOR });
  });

  it('mọi chuỗi hiển thị là tiếng Việt có dấu', () => {
    const { container } = renderWithProviders(<InputQualityGateView {...scenarioFor('success')} />);

    expectVietnamese(container, { allowWords: ALLOWED_WORDS });
  });

  it('mọi chuỗi hiển thị lúc lỗi và lúc một phần cũng là tiếng Việt có dấu', () => {
    const failed = renderWithProviders(<InputQualityGateView {...scenarioFor('error')} />);

    expectVietnamese(failed.container, { allowWords: ALLOWED_WORDS });
    cleanup();

    const partial = renderWithProviders(<InputQualityGateView {...scenarioFor('partial')} />);

    expectVietnamese(partial.container, { allowWords: ALLOWED_WORDS });
  });

  it('không mã màu thô trong bất kỳ file nào của thư mục màn (A1)', () => {
    for (const file of readdirSync(SCREEN_DIRECTORY)) {
      expectNoRawColor(`${SCREEN_DIRECTORY}/${file}`);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* (e) Cổng xác nhận — cảnh báo có ý thức, không chặn cứng.                     */
/* -------------------------------------------------------------------------- */

describe('InputQualityGate — cổng xác nhận khi có chỉ số mức Kém', () => {
  let clock: FakeClock;

  beforeEach(() => {
    clock = installFakeClock();
  });

  afterEach(() => {
    clock.restore();
  });

  it('chặn cho tới khi tích ô, và tích ô xong thì qua — chứng minh qua giao diện', async () => {
    await mountScreen(clock);
    await selectMeasuredFloor(clock);

    // Tầng 1 có độ phân giải cạnh ngắn 900 px — mức Kém theo `@/domain/quality`,
    // nên ô xác nhận phải hiện ra và lời chặn phải nói đúng lý do.
    const checkbox = screen.getByRole('checkbox', {
      name: /tôi đã đọc cảnh báo và vẫn muốn xử lý bản vẽ này/iu,
    });

    expect(checkbox).not.toBeChecked();
    expect(screen.getByText(/đánh dấu ô xác nhận bên trên rồi thử lại/iu)).toBeInTheDocument();

    // Không chặn cứng: nút chính vẫn bấm được, chỉ có lời cảnh báo đi kèm.
    const primary = screen.getByRole('button', { name: /tiếp tục xử lý/iu });

    expect(primary).toBeEnabled();
    expect(primary).toHaveAttribute('aria-describedby');

    const blockedBefore = screen.queryAllByText(/đánh dấu ô xác nhận bên trên rồi thử lại/iu).length;

    fireEvent.click(checkbox);
    await settle(clock);

    expect(checkbox).toBeChecked();

    const blockedAfter = screen.queryAllByText(/đánh dấu ô xác nhận bên trên rồi thử lại/iu).length;

    console.log(
      `[NGHIEM-E] loi-chan-truoc=${String(blockedBefore)} loi-chan-sau=${String(blockedAfter)}`,
    );

    expect(blockedBefore).toBe(1);
    expect(blockedAfter).toBe(0);
    expect(screen.getByRole('button', { name: /tiếp tục xử lý/iu })).not.toHaveAttribute(
      'aria-describedby',
    );
  });

  it('bản vẽ không có chỉ số mức Kém thì không hỏi xác nhận', () => {
    renderWithProviders(<InputQualityGateView {...scenarioFor('empty')} />);

    expect(
      screen.queryByRole('checkbox', { name: /tôi đã đọc cảnh báo/iu }),
    ).toBeNull();
    expect(screen.queryByText(/đánh dấu ô xác nhận bên trên rồi thử lại/iu)).toBeNull();
  });

  it('mô hình đã tích ô mở đường đi tiếp mà vẫn giữ ô xác nhận trên màn', () => {
    const acknowledged = acknowledgedScenario();

    expect(acknowledged.model.footer.requiresAcknowledgement).toBe(true);
    expect(acknowledged.model.footer.canContinue).toBe(true);

    renderWithProviders(<InputQualityGateView {...acknowledged} />);

    expect(
      screen.getByRole('checkbox', { name: /tôi đã đọc cảnh báo/iu }),
    ).toBeChecked();
  });
});

/* -------------------------------------------------------------------------- */
/* (f) Liên kết hai chiều thẻ phát hiện ↔ vùng ảnh.                             */
/* -------------------------------------------------------------------------- */

describe('InputQualityGate — liên kết hai chiều báo cáo ↔ ảnh', () => {
  let clock: FakeClock;

  beforeEach(() => {
    clock = installFakeClock();
  });

  afterEach(() => {
    clock.restore();
  });

  it('rê chuột lên thẻ phát hiện thì đúng vùng ảnh của nó được đánh dấu, và ngược lại', async () => {
    await mountScreen(clock);
    await selectMeasuredFloor(clock);

    expect(highlightedRegionLabels()).toHaveLength(0);

    // Chiều thứ nhất — báo cáo sang ảnh.
    const card = screen.getByText('Ảnh bị nghiêng').closest('div[tabindex]');

    expect(card).not.toBeNull();

    fireEvent.mouseEnter(card as HTMLElement);
    await settle(clock);

    const fromCard = highlightedRegionLabels();

    console.log(`[NGHIEM-F] tu-the-phat-hien=${fromCard.join(' | ')}`);
    expect(fromCard).toHaveLength(1);
    expect(fromCard[0]).toMatch(/ảnh bị nghiêng/iu);

    fireEvent.mouseLeave(card as HTMLElement);
    await settle(clock);
    expect(highlightedRegionLabels()).toHaveLength(0);

    // Chiều thứ hai — ảnh sang trạng thái tô sáng, qua bàn phím chứ không chuột,
    // vì A12 nói bàn phím là đường đi hạng nhất chứ không phải phương án dự phòng.
    const region = screen.getByRole('button', { name: /ảnh bị nghiêng/iu });

    fireEvent.focus(region);
    await settle(clock);

    const fromRegion = highlightedRegionLabels();

    console.log(`[NGHIEM-F] tu-vung-anh=${fromRegion.join(' | ')}`);
    expect(fromRegion).toHaveLength(1);
    expect(fromRegion[0]).toBe(fromCard[0]);
  });

  it('rê chuột lên thẻ chỉ số có neo vùng cũng đánh dấu đúng vùng ấy', async () => {
    await mountScreen(clock);
    await selectMeasuredFloor(clock);

    const metricRow = screen.getByText('độ nghiêng').closest('div[tabindex]');

    expect(metricRow).not.toBeNull();

    fireEvent.mouseEnter(metricRow as HTMLElement);
    await settle(clock);

    const highlighted = highlightedRegionLabels();

    expect(highlighted).toHaveLength(1);
    expect(highlighted[0]).toMatch(/ảnh bị nghiêng/iu);
  });
});

/* -------------------------------------------------------------------------- */
/* (g) Phím mũi tên đổi tầng đang xem.                                         */
/* -------------------------------------------------------------------------- */

describe('InputQualityGate — ArrowLeft/ArrowRight đổi tầng đang xem (A12)', () => {
  let clock: FakeClock;

  beforeEach(() => {
    clock = installFakeClock();
  });

  afterEach(() => {
    clock.restore();
  });

  it('mũi tên phải đi tới tầng sau, mũi tên trái quay lại tầng trước', async () => {
    await mountScreen(clock);

    // Màn mở ở tầng đầu danh sách dự án.
    expect(activeFloorNames()).toHaveLength(1);
    expect(activeFloorNames()[0]).toContain(SEED_FLOOR_NAME);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await settle(clock);

    const afterRight = activeFloorNames();

    console.log(`[NGHIEM-G] sau-mui-ten-phai=${afterRight.join(' | ')}`);
    expect(afterRight).toHaveLength(1);
    expect(afterRight[0]).toContain(MEASURED_FLOOR_NAME);

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await settle(clock);

    const afterLeft = activeFloorNames();

    console.log(`[NGHIEM-G] sau-mui-ten-trai=${afterLeft.join(' | ')}`);
    expect(afterLeft).toHaveLength(1);
    expect(afterLeft[0]).toContain(SEED_FLOOR_NAME);
  });

  it('mũi tên trái ở tầng đầu không đi đâu cả — không có tầng thứ không', async () => {
    await mountScreen(clock);

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await settle(clock);

    expect(activeFloorNames()).toHaveLength(1);
    expect(activeFloorNames()[0]).toContain(SEED_FLOOR_NAME);
  });
});

/* -------------------------------------------------------------------------- */
/* (2.5) Toast hoàn tác của A8 — dây từ container xuống hook.                   */
/* -------------------------------------------------------------------------- */

describe('InputQualityGate — toast hoàn tác sau khi nắn thẳng (A8, R-73)', () => {
  let clock: FakeClock;

  beforeEach(() => {
    clock = installFakeClock();
  });

  afterEach(() => {
    clock.restore();
  });

  it('nắn thẳng xong thì một toast hoàn tác xuất hiện, kèm lối hoàn tác thật', async () => {
    const toasts: InputQualityToast[] = [];

    await mountScreen(clock, {
      onToast: (toast) => {
        toasts.push(toast);
      },
    });
    await selectMeasuredFloor(clock);

    expect(toasts).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /tự động nắn/iu }));
    await settle(clock);
    await settle(clock);

    expect(toasts).toHaveLength(1);

    const toast = toasts[0];

    expect(toast?.message).toBe('Đã nắn thẳng bản vẽ');
    expect(typeof toast?.onUndo).toBe('function');
    expect(toast?.undoWindowMs).toBeGreaterThan(0);

    // Lượt ghi thật sự đổi dữ liệu: máy chủ đo lại, độ nghiêng về mức tốt và
    // phát hiện nghiêng biến khỏi danh sách. Hai phát hiện còn lại ở nguyên đó —
    // nắn thẳng không được phép dọn hộ những thứ nó không sửa.
    const panel = screen.getByRole('region', { name: /báo cáo chất lượng/iu });

    expect(within(panel).queryByText('Ảnh bị nghiêng')).toBeNull();
    expect(within(panel).getByText('Độ phân giải thấp')).toBeInTheDocument();
    expect(within(panel).getByText('Không tìm thấy khung bản vẽ')).toBeInTheDocument();
  });
});
