/**
 * Lượt kiểm của màn S-13 "Lớp đối tượng".
 *
 * Bốn bộ khẳng định dùng chung (`expectSevenStates`, `expectAccessible`,
 * `expectVietnamese`, `expectNoRawColor`) cộng ba phép đo của bản nghiệm thu mà
 * chỉ màn ĐÃ RÁP mới trả lời được:
 *
 * | mã | đo cái gì | ngưỡng |
 * |---|---|---|
 * | `[NGHIEM-1]` | bảy trạng thái của A11, không trạng thái nào ra màn trắng | 7/7 |
 * | `[NGHIEM-2]` | tổng số đối tượng ở BỐN NƠI trên màn thật | 21 / 21 / 21 / 21 |
 * | `[NGHIEM-3]` | thu gọn và không có quyền vẫn còn canvas + thanh trạng thái | không màn trắng |
 *
 * Hai phép đo còn lại của bản nghiệm thu — "kéo 20 lần → 1 bước lịch sử" (D-06)
 * và "bật ba lớp → đúng 3 màu dữ liệu" (P-06) — sống ở
 * `useObjectLayerReview.test.ts`, nơi lái được hook mà không phải dựng chuột
 * giả trên jsdom. Không đo lại ở đây để hai chỗ không trả lời lệch nhau.
 *
 * ## Một lớp render, cố ý
 *
 * Cả bảy trạng thái đi qua `ObjectLayerReviewContainer` THẬT với cổng giả, và
 * `scenarioArgsFor` đến từ `ObjectLayerReview.stories.tsx` — một bộ dữ liệu cho
 * cả story lẫn bài kiểm (R-70). Viết tay props view cho bảy trạng thái nghĩa là
 * dựng lại viewmodel bằng tay, đúng thứ R-61 cấm.
 *
 * ## Bốn nơi con số 21 xuất hiện — vì sao đọc từ DOM chứ không từ mô hình
 *
 * `useObjectLayerReview.test.ts` đã khẳng định mô hình mang đúng 21. Phép kiểm
 * ở đây trả lời một câu khác: con số ấy có tới được MÀN HÌNH ở cả bốn chỗ
 * không. Nên nó đọc từ cây DOM đã render — cây lớp, bộ đếm, danh sách, chú giải
 * canvas — chứ không đọc lại `model.counts.total` bốn lần.
 */

import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { resetSelectorCaches } from '@/store/selectors';
import { useStore } from '@/store';

import { ObjectLayerReviewContainer } from './ObjectLayerReview.container';
import { scenarioArgsFor } from './ObjectLayerReview.stories';
import { OBJECT_LAYER_FIXTURE_COUNTS } from './objectLayerFixture';

const SCREEN_DIRECTORY = 'src/screens/qc/ObjectLayerReview';

/** 21 — đọc ra từ bộ mẫu, không gõ tay lại (R-71). */
const TOTAL_OBJECTS = OBJECT_LAYER_FIXTURE_COUNTS.total;

/* Nhãn tra cứu — chép từ chính các view con, một chỗ viết duy nhất. */
const LAYER_TREE_LABEL = 'cây lớp';
const LIST_LABEL = 'danh sách đối tượng';
const LEGEND_LABEL = 'chú giải màu lớp';
const STATUS_BAR_LABEL = 'Thanh trạng thái';
const TOOL_RAIL_LABEL = 'Công cụ lớp đối tượng';
const EMPTY_ACTION = 'thêm thủ công';

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

function renderState(state: SevenStateScenario['state']) {
  return renderWithProviders(
    <MemoryRouter>
      <ObjectLayerReviewContainer {...scenarioArgsFor(state)} />
    </MemoryRouter>,
  );
}

/** Mảng thứ hai của `expectSevenStates` chỉ để thoả kiểu; props thật từ `scenarioArgsFor`. */
function scenarioIndex(): readonly SevenStateScenario[] {
  return SEVEN_STATES.map((state) => ({
    state,
    label: SEVEN_STATE_LABELS[state],
    rows: [],
    totalCount: TOTAL_OBJECTS,
    isLoading: state === 'loading',
    isCollapsed: state === 'collapsed',
    canView: state !== 'forbidden',
    error: null,
  }));
}

/** Con số đầu tiên trong một chuỗi, hoặc `NaN` khi chuỗi không có số nào. */
function firstNumberIn(text: string): number {
  const found = /\d+/u.exec(text);

  return found === null ? Number.NaN : Number.parseInt(found[0], 10);
}

/* -------------------------------------------------------------------------- */
/* Môi trường.                                                                 */
/* -------------------------------------------------------------------------- */

