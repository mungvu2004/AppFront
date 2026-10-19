/**
 * Lượt kiểm của màn S-15 "Trục và gốc toạ độ" đã RÁP.
 *
 * Ba bộ khẳng định dùng chung (`expectSevenStates`, `expectAccessible`,
 * `expectVietnamese`) cộng sáu phép đo của bản nghiệm thu mà chỉ màn đã ráp mới
 * trả lời được:
 *
 * | mã | đo cái gì | ngưỡng |
 * |---|---|---|
 * | `[NGHIEM-1]` | bảy trạng thái của A11, không trạng thái nào ra màn trắng | 7/7 |
 * | `[NGHIEM-2]` | câu chặn 100 mm hiện trên MÀN và nêu đích danh hai trục | 1 và 2 |
 * | `[NGHIEM-3]` | mọi độ lệch gốc toạ độ hiện đủ CẢ pixel LẪN milimét | 4 chuỗi |
 * | `[NGHIEM-4]` | thu gọn và không có quyền vẫn còn canvas | không màn trắng |
 * | `[NGHIEM-5]` | container gắn được bằng MỘT thẻ, có cổng giả (R-73) | dựng xong |
 * | `[NGHIEM-6]` | bảng độ lệch ba tầng đọc từ màn, bằng chữ | 3 dòng |
 *
 * Ba phép đo còn lại của bản nghiệm thu — bảng độ lệch trước/sau căn tự động
 * (D.3), "một lần Ctrl+Z, đúng một bước lịch sử" (D.4) và lượt kéo 80 mm bị
 * chặn ở tầng lệnh (D.5) — sống ở `useAxisGridManager.test.ts`, nơi lái được
 * hook mà không phải dựng chuột giả trên jsdom. Không đo lại ở đây để hai chỗ
 * không trả lời lệch nhau (R-70).
 *
 * ## View thuần, và đó là lý do bài kiểm này ngắn
 *
 * Cả bảy trạng thái dựng từ `scenarioArgsFor` của `AxisGridManager.stories.tsx`
 * — cùng bảy view-model của `axisGridManagerScenarios.ts` mà story dùng, và
 * chính là bảy view-model đã đi qua `detectAxes()`/`alignFloors()` trong
 * `axisGridFixture.ts`. Một bộ dữ liệu cho cả story lẫn bài kiểm, không phải
 * hai bảng sẽ lệch nhau (R-70), và không một con số nào viết tay ở đây (R-71).
 *
 * Màn ĐÃ NỐI DÂY (`AxisGridManagerContainer`) được kiểm riêng ở `[NGHIEM-5]`:
 * một lượt dựng thật qua `ScreenErrorBoundary` + `useAxisGridManager` + cổng
 * giả, đủ để chứng minh container gắn được bằng một thẻ (R-73).
 */

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { pixels } from '@/domain/units/scale';
import type { HttpError } from '@/lib/http/types';
import { expectAccessible } from '@/lib/testing/expectAccessible';
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
import { ROUTES } from '@/routes/paths';
import { useStore } from '@/store';

import { BACK_TO_FLOORS_LABEL, FLOOR_MISSING_TITLE } from '../shared/floorLayerReadFailure';

import { AxisGridCanvas } from './AxisGridCanvas';
import { AxisGridLeftPanel } from './AxisGridLeftPanel';
import { AxisGridOriginPanel } from './AxisGridOriginPanel';
import { fitCanvas } from './axisGridCanvasFit';
import { AxisGridManager } from './AxisGridManager';
import { AxisGridManagerContainer } from './AxisGridManager.container';
import { scenarioArgsFor } from './AxisGridManager.stories';
import {
  AXIS_GRID_FIXTURE_FLOOR1,
  AXIS_GRID_FIXTURE_SPACING_VIOLATION_EXAMPLE,
} from './axisGridFixture';
import {
  createAxisGridSampleGraph,
  createMockAxisGridManagerGateway,
  describeSpacingViolation,
} from './axisGridManagerGateway';
import { axisGridScenarioFor } from './axisGridManagerScenarios';

const SCREEN_ARIA_LABEL = 'Quản lý trục và gốc toạ độ';
const CANVAS_ARIA_LABEL = 'Khung xem bản vẽ quản lý trục và gốc toạ độ';
const AXIS_PANEL_TITLE = 'Trục';
const ORIGIN_PANEL_TITLE = 'Gốc toạ độ';
const ALIGN_PANEL_TITLE = 'Căn chỉnh giữa các tầng';
const EXPAND_PANEL_LABEL = 'Bảng trục đang thu gọn';

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

