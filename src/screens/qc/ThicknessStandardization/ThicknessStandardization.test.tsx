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
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lowerFirst } from '@/lib/format/sentence';

import { counterLabelOf } from '@/domain/spatial/ids';
import type { Wall, WallId } from '@/domain/spatial/types';
import { createHistoryStack, type HistoryStack } from '@/lib/commands/history';
import type { HttpError } from '@/lib/http/types';
import { standardizeThickness } from '@/lib/geometry/standardize';
import { createNotificationBus, type NotificationBus } from '@/lib/mutations/notificationBus';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';
import { provisionalScaleNoticeOf } from '@/lib/viewmodel/provisionalScale';
import {
  SEVEN_STATES,
  SEVEN_STATE_LABELS,
  type SevenState,
  type SevenStateScenario,
} from '@/lib/testing/sevenStateScenarios';
import { resetSelectorCaches } from '@/store/selectors';
import { ROUTES } from '@/routes/paths';
import type { ProjectRole } from '@/types/project';
import { useStore } from '@/store';

import { BACK_TO_FLOORS_LABEL, FLOOR_MISSING_TITLE } from '../shared/floorLayerReadFailure';

import { ThicknessPreviewCanvas } from './ThicknessPreviewCanvas';
import { ThicknessStandardizationContainer } from './ThicknessStandardization.container';
import { ProvisionalScale, scenarioArgsFor } from './ThicknessStandardization.stories';
import {
  FIXTURE_SEGMENT_COUNT,
  THICKNESS_FIXTURE_LEVELS,
  THICKNESS_FIXTURE_WALLS,
} from './thicknessFixture';
import {
  createMockThicknessStandardizationGateway,
  deviationOf,
} from './thicknessStandardizationGateway';
import { DEFAULT_TOLERANCE_MM, thicknessGroupLabel } from './thicknessTypes';

/* -------------------------------------------------------------------------- */
/* Nhãn đọc trên màn — cùng chữ mà view và các mảnh con dựng.                   */
/* -------------------------------------------------------------------------- */

const SCREEN_ARIA_LABEL = 'Độ dày tường';
const HISTOGRAM_SECTION_LABEL = 'Phân bố độ dày đo được';
const UNDO_LABEL = 'Hoàn tác';
const DETAIL_LABEL = /^Xem bảng từng đoạn \(\d+\)$/u;
const LOW_THRESHOLD_LABEL = `Ngưỡng giữa ${lowerFirst(thicknessGroupLabel(100))} và ${lowerFirst(thicknessGroupLabel(150))}`;
const HIGH_THRESHOLD_LABEL = `Ngưỡng giữa ${lowerFirst(thicknessGroupLabel(400))} và ${lowerFirst(thicknessGroupLabel('CONCRETE_COLUMN'))}`;

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

/**
 * Hai từ tiếng Việt KHÔNG có dấu trong tiếng Việt chuẩn.
 *
 * "Dung sai" (tolerance) viết đúng chính tả là hai âm tiết không mang dấu nào,
 * nên phép soát cụm của `expectVietnamese` — "hai từ hình dạng tiếng Việt mà
 * cả chuỗi không một dấu nào" — báo nhầm nhãn ô nhập của thanh áp dụng.
 * `allowWords` là đúng cửa mà chính bộ khẳng định mở cho ca này (tiền lệ:
 * `PipelineFailure.test.tsx`, `CadBranchConfirm.test.tsx`), không phải một
 * lượt nới khẳng định: từng từ vẫn bị soát, chỉ hai từ được kê tên là bỏ qua.
 */
/* "Xem tay" (danh sách đoạn cột BTCT > 450 mm, S-21) cũng viết đúng mà không mang dấu nào. */
const ALLOWED_WORDS: readonly string[] = ['dung', 'sai', 'xem', 'tay'];

/* -------------------------------------------------------------------------- */
/* Bộ mẫu — đọc ra, không viết tay lại.                                        */
/* -------------------------------------------------------------------------- */

