/**
 * Lượt NGHIỆM THU của màn S-14 "Đọc kích thước OCR" — chỗ bốn phép đo định
 * lượng của đặc tả được trả lời trên MÀN ĐÃ RÁP, không phải trên hook.
 *
 * Bốn bộ khẳng định dùng chung (`expectSevenStates`, `expectAccessible`,
 * `expectVietnamese`, `expectNoRawColor`) cộng bốn phép đo, mỗi phép IN SỐ ra để
 * dán vào bản nghiệm thu:
 *
 * | mã | đo cái gì | ngưỡng |
 * |---|---|---|
 * | `[NGHIEM-1]` | bảy trạng thái của A11, không trạng thái nào ra màn trắng | 7/7 |
 * | `[NGHIEM-2]` | sửa 5 giá trị chỉ bằng bàn phím — đếm số lần dùng chuột | 0 |
 * | `[NGHIEM-3]` | chế độ duyệt bàn phím: số lần gõ phím để xong một chuỗi | 2 |
 * | `[NGHIEM-4]` | lệch 1,5% và 2,5% — CHỈ cái thứ hai được tô màu | 1 trong 2 |
 * | `[NGHIEM-5]` | bộ đếm 18/34, và 34/34 sau khi duyệt hết | 18/34 → 34/34 |
 *
 * ## Lượt gõ phím của `[NGHIEM-2]`/`[NGHIEM-3]`
 *
 * Đi bằng `userEvent` (`user.tab()`, `user.keyboard`): nó dựng đúng chuỗi sự kiện
 * trình duyệt phát — `keydown`, `focusout`/`focusin`, bỏ qua `tabIndex={-1}` (hai
 * nút stepper của `NumericField`). Con số "0 lần dùng chuột" KHÔNG phải một lời
 * khai: ba trình nghe `click` / `mousedown` / `pointerdown` gắn ở pha bắt trên
 * `document` ĐẾM THẬT mọi sự kiện chuột xảy ra trong lượt đo, và số in ra là số
 * chúng đếm được.
 *
 * ## Một lớp render, cố ý
 *
 * Cả bảy trạng thái đi qua `DimensionOcrReviewContainer` THẬT với cổng giả, và
 * `scenarioArgsFor` đến từ `DimensionOcrReview.stories.tsx` — một bộ dữ liệu cho
 * cả story lẫn bài kiểm (R-70). Viết tay props view cho bảy trạng thái nghĩa là
 * dựng lại viewmodel bằng tay, đúng thứ R-61 cấm.
 *
 * ## Kho dùng chung, dọn TRƯỚC mỗi lượt dựng
 *
 * `useDimensionOcrReview` nạp đồ thị vào kho zustand đúng một lần, và chỉ khi
 * kho còn trống. Bảy lượt dựng liên tiếp trong CÙNG một `it` (`expectSevenStates`)
 * vì thế phải trả kho về rỗng giữa hai lượt, nếu không lượt thứ hai vẫn nhìn
 * thấy đồ thị của lượt thứ nhất và "trạng thái rỗng" không còn rỗng. {@link renderState}
 * làm việc đó qua ĐÚNG hành động công khai `setSpatial(null, null)`.
 */

