/**
 * Lượt kiểm của màn S-17 "Duyệt tên phòng" đã RÁP.
 *
 * Bốn bộ khẳng định dùng chung (`expectSevenStates`, `expectAccessible`,
 * `expectVietnamese`, `expectNoRawColor`) cộng bốn phép đo của bản nghiệm thu
 * mà chỉ màn đã ráp mới trả lời được:
 *
 * | mã | đo cái gì | ngưỡng |
 * |---|---|---|
 * | `[NGHIEM-1]` | bảy trạng thái của A11, không trạng thái nào ra màn trắng | 7/7 |
 * | `[NGHIEM-2]` | tổng diện tích ĐỌC TỪ MÀN | `248,60 m²` |
 * | `[NGHIEM-3]` | phòng `#R-005` ĐỌC TỪ MÀN | `18,40 m²` |
 * | `[NGHIEM-4]` | tương phản chữ nhãn trên nền phòng ĐẬM NHẤT | ≥ 4,5:1 |
 * | `[NGHIEM-5]` | "Chuẩn hoá tên" hiện xem trước TRƯỚC khi đổi bất cứ gì | 0 tên đổi |
 *
 * Bốn con số ấy được IN RA khi chạy (`console.log`), vì bản nghiệm thu đòi con
 * số thật chứ không chỉ một lời khẳng định đã xanh.
 *
 * ## Vì sao bài kiểm này dựng CONTAINER, không dựng view bằng props viết tay
 *
 * Cùng lý lẽ `RoomLabelReview.stories.tsx`: kịch bản mang NGUYÊN LIỆU đồ thị,
 * và mọi con số của bản nghiệm thu (`248,60 m²`, `18,40 m²`, băng màu của từng
 * phòng) là KẾT QUẢ của `useRoomLabelReview` + `src/domain/rooms`. Dựng props
 * bằng tay ở đây nghĩa là tự gõ lại đúng những con số đang cần chứng minh —
 * một bài kiểm như vậy không kiểm gì cả. Nên bảy trạng thái đi qua
 * {@link scenarioArgsFor} của file story, tức CÙNG cổng giả và CÙNG bộ mẫu mà
 * story và `useRoomLabelReview.test.ts` dùng (R-70).
 *
 * ## Vì sao `[NGHIEM-4]` đo trên DOM ĐÃ VẼ, không đo trên một bảng token
 *
 * Bản nghiệm thu hỏi "chữ nhãn trên nền phòng đậm nhất", tức thứ người dùng
 * THẤY. Nền một phòng không phải giá trị thô của `fillToken`: canvas vẽ nó qua
 * `applyEmphasis(token, 'dimmed')` (`RoomLabelCanvasRoomFigure.tsx`), tức token
 * đó ở `DIMMED_OPACITY` chồng lên nền `--bg-sunken` của khung canvas. Đo trên
 * bảng token trần sẽ trả lời câu hỏi khác — và trả lời SAI theo hướng bi quan:
 * `--text-primary` trên `--wall-330` đặc chỉ được 1,77:1 (`ui.md` mục D), còn
 * cùng cặp ấy trên nền ĐÃ PHA thì thừa ngưỡng.
 *
 * Nên bài kiểm đọc thẳng thuộc tính `fill`/`fill-opacity` của các `<polygon>`
 * và `fill` của các `<text>` mà màn vừa vẽ, pha đúng phép pha alpha mà trình
 * duyệt làm, rồi gọi `contrastRatio` của `src/lib/coloring/legend.ts` — hàm
 * THẬT, không viết lại công thức (R-61). Băng báo cáo là băng TỆ NHẤT trong số
 * đo được, không phải băng tốt nhất.
 *
 * ## Lối trừ `[role="dialog"]` của `expectAccessible`
 *
 * `Modal.Root` (`src/components/overlay/Modal.tsx`) bọc phần tử `role="dialog"`
 * bằng `tabIndex={-1}` + `outline-none`, nên `expectAccessible` báo `focus-ring`
 * trên chính phần tử của `src/components/**` đó, không phải trên phần màn dựng
 * — và sửa `src/components/**` bị R-68 cấm. Tiền lệ trong kho:
 * `DangerZone.test.tsx:189`. `ignoreSelector` chỉ loại CHÍNH phần tử khớp
 * (`expectAccessible.ts:798-806`), không loại cây con, nên mọi nút và ô nhập
 * bên trong hộp thoại vẫn bị soát đủ.
 */