/** Sai lệch của một đoạn so với nhóm M-05 gán cho nó, đếm lại từ bộ mẫu. */
function fixtureDeviationOf(wall: Wall): number | null {
  const { standardized } = standardizeThickness(wall.thicknessMm);

  return typeof standardized === 'number' ? deviationOf(wall.thicknessMm, standardized) : null;
}

/**
 * Lô của bản Z (S-21): đoạn KHÔNG chuẩn (lệch quá dung sai), không phải cột BTCT, chưa duyệt.
 * Đếm lại từ bộ mẫu thang sáu bậc: 65/60 → 100, 265/335 → 300, 365 → 400 (255 đã duyệt nên đứng
 * ngoài lô).
 */
const BATCH_WALLS: readonly Wall[] = THICKNESS_FIXTURE_WALLS.filter((wall) => {
  const deviation = fixtureDeviationOf(wall);

  return !wall.reviewed && deviation !== null && deviation > DEFAULT_TOLERANCE_MM;
});

/** Các bậc đích của lô, tăng dần — đọc từ bộ mẫu, không gõ tay. */
const BATCH_GROUPS: readonly number[] = [
  ...new Set(BATCH_WALLS.map((wall) => standardizeThickness(wall.thicknessMm).standardized as number)),
].sort((first, second) => first - second);

/** Đoạn xem tay: nhóm cột BTCT (trên ngưỡng 450 mm, không có giá trị chuẩn). */
const MANUAL_WALLS: readonly Wall[] = THICKNESS_FIXTURE_WALLS.filter((wall) => fixtureDeviationOf(wall) === null);

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

  /*
   * Hai đường nạp đồ thị đua nhau vào kho (effect gieo bộ mẫu và N16 của
   * `useFloorLayer`); bảng hiện ra ngay khi đường đầu xong. Chờ kho đứng yên
   * qua vài nhịp để mọi bài đọc số liệu trên đồ thị đã ổn định, không theo
   * thứ tự chạy của cả bộ.
   */
  let settledRef = useStore.getState().spatial;
  let calmTicks = 0;

  await waitFor(() => {
    const current = useStore.getState().spatial;

    calmTicks = current === settledRef ? calmTicks + 1 : 0;
    settledRef = current;
    expect(calmTicks).toBeGreaterThanOrEqual(5);
  });

  return { container: rendered.container, history, unmount: rendered.unmount } satisfies Rendered;
}