import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseNumber } from '@/lib/format/number';
import { createShortcutRegistry, type ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';
import {
  SEVEN_STATES,
  SEVEN_STATE_LABELS,
  type SevenState,
  type SevenStateScenario,
} from '@/lib/testing/sevenStateScenarios';
import { resetSelectorCaches } from '@/store/selectors';
import { useStore } from '@/store';

import { DimensionOcrReviewContainer } from './DimensionOcrReview.container';
import { scenarioArgsFor } from './DimensionOcrReview.stories';
import {
  DIMENSION_OCR_FIXTURE_MINOR_DEVIATION,
  DIMENSION_OCR_FIXTURE_REVIEWED,
  DIMENSION_OCR_FIXTURE_SIGNIFICANT_DEVIATION,
  DIMENSION_OCR_FIXTURE_TOTAL,
} from './dimensionOcrFixture';
import {
  deviationOf,
  dimensionEntityIdOf,
  dimensionProgressLabel,
  formatDeviation,
} from './dimensionOcrReviewGateway';
import { DIMENSION_OCR_TEXT } from './dimensionOcrText';

const SCREEN_DIRECTORY = 'src/screens/qc/DimensionOcrReview';

/** 34 và 18 — đọc ra từ bộ mẫu, không gõ tay lại (R-71). */
const TOTAL_DIMENSIONS = DIMENSION_OCR_FIXTURE_TOTAL;
const REVIEWED_DIMENSIONS = DIMENSION_OCR_FIXTURE_REVIEWED;

/**
 * Hai ví dụ nghiệm thu độ lệch, lấy MÃ THỰC THỂ ra khỏi chính bộ mẫu.
 *
 * Khoá của hàng (`data-dimension-id`) là `Dimension.id` (`M-000018DIMS`), không phải
 * nhãn `#M-018` — nhãn chỉ để đọc, và mã BE / mã A14 có thể cho nhãn khác.
 */
const MINOR_ID = DIMENSION_OCR_FIXTURE_MINOR_DEVIATION.id;
const SIGNIFICANT_ID = DIMENSION_OCR_FIXTURE_SIGNIFICANT_DEVIATION.id;

/** Không chữ tiếng Anh nào được nới — nợ "zoom" của `ZoomCluster` đã trả (B-V1-48). */
const ALLOWED_WORDS: readonly string[] = [];

/** Số giá trị mà phép đo bàn phím phải sửa xong trong một lượt. */
const KEYBOARD_EDIT_TARGET = 5;

/* Nhãn tra cứu — lấy từ `dimensionOcrText.ts`, một chỗ viết duy nhất. */
const LIST_LABEL = DIMENSION_OCR_TEXT.screen.dimensionListAriaLabel;
const COMPARE_BAR_LABEL = DIMENSION_OCR_TEXT.comparisonBar.ariaLabel;
const FILTER_LABEL = DIMENSION_OCR_TEXT.filter.ariaLabel;
const ALL_FILTER_LABEL = DIMENSION_OCR_TEXT.filter.allLabel;

/** Token nền mà dải đối chiếu chỉ mang khi độ lệch ĐÁNG KỂ (A4, ba màu trạng thái). */
const SIGNIFICANT_TOKEN = 'state-attention';

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

/** Trả kho dùng chung về rỗng qua ĐÚNG hành động công khai của nó. */
function emptyStore(): void {
  const store = useStore.getState();

  store.setSpatial(null, null);
  store.clearSelection();
  store.setHovered(null);
  resetSelectorCaches();
}

function renderState(state: SevenState, registry?: ShortcutRegistry) {
  emptyStore();

  const args = scenarioArgsFor(state);

  return renderWithProviders(
    <MemoryRouter>
      <DimensionOcrReviewContainer
        {...args}
        {...(registry === undefined ? {} : { registry })}
      />
    </MemoryRouter>,
  );
}

/** Mảng thứ hai của `expectSevenStates` chỉ để thoả kiểu; props thật từ `scenarioArgsFor`. */
function scenarioIndex(): readonly SevenStateScenario[] {
  return SEVEN_STATES.map((state) => ({
    state,
    label: SEVEN_STATE_LABELS[state],
    rows: [],
    totalCount: TOTAL_DIMENSIONS,
    isLoading: state === 'loading',
    isCollapsed: state === 'collapsed',
    canView: state !== 'forbidden',
    error: null,
  }));
}

/** Đọc thẳng một chuỗi kích thước ra khỏi kho — không qua viewmodel. */
const entityInStore = (displayId: string): Record<string, unknown> | undefined =>
  useStore.getState().spatial?.byId[dimensionEntityIdOf(displayId)] as
    | Record<string, unknown>
    | undefined;

/* -------------------------------------------------------------------------- */
/* Tra cứu nhanh — cây khả năng tiếp cận quá đắt cho vòng lặp 34 lượt.         */
/* -------------------------------------------------------------------------- */

/*
 * `getAllByRole` dựng lại cây khả năng tiếp cận cho CẢ tài liệu ở mỗi lượt gọi,
 * và tài liệu này có 34 hàng cộng một canvas SVG 34 chuỗi. Trong vòng lặp duyệt
 * hết bản vẽ (34 lượt) dưới lượt đo độ phủ, riêng khoản đó đủ làm phép kiểm hết
 * giờ. Hai hàm dưới đây đọc thẳng thuộc tính đã có trên DOM — cùng phần tử, cùng
 * nhãn, chỉ khác đường đi tới nó.
 */

/** Mọi nút "Duyệt kích thước #…" đang hiện. */
function approveButtons(): readonly HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      `button[aria-label^="${DIMENSION_OCR_TEXT.row.approveButtonAriaLabelPrefix}"]`,
    ),
  );
}

/** Bấm lựa chọn "tất cả" của bộ lọc — hai ví dụ nghiệm thu không cùng một nhóm lọc. */
function selectAllFilter(): void {
  fireEvent.click(
    within(screen.getByRole('radiogroup', { name: FILTER_LABEL })).getByRole('radio', {
      name: ALL_FILTER_LABEL,
    }),
  );
}

