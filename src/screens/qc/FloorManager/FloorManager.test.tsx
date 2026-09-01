/**
 * Lượt kiểm của màn S-16 "Quản lý tầng" đã RÁP.
 *
 * Bốn bộ khẳng định dùng chung (`expectSevenStates`, `expectAccessible`,
 * `expectVietnamese`, `expectNoRawColor`) cộng năm phép đo của bản nghiệm thu mà
 * chỉ màn đã ráp mới trả lời được, cộng `[NGHIEM-6]` của T8 — hai thông báo mà
 * hook đã trả về nhưng trước đó không view nào vẽ ra:
 *
 * | mã | đo cái gì | ngưỡng |
 * |---|---|---|
 * | `[NGHIEM-1]` | bảy trạng thái của A11, không trạng thái nào ra màn trắng | 7/7 |
 * | `[NGHIEM-2]` | container gắn được bằng MỘT thẻ, có cổng giả (R-73) | dựng xong |
 * | `[NGHIEM-3]` | bảng cao độ CẢ BỐN TẦNG trước và sau khi Tầng trệt cao 3,9 → 4,2 m | Tầng 2 tự dịch |
 * | `[NGHIEM-4]` | bốn cặp (chiều cao thật, chiều cao dải) của lát cắt | tổng tỷ lệ = 1 |
 * | `[NGHIEM-5]` | xoá một tầng rồi hoàn tác: thứ tự VÀ cao độ về nguyên trạng | 4 → 3 → 4 dòng |
 * | `[NGHIEM-6]` | hai câu màn phải nói ra: vai Người xem, và nợ của cổng | cả hai hiện trên màn |
 *
 * ## Vì sao `[NGHIEM-3]` đi qua ô nhập thật chứ không gọi thẳng hook
 *
 * `useFloorManager.test.ts` đã lái `onFloorFieldChange` + `onFloorFieldCommit`
 * trực tiếp. Bài này đo nửa còn lại: một người thật gõ vào `NumericField` và
 * KHÔNG bấm gì nữa. `NumericField` chỉ chốt sau {@link NUMERIC_FIELD_COMMIT_MS}
 * im lặng (`useNumericField.ts:14` — `COMMIT_DEBOUNCE_MS`, không xuất ra ngoài
 * nên hằng ở đây là bản sao có chú thích, và tệp `.test.` được `no-raw-duration`
 * miễn trừ theo `eslint-rules/no-raw-duration.js:86`). Nhịp đó là NHỊP CHỐT, không
 * phải từng phím gõ — người dùng đã duyệt — nên bài kiểm chờ đúng nó thay vì sửa
 * component cho dễ đo (R-70).
 *
 * ## `getBoundingClientRect` trả 0 trên jsdom, nên `[NGHIEM-4]` đọc gì
 *
 * jsdom không bố cục, nên chiều cao *đo được* của một dải luôn là 0 và một bài
 * kiểm đọc nó chỉ đang tự lừa mình. Thứ component THẬT SỰ ghi ra là
 * `style={{ flexGrow: band.bandHeightRatio }}` trên chính thẻ dải
 * (`FloorSectionCut.tsx`, dòng duy nhất quyết định tỷ lệ). Bài kiểm đọc thuộc
 * tính đó khỏi DOM và đối chiếu với chiều cao thật của bộ mẫu — không tính lại
 * tỷ lệ ở đây, chỉ chia hai con số đã có để so.
 *
 * ## Một bộ dữ liệu, không phải hai
 *
 * Bảy trạng thái dựng từ `scenarioArgsFor` của `FloorManager.stories.tsx` — cùng
 * bảy view-model mà story dùng (R-70). Màn ĐÃ NỐI DÂY dựng từ
 * `createMockFloorManagerGateway()`, tức cùng bộ mẫu bốn tầng
 * `FLOOR_MANAGER_SAMPLE_LEVELS` mà `useFloorManager.test.ts` lái. Không một con
 * số nào viết tay ở đây (R-71).
 */

import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createShortcutRegistry, type ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { installFakeClock } from '@/lib/testing/fakeClock';
import { renderWithProviders } from '@/lib/testing/render';
import {
  SEVEN_STATES,
  SEVEN_STATE_LABELS,
  type SevenState,
  type SevenStateScenario,
} from '@/lib/testing/sevenStateScenarios';
import { resetSelectorCaches } from '@/store/selectors';
import { useStore } from '@/store';

