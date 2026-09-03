/**
 * Lượt kiểm của màn S-18 "Chuẩn hoá độ dày tường" đã RÁP.
 *
 * Bốn bộ khẳng định dùng chung (`expectSevenStates`, `expectAccessible`,
 * `expectVietnamese`, `expectNoRawColor`) cộng năm phép đo của bản nghiệm thu
 * mà chỉ màn đã ráp mới trả lời được:
 *
 * | mã | đo cái gì | ngưỡng |
 * |---|---|---|
 * | `[NGHIEM-1]` | bảy trạng thái của A11, không trạng thái nào ra màn trắng | 7/7 |
 * | `[NGHIEM-2]` | áp ba nhóm TỪ MÀN → số bước lịch sử, rồi một lượt hoàn tác | 1 bước, về nguyên trạng |
 * | `[NGHIEM-3]` | kéo một ngưỡng qua lại năm lần TỪ MÀN → số bước lịch sử | 0 bước, bốn số đổi |
 * | `[NGHIEM-4]` | "áp dụng lại bộ lọc" → con số trong cảnh báo ĐỌC TỪ MÀN | 9 trên 12 |
 * | `[NGHIEM-5]` | mã màu trong biểu đồ | chỉ token, không mã thô |
 *
 * Mọi con số ấy được IN RA khi chạy (`console.log`), vì bản nghiệm thu đòi con
 * số thật chứ không chỉ một lời khẳng định đã xanh.
 *
 * ## Vì sao bài kiểm này dựng CONTAINER, không dựng view bằng props viết tay
 *
 * Cùng lý lẽ `ThicknessStandardization.stories.tsx`: kịch bản mang NGUYÊN LIỆU
 * đồ thị, và mọi con số của bản nghiệm thu (48 đoạn, 9/12 tường đã duyệt, bốn
 * số tóm tắt) là KẾT QUẢ của `useThicknessStandardization` +
 * `src/lib/geometry/standardize`. Dựng props bằng tay ở đây nghĩa là tự gõ lại
 * đúng những con số đang cần chứng minh — một bài kiểm như vậy không kiểm gì
 * cả. Nên bảy trạng thái đi qua {@link scenarioArgsFor} của file story, tức
 * CÙNG cổng giả và CÙNG bộ mẫu mà story và `useThicknessStandardization.test.ts`
 * dùng (R-70).
 *
 * ## Vì sao `[NGHIEM-4]` đếm lại 9 từ bộ mẫu thay vì gõ số 9
 *
 * Bộ mẫu có {@link FIXTURE_REVIEWED_COUNT} = 12 đoạn `reviewed: true`, nhưng
 * cảnh báo phải nêu số tường đã duyệt **sẽ bị đổi**, không phải số tường đã
 * duyệt nói chung: ba trong số đó không đổi được dù dung sai có nới tới đâu —
 * một đoạn đã đúng độ dày chuẩn (lệnh no-op bị `createChangeWallThicknessCommand`
 * từ chối), một đoạn thuộc cột bê tông cốt thép (không có giá trị mm để gán),
 * và một đoạn lệch quá dung sai. {@link REVIEWED_AND_CHANGEABLE} vì thế đếm
 * lại con số đó TỪ bộ mẫu bằng chính `standardizeThickness`; số 9 chỉ là thứ
 * bài kiểm IN RA, không phải thứ nó giả định.
 *
 * ## Vì sao ngăn xếp hoàn tác được TIÊM vào container
 *
 * `ThicknessStandardizationProps` không mang số bước lịch sử (hợp đồng kiểu đã
 * đóng băng), nên cách duy nhất để đếm bước mà vẫn lái MÀN THẬT là tiêm một
 * `HistoryStack` qua `ThicknessStandardizationContainerProps.history` và đọc
 * `undoSteps().length` — chính ngăn xếp mà lượt `runTransaction` đẩy vào,
 * không phải một bảng đếm thứ hai.
 */