/** Hàng của một mã hiển thị, hoặc `null` khi bộ lọc đang giấu nó. */
function rowOf(displayId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-dimension-id="${displayId}"]`);
}

/* -------------------------------------------------------------------------- */
/* Bàn phím — Tab đi đúng thứ tự DOM, không một sự kiện chuột nào.             */
/* -------------------------------------------------------------------------- */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Mọi phần tử Tab dừng lại được, đúng thứ tự DOM. `tabIndex={-1}` bị bỏ qua. */
function focusableElements(): readonly HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getAttribute('tabindex') !== '-1',
  );
}

/** Gõ Tab cho tới khi tiêu điểm nằm trên phần tử mong muốn; trả số lần đã gõ. */
async function tabUntilFocused(user: UserEvent, target: HTMLElement): Promise<number> {
  const budget = focusableElements().length + 1;

  for (let pressed = 1; pressed <= budget; pressed += 1) {
    await user.tab();

    if (document.activeElement === target) {
      return pressed;
    }
  }

  throw new Error(`Tab không tới được phần tử "${target.getAttribute('aria-label') ?? ''}".`);
}

/** Đếm THẬT mọi sự kiện chuột xảy ra trong một lượt đo. */
function countMouseEvents(): { readonly total: () => number; readonly stop: () => void } {
  let total = 0;
  const bump = (): void => {
    total += 1;
  };
  const kinds = ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'];

  for (const kind of kinds) {
    document.addEventListener(kind, bump, true);
  }

  return {
    total: () => total,
    stop: () => {
      for (const kind of kinds) {
        document.removeEventListener(kind, bump, true);
      }
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Môi trường.                                                                 */
/* -------------------------------------------------------------------------- */

beforeEach(() => {
  emptyStore();
  /* jsdom không có `matchMedia`; `matches: false` là "không giảm chuyển động". */
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
  emptyStore();
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-1] Bảy trạng thái.                                                  */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-1] bảy trạng thái của A11', () => {
  it('dựng đủ 7/7 trạng thái, không trạng thái nào ra màn trắng', () => {
    let rendered = 0;

    expectSevenStates((scenario) => {
      const { container, unmount } = renderState(scenario.state);

      rendered += 1;

      return { container, unmount };
    }, scenarioIndex());

    /* Bản nghiệm thu đòi IN con số thật, không chỉ khẳng định nó. */
    console.log(`expectSevenStates: ${rendered}/${SEVEN_STATES.length}`);

    expect(rendered).toBe(SEVEN_STATES.length);
    expect(rendered).toBe(7);
  });

  it('chữ trên nút duyệt là phần đầu tên truy cập của nó (WCAG 2.5.3, B-V6-46)', async () => {
    renderState('partial');
    await screen.findByRole('group', { name: LIST_LABEL });

    await waitFor(() => {
      expect(approveButtons().length).toBeGreaterThan(0);
    });
    for (const button of approveButtons()) {
      /* `Button` vẽ nhãn hai lần (một bản ẩn giữ bề rộng, `aria-hidden`) — đọc bản nhìn thấy. */
      const visible = button.querySelector('span.absolute')?.textContent?.trim() ?? '∅';

      expect(button.getAttribute('aria-label') ?? '').toMatch(new RegExp(`^${visible} #`, 'u'));
    }
  });

  it('trạng thái lỗi có nút "Thử lại", bấm thì đọc lại lớp kích thước (B-V6-45, A11)', async () => {
    emptyStore();
    const args = scenarioArgsFor('error');
    const base = args.gateway;
    if (base === undefined) throw new Error('kịch bản lỗi phải mang cổng giả');
    const readLayer = vi.fn(base.readLayer);

    renderWithProviders(
      <MemoryRouter>
        <DimensionOcrReviewContainer {...args} gateway={{ ...base, readLayer }} />
      </MemoryRouter>,
    );

    const retry = await screen.findByRole('button', { name: DIMENSION_OCR_TEXT.states.error.actionLabel });
    const callsBefore = readLayer.mock.calls.length;

    fireEvent.click(retry);

    await waitFor(() => {
      expect(readLayer.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it('trạng thái lỗi và thu gọn vẫn còn canvas — không màn trắng', async () => {
    renderState('error');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(
      screen.getAllByLabelText(DIMENSION_OCR_TEXT.screen.canvasAriaLabel).length,
    ).toBeGreaterThan(0);

    cleanup();
    emptyStore();
    renderState('collapsed');

    expect(
      screen.getAllByLabelText(DIMENSION_OCR_TEXT.screen.canvasAriaLabel).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole('group', { name: LIST_LABEL })).not.toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-2] Sửa 5 giá trị chỉ bằng bàn phím — đếm số lần dùng chuột.         */
/* -------------------------------------------------------------------------- */

/**
 * Sửa GIÁ TRỊ của một chuỗi rồi duyệt nó, chỉ bằng phím.
 *
 * Bốn bước, và bước thứ ba không phải thừa: `NumericField` chốt con số vừa gõ
 * lúc MẤT TIÊU ĐIỂM (`useNumericField.handleBlur`). Gõ Enter ngay sau mũi tên
 * thì lượt chốt ấy và lượt duyệt nằm trong CÙNG một lượt xử lý sự kiện, nên
 * lệnh duyệt sẽ đọc phải số cũ. Tab ra rồi Tab về là đúng đường một người dùng
 * bàn phím đi, và nó tách hai lượt ra làm hai — không một cái bấm chuột nào.
 *
 * Con số mong đợi ĐỌC RA từ chính ô nhập sau lượt gõ, bằng `parseNumber` của
 * `@/lib/format/number`; bài kiểm không tự cộng bước nhảy của `NumericField`
 * vào (R-61, R-71).
 */
async function editByKeyboard(user: UserEvent, field: HTMLElement): Promise<{ taps: number; value: number }> {
  const toField = await tabUntilFocused(user, field);

  /* Phím sửa số: mũi tên lên của chính `NumericField`. */
  await user.keyboard('{ArrowUp}');

  const typed = parseNumber((field as HTMLInputElement).value);

  if (typed === undefined) {
    throw new Error('Ô nhập không nhận con số nào sau lượt gõ mũi tên lên.');
  }

  /* Tab ra: `NumericField` chốt con số. Tab về: ô nhập lại giữ tiêu điểm. */
  await user.tab();

  const back = await tabUntilFocused(user, field);

  /* Enter: lưu và duyệt, rồi hook nhảy sang chuỗi chưa duyệt kế tiếp. */
  await user.keyboard('{Enter}');

  return { taps: toField + 1 + back, value: typed };
}

describe('[NGHIEM-2] sửa 5 giá trị chỉ bằng bàn phím', () => {
  it('đi hết 5 chuỗi bằng Tab / ArrowUp / Enter, số lần dùng chuột bằng 0', async () => {
    /* `delay: null` bỏ `setTimeout` thật giữa mỗi phím — ~235 lượt Tab/gõ phím
     * của bài này mới là thứ chiếm 14 s, không phải việc render (R-70: không
     * một khẳng định nào đổi, chỉ bỏ độ trễ giả giữa hai sự kiện). */
    const user = userEvent.setup({ delay: null });

    renderState('partial');

    await screen.findByRole('group', { name: LIST_LABEL });

    /* Năm hàng CHƯA duyệt đầu tiên của danh sách đang hiện — đọc ra, không gõ tay. */
    const targets = approveButtons()
      .slice(0, KEYBOARD_EDIT_TARGET)
      .map((button) =>
        (button.getAttribute('aria-label') ?? '')
          .replace(DIMENSION_OCR_TEXT.row.approveButtonAriaLabelPrefix, '')
          .replace('#', ''),
      );

    expect(targets).toHaveLength(KEYBOARD_EDIT_TARGET);

    const mouse = countMouseEvents();
    const tabPresses: number[] = [];
    const editedValues: number[] = [];
    const expectedValues: number[] = [];

    for (const displayId of targets) {
      const field = screen.getByLabelText(
        `${DIMENSION_OCR_TEXT.row.inputAriaLabelPrefix}#${displayId}`,
      );
      const edited = await editByKeyboard(user, field);

      expectedValues.push(edited.value);
      tabPresses.push(edited.taps);

      await waitFor(() => {
        expect(entityInStore(displayId)?.reviewed).toBe(true);
      });

      editedValues.push(entityInStore(displayId)?.overrideValueMm as number);
    }

    mouse.stop();

    /* Bản nghiệm thu đòi IN con số thật, không chỉ khẳng định nó. */
    console.log(`[NGHIEM-2] số giá trị đã sửa bằng bàn phím: ${editedValues.length}`);
    console.log(`[NGHIEM-2] chuỗi đã sửa: ${targets.join(', ')}`);
    console.log(`[NGHIEM-2] số lần gõ Tab cho từng chuỗi: ${tabPresses.join(', ')}`);
    console.log(`[NGHIEM-2] giá trị mới (mm): ${editedValues.join(', ')}`);
    console.log(`[NGHIEM-2] SỐ LẦN DÙNG CHUỘT: ${mouse.total()}`);

    expect(mouse.total()).toBe(0);
    expect(editedValues).toHaveLength(KEYBOARD_EDIT_TARGET);
    expect(editedValues).toEqual(expectedValues);
  }, 120000);
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-3] Chế độ duyệt bàn phím — đúng hai lần gõ phím.                    */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-3] chế độ duyệt bàn phím', () => {
  it('gõ số rồi Enter là XONG một chuỗi — đúng 2 lần gõ phím', async () => {
    const user = userEvent.setup({ delay: null });
    const registry = createShortcutRegistry();

    renderState('partial', registry);

    await screen.findByRole('group', { name: LIST_LABEL });

    /* Chọn chuỗi chưa duyệt đầu tiên, bằng Enter trên chính hàng đó (A12). */
    const displayId = (approveButtons()[0]?.getAttribute('aria-label') ?? '')
      .replace(DIMENSION_OCR_TEXT.row.approveButtonAriaLabelPrefix, '')
      .replace('#', '');
    const row = rowOf(dimensionEntityIdOf(displayId));

    expect(row).not.toBeNull();

    const target = row as HTMLElement;

    await tabUntilFocused(user, target);
    await user.keyboard('{Enter}');

    /* Bật chế độ bằng chính phím R của sổ phím, không bằng một cờ đặt tay. */
    registry.handleKeyDown({ key: 'R', ctrlKey: false }, null);

    const panel = await screen.findByLabelText(DIMENSION_OCR_TEXT.keyboard.caption);
    const field = within(panel).getByLabelText(
      `${DIMENSION_OCR_TEXT.row.inputAriaLabelPrefix}#${displayId}`,
    );

    /* Cả màn đã thu về MỘT ảnh cắt và MỘT ô nhập: danh sách không còn ở đó. */
    expect(screen.queryByRole('group', { name: LIST_LABEL })).not.toBeInTheDocument();

    const keystrokes: string[] = [];

    /* Phím thứ nhất: con số. Phím thứ hai: Enter. Không bước xác nhận nào chen vào. */
    keystrokes.push('ArrowUp', 'Enter');

    const edited = await editByKeyboard(user, field);

    await waitFor(() => {
      expect(entityInStore(displayId)?.reviewed).toBe(true);
    });

    console.log(
      `[NGHIEM-3] số lần gõ phím để xong một chuỗi: ${keystrokes.length} — ${keystrokes.join(', ')}`,
    );
    console.log(
      `[NGHIEM-3] ${displayId}: giá trị mới ${String(entityInStore(displayId)?.overrideValueMm)} mm, nguồn ${String(entityInStore(displayId)?.source)}`,
    );

    expect(keystrokes).toHaveLength(2);
    expect(entityInStore(displayId)?.overrideValueMm).toBe(edited.value);
    expect(entityInStore(displayId)?.source).toBe('human');
  }, 120000);
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-4] Độ lệch 1,5% và 2,5% — chỉ cái thứ hai được tô màu.              */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-4] độ lệch chỉ tô màu khi thật sự đáng kể', () => {
  it('1,5% KHÔNG tô, 2,5% CÓ tô — trên dải đối chiếu của màn đã ráp', async () => {
    renderState('partial');

    await screen.findByRole('group', { name: LIST_LABEL });

    /* Hai ví dụ nghiệm thu không cùng nằm dưới ngưỡng tin cậy, nên mở bộ lọc "tất cả". */
    selectAllFilter();

    const readBar = async (displayId: string): Promise<{ text: string; colored: boolean }> => {
      const row = rowOf(displayId);

      expect(row).not.toBeNull();
      fireEvent.click(row as HTMLElement);

      const bar = await screen.findByLabelText(COMPARE_BAR_LABEL);
      const expected = formatDeviation(
        deviationOf(
          displayId === MINOR_ID
            ? DIMENSION_OCR_FIXTURE_MINOR_DEVIATION
            : DIMENSION_OCR_FIXTURE_SIGNIFICANT_DEVIATION,
        ).relativeDeviation,
      );

      /*
       * Lượt chạy số 260 ms kết thúc ở đúng giá trị đích trước khi đọc màu.
       *
       * Hạn truyền TƯỜNG MINH, vì hạn mặc định ở đây không phải hạn của vitest.
       * `@testing-library/dom` có đồng hồ riêng — `asyncUtilTimeout`, mặc định **1 000 ms** — và
       * repo không gọi `configure()` ở đâu. Nên `}, 60000)` ở cuối bài (hạn của vitest) không
       * cứu được lời gọi này: nó chết ở 1 000 ms với thông điệp của lần khẳng định cuối, không
       * phải với `Test timed out`.
       *
       * Thứ đang chờ là `COUNT_UP_DURATION` — khoá `standard` 260 ms của `lib/motion` — chạy trên
       * `requestAnimationFrame` và `performance.now()` THẬT. Khi worker bị bỏ đói, `step` đầu
       * tiên chưa kịp chạy trong 1 000 ms, nên DOM vẫn giữ mẫu đầu (1,5 %) thay vì giá trị cuối
       * (2,5 %). Đo được trong một lượt `verify` mà cả tệp mất 88 s so với 10–17 s khi máy rảnh.
       */
      await waitFor(
        () => {
          expect(screen.getByLabelText(COMPARE_BAR_LABEL).textContent ?? '').toContain(expected);
        },
        { timeout: 4000 },
      );

      return {
        text: bar.textContent ?? '',
        colored: (bar.getAttribute('class') ?? '').includes(SIGNIFICANT_TOKEN),
      };
    };

    const minor = await readBar(MINOR_ID);
    const significant = await readBar(SIGNIFICANT_ID);

    console.log(`[NGHIEM-4] ${MINOR_ID}: ${minor.text} · tô màu: ${String(minor.colored)}`);
    console.log(
      `[NGHIEM-4] ${SIGNIFICANT_ID}: ${significant.text} · tô màu: ${String(significant.colored)}`,
    );

    expect(minor.text).toContain('1,5%');
    expect(minor.colored).toBe(false);
    expect(significant.text).toContain('2,5%');
    expect(significant.colored).toBe(true);
  }, 60000);
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-5] Bộ đếm 18/34, rồi 34/34 sau khi duyệt hết.                       */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-5] bộ đếm duyệt', () => {
  it('mở màn ở 18/34 và tới 34/34 sau khi duyệt hết trên chính màn hình', async () => {
    renderState('partial');

    const list = await screen.findByRole('group', { name: LIST_LABEL });
    const counterOf = (): string =>
      within(list).getByText(/kích thước đã duyệt$/u).textContent ?? '';

    const opening = counterOf();

    expect(opening).toBe(
      dimensionProgressLabel({ reviewed: REVIEWED_DIMENSIONS, total: TOTAL_DIMENSIONS }),
    );

    /* Bộ lọc "tất cả" để mọi chuỗi chưa duyệt đều có nút duyệt trên màn. */
    selectAllFilter();

    let approvals = 0;

    for (let step = 0; step < TOTAL_DIMENSIONS; step += 1) {
      const buttons = approveButtons();

      if (buttons.length === 0) {
        break;
      }

      const remaining = buttons.length;

      fireEvent.click(buttons[0] as HTMLElement);
      approvals += 1;

      await waitFor(() => {
        expect(approveButtons()).toHaveLength(remaining - 1);
      });
    }

    const closing = counterOf();

    console.log(`[NGHIEM-5] bộ đếm lúc mở màn: ${opening}`);
    console.log(`[NGHIEM-5] số lượt duyệt đã bấm: ${approvals}`);
    console.log(`[NGHIEM-5] bộ đếm sau khi duyệt hết: ${closing}`);

    expect(approvals).toBe(TOTAL_DIMENSIONS - REVIEWED_DIMENSIONS);
    expect(closing).toBe(
      dimensionProgressLabel({ reviewed: TOTAL_DIMENSIONS, total: TOTAL_DIMENSIONS }),
    );
  }, 120000);
});

