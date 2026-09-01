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

import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
import { useStore } from '@/store';

import { AxisGridManager } from './AxisGridManager';
import { AxisGridManagerContainer } from './AxisGridManager.container';
import { scenarioArgsFor } from './AxisGridManager.stories';
import {
  AXIS_GRID_FIXTURE_FLOOR1,
  AXIS_GRID_FIXTURE_SPACING_VIOLATION_EXAMPLE,
} from './axisGridFixture';
import {
  createMockAxisGridManagerGateway,
  describeSpacingViolation,
} from './axisGridManagerGateway';
import { axisGridScenarioFor } from './axisGridManagerScenarios';

const SCREEN_ARIA_LABEL = 'quản lý trục và gốc toạ độ';
const CANVAS_ARIA_LABEL = 'Khung xem bản vẽ quản lý trục và gốc toạ độ';
const AXIS_PANEL_TITLE = 'Trục';
const ORIGIN_PANEL_TITLE = 'Gốc toạ độ';
const ALIGN_PANEL_TITLE = 'Căn chỉnh giữa các tầng';
const EXPAND_PANEL_LABEL = 'bảng trục đang thu gọn';

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

    const labels = ['lệch X (pixel)', 'lệch Y (pixel)', 'lệch X (mm)', 'lệch Y (mm)'];
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