import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Wall, WallId } from '@/domain/spatial/types';
import { createHistoryStack, type HistoryStack } from '@/lib/commands/history';
import { standardizeThickness } from '@/lib/geometry/standardize';
import { createNotificationBus, type NotificationBus } from '@/lib/mutations/notificationBus';
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
import type { ProjectRole } from '@/types/project';
import { useStore } from '@/store';

import { ThicknessStandardizationContainer } from './ThicknessStandardization.container';
import { scenarioArgsFor } from './ThicknessStandardization.stories';
import {
  FIXTURE_REVIEWED_COUNT,
  FIXTURE_SEGMENT_COUNT,
  THICKNESS_FIXTURE_LEVELS,
  THICKNESS_FIXTURE_WALLS,
} from './thicknessFixture';
import {
  createMockThicknessStandardizationGateway,
  deviationOf,
} from './thicknessStandardizationGateway';
import { DEFAULT_TOLERANCE_MM, THICKNESS_GROUP_LABELS } from './thicknessTypes';

/* -------------------------------------------------------------------------- */
/* Nhãn đọc trên màn — cùng chữ mà view và các mảnh con dựng.                   */
/* -------------------------------------------------------------------------- */

const SCREEN_ARIA_LABEL = 'chuẩn hoá độ dày tường';
const HISTOGRAM_SECTION_LABEL = 'Phân bố độ dày đo được';
const SUMMARY_GROUP_LABEL = 'Tóm tắt chuẩn hoá độ dày tường';
const OPEN_PREVIEW_LABEL = 'Xem trước';
const APPLY_LABEL = 'Áp dụng';
const UNDO_LABEL = 'Hoàn tác';
const REAPPLY_FILTER_LABEL = 'Áp dụng lại bộ lọc';
const REAPPLY_WARNING_TITLE = 'Áp dụng lại bộ lọc sẽ đổi tường đã duyệt';
const LOW_THRESHOLD_LABEL = `ngưỡng giữa ${THICKNESS_GROUP_LABELS[110]} và ${THICKNESS_GROUP_LABELS[220]}`;
const HIGH_THRESHOLD_LABEL = `ngưỡng giữa ${THICKNESS_GROUP_LABELS[330]} và ${THICKNESS_GROUP_LABELS.CONCRETE_COLUMN}`;

const PROJECT_ID = 'project-1';
const FLOOR_ID = THICKNESS_FIXTURE_LEVELS[0]?.id ?? '';

/** Vai có quyền sửa lớp — bốn phép đo của bản nghiệm thu đều là vai sửa được. */
const EDITOR_ROLES: readonly ProjectRole[] = ['engineer'];

/**
 * Trần thời gian cho những bài dựng CẢ MÀN nhiều lần.
 *
 * Bộ mẫu là 48 đoạn, và mỗi lượt dựng vẽ hai bảng cộng biểu đồ cộng canvas;
 * bảy trạng thái liên tiếp thì một lượt chạy song song vượt trần mặc định
 * 5.000 ms của vitest. Đây KHÔNG phải nới một khẳng định (R-70): không một
 * phép so sánh nào đổi, chỉ đồng hồ chờ dài ra. Tiền lệ cùng lý do:
 * `DimensionOcrReview.test.tsx` (60.000–120.000 ms).
 */
const HEAVY_TEST_TIMEOUT_MS = 120000;

/** Ba số đo dùng cho bài "áp ba nhóm" — mỗi số một nhóm chuẩn khác nhau. */
const THREE_MEASUREMENTS = [100, 195, 315] as const;

/**
 * Hai từ tiếng Việt KHÔNG có dấu trong tiếng Việt chuẩn.
 *
 * "dung sai" (tolerance) viết đúng chính tả là hai âm tiết không mang dấu nào,
 * nên phép soát cụm của `expectVietnamese` — "hai từ hình dạng tiếng Việt mà
 * cả chuỗi không một dấu nào" — báo nhầm nhãn ô nhập của thanh áp dụng.
 * `allowWords` là đúng cửa mà chính bộ khẳng định mở cho ca này (tiền lệ:
 * `PipelineFailure.test.tsx`, `CadBranchConfirm.test.tsx`), không phải một
 * lượt nới khẳng định: từng từ vẫn bị soát, chỉ hai từ được kê tên là bỏ qua.
 */