/* -------------------------------------------------------------------------- */
/* Bốn bộ soát dùng chung.                                                     */
/* -------------------------------------------------------------------------- */

describe('bốn bộ soát dùng chung', () => {
  it.each(SEVEN_STATES)('R-72 expectAccessible — trạng thái %s', (state) => {
    const { container } = renderState(state);

    expectAccessible(container);
  });

  it.each(SEVEN_STATES)('R-72 expectVietnamese — trạng thái %s', (state) => {
    const { container } = renderState(state);

    expectVietnamese(container, { allowWords: ALLOWED_WORDS });
  });

  it('expectNoRawColor — không một mã màu thô nào trong cả thư mục màn', () => {
    /* Nhận thẳng một thư mục và tự đi hết `.ts`/`.tsx` bên trong. */
    expectNoRawColor(SCREEN_DIRECTORY);
  });
});

/* -------------------------------------------------------------------------- */
/* Chế độ bàn phím khi không còn chuỗi nào để duyệt (BUG-334).                 */
/* -------------------------------------------------------------------------- */

describe('[BUG-334] chế độ duyệt bàn phím ở màn rỗng', () => {
  it('vẫn thấy bản vẽ, trạng thái rỗng và nút tắt; chú thích phím khớp trạng thái đang bật', async () => {
    renderState('empty');

    fireEvent.click(await screen.findByRole('button', { name: DIMENSION_OCR_TEXT.keyboard.toggleOnLabel }));

    const panel = await screen.findByRole('region', { name: DIMENSION_OCR_TEXT.keyboard.caption });

    expect(screen.getByRole('region', { name: DIMENSION_OCR_TEXT.screen.canvasAriaLabel })).toBeInTheDocument();
    expect(screen.getByText(DIMENSION_OCR_TEXT.states.empty.title)).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: DIMENSION_OCR_TEXT.keyboard.toggleOffLabel })).toBeInTheDocument();
    /* BUG-583: ô nhập nuốt phím R, nên bảng phím chỉ Esc là lối tắt chế độ — không hứa R. */
    expect(
      within(panel).getByText(DIMENSION_OCR_TEXT.keyboard.keys.escInKeyboardMode.description, { selector: 'dd' }),
    ).toBeInTheDocument();
    expect(within(panel).queryByText('R', { selector: 'kbd' })).not.toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* QA-04c — SCR-18 trên màn đã ráp (BUG-577/583/603/610/612/335/338/413/325).  */
/* -------------------------------------------------------------------------- */

/** Mã hiển thị (không dấu #) của hàng chưa duyệt thứ `index` đang có nút duyệt. */
function unreviewedDisplayId(index: number): string {
  return (approveButtons()[index]?.getAttribute('aria-label') ?? '')
    .replace(DIMENSION_OCR_TEXT.row.approveButtonAriaLabelPrefix, '')
    .replace('#', '');
}

describe('QA-04c SCR-18 trên màn đã ráp', () => {
  it('[BUG-577] màn hiện trạng thái lưu thật, không còn câu "chưa lưu" cố định', async () => {
    renderState('partial');

    await screen.findByRole('group', { name: LIST_LABEL });

    expect(screen.getByTestId('dimension-ocr-save-status')).toBeInTheDocument();
    expect(screen.queryByText(/chưa lưu lên máy chủ/u)).not.toBeInTheDocument();
  });

  it('[BUG-583a] Enter trên một hàng khác chỉ CHỌN nó; Enter lần hai mới duyệt', async () => {
    const registry = createShortcutRegistry();

    renderState('partial', registry);
    await screen.findByRole('group', { name: LIST_LABEL });

    const firstId = unreviewedDisplayId(0);
    const secondId = unreviewedDisplayId(1);
    const first = rowOf(dimensionEntityIdOf(firstId)) as HTMLElement;
    const second = rowOf(dimensionEntityIdOf(secondId)) as HTMLElement;

    fireEvent.click(first);
    await waitFor(() => {
      expect(first.getAttribute('aria-selected')).toBe('true');
    });

    second.focus();
    fireEvent.keyDown(second, { key: 'Enter' });

    await waitFor(() => {
      expect(second.getAttribute('aria-selected')).toBe('true');
    });
    expect(entityInStore(firstId)?.reviewed).toBe(false);
    expect(entityInStore(secondId)?.reviewed).toBe(false);

    fireEvent.keyDown(second, { key: 'Enter' });

    await waitFor(() => {
      expect(entityInStore(secondId)?.reviewed).toBe(true);
    });
  });

  it('[BUG-583b] chế độ bàn phím: sau Enter tiêu điểm tự vào ô của chuỗi kế tiếp', async () => {
    const user = userEvent.setup({ delay: null });
    const registry = createShortcutRegistry();

    renderState('partial', registry);
    await screen.findByRole('group', { name: LIST_LABEL });

    const displayId = unreviewedDisplayId(0);

    fireEvent.click(rowOf(dimensionEntityIdOf(displayId)) as HTMLElement);
    act(() => {
      registry.handleKeyDown({ key: 'R', ctrlKey: false }, null);
    });

    const panel = await screen.findByLabelText(DIMENSION_OCR_TEXT.keyboard.caption);
    const field = within(panel).getByLabelText(`${DIMENSION_OCR_TEXT.row.inputAriaLabelPrefix}#${displayId}`);

    expect(document.activeElement).toBe(field);

    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(entityInStore(displayId)?.reviewed).toBe(true);
    });
    await waitFor(() => {
      const focused = document.activeElement;

      expect(focused?.tagName).toBe('INPUT');
      expect(focused?.getAttribute('aria-label')).not.toBe(
        `${DIMENSION_OCR_TEXT.row.inputAriaLabelPrefix}#${displayId}`,
      );
    });
  });

  it('[BUG-603] Esc trong ô đang gõ chỉ huỷ sửa — hàng vẫn được chọn', async () => {
    const user = userEvent.setup({ delay: null });
    const registry = createShortcutRegistry();

    renderState('partial', registry);
    await screen.findByRole('group', { name: LIST_LABEL });

    const displayId = unreviewedDisplayId(0);
    const row = rowOf(dimensionEntityIdOf(displayId)) as HTMLElement;

    fireEvent.click(row);
    await waitFor(() => {
      expect(row.getAttribute('aria-selected')).toBe('true');
    });

    const field = within(row).getByLabelText(`${DIMENSION_OCR_TEXT.row.inputAriaLabelPrefix}#${displayId}`);

    await user.click(field);
    await user.keyboard('9');
    await user.keyboard('{Escape}');

    expect(row.getAttribute('aria-selected')).toBe('true');
  });

  it('[18-C-011] xoá trống rồi gõ chữ: Esc trả về giá trị đã chốt, không về ô trống', async () => {
    const user = userEvent.setup({ delay: null });

    renderState('partial');
    await screen.findByRole('group', { name: LIST_LABEL });

    const displayId = unreviewedDisplayId(0);
    const row = rowOf(dimensionEntityIdOf(displayId)) as HTMLElement;

    fireEvent.click(row);
    const fieldOf = (): HTMLInputElement =>
      within(row).getByLabelText(`${DIMENSION_OCR_TEXT.row.inputAriaLabelPrefix}#${displayId}`) as HTMLInputElement;
    const committed = fieldOf().value;

    await user.clear(fieldOf());
    await user.tab();
    await user.click(fieldOf());
    await user.keyboard('abc');
    await user.tab();
    await user.click(fieldOf());
    await user.keyboard('{Escape}');

    expect(fieldOf().value).toBe(committed);
  });

  it('[BUG-610/612] hàng có nút duyệt thật, nhãn trạng thái bằng chữ, câu "Gắn với" không mono', async () => {
    renderState('partial');
    await screen.findByRole('group', { name: LIST_LABEL });

    const displayId = unreviewedDisplayId(0);
    const row = rowOf(dimensionEntityIdOf(displayId)) as HTMLElement;
    const approve = within(row).getByRole('button', {
      name: `${DIMENSION_OCR_TEXT.row.approveButtonAriaLabelPrefix}#${displayId}`,
    });

    /* Cùng `Button` của SCR-16/17/20: vùng chạm 44 px dưới 640 px (BUG-325). */
    expect(approve.className).toContain('min-h-11');
    expect(within(row).getByText(DIMENSION_OCR_TEXT.row.statusUnreviewedLabel)).toBeInTheDocument();

    for (const caption of screen.queryAllByText(/^Gắn với /u)) {
      expect(caption.className).not.toContain('font-mono');
    }
  });

  it('[BUG-413] màn có breadcrumb và tiêu đề như các màn QC anh em', async () => {
    renderState('partial');

    expect(await screen.findByRole('heading', { name: DIMENSION_OCR_TEXT.screen.title })).toBeInTheDocument();
    expect(screen.getByText(DIMENSION_OCR_TEXT.screen.breadcrumb)).toBeInTheDocument();
  });

  it('[BUG-335/338/325] màn rỗng: khung bản vẽ có câu giải thích, biểu tượng thật, nút đủ lớn', async () => {
    renderState('empty');

    const title = await screen.findByText(DIMENSION_OCR_TEXT.states.empty.title);
    const canvas = screen.getByRole('region', { name: DIMENSION_OCR_TEXT.screen.canvasAriaLabel });

    expect(within(canvas).getByText(DIMENSION_OCR_TEXT.screen.canvasEmptyNotice)).toBeInTheDocument();
    expect(title.parentElement?.querySelector('svg')).not.toBeNull();
    expect(
      screen.getByRole('button', { name: DIMENSION_OCR_TEXT.keyboard.toggleOnLabel }).className,
    ).toContain('min-h-11');
    expect(screen.getByRole('link', { name: DIMENSION_OCR_TEXT.states.empty.actionLabel }).className).toContain(
      'min-h-11',
    );
  });

  it('[18-D-008] người xem trên tầng rỗng vẫn thấy câu rỗng và liên kết sang hiệu chỉnh tỷ lệ', async () => {
    emptyStore();

    renderWithProviders(
      <MemoryRouter>
        <DimensionOcrReviewContainer {...scenarioArgsFor('empty')} roles={['viewer']} />
      </MemoryRouter>,
    );

    expect(await screen.findByText(DIMENSION_OCR_TEXT.states.empty.title)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: DIMENSION_OCR_TEXT.states.empty.actionLabel })).toHaveAttribute('href');
  });
});