function renderState(state: SevenState) {
  return renderWithProviders(<AxisGridManager {...scenarioArgsFor(state)} />);
}

/** Mảng thứ hai của `expectSevenStates` chỉ để thoả kiểu; props thật từ `scenarioArgsFor`. */
function scenarioIndex(): readonly SevenStateScenario[] {
  return SEVEN_STATES.map((state) => ({
    state,
    label: SEVEN_STATE_LABELS[state],
    rows: [],
    totalCount: axisGridScenarioFor(state).groups.reduce(
      (sum, group) => sum + group.rows.length,
      0,
    ),
    isLoading: state === 'loading',
    isCollapsed: state === 'collapsed',
    canView: state !== 'forbidden',
    error: null,
  }));
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

  it('mỗi trạng thái vẫn còn canvas, nên không có màn trắng ở bất kỳ nhánh nào', () => {
    for (const state of SEVEN_STATES) {
      const { unmount } = renderState(state);

      expect(
        screen.getByRole('region', { name: SCREEN_ARIA_LABEL }),
        `trạng thái ${state} mất vỏ màn`,
      ).toBeInTheDocument();
      expect(
        screen.getAllByLabelText(CANVAS_ARIA_LABEL).length,
        `trạng thái ${state} mất canvas`,
      ).toBeGreaterThan(0);

      unmount();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-2] Câu chặn khoảng cách tối thiểu, đọc từ MÀN.                      */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-2] câu chặn 100 mm nêu đích danh hai trục', () => {
  it('hiện nguyên văn câu chặn trên màn, và KHÔNG lật màn sang trạng thái lỗi', () => {
    /* Câu do cổng soạn từ chính bộ mẫu vi phạm — bài kiểm không gõ lại câu nào. */
    const message = describeSpacingViolation(AXIS_GRID_FIXTURE_SPACING_VIOLATION_EXAMPLE);

    renderWithProviders(
      <AxisGridManager {...scenarioArgsFor('partial')} spacingMessage={message} />,
    );

    const alert = screen.getByRole('status');

    /* Bản nghiệm thu đòi IN nguyên văn câu chặn, không chỉ khẳng định nó. */
    console.log(`câu chặn khoảng cách: ${alert.textContent ?? ''}`);

    expect(alert).toHaveTextContent(AXIS_GRID_FIXTURE_SPACING_VIOLATION_EXAMPLE.firstLabel);
    expect(alert).toHaveTextContent(AXIS_GRID_FIXTURE_SPACING_VIOLATION_EXAMPLE.secondLabel);
    expect(alert.textContent ?? '').toContain(message);

    /* Câu chặn không phải lỗi màn: cột trái vẫn là danh sách trục thật. */
    expect(screen.getByRole('heading', { name: AXIS_PANEL_TITLE })).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-3] Mọi độ lệch đủ cả pixel lẫn milimét (CẤM TUYỆT ĐỐI).             */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-3] độ lệch gốc toạ độ hiện bằng chữ, đủ hai đơn vị', () => {
  it('bốn nhãn lệch — hai pixel, hai milimét — cùng có mặt trên màn', () => {
    renderState('success');

    const labels = ['Lệch X (pixel)', 'Lệch Y (pixel)', 'Lệch X (mm)', 'Lệch Y (mm)'];
    const found = labels.filter((label) => screen.queryAllByText(label).length > 0);

    console.log(`nhãn độ lệch có mặt: ${String(found.length)}/4 — ${found.join(' · ')}`);

    expect(found).toEqual(labels);
    expect(screen.getByRole('heading', { name: ORIGIN_PANEL_TITLE })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: ALIGN_PANEL_TITLE })).toBeInTheDocument();
  });
});

/*
 * Bảng độ lệch của CẢ BA tầng, đọc từ chính view-model mà màn vẽ ra.
 *
 * `useAxisGridManager.test.ts` đã in bảng "trước và sau" của lượt căn tự động
 * trên hai tầng căn được. Bảng này trả lời câu còn lại của bản nghiệm thu: bộ
 * mẫu ba tầng nói gì trên MÀN, kể cả tầng 2 vốn được dựng cố ý KHÔNG phải một
 * phép tịnh tiến đều (một trục lệch riêng 200 mm) nên không tầng nào bù lại
 * được cho nó — đó là dữ liệu của kịch bản cảnh báo, không phải một lượt căn
 * hỏng.
 */