import { FloorManager } from './FloorManager';
import { FloorManagerContainer } from './FloorManager.container';
import { scenarioArgsFor } from './FloorManager.stories';
import {
  FLOOR_MANAGER_FIXTURE_UNSUPPORTED_NOTICES,
  floorManagerScenarioFor,
} from './floorManagerFixture';
import {
  createMockFloorManagerGateway,
  FLOOR_MANAGER_SAMPLE_LEVELS,
} from './floorManagerGateway';

const PROJECT_ID = 'project-floor-manager';
const SCREEN_ARIA_LABEL = 'quản lý tầng';
const SECTION_ARIA_LABEL = 'Lát cắt các tầng theo đúng tỷ lệ chiều cao';
const TABLE_CAPTION_TEXT = 'cao độ tính tự động từ chiều cao các tầng dưới trừ khi ghi đè.';
const ADD_FLOOR_LABEL = 'Thêm tầng';
const REMOVE_FLOOR_MENU_ITEM = 'xoá tầng';
const EXPAND_SECTION_LABEL = 'hiện lát cắt';

/** Tầng của bộ mẫu mà bản nghiệm thu chỉ đích danh — đọc ra, không gõ lại tên. */
const GROUND_FLOOR = FLOOR_MANAGER_SAMPLE_LEVELS[1];
const SECOND_FLOOR = FLOOR_MANAGER_SAMPLE_LEVELS[2];

/** Chiều cao mới của Tầng trệt, ở đúng dạng người dùng gõ (A15: dấu phẩy). */
const NEW_GROUND_HEIGHT_DRAFT = '4,2';

/**
 * Nhịp chốt của `NumericField`, milimét giây.
 *
 * Bản sao của `COMMIT_DEBOUNCE_MS` (`src/hooks/useNumericField.ts:14`), thứ
 * không được xuất ra ngoài. Đây là nhịp CHỐT của một ô số — cùng 800 ms mà A7
 * dùng cho tự lưu — chứ không phải một thời lượng chuyển động, nên nó không
 * nằm trên thang năm giá trị của mục B.
 */
const NUMERIC_FIELD_COMMIT_MS = 800;

/** Thừa nhịp để mọi promise của lượt chốt kịp lắng. */
const SETTLE_MS = 1_000;

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

function renderState(state: SevenState) {
  return renderWithProviders(<FloorManager {...scenarioArgsFor(state)} />);
}

/** Mảng thứ hai của `expectSevenStates` chỉ để thoả kiểu; props thật từ `scenarioArgsFor`. */
function scenarioIndex(): readonly SevenStateScenario[] {
  return SEVEN_STATES.map((state) => {
    const scenario = floorManagerScenarioFor(state);

    return {
      state,
      label: SEVEN_STATE_LABELS[state],
      rows: [],
      totalCount: scenario.rows.length,
      isLoading: state === 'loading',
      isCollapsed: scenario.isCollapsed,
      canView: scenario.canEdit || state === 'forbidden',
      error: scenario.errorMessage,
    };
  });
}

interface MountedScreen {
  readonly registry: ShortcutRegistry;
}

/** Màn ĐÃ NỐI DÂY, dựng bằng MỘT thẻ với cổng giả — đúng thứ R-73 đòi. */
async function mountScreen(): Promise<MountedScreen> {
  const registry = createShortcutRegistry();

  renderWithProviders(
    <FloorManagerContainer
      gateway={createMockFloorManagerGateway()}
      projectId={PROJECT_ID}
      registry={registry}
      roles={['engineer']}
    />,
  );

  /* Trước lúc cổng trả lời, mọi kịch bản đều là "đang tải" — chờ bảng thật. */
  await waitFor(() => {
    expect(screen.getByText(TABLE_CAPTION_TEXT)).toBeInTheDocument();
  });

  return { registry };
}

/**
 * Bảng tầng ĐỌC TỪ MÀN, mỗi dòng một chuỗi.
 *
 * Nguồn là `aria-label` của chính thẻ `<tr>` — chuỗi mà `FloorTableRow.tsx`
 * sinh ra từ view-model (`"{tên}, cao độ {cao độ}, cao {chiều cao}, {tiến độ}
 * đã kiểm"`). Đọc ở đây thay vì đọc kho: bản nghiệm thu hỏi màn nói gì, không
 * hỏi kho giữ gì. Thứ tự mảng là thứ tự DOM, tức TỪ DƯỚI LÊN theo hợp đồng.
 */