/** Câu trạng thái dưới H1 ("x/48 đoạn không chuẩn, y đúng chuẩn"). */
const statusText = (): string => screen.getByText(/đoạn không chuẩn,/u).textContent ?? '';

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
  window.sessionStorage.clear();
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

  it('[BUG-637] thu gọn: nút bung khung xem trước nói việc làm', () => {
    const collapsed = renderState('collapsed');

    expect(screen.getByRole('button', { name: 'Mở khung xem trước' })).toBeInTheDocument();
    collapsed.unmount();
  });

  it('[BUG-412] chưa có hình tường: khung xem trước không còn ô chú giải trắng mồ côi', () => {
    const noop = (): void => undefined;
    const { unmount } = renderWithProviders(
      <ThicknessPreviewCanvas
        hoveredGroup={null}
        hoveredWallId={null}
        isCollapsed={false}
        legend={[]}
        onHoverWall={noop}
        shapes={[]}
      />,
    );

    expect(screen.queryByRole('list', { name: 'Chú giải độ dày tường' })).toBeNull();

    unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-2] Đổi cả lô TỪ MÀN → MỘT bước lịch sử, hoàn tác trả nguyên trạng.   */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-2] đổi ba nhóm là ĐÚNG MỘT bước hoàn tác', () => {
  it('chưa tích thì nút chính là "Chọn cả N nhóm"; "Đổi N đoạn" cho một bước; "Hoàn tác" trả nguyên trạng', async () => {
    const notifications: NotificationBus = createNotificationBus();
    const { history } = await renderMain({ notifications });
    const targets = BATCH_WALLS;

    expect(targets.length).toBeGreaterThan(0);
    expect(history.undoSteps()).toHaveLength(0);

    /* CẤM TUYỆT ĐỐI: không tích sẵn — mọi ô đồng ý bắt đầu ở trạng thái tắt. */
    for (const group of BATCH_GROUPS) {
      expect(screen.getByRole('checkbox', { name: new RegExp(`về ${String(group)} mm$`, 'u') })).not.toBeChecked();
    }

    expect(screen.queryByRole('button', { name: /^Đổi \d+ đoạn/u })).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: `Chọn cả ${String(BATCH_GROUPS.length)} nhóm để đổi (${String(targets.length)} đoạn)` }),
    );

    /* Tích là CHỌN: chưa một độ dày nào đổi. */
    const applyButton = await screen.findByRole('button', { name: new RegExp(`^Đổi ${String(targets.length)} đoạn`, 'u') });

    expect(history.undoSteps()).toHaveLength(0);
    expect(thicknessInStore(targets[0]?.id as WallId)).toBe(targets[0]?.thicknessMm);

    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(history.undoSteps()).toHaveLength(1);
    });

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

    expect(targets.filter((wall) => thicknessInStore(wall.id) === wall.thicknessMm)).toHaveLength(targets.length);
    expect(history.undoSteps()).toHaveLength(0);
    expect(history.canRedo()).toBe(true);
  }, HEAVY_TEST_TIMEOUT_MS);

  it('đoạn xem tay đứng ngoài lô, mỗi mã là link sang màn duyệt tường', async () => {
    await renderMain();

    expect(MANUAL_WALLS.length).toBeGreaterThan(0);

    for (const wall of MANUAL_WALLS) {
      expect(
        screen.getByRole('button', { name: `Mở đoạn #${counterLabelOf(wall.id)} ở màn duyệt tường` }),
      ).toBeInTheDocument();
    }
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
    const groupText = (): string => screen.getByTestId('thickness-group-100').textContent ?? '';
    const statusBefore = statusText();
    const summaryBefore = groupText();
    const rowsBefore = within(container).getAllByRole('row').length;

    /*
     * Ngưỡng thấp 100 ↔ 150 (125 mm; quanh ngưỡng cao 450 không có tường nào nên
     * kéo nó không đổi số), kéo bằng BÀN PHÍM (A12): jsdom trả bề
     * rộng 0 cho mọi phần tử nên đường chuột của biểu đồ không đo được, còn
     * đường bàn phím thì đi qua đúng `onThresholdDrag` ấy. Năm lượt, có qua có
     * lại: +5 +5 +5 −5 +5 = +15 mm → 140 mm, tường 135 mm sang nhóm 100 và lệch quá dung sai.
     */
    const slider = within(container).getByRole('slider', { name: LOW_THRESHOLD_LABEL });
    const before = slider.getAttribute('aria-valuenow');

    for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowRight']) {
      fireEvent.keyDown(
        within(container).getByRole('slider', { name: LOW_THRESHOLD_LABEL }),
        { key },
      );
    }

    const after = within(container)
      .getByRole('slider', { name: LOW_THRESHOLD_LABEL })
      .getAttribute('aria-valuenow');
    /* Số trong ô chạy đếm lên (BUG-340: một con số trong câu trạng thái) — đợi nó dừng, không đọc giữa chừng. */
    /* Đoạn 135 mm rời bậc 150 (trong dung sai), sang bậc 100 và lệch 35 mm: dòng nhóm 100 thêm một đoạn. */
    await waitFor(() => {
      expect(groupText()).not.toEqual(summaryBefore);
    });

    const summaryAfter = groupText();

    console.log(
      `[S-18][NGHIEM-3] ngưỡng thấp: ${String(before)} mm → ${String(after)} mm sau 5 lượt kéo · ` +
        `${String(history.undoSteps().length)} bước lịch sử`,
    );
    console.log(`[S-21][NGHIEM-3] nhóm 100 TRƯỚC = ${summaryBefore} · SAU = ${summaryAfter} · ${statusBefore}`);

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

  it('[BUG-606] Home trên ngưỡng cao bị kẹp bởi ngưỡng kề, trục không trôi', async () => {
    const { container } = await renderMain();
    const valueOf = (name: string): number =>
      Number(within(container).getByRole('slider', { name }).getAttribute('aria-valuenow'));
    const midName = `Ngưỡng giữa ${lowerFirst(thicknessGroupLabel(300))} và ${lowerFirst(thicknessGroupLabel(400))}`;
    const minBefore = within(container).getByRole('slider', { name: LOW_THRESHOLD_LABEL }).getAttribute('aria-valuemin');

    fireEvent.keyDown(within(container).getByRole('slider', { name: HIGH_THRESHOLD_LABEL }), { key: 'Home' });

    expect(valueOf(HIGH_THRESHOLD_LABEL)).toBeGreaterThan(valueOf(midName));
    expect(within(container).getByRole('slider', { name: LOW_THRESHOLD_LABEL }).getAttribute('aria-valuemin')).toBe(minBefore);
  }, HEAVY_TEST_TIMEOUT_MS);

  it('[BUG-606] rê một cột biểu đồ làm tường của cột đó sáng hơn các tường khác', async () => {
    const { container } = await renderMain();
    const opacities = (): Set<string | null> =>
      new Set([...container.querySelectorAll('aside svg polygon')].map((p) => p.getAttribute('fill-opacity')));

    expect(opacities().size).toBe(1);

    fireEvent.pointerEnter(container.querySelector('section[aria-label] div.items-end') as Element);

    expect(opacities().size).toBeGreaterThan(1);
  }, HEAVY_TEST_TIMEOUT_MS);
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-4] Tường đã duyệt không bao giờ bị ghi đè im lặng.                   */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-4] tường đã duyệt đứng ngoài lô, câu tóm tắt nói rõ số đó', () => {
  it('chọn cả lô rồi đổi: không tường đã duyệt nào đổi độ dày', async () => {
    const { history } = await renderMain();
    const reviewed = THICKNESS_FIXTURE_WALLS.filter((wall) => wall.reviewed);

    fireEvent.click(screen.getByRole('button', { name: /^Chọn cả \d+ nhóm/u }));

    expect(screen.getByText(new RegExp(`${String(reviewed.length)} tường đã duyệt không nằm trong lô`, 'u'))).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /^Đổi \d+ đoạn/u }));

    await waitFor(() => {
      expect(history.undoSteps()).toHaveLength(1);
    });

    for (const wall of reviewed) {
      expect(thicknessInStore(wall.id)).toBe(wall.thicknessMm);
    }
  }, HEAVY_TEST_TIMEOUT_MS);
});