const ALLOWED_WORDS: readonly string[] = ['dung', 'sai'];

/* -------------------------------------------------------------------------- */
/* Bộ mẫu — đọc ra, không viết tay lại.                                        */
/* -------------------------------------------------------------------------- */

/** Sai lệch của một đoạn so với nhóm M-05 gán cho nó, đếm lại từ bộ mẫu. */
function fixtureDeviationOf(wall: Wall): number | null {
  const { standardized } = standardizeThickness(wall.thicknessMm);

  return typeof standardized === 'number' ? deviationOf(wall.thicknessMm, standardized) : null;
}

/** Những đoạn ĐÃ DUYỆT mà một lượt chuẩn hoá thật sự đổi được — xem đầu file. */
const REVIEWED_AND_CHANGEABLE: readonly Wall[] = THICKNESS_FIXTURE_WALLS.filter((wall) => {
  const deviation = fixtureDeviationOf(wall);

  return wall.reviewed && deviation !== null && deviation !== 0 && deviation <= DEFAULT_TOLERANCE_MM;
});

const wallsOfMeasurement = (measuredMm: number): readonly Wall[] =>
  THICKNESS_FIXTURE_WALLS.filter((wall) => wall.thicknessMm === measuredMm);

/** Độ dày hiện tại của một tường, đọc THẲNG từ kho — không qua viewmodel. */
const thicknessInStore = (wallId: WallId): number | undefined => {
  const graph = useStore.getState().spatial;
  const wall = graph === null ? undefined : (graph.byId[wallId] as Wall | undefined);

  return wall?.thicknessMm;
};

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

interface Rendered {
  readonly container: HTMLElement;
  readonly history: HistoryStack;
  readonly unmount: () => void;
}

function renderState(state: SevenState, history?: HistoryStack) {
  return renderWithProviders(
    <ThicknessStandardizationContainer
      {...scenarioArgsFor(state)}
      {...(history === undefined ? {} : { history })}
    />,
  );
}

/**
 * Dựng màn trên BỘ MẪU ĐẦY ĐỦ (48 đoạn, ba tầng) rồi chờ lượt đọc xong.
 *
 * Bốn phép đo của bản nghiệm thu nói về bộ mẫu đầy đủ — 48 đoạn, 12 đoạn đã
 * duyệt, 9 trong số đó đổi được — nên chúng KHÔNG dùng kịch bản `partial`
 * (kịch bản ấy cố tình lọc còn hai nhóm 110/220, tức 40 đoạn). Cổng giả không
 * tham số trả đúng `THICKNESS_FIXTURE_GRAPH`, cùng đồ thị mà
 * `useThicknessStandardization.test.ts` lái (R-70).
 */
async function renderMain(options: { readonly notifications?: NotificationBus } = {}) {
  const history = createHistoryStack();
  const rendered = renderWithProviders(
    <ThicknessStandardizationContainer
      floorId={FLOOR_ID}
      gateway={createMockThicknessStandardizationGateway()}
      history={history}
      projectId={PROJECT_ID}
      roles={EDITOR_ROLES}
      {...(options.notifications === undefined ? {} : { notifications: options.notifications })}
    />,
  );

  await screen.findAllByRole('table');

  return { container: rendered.container, history, unmount: rendered.unmount } satisfies Rendered;
}