function floorTableReadings(): readonly string[] {
  return screen
    .getAllByRole('row')
    .map((row) => row.getAttribute('aria-label'))
    .filter((label): label is string => label !== null);
}

/** Bốn dải lát cắt — thẻ dải có `flex-grow`, không lẫn nút thu gọn. */
function sectionBands(): readonly HTMLElement[] {
  const section = screen.getByLabelText(SECTION_ARIA_LABEL);

  return within(section)
    .getAllByRole('button')
    .filter((element) => element.style.flexGrow !== '');
}

/** Gõ một phím vào SỔ PHÍM THẬT, đúng đường một bàn phím thật đi (A12). */
async function pressKey(registry: ShortcutRegistry, key: string): Promise<void> {
  await act(async () => {
    registry.handleKeyDown({ key, ctrlKey: true }, null);
    await Promise.resolve();
  });
}

/* -------------------------------------------------------------------------- */
/* Môi trường.                                                                 */
/* -------------------------------------------------------------------------- */

afterEach(() => {
  cleanup();
  /* Kho dùng chung giữa các bài kiểm: trả nó về rỗng qua ĐÚNG hành động công khai. */
  const store = useStore.getState();

  store.setSpatial(null, null);
  store.clearSelection();
  store.setHovered(null);
  resetSelectorCaches();
  vi.useRealTimers();
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
    console.log(`expectSevenStates: ${String(rendered)}/${String(SEVEN_STATES.length)}`);

    expect(rendered).toBe(SEVEN_STATES.length);
    expect(rendered).toBe(7);
  });

  it('mỗi trạng thái vẫn còn vỏ màn, nên không có màn trắng ở bất kỳ nhánh nào', () => {
    for (const state of SEVEN_STATES) {
      const { unmount } = renderState(state);

      expect(
        screen.getByRole('region', { name: SCREEN_ARIA_LABEL }),
        `trạng thái ${state} mất vỏ màn`,
      ).toBeInTheDocument();

      /* Thu gọn là trạng thái DUY NHẤT không có lát cắt — và nó phải còn đường bung lại. */
      if (state === 'collapsed') {
        expect(screen.getByRole('button', { name: EXPAND_SECTION_LABEL })).toBeInTheDocument();
      } else {
        expect(
          screen.getAllByLabelText(SECTION_ARIA_LABEL).length,
          `trạng thái ${state} mất lát cắt`,
        ).toBeGreaterThan(0);
      }

      unmount();
    }
  });

  it('vai Người xem: bảng chỉ đọc, mọi thao tác sửa biến mất', () => {
    renderState('forbidden');

    expect(screen.queryByRole('button', { name: ADD_FLOOR_LABEL })).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(SECTION_ARIA_LABEL).length).toBeGreaterThan(0);
    expect(screen.getByText(TABLE_CAPTION_TEXT)).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-2] Container gắn được bằng một thẻ (R-73).                          */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-2] màn đã nối dây', () => {
  it('dựng được bằng một thẻ với cổng giả, và ra khỏi trạng thái đang tải', async () => {
    await mountScreen();

    const readings = floorTableReadings();

    console.log(`[NGHIEM-2] container dựng xong, ${String(readings.length)} dòng tầng trên màn`);

    expect(screen.getByRole('region', { name: SCREEN_ARIA_LABEL })).toBeInTheDocument();
    expect(readings).toHaveLength(FLOOR_MANAGER_SAMPLE_LEVELS.length);
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-3] Bảng cao độ trước và sau khi Tầng trệt cao 3,9 → 4,2 m.          */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-3] đổi chiều cao một tầng kéo cao độ tầng trên theo', () => {
  it('gõ 4,2 vào ô chiều cao rồi im lặng đủ nhịp chốt: cao độ Tầng 2 tự dịch', async () => {
    await mountScreen();

    const before = floorTableReadings();

    console.log('[NGHIEM-3] BẢNG CAO ĐỘ TRƯỚC:');
    for (const line of before) {
      console.log(`  ${line}`);
    }

    const heightField = screen.getByLabelText(`Chiều cao tầng ${GROUND_FLOOR?.name ?? ''}`);
    const clock = installFakeClock();

    /* Gõ, rồi KHÔNG bấm gì nữa — nhịp chốt của NumericField phải tự tới. */
    await act(async () => {
      fireEvent.focus(heightField);
      fireEvent.change(heightField, { target: { value: NEW_GROUND_HEIGHT_DRAFT } });
      await clock.flushMicrotasks();
    });

    await act(async () => {
      await clock.advance(NUMERIC_FIELD_COMMIT_MS);
      await clock.flushMicrotasks();
      await clock.advance(SETTLE_MS);
      await clock.flushMicrotasks();
    });

    clock.restore();

    await waitFor(() => {
      expect(floorTableReadings()).not.toEqual(before);
    });

    const after = floorTableReadings();

    console.log('[NGHIEM-3] BẢNG CAO ĐỘ SAU:');
    for (const line of after) {
      console.log(`  ${line}`);
    }

    /* Cả bốn tầng vẫn còn — đổi chiều cao không được làm mất dòng nào. */
    expect(after).toHaveLength(FLOOR_MANAGER_SAMPLE_LEVELS.length);

    const groundName = GROUND_FLOOR?.name ?? '';
    const secondName = SECOND_FLOOR?.name ?? '';
    const groundAfter = after.find((line) => line.startsWith(groundName)) ?? '';
    const secondAfter = after.find((line) => line.startsWith(secondName)) ?? '';

    /* Tầng trệt CAO lên 4,2 m; Tầng 2 đứng ở CAO ĐỘ 4,2 m — hai chuyện khác nhau. */
    expect(groundAfter).toContain('cao 4,2 m');
    expect(secondAfter).toContain('cao độ 4,2 m');

    /* Và trước đó nó đúng là cảnh đặc tả tả: 3,9 m và cao độ 3,9 m. */
    expect(before.find((line) => line.startsWith(groundName)) ?? '').toContain('cao 3,9 m');
    expect(before.find((line) => line.startsWith(secondName)) ?? '').toContain('cao độ 3,9 m');
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-4] Bốn cặp số tỷ lệ dải lát cắt.                                    */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-4] chiều cao dải tỷ lệ với chiều cao thật', () => {
  it('bốn cặp (chiều cao thật, chiều cao dải), và bốn tỷ lệ cộng lại bằng 1', async () => {
    await mountScreen();

    const bands = sectionBands();
    const totalHeightMm = FLOOR_MANAGER_SAMPLE_LEVELS.reduce(
      (total, level) => total + level.heightMm,
      0,
    );

    console.log('[NGHIEM-4] BỐN CẶP SỐ (chiều cao thật ↔ chiều cao dải):');

    let ratioSum = 0;

    bands.forEach((band, index) => {
      const level = FLOOR_MANAGER_SAMPLE_LEVELS[index];
      const writtenRatio = Number(band.style.flexGrow);

      ratioSum += writtenRatio;

      console.log(
        `  ${band.getAttribute('aria-label') ?? ''} → flex-grow ${band.style.flexGrow} ` +
          `(chiều cao thật ${String(level?.heightMm ?? 0)} mm / ${String(totalHeightMm)} mm)`,
      );

      /* Tỷ lệ dải PHẢI là chiều cao thật chia tổng — không hằng số, không làm tròn. */
      expect(writtenRatio).toBeCloseTo((level?.heightMm ?? 0) / totalHeightMm, 10);
    });

    console.log(
      `[NGHIEM-4] tổng tỷ lệ bốn dải = ${String(ratioSum)} · tổng chiều cao thật = ${String(totalHeightMm)} mm`,
    );

    expect(bands).toHaveLength(FLOOR_MANAGER_SAMPLE_LEVELS.length);
    expect(ratioSum).toBeCloseTo(1, 10);
    expect(totalHeightMm).toBe(14_100);
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-5] Xoá một tầng rồi hoàn tác.                                       */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-5] xoá tầng và hoàn tác', () => {
  it('xoá ngay KHÔNG hộp thoại, rồi một lần Ctrl+Z trả thứ tự và cao độ về nguyên trạng', async () => {
    const { registry } = await mountScreen();

    const before = floorTableReadings();

    console.log('[NGHIEM-5] TRƯỚC:');
    for (const line of before) {
      console.log(`  ${line}`);
    }

    /* Mở menu ngữ cảnh của dòng, rồi chọn "xoá tầng" — đường một người thật đi. */
    fireEvent.click(
      screen.getByLabelText(`Thao tác khác cho tầng ${SECOND_FLOOR?.name ?? ''}`),
    );

    const removeItem = screen.getByRole('menuitem', { name: REMOVE_FLOOR_MENU_ITEM });

    /* CẤM TUYỆT ĐỐI: xoá tầng không được hỏi bằng hộp thoại. */
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(removeItem);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(floorTableReadings()).toHaveLength(FLOOR_MANAGER_SAMPLE_LEVELS.length - 1);
    });

    const afterRemove = floorTableReadings();

    console.log('[NGHIEM-5] SAU KHI XOÁ:');
    for (const line of afterRemove) {
      console.log(`  ${line}`);
    }

    expect(afterRemove.some((line) => line.startsWith(SECOND_FLOOR?.name ?? ''))).toBe(false);

    await pressKey(registry, 'z');

    await waitFor(() => {
      expect(floorTableReadings()).toHaveLength(FLOOR_MANAGER_SAMPLE_LEVELS.length);
    });

    const afterUndo = floorTableReadings();

    console.log('[NGHIEM-5] SAU KHI HOÀN TÁC:');
    for (const line of afterUndo) {
      console.log(`  ${line}`);
    }

    /* Thứ tự VÀ cao độ về nguyên trạng — so cả mảng, không so từng dòng rời. */
    expect(afterUndo).toEqual(before);
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-6] Hai câu màn PHẢI nói ra.                                         */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-6] màn nói ra hai sự thật thay vì im lặng', () => {
  it('vai Người xem: câu giải thích vì sao mọi nút sửa biến mất có mặt trên màn', () => {
    const notice = floorManagerScenarioFor('forbidden').forbiddenNotice ?? '';

    renderState('forbidden');

    console.log(`[NGHIEM-6] câu của vai Người xem: ${notice}`);

    /* Ẩn nút là đúng; ẩn mà không nói vì sao mới là lỗi A11 mà bài này chặn. */
    expect(notice).not.toBe('');
    expect(screen.queryByRole('button', { name: ADD_FLOOR_LABEL })).not.toBeInTheDocument();
    expect(screen.getByText(notice)).toBeInTheDocument();
  });

  it('cổng khai khả năng chưa có: TỪNG câu nợ hiện ra, và câu chữ vẫn đi qua hai bộ soát', () => {
    const { container } = renderWithProviders(
      <FloorManager
        {...scenarioArgsFor('partial')}
        unsupportedNotices={FLOOR_MANAGER_FIXTURE_UNSUPPORTED_NOTICES}
      />,
    );

    console.log('[NGHIEM-6] CÁC CÂU NỢ CỦA CỔNG:');
    for (const notice of FLOOR_MANAGER_FIXTURE_UNSUPPORTED_NOTICES) {
      console.log(`  ${notice}`);
      expect(screen.getByText(notice)).toBeInTheDocument();
    }

    expect(FLOOR_MANAGER_FIXTURE_UNSUPPORTED_NOTICES.length).toBeGreaterThan(0);

    expectAccessible(container);
    expectVietnamese(container);
  });

  it('màn ĐÃ NỐI DÂY đọc hai câu đó thẳng từ cổng thật, không ai gõ lại chuỗi nào', async () => {
    await mountScreen();

    console.log(
      `[NGHIEM-6] màn đã nối dây nói ra ${String(FLOOR_MANAGER_FIXTURE_UNSUPPORTED_NOTICES.length)} khoản nợ của cổng`,
    );

    for (const notice of FLOOR_MANAGER_FIXTURE_UNSUPPORTED_NOTICES) {
      expect(screen.getByText(notice)).toBeInTheDocument();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Bốn bộ khẳng định dùng chung (R-72, R-67, A1).                              */
/* -------------------------------------------------------------------------- */

describe('khả năng tiếp cận và tiếng Việt', () => {
  for (const state of SEVEN_STATES) {
    it(`trạng thái "${SEVEN_STATE_LABELS[state]}" đi qua expectAccessible và expectVietnamese`, () => {
      const { container } = renderState(state);

      expectAccessible(container);
      expectVietnamese(container);
    });
  }

  it('màn đã nối dây cũng đi qua expectAccessible và expectVietnamese', async () => {
    const { container } = renderWithProviders(
      <FloorManagerContainer
        gateway={createMockFloorManagerGateway()}
        projectId={PROJECT_ID}
        roles={['engineer']}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(TABLE_CAPTION_TEXT)).toBeInTheDocument();
    });

    expectAccessible(container);
    expectVietnamese(container);
  });
});

describe('màu lấy từ token (A1)', () => {
  it('không một mã màu thô nào trong cả thư mục màn', () => {
    expectNoRawColor('src/screens/qc/FloorManager');
  });
});