/* -------------------------------------------------------------------------- */
/* Bốn bộ khẳng định dùng chung.                                               */
/* -------------------------------------------------------------------------- */

describe('P04 cụm C — điều khiển chỉ hiện khi dùng được', () => {
  it('[BUG-601] vai người xem: không ô chọn hàng, không ô "Đồng ý", không ô đổi nhóm', async () => {
    renderWithProviders(
      <ThicknessStandardizationContainer
        floorId={FLOOR_ID}
        gateway={createMockThicknessStandardizationGateway()}
        projectId={PROJECT_ID}
        roles={['viewer']}
      />,
    );

    await screen.findAllByRole('table');

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.queryAllByRole('radiogroup')).toHaveLength(0);
  }, HEAVY_TEST_TIMEOUT_MS);

  it('[BUG-585/593] ô đổi nhóm của hàng ghi thật một bước, và không mời chọn "Cột BTCT"', async () => {
    const { history } = await renderMain();
    const target = wallsOfMeasurement(195)[0] as Wall;

    /* Bảng từng đoạn nằm trong ngăn kéo (bản Z). */
    fireEvent.click(screen.getByRole('button', { name: DETAIL_LABEL }));
    await screen.findByRole('dialog');

    expect(screen.queryAllByRole('radiogroup', { name: /^Độ dày chuẩn hoá của đoạn /u })).toHaveLength(0);

    const row = screen
      .getAllByRole('row')
      /* Ô chọn đọc mã ngắn của tường ("Chọn dòng tường #W-001"), không đọc ULID (Impeccable A3). */
      .find((entry) => within(entry).queryByRole('checkbox', { name: new RegExp(`tường #${counterLabelOf(target.id)}$`, 'u') }) !== null);

    fireEvent.click(within(row as HTMLElement).getByRole('combobox', { name: /^Độ dày chuẩn hoá của đoạn /u }));

    expect(screen.queryByRole('option', { name: 'Cột BTCT' })).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: '300 mm' }));

    await waitFor(() => {
      expect(history.undoSteps()).toHaveLength(1);
    });
    expect(thicknessInStore(target.id)).toBe(300);
  }, HEAVY_TEST_TIMEOUT_MS);

});