/** Bốn con số tóm tắt, đọc TỪ MÀN — mỗi ô là một `role="status"`. */
function summaryLines(container: HTMLElement): readonly string[] {
  const group = within(container).getByRole('group', { name: SUMMARY_GROUP_LABEL });

  return within(group)
    .getAllByRole('status')
    .map((line) => line.textContent ?? '');
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
    totalCount: FIXTURE_SEGMENT_COUNT,
    isLoading: state === 'loading',
    isCollapsed: state === 'collapsed',
    canView: state !== 'forbidden',
    error: null,
  }));
}

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
   * jsdom không có `ResizeObserver`; các mảnh con chỉ cần nó để đo khung.
   * Gắn bằng `Object.defineProperty`, cùng lối với `matchMedia` ngay trên.
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
    console.log(`[S-18][NGHIEM-1] expectSevenStates = ${rendered}/${SEVEN_STATES.length}`);

    expect(rendered).toBe(SEVEN_STATES.length);
    expect(rendered).toBe(7);
  }, HEAVY_TEST_TIMEOUT_MS);

  it('mỗi trạng thái vẫn còn vỏ màn và biểu đồ, nên không có màn trắng ở nhánh nào', () => {
    for (const state of SEVEN_STATES) {
      const { unmount } = renderState(state);

      expect(screen.getByRole('region', { name: SCREEN_ARIA_LABEL })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: HISTOGRAM_SECTION_LABEL })).toBeInTheDocument();

      unmount();
    }
  }, HEAVY_TEST_TIMEOUT_MS);
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-2] Áp ba nhóm TỪ MÀN → MỘT bước lịch sử, hoàn tác trả nguyên trạng.  */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-2] áp ba nhóm là ĐÚNG MỘT bước hoàn tác', () => {
  it('tích ba nhóm, xem trước, áp — một bước; rồi "Hoàn tác" trả về nguyên trạng', async () => {
    const notifications: NotificationBus = createNotificationBus();
    const { history } = await renderMain({ notifications });

    const targets = THREE_MEASUREMENTS.flatMap((measuredMm) => wallsOfMeasurement(measuredMm));

    expect(targets.length).toBeGreaterThan(0);
    expect(history.undoSteps()).toHaveLength(0);

    /* CẤM TUYỆT ĐỐI: không tích sẵn — mọi ô đồng ý bắt đầu ở trạng thái tắt. */
    for (const measuredMm of THREE_MEASUREMENTS) {
      const box = screen.getByRole('checkbox', {
        name: new RegExp(`tường ${String(measuredMm)} mm`, 'u'),
      });

      expect(box).not.toBeChecked();
      fireEvent.click(box);
    }

    fireEvent.click(screen.getByRole('button', { name: OPEN_PREVIEW_LABEL }));

    /* Xem trước là XEM: chưa một độ dày nào đổi ở đúng lúc bảng hiện ra. */
    const applyButton = await screen.findByRole('button', { name: APPLY_LABEL });

    expect(history.undoSteps()).toHaveLength(0);
    expect(thicknessInStore(targets[0]?.id as WallId)).toBe(targets[0]?.thicknessMm);

    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(history.undoSteps()).toHaveLength(1);
    });

    console.log(
      `[S-18][NGHIEM-2] áp ${String(THREE_MEASUREMENTS.length)} nhóm (${String(targets.length)} tường) = ` +
        `${String(history.undoSteps().length)} bước lịch sử · ${String(history.undoSteps()[0]?.commands.length)} lệnh trong bước`,
    );

    expect(history.undoSteps()).toHaveLength(1);
    expect(history.undoSteps()[0]?.commands).toHaveLength(targets.length);

    for (const wall of targets) {
      expect(thicknessInStore(wall.id)).toBe(standardizeThickness(wall.thicknessMm).standardized);
    }

    /* A8: một lượt áp = MỘT toast, MỘT vé tám giây. */
    expect(notifications.list()).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: UNDO_LABEL }));

    await waitFor(() => {
      expect(thicknessInStore(targets[0]?.id as WallId)).toBe(targets[0]?.thicknessMm);
    });

    const restored = targets.filter((wall) => thicknessInStore(wall.id) === wall.thicknessMm);

    console.log(
      `[S-18][NGHIEM-2] sau MỘT lượt hoàn tác: ${String(restored.length)}/${String(targets.length)} tường về nguyên trạng · ` +
        `${String(history.undoSteps().length)} bước lịch sử còn lại`,
    );

    expect(restored).toHaveLength(targets.length);
    expect(history.undoSteps()).toHaveLength(0);
    expect(history.canRedo()).toBe(true);
  }, HEAVY_TEST_TIMEOUT_MS);
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-3] Kéo ngưỡng TỪ MÀN là thao tác THUẦN.                             */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-3] kéo ngưỡng qua lại năm lần không ghi gì', () => {
  it('bảng và bốn con số cập nhật, ngăn xếp hoàn tác vẫn đúng KHÔNG bước', async () => {
    const notifications: NotificationBus = createNotificationBus();
    const { container, history } = await renderMain({ notifications });

    const graphBefore = useStore.getState().spatial;
    const thicknessBefore = THICKNESS_FIXTURE_WALLS.map((wall) => thicknessInStore(wall.id));
    const summaryBefore = summaryLines(container);
    const rowsBefore = within(container).getAllByRole('row').length;

    /*
     * Ngưỡng 330 ↔ cột bê tông cốt thép, kéo bằng BÀN PHÍM (A12): jsdom trả bề
     * rộng 0 cho mọi phần tử nên đường chuột của biểu đồ không đo được, còn
     * đường bàn phím thì đi qua đúng `onThresholdDrag` ấy. Năm lượt, có qua có
     * lại: +5 +5 +5 −5 +5 = +15 mm.
     */
    const slider = within(container).getByRole('slider', { name: HIGH_THRESHOLD_LABEL });
    const before = slider.getAttribute('aria-valuenow');

    for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowRight']) {
      fireEvent.keyDown(
        within(container).getByRole('slider', { name: HIGH_THRESHOLD_LABEL }),
        { key },
      );
    }

    const after = within(container)
      .getByRole('slider', { name: HIGH_THRESHOLD_LABEL })
      .getAttribute('aria-valuenow');
    const summaryAfter = summaryLines(container);

    console.log(
      `[S-18][NGHIEM-3] ngưỡng cao: ${String(before)} mm → ${String(after)} mm sau 5 lượt kéo · ` +
        `${String(history.undoSteps().length)} bước lịch sử`,
    );
    console.log(`[S-18][NGHIEM-3] bốn số TRƯỚC = ${summaryBefore.join(' · ')}`);
    console.log(`[S-18][NGHIEM-3] bốn số SAU   = ${summaryAfter.join(' · ')}`);

    /* KHÔNG một lượt ghi nào: ngăn xếp trống, kho giữ nguyên THAM CHIẾU cũ. */
    expect(history.undoSteps()).toHaveLength(0);
    expect(history.canUndo()).toBe(false);
    expect(useStore.getState().spatial).toBe(graphBefore);
    expect(THICKNESS_FIXTURE_WALLS.map((wall) => thicknessInStore(wall.id))).toEqual(
      thicknessBefore,
    );
    expect(notifications.list()).toHaveLength(0);

    /* Nhưng ngưỡng, bốn con số và bảng thì ĐÃ tính lại. */
    expect(after).not.toBe(before);
    expect(summaryAfter).not.toEqual(summaryBefore);
    expect(within(container).getAllByRole('row').length).toBe(rowsBefore);
  }, HEAVY_TEST_TIMEOUT_MS);

  it('ngưỡng thấp cũng kéo được bằng bàn phím, và vẫn không ghi gì', async () => {
    const { container, history } = await renderMain();
    const slider = within(container).getByRole('slider', { name: LOW_THRESHOLD_LABEL });

    fireEvent.keyDown(slider, { key: 'ArrowRight' });

    expect(history.undoSteps()).toHaveLength(0);
  }, HEAVY_TEST_TIMEOUT_MS);
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-4] Áp dụng lại bộ lọc: cảnh báo TRƯỚC, ghi SAU.                      */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-4] áp dụng lại bộ lọc không bao giờ ghi đè im lặng tường đã duyệt', () => {
  it('lượt bấm đầu HIỆN cảnh báo mang đúng số tường đã duyệt sẽ bị đổi', async () => {
    const { container, history } = await renderMain();

    expect(screen.queryByText(REAPPLY_WARNING_TITLE)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: REAPPLY_FILTER_LABEL }));

    /* Cảnh báo phải HIỆN RA — đây là thứ bản T7 làm rơi mất, xem `ThicknessApplyBar`. */
    const warningTitle = await screen.findByText(REAPPLY_WARNING_TITLE);
    const warningText = warningTitle.closest('div')?.textContent ?? '';

    const affected = REVIEWED_AND_CHANGEABLE.length;

    console.log(
      `[S-18][NGHIEM-4] cảnh báo trên màn = "${warningText}" · ` +
        `${String(affected)} trên tổng ${String(FIXTURE_REVIEWED_COUNT)} tường đã duyệt của bộ mẫu`,
    );

    /* Con số đếm TỪ bộ mẫu, không gõ tay — và với bộ mẫu hiện tại nó bằng 9/12. */
    expect(affected).toBe(9);
    expect(FIXTURE_REVIEWED_COUNT).toBe(12);
    expect(affected).toBeLessThan(FIXTURE_REVIEWED_COUNT);
    expect(warningText).toContain(`${String(affected)} tường đã duyệt sẽ bị đổi`);

    /* Cảnh báo là CẢNH BÁO: chưa một độ dày nào đổi. */
    expect(history.undoSteps()).toHaveLength(0);
    expect(container).toBeTruthy();
  }, HEAVY_TEST_TIMEOUT_MS);

  it('"Huỷ" bỏ cảnh báo mà không áp gì — cùng đường phím Escape đang gọi', async () => {
    const { history } = await renderMain();

    fireEvent.click(screen.getByRole('button', { name: REAPPLY_FILTER_LABEL }));
    await screen.findByText(REAPPLY_WARNING_TITLE);

    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }));

    await waitFor(() => {
      expect(screen.queryByText(REAPPLY_WARNING_TITLE)).toBeNull();
    });

    expect(history.undoSteps()).toHaveLength(0);
  }, HEAVY_TEST_TIMEOUT_MS);

  it('"Loại tường đã duyệt ra rồi áp lại" giữ nguyên độ dày của tường đã duyệt', async () => {
    const { history } = await renderMain();

    fireEvent.click(screen.getByRole('button', { name: REAPPLY_FILTER_LABEL }));
    await screen.findByText(REAPPLY_WARNING_TITLE);

    fireEvent.click(
      screen.getByRole('button', { name: 'Loại tường đã duyệt ra rồi áp lại' }),
    );

    await waitFor(() => {
      expect(history.undoSteps()).toHaveLength(1);
    });

    const untouched = REVIEWED_AND_CHANGEABLE.filter(
      (wall) => thicknessInStore(wall.id) === wall.thicknessMm,
    );

    console.log(
      `[S-18][NGHIEM-4] sau khi loại tường đã duyệt: ${String(untouched.length)}/${String(REVIEWED_AND_CHANGEABLE.length)} ` +
        `tường đã duyệt giữ nguyên độ dày`,
    );

    expect(untouched).toHaveLength(REVIEWED_AND_CHANGEABLE.length);
  }, HEAVY_TEST_TIMEOUT_MS);
});

/* -------------------------------------------------------------------------- */
/* Bốn bộ khẳng định dùng chung.                                               */
/* -------------------------------------------------------------------------- */

describe('khả năng tiếp cận, tiếng Việt và màu', () => {
  it('expectAccessible xanh ở trạng thái chính', async () => {
    const { container } = await renderMain();

    expectAccessible(container);
  }, HEAVY_TEST_TIMEOUT_MS);

  it('expectVietnamese xanh ở cả bảy trạng thái', async () => {
    for (const state of SEVEN_STATES) {
      const { container, unmount } = renderState(state);

      await waitFor(() => {
        expect(container.childElementCount).toBeGreaterThan(0);
      });

      expectVietnamese(container, { allowWords: ALLOWED_WORDS });
      unmount();
    }
  }, HEAVY_TEST_TIMEOUT_MS);

  it('[NGHIEM-5] expectNoRawColor xanh trên toàn thư mục màn', () => {
    expectNoRawColor('src/screens/qc/ThicknessStandardization');
  }, HEAVY_TEST_TIMEOUT_MS);
});