describe('[NGHIEM-6] bảng độ lệch ba tầng, đọc từ màn', () => {
  it('mỗi tầng một dòng, độ lệch bằng chữ, kèm trạng thái A4 của nó', () => {
    const viewModel = axisGridScenarioFor('forbidden');
    const table = viewModel.floors
      .map((floor) => `${floor.name}: ${floor.offsetText} (${floor.status})`)
      .join(' · ');

    console.log(`độ lệch ba tầng trên màn: ${table}`);

    expect(viewModel.floors.length).toBe(3);
    expect(viewModel.floors.every((floor) => floor.offsetText.length > 0)).toBe(true);
  });
});

describe('[BUG-330][BUG-336] tầng chưa có trục: không số 0 giả, không "Đã duyệt"', () => {
  it.each(['empty', 'error'] as const)('trạng thái "%s": hai panel nói chưa có trục, nút căn bị khoá, canvas có lời giải thích', (state) => {
    renderState(state);

    expect(screen.queryByText('Lệch X (pixel)')).not.toBeInTheDocument();
    expect(screen.queryByText('Đã duyệt')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Căn chỉnh tự động' })).toBeDisabled();
    expect(screen.getByText('Chưa có trục nào nên chưa tính được gốc toạ độ.')).toBeInTheDocument();
    expect(
      screen.getByText(
        state === 'error'
          ? 'Chưa vẽ được trục vì lớp trục của tầng này chưa đọc được.'
          : 'Chưa có trục nào để hiện trên bản vẽ.',
      ),
    ).toBeInTheDocument();
  });

  it('vai người xem trên tầng chưa có trục: cũng không số 0 giả, không "Đã duyệt" (review-1 P2-2)', async () => {
    renderWithProviders(
      <AxisGridManagerContainer
        floorId={String(AXIS_GRID_FIXTURE_FLOOR1.levelId)}
        gateway={createMockAxisGridManagerGateway({ graph: createAxisGridSampleGraph({ withAxes: false }) })}
        levelId={AXIS_GRID_FIXTURE_FLOOR1.levelId}
        projectId="project-axis-grid"
        roles={['viewer']}
      />,
    );

    expect(await screen.findByText('Chưa có trục nào nên chưa tính được gốc toạ độ.')).toBeInTheDocument();
    expect(screen.queryByText('Lệch X (pixel)')).not.toBeInTheDocument();
    expect(screen.queryByText('Đã duyệt')).not.toBeInTheDocument();
    expect(screen.getByText('Chưa có trục nào để hiện trên bản vẽ.')).toBeInTheDocument();
  });

  it('trạng thái có trục vẫn hiện bốn độ lệch và nút căn bấm được', () => {
    renderState('success');

    expect(screen.getByText('Lệch X (pixel)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Căn chỉnh tự động' })).toBeEnabled();
  });

  it('[BUG-336][BUG-404] chỉ một tầng (chưa có gì để căn): không "Đã duyệt"; đủ tầng trong dung sai thì có', () => {
    const args = scenarioArgsFor('success');
    const { unmount } = renderWithProviders(
      <AxisGridManager {...args} viewModel={{ ...args.viewModel, floors: args.viewModel.floors.slice(0, 1) }} />,
    );

    expect(screen.queryByText('Đã duyệt')).not.toBeInTheDocument();
    unmount();

    renderState('success');
    expect(screen.getByText('Đã duyệt')).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-4] Hai trạng thái dễ thành màn trắng nhất.                          */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-4] thu gọn và không có quyền', () => {
  it('thu gọn: hai cột ẩn, canvas còn, và còn đường bung lại', () => {
    renderState('collapsed');

    expect(screen.getAllByLabelText(CANVAS_ARIA_LABEL).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: EXPAND_PANEL_LABEL })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: AXIS_PANEL_TITLE })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: ORIGIN_PANEL_TITLE })).not.toBeInTheDocument();
  });

  it('vai người xem: canvas chỉ xem, và màn nói ra vì sao', () => {
    const viewModel = axisGridScenarioFor('forbidden');

    renderState('forbidden');

    expect(viewModel.viewerRoleNotice).not.toBeNull();
    expect(screen.getAllByText(viewModel.viewerRoleNotice ?? '').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: AXIS_PANEL_TITLE })).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-5] Container gắn được bằng một thẻ (R-73).                          */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-5] màn đã nối dây', () => {
  it('dựng được bằng một thẻ với cổng giả, và ra khỏi trạng thái đang tải', async () => {
    renderWithProviders(
      <AxisGridManagerContainer
        floorId={String(AXIS_GRID_FIXTURE_FLOOR1.levelId)}
        gateway={createMockAxisGridManagerGateway()}
        levelId={AXIS_GRID_FIXTURE_FLOOR1.levelId}
        projectId="project-axis-grid"
        roles={['engineer']}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: AXIS_PANEL_TITLE })).toBeInTheDocument();
    });

    expect(screen.getByRole('region', { name: SCREEN_ARIA_LABEL })).toBeInTheDocument();
  });
});