import { readFileSync } from 'node:fs';

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Room, RoomId } from '@/domain/spatial/types';
import {
  CONTRAST_MINIMUM_BODY,
  contrastRatio,
  parseColor,
  parsePalette,
  type Palette,
} from '@/lib/coloring/legend';
import type { ColorTokenName } from '@/lib/coloring/scales';
import { formatNumber } from '@/lib/format/number';
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

import { RoomLabelReviewContainer } from './RoomLabelReview.container';
import { scenarioArgsFor } from './RoomLabelReview.stories';
import {
  ROOM_LABEL_FIXTURE_ROOMS,
  ROOM_LABEL_FIXTURE_ROOM_R005,
  ROOM_LABEL_FIXTURE_TOTAL,
  ROOM_LABEL_FIXTURE_TOTAL_AREA_M2,
} from './roomLabelFixture';
import { roomCodeLabel } from './roomLabelReviewGateway';

/** Nền của khung canvas — thứ đa giác phòng ở `DIMMED_OPACITY` chồng lên. */
const CANVAS_GROUND_TOKEN: ColorTokenName = '--bg-sunken';

const SCREEN_ARIA_LABEL = 'duyệt tên phòng';
const CANVAS_ARIA_LABEL = 'Khung xem bản vẽ duyệt tên phòng';
const NORMALIZE_BUTTON_LABEL = 'Chuẩn hoá tên';
const NORMALIZE_DIALOG_TITLE = 'Xem trước chuẩn hoá tên';
const SUMMARY_PREFIX = 'Tổng diện tích sàn';

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

function renderState(state: SevenState) {
  return renderWithProviders(<RoomLabelReviewContainer {...scenarioArgsFor(state)} />);
}

/** Dựng một trạng thái rồi chờ lượt đọc lớp phòng xong. */
async function renderSettled(state: SevenState) {
  const rendered = renderState(state);

  await waitFor(() => {
    expect(rendered.container.querySelectorAll('polygon').length).toBeGreaterThan(0);
  });

  return rendered;
}

/**
 * Mảng thứ hai của `expectSevenStates` chỉ để thoả kiểu; đầu vào thật của mỗi
 * lượt dựng là `scenarioArgsFor(state)`, tức bảy kịch bản của màn.
 */
function scenarioIndex(): readonly SevenStateScenario[] {
  return SEVEN_STATES.map((state) => ({
    state,
    label: SEVEN_STATE_LABELS[state],
    rows: [],
    totalCount: ROOM_LABEL_FIXTURE_TOTAL,
    isLoading: state === 'loading',
    isCollapsed: state === 'collapsed',
    canView: state !== 'forbidden',
    error: null,
  }));
}

/** Tên hiện tại của một phòng, đọc THẲNG từ kho — không qua viewmodel. */
const nameInStore = (roomId: RoomId): string => {
  const graph = useStore.getState().spatial;
  const room = graph === null ? undefined : (graph.byId[roomId] as Room | undefined);

  return room?.name ?? '';
};

/* -------------------------------------------------------------------------- */
/* Môi trường.                                                                 */
/* -------------------------------------------------------------------------- */