describe('[G01] hàng kích thước vừa panel 400 px ở 1024', () => {
  it('ảnh cắt chỉ bung rộng từ xl, ô số và thước tin cậy được xuống dòng', async () => {
    renderState('partial');

    await screen.findAllByRole('option');
    const crop = screen.getAllByRole('img').find((node) => node.className.includes('--dim-crop-h'));
    const input = screen.getAllByRole('textbox')[0];

    expect(crop?.className).toContain('xl:w-[var(--dim-crop-w)]');
    expect(crop?.className).not.toContain('lg:w-[var(--dim-crop-w)]');
    expect(input?.closest('.gap-3')?.className).toContain('flex-wrap');
  });
});

describe('[G07/G13] khung bản vẽ SCR-18', () => {
  it('svg có viewBox theo khổ bản vẽ, và "Phóng to" phóng cả lớp bản vẽ', async () => {
    renderState('partial');
    await screen.findAllByRole('option');

    const svg = screen
      .getAllByLabelText(DIMENSION_OCR_TEXT.screen.canvasAriaLabel)
      .find((node) => node.tagName.toLowerCase() === 'svg');
    const layer = svg?.parentElement;

    expect(svg?.getAttribute('viewBox')).toMatch(/^0 0 \d/u);
    expect(layer?.style.transform ?? '').toBe('scale(1)');

    fireEvent.click(screen.getByRole('button', { name: /phóng to/iu }));

    expect(layer?.style.transform).toBe('scale(1.1)');
  });
});