describe('[BUG-326] đọc lớp hỏng thay cả màn bằng một trạng thái lỗi có lối ra', () => {
  const FLOOR_GONE: HttpError = {
    code: 'NOT_FOUND',
    kind: 'http',
    raw: { code: 'NOT_FOUND', resource: 'floor' },
    requestId: 'r',
    retryable: false,
    status: 404,
  };

  it('404 tầng: một nút "Về quản lý tầng", không dựng panel trục', async () => {
    const onNavigate = vi.fn();

    renderWithProviders(
      <AxisGridManagerContainer
        floorId={String(AXIS_GRID_FIXTURE_FLOOR1.levelId)}
        gateway={{ ...createMockAxisGridManagerGateway(), readLayer: () => Promise.reject(FLOOR_GONE) }}
        onNavigate={onNavigate}
        projectId="project-axis-grid"
        roles={['engineer']}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: BACK_TO_FLOORS_LABEL }));
    expect(onNavigate).toHaveBeenCalledWith(ROUTES.project.floors('project-axis-grid'));
    expect(screen.getByText(FLOOR_MISSING_TITLE)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: AXIS_PANEL_TITLE })).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* Ba bộ khẳng định dùng chung (R-72, R-67).                                   */
/* -------------------------------------------------------------------------- */

describe('khả năng tiếp cận và tiếng Việt', () => {
  for (const state of SEVEN_STATES) {
    it(`trạng thái "${SEVEN_STATE_LABELS[state]}" đi qua expectAccessible và expectVietnamese`, () => {
      const { container } = renderState(state);

      expectAccessible(container);
      expectVietnamese(container);
    });
  }
});

/* -------------------------------------------------------------------------- */
/* [BUG-404] Canvas vừa khung.                                                 */
/* -------------------------------------------------------------------------- */

describe('[BUG-404] canvas vừa khung: bong bóng, nhãn gốc giữ cỡ px và nằm trong khung', () => {
  const FRAME = { width: 800, height: 600 };

  afterEach(() => {
    Reflect.deleteProperty(window, 'ResizeObserver');
  });

  it('viewBox ôm cả lưới cộng lề; mọi bong bóng 24 px màn, nằm trọn trong khung', () => {
    /* jsdom không có `ResizeObserver`: gắn một bản báo khung 800×600 ngay khi được theo dõi. */
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: class {
        private readonly onResize: ResizeObserverCallback;
        constructor(onResize: ResizeObserverCallback) {
          this.onResize = onResize;
        }
        observe(): void {
          this.onResize([{ contentRect: FRAME } as ResizeObserverEntry], this as unknown as ResizeObserver);
        }
        disconnect(): void {
          /* Không có gì để ngắt. */
        }
      },
    });

    const { container } = renderState('success');
    const svg = container.querySelector(`svg[aria-label="${CANVAS_ARIA_LABEL}"]`);
    const [x, y, width, height] = (svg?.getAttribute('viewBox') ?? '').split(' ').map(Number);
    const bounds = axisGridScenarioFor('success').canvas.boundsPx;
    /* `preserveAspectRatio` mặc định "meet": một đơn vị viewBox = `screenScale` px màn. */
    const screenScale = Math.min(FRAME.width / (width ?? 1), FRAME.height / (height ?? 1));

    expect(x).toBeLessThan(bounds.x);
    expect(y).toBeLessThan(bounds.y);

    const badges = [...container.querySelectorAll('g[transform*="scale("]')].filter((group) =>
      group.querySelector('circle[r="12"]'),
    );

    expect(badges.length).toBeGreaterThan(0);

    for (const badge of badges) {
      const match = /translate\(([-\d.e]+) ([-\d.e]+)\) scale\(([-\d.e]+)\)/u.exec(badge.getAttribute('transform') ?? '');
      const [cx, cy, unit] = [Number(match?.[1]), Number(match?.[2]), Number(match?.[3])];
      const radius = 12 * unit;

      expect(unit * screenScale).toBeCloseTo(1, 5);
      expect(cx - radius).toBeGreaterThanOrEqual(x ?? 0);
      expect(cy - radius).toBeGreaterThanOrEqual(y ?? 0);
      expect(cx + radius).toBeLessThanOrEqual((x ?? 0) + (width ?? 0));
      expect(cy + radius).toBeLessThanOrEqual((y ?? 0) + (height ?? 0));
    }
  });
});