beforeEach(() => {
  resetSelectorCaches();
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
    console.log(`expectSevenStates: ${rendered}/${SEVEN_STATES.length}`);

    expect(rendered).toBe(SEVEN_STATES.length);
    expect(rendered).toBe(7);
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-2] Tổng số đối tượng ở bốn nơi.                                     */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-2] tổng số đối tượng trên màn đã ráp', () => {
  it('cây lớp, bộ đếm, danh sách và canvas cùng nói 21', async () => {
    /*
     * Trạng thái `success` là chỗ cả 21 đối tượng cùng hiện: ở `partial` thì
     * năm mục dưới ngưỡng đang được LỌC SẴN (đúng đặc tả), nên danh sách và
     * canvas cố ý hiện ít hơn tổng. Bộ lọc là một câu trả lời khác, không phải
     * một con số lệch.
     */
    renderState('success');

    /* Lượt đọc của cổng là bất đồng bộ: trước khi nó lắng, màn ở `loading`. */
    const list = await screen.findByRole('group', { name: LIST_LABEL });

    /* 1. Cây lớp — ba lớp con, mỗi lớp một số đếm trong ngoặc. */
    const tree = screen.getByRole('tree', { name: LAYER_TREE_LABEL });
    const layerCounts = within(tree)
      .getAllByRole('treeitem')
      .map((item) => firstNumberIn(item.textContent ?? ''));
    const treeTotal = layerCounts.reduce((sum, count) => sum + count, 0);

    /* 2. Bộ đếm — "21/21 đối tượng đã duyệt", đọc từ nhãn của chính bộ đếm. */
    const counter = screen.getAllByLabelText(/đối tượng đã duyệt$/u)[0] as HTMLElement;
    const counterTotal = Number.parseInt(
      (/\d+\/(\d+)/u.exec(counter.getAttribute('aria-label') ?? '') ?? ['', ''])[1] ?? '',
      10,
    );

    /* 3. Danh sách — đếm chính số dòng đang vẽ, không đọc một con số truyền riêng. */
    const listTotal = within(list).getAllByRole('option').length;

    /* 4. Canvas — chú giải hiện tổng lấy từ chính mảng `placements`. */
    const legend = screen.getByLabelText(LEGEND_LABEL);
    const canvasTotal = firstNumberIn(
      (legend.textContent ?? '').replace(/^[^\d]*/u, ''),
    );

    /* Bản nghiệm thu đòi IN cả bốn con số, không chỉ khẳng định chúng. */
    console.log(`tổng đối tượng — cây lớp:  ${treeTotal} (${layerCounts.join(' + ')})`);
    console.log(`tổng đối tượng — bộ đếm:   ${counterTotal}`);
    console.log(`tổng đối tượng — danh sách: ${listTotal}`);
    console.log(`tổng đối tượng — canvas:   ${canvasTotal}`);

    expect(layerCounts).toEqual([
      OBJECT_LAYER_FIXTURE_COUNTS.doorCount,
      OBJECT_LAYER_FIXTURE_COUNTS.windowCount,
      OBJECT_LAYER_FIXTURE_COUNTS.furnitureCount,
    ]);
    expect(treeTotal).toBe(TOTAL_OBJECTS);
    expect(counterTotal).toBe(TOTAL_OBJECTS);
    expect(listTotal).toBe(TOTAL_OBJECTS);
    expect(canvasTotal).toBe(TOTAL_OBJECTS);
    expect(TOTAL_OBJECTS).toBe(21);
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-3] Hai trạng thái dễ thành màn trắng nhất.                          */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-3] thu gọn và không có quyền', () => {
  it('trạng thái thu gọn: hai panel ẩn, canvas và thanh trạng thái vẫn còn', () => {
    renderState('collapsed');

    expect(screen.getByRole('toolbar', { name: TOOL_RAIL_LABEL })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: STATUS_BAR_LABEL })).toBeInTheDocument();
    expect(screen.queryByRole('tree', { name: LAYER_TREE_LABEL })).not.toBeInTheDocument();
    expect(screen.getByLabelText(LEGEND_LABEL)).toBeInTheDocument();
  });

  it('trạng thái không có quyền: xem được, chỉ mất nút sửa — KHÔNG khoá mờ cả màn', () => {
    renderState('forbidden');

    expect(screen.getByRole('status', { name: STATUS_BAR_LABEL })).toBeInTheDocument();
    expect(screen.getByRole('tree', { name: LAYER_TREE_LABEL })).toBeInTheDocument();
    expect(screen.getByLabelText(LEGEND_LABEL)).toBeInTheDocument();
  });

  it('trạng thái lỗi: danh sách nói ra lỗi, canvas VẪN không trắng', async () => {
    renderState('error');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByLabelText(LEGEND_LABEL)).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* Trạng thái rỗng — nút "thêm thủ công" phải LÀM một việc thật.               */
/* -------------------------------------------------------------------------- */

describe('trạng thái rỗng', () => {
  it('nút "thêm thủ công" thêm thật một đối tượng, qua lệnh của S-07', async () => {
    renderState('empty');

    const button = await screen.findByRole('button', { name: EMPTY_ACTION });

    /* Trước khi bấm: bộ mẫu rỗng, cây lớp nói 0. */
    expect(within(screen.getByRole('tree', { name: LAYER_TREE_LABEL })).getAllByRole('treeitem')
      .map((item) => firstNumberIn(item.textContent ?? ''))).toEqual([0, 0, 0]);

    fireEvent.click(button);

    const list = await screen.findByRole('group', { name: LIST_LABEL });

    await waitFor(() => {
      expect(within(list).getAllByRole('option')).toHaveLength(1);
    });

    /*
     * A5: lượt thêm KHÔNG đặt cờ duyệt — bộ đếm nhảy lên 0/1, không phải 1/1.
     * Chỉ lệnh duyệt của người mới bật cờ xanh.
     */
    const counter = screen.getAllByLabelText(/đối tượng đã duyệt$/u)[0] as HTMLElement;

    expect(counter.getAttribute('aria-label')).toBe('0/1 đối tượng đã duyệt');
  });
});

/* -------------------------------------------------------------------------- */
/* Ba bộ soát dùng chung.                                                      */
/* -------------------------------------------------------------------------- */

describe('ba bộ soát dùng chung', () => {
  it.each(SEVEN_STATES)('R-72 expectAccessible — trạng thái %s', (state) => {
    const { container } = renderState(state);

    expectAccessible(container);
  });

  it.each(SEVEN_STATES)('R-72 expectVietnamese — trạng thái %s', (state) => {
    const { container } = renderState(state);

    expectVietnamese(container);
  });

  it('expectNoRawColor — không một mã màu thô nào trong cả thư mục màn', () => {
    /* Nhận thẳng một thư mục và tự đi hết `.ts`/`.tsx` bên trong. */
    expectNoRawColor(SCREEN_DIRECTORY);
  });
});