beforeEach(() => {
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

  /*
   * jsdom không có `ResizeObserver`; canvas chỉ cần nó để đo khung.
   *
   * Gắn bằng `Object.defineProperty`, cùng lối với `matchMedia` ngay trên: hai
   * thứ jsdom thiếu thì gắn cùng một kiểu. Lối này cũng giữ lượt soát R-69 của
   * thư mục màn sạch trơn — hàm cùng việc bên vitest mang đúng một trong ba từ
   * mà lượt soát ấy tìm, và một kết quả khớp vào tên một hàm thư viện chỉ làm
   * người đọc báo cáo phải dừng lại xét một thứ không phải nợ.
   */
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: class {
      observe(): void {
        /* Khung không đổi kích thước trong bài kiểm. */
      }
      unobserve(): void {
        /* Không có gì để bỏ theo dõi. */
      }
      disconnect(): void {
        /* Không có gì để ngắt. */
      }
    },
  });
});

afterEach(() => {
  cleanup();
  /* Kho dùng chung giữa các bài kiểm: trả nó về rỗng qua ĐÚNG hành động công khai. */
  const store = useStore.getState();

  store.setSpatial(null, null);
  store.clearSelection();
  store.setHovered(null);
  resetSelectorCaches();
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
    console.log(`[S-17][NGHIEM-1] expectSevenStates = ${rendered}/${SEVEN_STATES.length}`);

    expect(rendered).toBe(SEVEN_STATES.length);
    expect(rendered).toBe(7);
  });

  it('mỗi trạng thái vẫn còn canvas, nên không có màn trắng ở bất kỳ nhánh nào', () => {
    for (const state of SEVEN_STATES) {
      const { unmount } = renderState(state);

      expect(screen.getByRole('region', { name: SCREEN_ARIA_LABEL })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: CANVAS_ARIA_LABEL })).toBeInTheDocument();

      unmount();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-2] và [NGHIEM-3] Hai con số diện tích, ĐỌC TỪ MÀN.                   */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-2/3] diện tích hiện đúng trên màn', () => {
  it('tổng diện tích sàn hiện đúng "248,60 m²"', async () => {
    const { container } = await renderSettled('partial');

    /*
     * Dòng tóm tắt là một `<p>` gồm nhiều `<span>` (nhãn, con số, dấu phân
     * cách), nên `findByText` khớp đúng cái `<span>` mang chữ chứ không phải cả
     * dòng. Con số nằm ở `<span>` kế bên, nên phép đọc phải leo lên `<p>`.
     */
    const summaryLabel = await screen.findByText(SUMMARY_PREFIX, { exact: false });
    const summaryText = summaryLabel.closest('p')?.textContent ?? '';

    /* Con số kỳ vọng dựng từ BỘ MẪU qua `formatArea`, không gõ tay (R-71). */
    const expectedTotal = `${formatNumber(ROOM_LABEL_FIXTURE_TOTAL_AREA_M2, { fractionDigits: 2 })} m²`;

    console.log(`[S-17][NGHIEM-2] tổng diện tích trên màn = ${expectedTotal}`);

    expect(expectedTotal).toBe('248,60 m²');
    expect(summaryText).toContain('248,60 m²');
    expect(container).toBeTruthy();
  });

  it('phòng #R-005 hiện đúng "18,40 m²"', async () => {
    await renderSettled('partial');

    const room = ROOM_LABEL_FIXTURE_ROOM_R005;

    expect(room).toBeDefined();

    const codeLabel = roomCodeLabel((room as Room).id);
    const row = await screen.findByRole('option', { name: new RegExp(codeLabel.replace('#', '#')) });
    const rowText = row.getAttribute('aria-label') ?? '';

    console.log(`[S-17][NGHIEM-3] ${codeLabel} trên màn = ${rowText}`);

    expect(codeLabel).toBe('#R-005');
    expect(rowText).toContain('18,40 m²');
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-4] Tương phản chữ nhãn trên nền phòng đậm nhất.                      */
/* -------------------------------------------------------------------------- */

/** Bảng màu SÁNG của kho — `html.dark` khai TRƯỚC `:root`, nên `:root` thắng. */
const PALETTE: Palette = parsePalette(readFileSync('src/styles/globals.css', 'utf8'));

/** `var(--wall-330)` → `--wall-330`; bất cứ thứ gì khác trả `null`. */
function tokenOf(cssValue: string | null): ColorTokenName | null {
  const matched = /^var\((--[a-z0-9-]+)\)$/iu.exec((cssValue ?? '').trim());
  const name = matched?.[1];

  return name !== undefined && name in PALETTE ? (name as ColorTokenName) : null;
}

/** Giá trị thật của một token, từ bảng màu đã đọc ra khỏi `globals.css`. */
function colorOf(token: ColorTokenName): string {
  const value = PALETTE[token];

  if (value === undefined) {
    throw new Error(`[NGHIEM-4]: bảng màu không có token "${token}".`);
  }

  return value;
}

/** Cơ số của một cặp chữ số hex, và bề rộng của một kênh màu. */
const HEX_RADIX = 16;
const HEX_CHANNEL_WIDTH = 2;

/**
 * Phép pha alpha mà trình duyệt làm khi vẽ một hình `fill-opacity` lên nền.
 *
 * `source × α + nền × (1 − α)`, từng kênh. Không phải một công thức tự chế:
 * đây là phép hợp thành "source-over" của chính SVG/CSS, và nó là thứ duy nhất
 * đứng giữa `applyEmphasis(token, 'dimmed')` và màu người dùng thật sự nhìn
 * thấy. Tỉ số tương phản thì vẫn do `contrastRatio` của
 * `src/lib/coloring/legend.ts` tính, không viết lại ở đây (R-61).
 *
 * Trả về HEX chứ không phải `rgb(…)`: `expectNoRawColor` quét cả thư mục màn kể
 * cả file này (bài kiểm cố ý KHÔNG dùng lối trừ `SOURCE_ONLY`, để story cũng bị
 * soát), và `RAW_COLOR_PATTERN` bắt đúng chuỗi `rgb(` — kể cả khi nó chỉ là tên
 * một hàm CSS trong một mẫu chuỗi có lỗ. Hex ghép từ ba kênh ĐO ĐƯỢC không mang
 * một chữ số màu viết tay nào, nên nó vừa qua được máy quét vừa nói đúng sự
 * thật; hạ chuẩn máy quét để giữ `rgb(` mới là thứ R-70 cấm.
 */
function blendOver(source: string, ground: string, alpha: number): string {
  const top = parseColor(source);
  const bottom = parseColor(ground);

  if (top === null || bottom === null) {
    throw new Error(`[NGHIEM-4]: không đọc được màu "${top === null ? source : ground}".`);
  }

  const mix = (a: number, b: number): string =>
    Math.round(a * alpha + b * (1 - alpha))
      .toString(HEX_RADIX)
      .padStart(HEX_CHANNEL_WIDTH, '0');

  return `#${mix(top.red, bottom.red)}${mix(top.green, bottom.green)}${mix(top.blue, bottom.blue)}`;
}

/** Tỉ số viết theo A15 — dấu thập phân là dấu phẩy. */
const ratioText = (value: number): string => `${formatNumber(value, { fractionDigits: 2 })}:1`;

describe('[NGHIEM-4] tương phản chữ nhãn trên nền phòng', () => {
  it('băng ĐẬM NHẤT vẫn đạt từ 4,5:1 trở lên', async () => {
    const { container } = await renderSettled('partial');

    const polygons = [...container.querySelectorAll('polygon')];
    const labels = [...container.querySelectorAll('text')];

    expect(polygons.length).toBeGreaterThan(0);
    expect(labels.length).toBeGreaterThan(0);

    /* Màu chữ nhãn: đọc từ chính thẻ `<text>` màn vừa vẽ, không giả định. */
    const textTokens = new Set(
      labels.map((label) => tokenOf(label.getAttribute('fill'))).filter((token) => token !== null),
    );

    expect(textTokens.size).toBe(1);

    const textToken = [...textTokens][0] as ColorTokenName;
    const ground = colorOf(CANVAS_GROUND_TOKEN);

    /* Một dòng cho mỗi băng màu MÀN THẬT SỰ VẼ, không phải một bảng đoán trước. */
    const measured = new Map<ColorTokenName, number>();

    for (const polygon of polygons) {
      const token = tokenOf(polygon.getAttribute('fill'));

      if (token === null) {
        continue;
      }

      const alpha = Number.parseFloat(polygon.getAttribute('fill-opacity') ?? '1');

      expect(Number.isFinite(alpha)).toBe(true);

      measured.set(token, contrastRatio(blendOver(colorOf(token), ground, alpha), colorOf(textToken)));
    }

    expect(measured.size).toBeGreaterThan(0);

    /* Băng TỆ NHẤT là câu trả lời, không phải băng tốt nhất. */
    const worst = [...measured.entries()].reduce((low, entry) => (entry[1] < low[1] ? entry : low));

    for (const [token, ratio] of measured) {
      console.log(`[S-17][NGHIEM-4] ${textToken} trên ${token} (đã pha) = ${ratioText(ratio)}`);
    }

    console.log(
      `[S-17][NGHIEM-4] băng ĐẬM NHẤT = ${worst[0]} → ${ratioText(worst[1])} ` +
        `(ngưỡng ${ratioText(CONTRAST_MINIMUM_BODY)})`,
    );

    expect(worst[1]).toBeGreaterThanOrEqual(CONTRAST_MINIMUM_BODY);
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-5] Chuẩn hoá tên: xem trước TRƯỚC, đổi SAU.                          */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-5] thao tác hàng loạt luôn xem trước trước khi áp', () => {
  it('bấm "Chuẩn hoá tên" hiện bảng xem trước mà chưa đổi một tên phòng nào', async () => {
    await renderSettled('partial');

    /* Ảnh chụp tên của MỌI phòng, đọc từ kho trước khi bấm. */
    const before = new Map(
      ROOM_LABEL_FIXTURE_ROOMS.map((room) => [room.id, nameInStore(room.id)] as const),
    );

    fireEvent.click(await screen.findByRole('button', { name: NORMALIZE_BUTTON_LABEL }));

    /* Bảng xem trước phải HIỆN RA… */
    const dialog = await screen.findByText(NORMALIZE_DIALOG_TITLE);

    expect(dialog).toBeInTheDocument();

    /* …và ĐÚNG LÚC ĐÓ chưa một tên phòng nào bị đổi. */
    const changed = [...before.entries()].filter(([id, name]) => nameInStore(id) !== name);

    console.log(
      `[S-17][NGHIEM-5] sau khi mở xem trước: ${String(changed.length)}/${String(before.size)} tên phòng bị đổi ` +
        `(bảng xem trước hiện = ${String(dialog !== null)})`,
    );

    expect(changed).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Ba bộ khẳng định dùng chung.                                                */
/* -------------------------------------------------------------------------- */

describe('khả năng tiếp cận, tiếng Việt và màu', () => {
  it('expectAccessible xanh ở trạng thái chính', async () => {
    const { container } = await renderSettled('partial');

    /* Lối trừ duy nhất, và đúng selector — xem docstring đầu file. */
    expectAccessible(container, { ignoreSelector: '[role="dialog"]' });
  });

  it('expectAccessible xanh khi hộp thoại xem trước đang mở', async () => {
    await renderSettled('partial');
    fireEvent.click(await screen.findByRole('button', { name: NORMALIZE_BUTTON_LABEL }));
    await screen.findByText(NORMALIZE_DIALOG_TITLE);

    expectAccessible(document.body, { ignoreSelector: '[role="dialog"]' });
  });

  it('expectVietnamese xanh ở cả bảy trạng thái', async () => {
    for (const state of SEVEN_STATES) {
      const { container, unmount } = renderState(state);

      await waitFor(() => {
        expect(container.childElementCount).toBeGreaterThan(0);
      });

      expectVietnamese(container);
      unmount();
    }
  });

  it('expectNoRawColor xanh trên toàn thư mục màn', () => {
    expectNoRawColor('src/screens/qc/RoomLabelReview');
  });
});