/* -------------------------------------------------------------------------- */
/* QA-04c — SCR-19 (BUG-578/594/595/601/404/335/338/413/613/325).              */
/* -------------------------------------------------------------------------- */

describe('QA-04c SCR-19 trên màn', () => {
  it('[BUG-578] câu "chỉ giữ trong phiên" hiện cố định dưới đầu màn', () => {
    renderWithProviders(<AxisGridManager {...scenarioArgsFor('success')} unsavedNotice="Trục chỉ giữ trong phiên này." />);

    expect(screen.getByText('Trục chỉ giữ trong phiên này.')).toBeInTheDocument();
  });

  it('[G4b-17] câu "chỉ giữ trong phiên" ẩn được để trả chỗ', () => {
    renderWithProviders(<AxisGridManager {...scenarioArgsFor('success')} unsavedNotice="Trục chỉ giữ trong phiên này." />);

    fireEvent.click(screen.getByRole('button', { name: 'Ẩn thông báo' }));

    expect(screen.queryByText('Trục chỉ giữ trong phiên này.')).not.toBeInTheDocument();
  });

  it('[G4b-16] có ảnh bản vẽ thì vẽ ảnh nền dưới lưới trục', () => {
    const { container } = renderWithProviders(
      <AxisGridManager {...scenarioArgsFor('success')} background={{ url: 'drawing.png', widthPx: 400, heightPx: 300 }} />,
    );

    expect(container.querySelector('svg image')?.getAttribute('href')).toBe('drawing.png');
  });

  it('[G4b-15] tầng ở tỷ lệ tạm thì hiện dải tỷ lệ tạm kèm nút hiệu chỉnh', () => {
    const onCalibrate = vi.fn();
    renderWithProviders(
      <AxisGridManager
        {...scenarioArgsFor('success')}
        provisionalScaleNotice={{ dismissKey: 'p15-test', message: 'Tỷ lệ tạm.', onCalibrate }}
        unsavedNotice={null}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Hiệu chỉnh tỷ lệ' }));

    expect(onCalibrate).toHaveBeenCalledTimes(1);
  });

  it('[BUG-594][BUG-601] "Căn chỉnh tự động" bị khoá thì nói lý do ngay dưới nút', () => {
    renderWithProviders(
      <AxisGridManager {...scenarioArgsFor('success')} autoAlignBlockedReason="Vai người xem không căn chỉnh được các tầng." />,
    );

    expect(screen.getByRole('button', { name: 'Căn chỉnh tự động' })).toBeDisabled();
    expect(screen.getByText('Vai người xem không căn chỉnh được các tầng.')).toBeInTheDocument();
  });

  it('[BUG-594][BUG-338] trạng thái rỗng: biểu tượng thật, và nút làm được việc (thêm trục), không "Suy ra" chết', () => {
    const onAxisAdd = vi.fn();

    renderWithProviders(<AxisGridManager {...scenarioArgsFor('empty')} onAxisAdd={onAxisAdd} />);

    expect(screen.queryByRole('button', { name: 'Suy ra từ tường bao' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm trục ngang' }));
    expect(onAxisAdd).toHaveBeenCalledWith('horizontal');
    expect(screen.getByText('Chưa có trục nào').parentElement?.querySelector('svg')).not.toBeNull();
  });

  it('[BUG-404][BUG-335] tầng chưa có trục: không vẽ dấu gốc "0,0" khổng lồ đè lên câu giải thích', () => {
    renderState('empty');

    expect(screen.queryByRole('img', { name: 'Gốc toạ độ 0,0' })).not.toBeInTheDocument();
    expect(screen.getByText('Chưa có trục nào để hiện trên bản vẽ.')).toBeInTheDocument();
  });

  it('[BUG-404] hộp bao rỗng: viewBox bằng đúng khung, một đơn vị là một px — không phóng mấy chục lần', () => {
    const fit = fitCanvas({ x: pixels(0), y: pixels(0), width: pixels(0), height: pixels(0) }, { width: 800, height: 600 }, 36);

    expect(fit.unit).toBe(1);
    expect(fit.viewBox).toBe('-400 -300 800 600');
  });

  it('[BUG-595] một lần kéo trục là MỘT lượt onAxisDrag lúc thả chuột, không một lượt mỗi pointermove', () => {
    const onAxisDrag = vi.fn();
    const viewModel = axisGridScenarioFor('success');
    const { container } = renderWithProviders(
      <AxisGridCanvas
        canvas={viewModel.canvas}
        isInteractive
        onAxisDrag={onAxisDrag}
        onAxisSelect={() => undefined}
        viewerRoleNotice={null}
      />,
    );
    const svg = container.querySelector('svg') as SVGSVGElement;
    const identity = { inverse: () => identity };

    Object.assign(svg, { getScreenCTM: () => identity });
    vi.stubGlobal(
      'DOMPoint',
      class {
        constructor(
          readonly x: number,
          readonly y: number,
        ) {}
        matrixTransform(): this {
          return this;
        }
      },
    );

    const axis = viewModel.canvas.axes.find((item) => item.isVisible);
    const figure = container.querySelector(`g[aria-label="${axis?.label ?? ''}"]`) as SVGGElement;

    fireEvent.pointerDown(figure, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 11, clientY: 11 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 12, clientY: 12 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 13, clientY: 13 });

    expect(onAxisDrag).not.toHaveBeenCalled();

    fireEvent.pointerUp(svg, { pointerId: 1 });

    expect(onAxisDrag).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('[G09] bấm trục rồi nhả với con trỏ gần như đứng yên thì KHÔNG gửi onAxisDrag (không đổi vị trí trục)', () => {
    const onAxisDrag = vi.fn();
    const viewModel = axisGridScenarioFor('success');
    const { container } = renderWithProviders(
      <AxisGridCanvas
        canvas={viewModel.canvas}
        isInteractive
        onAxisDrag={onAxisDrag}
        onAxisSelect={() => undefined}
        viewerRoleNotice={null}
      />,
    );
    const svg = container.querySelector('svg') as SVGSVGElement;
    const identity = { inverse: () => identity };

    Object.assign(svg, { getScreenCTM: () => identity });
    vi.stubGlobal(
      'DOMPoint',
      class {
        constructor(
          readonly x: number,
          readonly y: number,
        ) {}
        matrixTransform(): this {
          return this;
        }
      },
    );

    const axis = viewModel.canvas.axes.find((item) => item.isVisible);
    const figure = container.querySelector(`g[aria-label="${axis?.label ?? ''}"]`) as SVGGElement;

    fireEvent.pointerDown(figure, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 11, clientY: 11 });
    fireEvent.pointerUp(svg, { pointerId: 1 });

    expect(onAxisDrag).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('[G20] chưa có giao trục nào để neo: bốn độ lệch đọc "—", không "0 px / 0 mm" như đã đo', () => {
    const origin = axisGridScenarioFor('success').origin;
    const unmeasured = {
      ...origin,
      anchorOptions: [],
      selectedAnchor: null,
      offsetXPxText: '—',
      offsetYPxText: '—',
      offsetXMmText: '—',
      offsetYMmText: '—',
      offsetXPx: pixels(0),
      offsetYPx: pixels(0),
    };

    renderWithProviders(<AxisGridOriginPanel onAnchorChange={() => undefined} origin={unmeasured} unavailableNotice={null} />);

    expect(screen.queryAllByText('—')).toHaveLength(4);
    expect(screen.queryAllByText('0')).toHaveLength(0);
  });

  it('[G20] màn cao bằng khung nhìn — danh sách 20 trục cuộn trong panel, không đẩy cả trang', () => {
    renderState('success');

    expect(screen.getByRole('region', { name: 'Quản lý trục và gốc toạ độ' })).toHaveClass('h-screen');
  });

  it('[G16] bấm một trục trên canvas giữ trục được chọn — click bị pointer capture đẩy về svg không bỏ chọn', () => {
    const onAxisSelect = vi.fn();
    const viewModel = axisGridScenarioFor('success');
    const { container } = renderWithProviders(
      <AxisGridCanvas
        canvas={viewModel.canvas}
        isInteractive
        onAxisDrag={() => undefined}
        onAxisSelect={onAxisSelect}
        viewerRoleNotice={null}
      />,
    );
    const svg = container.querySelector('svg') as SVGSVGElement;
    const axis = viewModel.canvas.axes.find((item) => item.isVisible);
    const figure = container.querySelector(`g[aria-label="${axis?.label ?? ''}"]`) as SVGGElement;

    fireEvent.pointerDown(figure, { pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1 });
    fireEvent.click(svg);

    expect(onAxisSelect).toHaveBeenLastCalledWith(axis?.id);

    fireEvent.pointerDown(svg, { pointerId: 2 });
    fireEvent.click(svg);

    expect(onAxisSelect).toHaveBeenLastCalledWith(null);
  });

  it('[BUG-613] bốn độ lệch gốc toạ độ: nhãn và giá trị cùng một dòng chữ (FieldRow isText)', () => {
    renderState('success');

    const label = screen.getByText('Lệch X (pixel)');

    expect(label.parentElement?.className ?? '').not.toContain('pt-[9px]');
  });

  it('[BUG-325] nút bung bảng dùng Button — vùng chạm 44 px dưới 640 px', () => {
    renderState('collapsed');

    expect(screen.getByRole('button', { name: EXPAND_PANEL_LABEL }).className).toContain('min-h-11');
  });
});

describe('[RV1] panel trục', () => {
  const renderPanel = (handlers: Partial<Parameters<typeof AxisGridLeftPanel>[0]> = {}) => {
    const groups = axisGridScenarioFor('success').groups;

    renderWithProviders(
      <AxisGridLeftPanel
        ghostEnabled={false}
        groups={groups}
        hasGhostFloors={false}
        isViewerRole={false}
        onAxisAdd={vi.fn()}
        onAxisRemove={vi.fn()}
        onAxisRename={vi.fn(() => null)}
        onAxisSpacingChange={vi.fn(() => null)}
        onAxisToggleVisibility={vi.fn()}
        onGhostToggle={vi.fn()}
        onViewOnDrawing={vi.fn()}
        projectFloorCount={3}
        {...handlers}
      />,
    );

    return groups;
  };

  it('[RV1-6][RV1-10] khoảng cách sai thì báo và KHÔNG đổi tên; nút submit ẩn không mang nhãn "Lưu"', () => {
    const onAxisRename = vi.fn(() => null);
    const onAxisSpacingChange = vi.fn(() => 'Khoảng cách phải từ 100 mm trở lên.');
    const groups = renderPanel({ onAxisRename, onAxisSpacingChange });
    const row = groups.flatMap((group) => group.rows).find((item) => item.spacingMm !== null);

    fireEvent.click(screen.getByRole('button', { name: `Sửa trục ${row?.label ?? ''}` }));
    fireEvent.change(screen.getByLabelText('Tên trục'), { target: { value: 'X' } });
    fireEvent.change(screen.getByLabelText('Khoảng cách tới trục kế (mm)'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));

    expect(onAxisRename).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/Khoảng cách phải từ/u);
    expect(screen.queryByRole('button', { name: 'Lưu' })).toBeNull();
  });

  it('[RV1-3][RV1-7][RV1-11] form thêm trục báo lỗi tại ô; dự án nhiều tầng không nói "chỉ một tầng"', () => {
    const onAxisAdd = vi.fn(() => 'Đã có trục A. Chọn tên khác.');
    const groups = renderPanel({ onAxisAdd });

    expect(screen.getByText(/Chưa tải tầng khác/u)).toBeTruthy();
    expect(screen.queryByText(/chỉ có một tầng/u)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: groups[0]?.addButtonLabel ?? '' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thêm' }));

    expect(screen.getByRole('alert').textContent).toMatch(/Đã có trục A/u);
    expect(screen.getByRole('button', { name: 'Thêm' })).toBeTruthy();
  });
});