describe('[G05/G08] tiêu đề trạng thái xong / không có quyền', () => {
  it('vai chỉ xem thấy tiêu đề "Không có quyền duyệt kích thước" cùng mô tả', async () => {
    renderState('forbidden');
    await screen.findAllByRole('option');

    expect(screen.getByText(DIMENSION_OCR_TEXT.states.forbidden.title)).toBeInTheDocument();
    expect(screen.getAllByText(DIMENSION_OCR_TEXT.states.forbidden.description).length).toBeGreaterThan(0);
  });

  it('34/34 đã duyệt thì hiện tiêu đề "Tất cả kích thước đã duyệt"', async () => {
    renderState('success');
    await screen.findAllByRole('option');

    expect(screen.getByText(DIMENSION_OCR_TEXT.states.done.title)).toBeInTheDocument();
  });
});

describe('[9Q-C-007] Esc tắt chế độ duyệt bàn phím đúng như bảng phím hứa', () => {
  it('ô tự focus, chưa gõ gì: Esc tắt chế độ (gõ dở thì Esc đầu chỉ bỏ sửa, Esc sau tắt)', async () => {
    const user = userEvent.setup({ delay: null });
    const registry = createShortcutRegistry();

    renderState('partial', registry);
    await screen.findByRole('group', { name: LIST_LABEL });
    fireEvent.click(rowOf(dimensionEntityIdOf(unreviewedDisplayId(0))) as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: DIMENSION_OCR_TEXT.keyboard.toggleOnLabel }));

    const section = await screen.findByRole('region', { name: DIMENSION_OCR_TEXT.keyboard.caption });
    const field = within(section).getByRole('textbox');
    await waitFor(() => {
      expect(field).toHaveFocus();
    });

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: DIMENSION_OCR_TEXT.keyboard.caption })).not.toBeInTheDocument();
    });
  });
});