describe('đường dẫn đầu màn (B-V6-43)', () => {
  it('màn phủ mọi tầng nên không nêu tầng nào: "Dự án > Độ dày tường"', () => {
    renderState('success');

    expect(screen.queryByText('Dự án > Độ dày tường')).not.toBeInTheDocument();
    expect(screen.queryByText(/Tầng 01 >/u)).not.toBeInTheDocument();
  });
});

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

describe('dải lưu lớp (F-04x-1)', () => {
  it('409 → dải chú ý với nút "Tải lại"', () => {
    const onReload = vi.fn();
    const message = 'Tầng này vừa được sửa ở nơi khác. Tải lại để xem bản mới nhất.';
    const BLOCK = { confirm: null, kind: 'reload', message, onReload } as const;

    renderWithProviders(
      <ThicknessStandardizationContainer {...scenarioArgsFor('partial')} forceSaveBlock={BLOCK} />,
    );

    expect(screen.getAllByRole('alert').some((node) => node.textContent?.includes(message))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});

describe('dải tỷ lệ tạm (F-04x-2)', () => {
  const NOTICE = provisionalScaleNoticeOf('unresolved')?.message ?? '';

  it('tầng unresolved: dải chú ý + "Đặt tỷ lệ" gọi onNavigate', async () => {
    const onNavigate = vi.fn();
    renderWithProviders(
      <ThicknessStandardizationContainer {...scenarioArgsFor('partial')} {...ProvisionalScale.args} onNavigate={onNavigate} />,
    );

    expect(await screen.findByText(NOTICE)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đặt tỷ lệ' }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('tầng có tỉ lệ thật: không dải', async () => {
    renderState('partial');

    await waitFor(() => {
      expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Đặt tỷ lệ' })).not.toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* Đọc lớp hỏng khi chưa có tài liệu: cả màn là MỘT trạng thái lỗi (BUG-326).   */
/* -------------------------------------------------------------------------- */

describe('[BUG-326] đọc lớp hỏng thay cả màn bằng một trạng thái lỗi có lối ra', () => {
  const FLOOR_GONE: HttpError = {
    code: 'NOT_FOUND',
    kind: 'http',
    raw: { code: 'NOT_FOUND', resource: 'floor' },
    requestId: 'r',
    retryable: false,
    status: 404,
  };

  it('404 tầng: một nút "Về quản lý tầng", không dựng biểu đồ và bảng', async () => {
    const onNavigate = vi.fn();

    renderWithProviders(
      <ThicknessStandardizationContainer
        floorId={FLOOR_ID}
        gateway={{ ...createMockThicknessStandardizationGateway(), readLayer: () => Promise.reject(FLOOR_GONE) }}
        onNavigate={onNavigate}
        projectId={PROJECT_ID}
        roles={EDITOR_ROLES}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: BACK_TO_FLOORS_LABEL }));
    expect(onNavigate).toHaveBeenCalledWith(ROUTES.project.floors(PROJECT_ID));
    expect(screen.getByText(FLOOR_MISSING_TITLE)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: HISTOGRAM_SECTION_LABEL })).toBeNull();
  });
});

/* R3 FL-11F-04 (R1/RR1/RR2 stack): focus + Space on the sr-only "Đồng ý" box ended unchecked (Checkbox keydown toggle + native keyup click = two toggles). */
describe('[11F-A-302] phím Space tích ô "Đồng ý" đúng một lần', () => {
  it('focus + Space: ô chuyển sang tích và vẫn tích', async () => {
    await renderMain();
    const user = userEvent.setup({ delay: null });
    const box = screen.getByRole('checkbox', { name: /về 100 mm$/u });

    expect(box).not.toBeChecked();
    box.focus();
    await user.keyboard(' ');
    expect(box).toBeChecked();
  });
});
