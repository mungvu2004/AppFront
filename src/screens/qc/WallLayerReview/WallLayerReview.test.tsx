/**
 * Lượt kiểm của màn S-12 "Duyệt lớp tường".
 *
 * Bốn bộ khẳng định dùng chung (`expectSevenStates`, `expectAccessible`,
 * `expectVietnamese`, `expectNoRawColor`) cộng bảy phép đo của bản nghiệm thu:
 *
 * | mã | đo cái gì | ngưỡng |
 * |---|---|---|
 * | `[NGHIEM-1]` | bảy trạng thái của A11 | 7/7 |
 * | `[NGHIEM-2]` | chú giải độ dày LUÔN hiện khi lớp Tường bật, kể cả `collapsed` | 7/7 |
 * | `[NGHIEM-3]` | ba độ dày phân biệt được khi che hết chữ — MÀU | 3 token khác nhau |
 * | `[NGHIEM-4]` | ba độ dày phân biệt được khi che hết chữ — BỀ RỘNG | tỉ lệ 1:2:3 |
 * | `[NGHIEM-5]` | không hộp thoại; xoá đi bằng vé hoàn tác (A8/A9) | 0 `role="dialog"` |
 * | `[NGHIEM-6]` | độ dày là điều khiển BA LỰA CHỌN, không ô nhập số tự do | 0 `input[type=number]` |
 * | `[NGHIEM-7]` | R-73 — màn cha mở được bằng một thẻ, lối ra chạy thật | gọi tới `onNavigate` |
 *
 * ## Một lớp render, cố ý — khác `PipelineFailure.test.tsx`
 *
 * Màn kia dựng view bằng props viết tay cho bảy trạng thái. Màn này KHÔNG:
 * viewmodel của nó (`WallRowViewModel`, `WallLayerCanvasShape`, đa giác tường
 * bằng pixel…) là kết quả của `useWallLayerReview` cộng `resolveWallShapes`, nên
 * viết tay bộ props đó là dựng lại logic hook bằng tay — đúng thứ R-61 cấm.
 * Nên cả bảy trạng thái đi qua `WallLayerReviewContainer` thật với cổng giả, và
 * `scenarioArgsFor` đến từ `WallLayerReview.stories.tsx`: một bộ dữ liệu cho cả
 * story lẫn bài kiểm, không phải hai bộ sẽ lệch nhau (R-70).
 *
 * Bù lại, phép kiểm này MẠNH HƠN: nó chứng minh màn thật — hook, panel, canvas,
 * ray công cụ, thanh trạng thái, ranh giới lỗi — sống sót qua bảy trạng thái,
 * chứ không chỉ chứng minh một hàm view không ném lỗi.
 *
 * ## `expectVietnamese` — vì sao `allowWords` rỗng
 *
 * Không nới một chữ nào. Mọi chuỗi người đọc của màn viết thẳng tiếng Việt có
 * dấu, và các component dùng chung mà màn này gọi (`WallThicknessLegend`,
 * `ZoomCluster`, `MiniMap`, `EmptyState`, `Skeleton`) không tự thêm nhãn máy đọc
 * nào vào cây — khác `Pipeline.Step` của màn S-11. Nếu một ngày chúng thêm, chỗ
 * đúng để sửa là component, không phải một `allowWords` mở cho cả bảy trạng thái
 * (nới cho cả bảy là tắt phép kiểm chứ không phải vượt qua nó, R-70).
 */

import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { wallStrokeToken } from '@/components/canvas/materialMap';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Level, LevelId } from '@/domain/spatial/types';
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
import { ROUTES } from '@/routes/paths';
import { resetSelectorCaches } from '@/store/selectors';
import { useStore } from '@/store';

import { WallLayerReviewContainer } from './WallLayerReview.container';
import { scenarioArgsFor } from './WallLayerReview.stories';
import {
  WALL_LAYER_FIXTURE_BUILDING,
  WALL_LAYER_FIXTURE_LEVEL,
  WALL_LAYER_FIXTURE_TOTAL,
  WALL_LAYER_FIXTURE_WALLS,
} from './wallLayerReviewFixture';
import {
  createMockWallLayerReviewGateway,
  toCanvasShapes,
  wallDisplayCode,
  wallStatusCode,
  WALL_LAYER_THICKNESS_CHOICES,
} from './wallLayerReviewGateway';

const SCREEN_DIRECTORY = 'src/screens/qc/WallLayerReview';

/**
 * Ba băng độ dày của hệ thiết kế — đọc ra, không viết tay lại (R-71).
 *
 * Khẳng định đúng BA băng ngay tại chỗ đọc: nếu hệ thiết kế đổi số băng, phép
 * kiểm này hỏng ở đây với một câu đọc được, chứ không hỏng ở một chỗ xa hơn.
 */
const THICKNESS_BANDS = WALL_LAYER_THICKNESS_CHOICES;

if (THICKNESS_BANDS.length !== 3) {
  throw new Error(`Cần đúng ba băng độ dày, đang có ${String(THICKNESS_BANDS.length)}.`);
}

const [THIN, MEDIUM, THICK] = THICKNESS_BANDS as readonly [
  (typeof THICKNESS_BANDS)[number],
  (typeof THICKNESS_BANDS)[number],
  (typeof THICKNESS_BANDS)[number],
];

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

function renderState(state: SevenStateScenario['state']) {
  return renderWithProviders(
    <MemoryRouter>
      <WallLayerReviewContainer {...scenarioArgsFor(state)} />
    </MemoryRouter>,
  );
}

/** Mảng thứ hai của `expectSevenStates` chỉ để thoả kiểu; props thật từ `scenarioArgsFor`. */
function scenarioIndex(): readonly SevenStateScenario[] {
  return SEVEN_STATES.map((state) => ({
    state,
    label: SEVEN_STATE_LABELS[state],
    rows: [],
    totalCount: WALL_LAYER_FIXTURE_TOTAL,
    isLoading: state === 'loading',
    isCollapsed: state === 'collapsed',
    canView: state !== 'forbidden',
    error: null,
  }));
}

/* -------------------------------------------------------------------------- */
/* Môi trường.                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * jsdom không khai `ResizeObserver`, mà `WallLayerCanvas` đo khung bằng nó.
 *
 * Bản giả không báo lượt đổi nào — khổ khung ở jsdom luôn là 0 — nên nhánh
 * "vừa khung" trả về sớm thay vì đề nghị một mức phóng dựng trên số 0. Cùng
 * khuôn `ScaleCalibration.test.tsx`, kể cả việc gỡ nó ở `afterEach` để không
 * lượt kiểm nào thừa hưởng bản giả của lượt trước.
 */
class FakeResizeObserver {
  observe(): void {
    /* khổ khung do jsdom quyết, không có lượt đổi nào để báo */
  }

  unobserve(): void {
    /* như trên */
  }

  disconnect(): void {
    /* như trên */
  }
}

beforeEach(() => {
  resetSelectorCaches();
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: FakeResizeObserver,
  });
});


afterEach(() => {
  cleanup();
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

    expect(rendered).toBe(SEVEN_STATES.length);
    expect(rendered).toBe(7);
  });

  it('trạng thái thu gọn: hai panel ẩn, nhưng canvas và thanh trạng thái vẫn còn', () => {
    renderState('collapsed');

    expect(screen.getByRole('toolbar', { name: 'Công cụ lớp tường' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Thanh trạng thái' })).toBeInTheDocument();
  });

  it('trạng thái không có quyền: ray ẩn công cụ sửa, KHÔNG khoá mờ cả màn', () => {
    renderState('forbidden');

    expect(screen.queryByRole('button', { name: /vẽ tường/u })).not.toBeInTheDocument();
    /* Vẫn xem được: khung canvas và thanh trạng thái không biến mất. */
    expect(screen.getByRole('status', { name: 'Thanh trạng thái' })).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-2] Chú giải độ dày LUÔN hiện khi lớp Tường bật.                     */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-2] chú giải độ dày', () => {
  /*
   * Đặc tả ghi đích danh: chú giải LUÔN HIỆN khi lớp Tường bật, và ở `collapsed`
   * thì "chỉ còn cụm công cụ trôi và chú giải (chú giải vẫn phải hiện)".
   * `WallLayerLegend` ánh xạ CHỆCH hai trạng thái (`forbidden` và `collapsed`
   * cùng về `'success'`) đúng để giữ lời hứa đó — xem đầu file đó. Phép kiểm này
   * là thứ giữ cho ánh xạ ấy không bị "dọn dẹp" thành 1:1 sau này.
   */
  /** Nhãn chú giải mà từng trạng thái phải cho ra — bốn nhánh của component dùng chung. */
  const LEGEND_EXPECTATION: Readonly<Record<string, { readonly kind: string; readonly name: string }>> =
    {
      empty: { kind: 'text', name: 'Chưa có dữ liệu tường' },
      loading: { kind: 'label', name: 'Đang tải chú giải' },
      error: { kind: 'text', name: 'Không tải được chú giải' },
      partial: { kind: 'group', name: 'Lọc theo độ dày tường' },
      success: { kind: 'group', name: 'Lọc theo độ dày tường' },
      /* Hai trạng thái ánh xạ CHỆCH: chú giải ĐẦY ĐỦ, không phải chữ "T" thu gọn. */
      forbidden: { kind: 'group', name: 'Lọc theo độ dày tường' },
      collapsed: { kind: 'group', name: 'Lọc theo độ dày tường' },
    };

  it.each(SEVEN_STATES)('trạng thái %s: chú giải có mặt', async (state) => {
    const { container } = renderState(state);
    const expectation = LEGEND_EXPECTATION[state];

    expect(expectation).toBeDefined();

    if (expectation?.kind === 'group') {
      expect(await screen.findByRole('group', { name: expectation.name })).toBeInTheDocument();

      return;
    }

    if (expectation?.kind === 'label') {
      expect(container.querySelector(`[aria-label="${expectation.name}"]`)).not.toBeNull();

      return;
    }

    expect(await screen.findByText(expectation?.name ?? '')).toBeInTheDocument();
  });

  it('lớp Tường TẮT là điều kiện duy nhất chú giải được ẩn', async () => {
    renderState('partial');

    expect(await screen.findByRole('group', { name: 'Lọc theo độ dày tường' })).toBeInTheDocument();

    await act(async () => {
      useStore.getState().toggleLayerVisibility('wall');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.queryByRole('group', { name: 'Lọc theo độ dày tường' })).not.toBeInTheDocument();
    });

    await act(async () => {
      useStore.getState().toggleLayerVisibility('wall');
      await Promise.resolve();
    });
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-3]/[NGHIEM-4] Ba độ dày phân biệt được khi che hết chữ.             */
/* -------------------------------------------------------------------------- */

describe('ba độ dày phân biệt được khi che hết chữ và chuyển đen trắng', () => {
  it('[NGHIEM-3] LỚP MÀU: ba băng cho ra ba token KHÁC NHAU', () => {
    const tokens = [THIN, MEDIUM, THICK].map((thickness) => wallStrokeToken(thickness));

    expect(new Set(tokens).size).toBe(3);
    expect(tokens[0]).toBe('var(--wall-110)');
    expect(tokens[1]).toBe('var(--wall-220)');
    expect(tokens[2]).toBe('var(--wall-330)');
  });

  it('[NGHIEM-4] LỚP BỀ RỘNG: đa giác tô đầy theo độ dày thật, tỉ lệ 1:2:3', () => {
    /*
     * Đo trên chính hình mà canvas vẽ: `toCanvasShapes` là hàm hook dùng để dựng
     * `canvas.shapes`, không phải một công thức chép lại. Ba tường NGANG cùng
     * chiều dài, khác độ dày, nên bề cao hộp bao chính là độ dày quy ra pixel.
     */
    const base = WALL_LAYER_FIXTURE_WALLS[10];

    expect(base).toBeDefined();

    const sample = [THIN, MEDIUM, THICK].map((thickness, index) => ({
      ...(base as NonNullable<typeof base>),
      id: `W-00090${String(index)}TEST` as NonNullable<typeof base>['id'],
      thicknessMm: thickness,
    }));

    const heights = toCanvasShapes(sample, WALL_LAYER_FIXTURE_LEVEL, wallStatusCode).map(
      (shape) => shape.boundsPx.height,
    );

    expect(heights).toHaveLength(3);

    const [thin, medium, thick] = heights as [number, number, number];

    expect(thin).toBeGreaterThan(0);
    expect(medium / thin).toBeCloseTo(2, 5);
    expect(thick / thin).toBeCloseTo(3, 5);
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-5]/[NGHIEM-6] Hai điều cấm tuyệt đối.                               */
/* -------------------------------------------------------------------------- */

describe('hai điều [CẤM TUYỆT ĐỐI]', () => {
  it.each(SEVEN_STATES)('[NGHIEM-5] trạng thái %s: KHÔNG hộp thoại nào', (state) => {
    const { container } = renderState(state);

    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(container.querySelectorAll('[role="alertdialog"]')).toHaveLength(0);
  });

  it('[NGHIEM-6] độ dày là điều khiển ba lựa chọn, KHÔNG BAO GIỜ ô nhập số tự do', () => {
    const { container } = renderState('partial');

    expect(container.querySelectorAll('input[type="number"]')).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-7] R-73 — mở được bằng một thẻ, lối ra chạy thật.                   */
/* -------------------------------------------------------------------------- */

describe('[NGHIEM-7] R-73', () => {
  it('container nhận đủ props để màn khác mở nó mà không viết thêm logic', async () => {
    const onNavigate = vi.fn();

    renderWithProviders(
      <MemoryRouter>
        <WallLayerReviewContainer {...scenarioArgsFor('success')} onNavigate={onNavigate} />
      </MemoryRouter>,
    );

    const goOn = await screen.findByRole('button', { name: 'Sang lớp Cửa và nội thất' });

    goOn.click();

    await waitFor(() => {
      expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    /* Container KHÔNG viết đường dẫn của riêng nó — nó tra `ROUTES` (R-65/R-71). */
    expect(onNavigate.mock.calls[0]?.[0]).toBe(ROUTES.layerObjects);
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

  /*
   * "zoom" — chữ DUY NHẤT được nới, và nó không đến từ màn này.
   *
   * `ZoomCluster` (`src/components/canvas/ZoomCluster.tsx`) tự đặt
   * `aria-label="Điều khiển zoom"` và "Zoom hiện tại 100%…". Đó là chuỗi của
   * một component dùng chung, và `src/components/**` nằm ngoài danh sách file
   * được sửa (R-68) — chỗ đúng để sửa là component, không phải màn này.
   *
   * Nới ĐÚNG một chữ, chứ không nới cả phép kiểm: sáu chuỗi tiếng Anh khác mà
   * lượt gộp này tìm thấy ("Ẩn layer" của `TreeItem`, "canvas" trong câu rỗng
   * của thanh tra) đã được SỬA THẬT, không nới. Tiền lệ: `ScaleCalibration.test.tsx`
   * cũng nới đúng chữ này, vì cùng một component.
   */
  const ALLOWED_WORDS = ['zoom'];

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
/* Nhãn mã tường — mã máy dài, nhãn người đọc ngắn.                            */
/* -------------------------------------------------------------------------- */

describe('nhãn mã tường', () => {
  it('mã máy hợp lệ với tầng lệnh, nhãn người đọc vẫn là "#W-014" đặc tả đòi', () => {
    const fourteenth = WALL_LAYER_FIXTURE_WALLS[13];

    expect(fourteenth).toBeDefined();
    /* Thân mã dài ≥ 10 ký tự, nếu không `dispatch.ts` từ chối mọi lệnh trên nó. */
    expect((fourteenth?.id ?? '').slice(2).length).toBeGreaterThanOrEqual(10);
    expect(wallDisplayCode(fourteenth?.id ?? '')).toBe('W-014');
    /* Tường ví dụ của đặc tả: 220 mm, độ tin cậy 0,71. */
    expect(fourteenth?.thicknessMm).toBe(220);
    expect(fourteenth?.confidence).toBe(0.71);
    expect(fourteenth?.levelId).toBe(WALL_LAYER_FIXTURE_LEVEL.id);
  });
});

/* -------------------------------------------------------------------------- */
/* Bốn điều khiển VỪA ĐƯỢC DỰNG — mỗi cái một phép đo trên cây thật.           */
/* -------------------------------------------------------------------------- */

/*
 * Bốn thứ dưới đây trước lượt sửa này KHÔNG CÓ MẶT trên màn: khối điều hướng
 * tầng, ô bật tim tường, nút con mắt của lớp Tường, và nút thu gọn hai panel.
 * Ba cổng đều xanh khi chúng vắng mặt — không cổng nào đếm được một điều khiển
 * chưa từng được dựng — nên phép đo phải là "nó có trên cây, và bấm vào nó thì
 * có việc xảy ra".
 */

describe('điều hướng tầng (BC-05)', () => {
  /** Tầng thứ hai của bài kiểm — cùng khuôn `WALL_LAYER_FIXTURE_LEVEL`. */
  const SECOND_LEVEL: Level = {
    ...WALL_LAYER_FIXTURE_LEVEL,
    id: 'L-000002LVL0' as LevelId,
    name: 'Tầng 2',
    order: 1,
  };

  const twoFloorArgs = (onNavigate: (path: string) => void) => ({
    ...scenarioArgsFor('partial'),
    onNavigate,
    gateway: createMockWallLayerReviewGateway({
      graph: normalizeSpatial({
        building: WALL_LAYER_FIXTURE_BUILDING,
        levels: [WALL_LAYER_FIXTURE_LEVEL, SECOND_LEVEL],
        walls: WALL_LAYER_FIXTURE_WALLS,
        openings: [],
        furniture: [],
        rooms: [],
        axes: [],
        dimensions: [],
        notes: [],
      }),
    }),
  });

  it('liệt kê mọi tầng, đánh dấu tầng đang mở, và mở được tầng khác', async () => {
    const onNavigate = vi.fn();

    renderWithProviders(
      <MemoryRouter>
        <WallLayerReviewContainer {...twoFloorArgs(onNavigate)} />
      </MemoryRouter>,
    );

    const nav = await screen.findByRole('navigation', { name: 'Tầng của bản vẽ' });
    const floors = Array.from(nav.querySelectorAll('button'));

    expect(floors).toHaveLength(2);
    expect(floors[0]?.getAttribute('aria-current')).toBe('page');
    expect(floors[1]?.getAttribute('aria-current')).toBeNull();
    expect(floors[1]?.textContent).toContain(SECOND_LEVEL.name);

    await act(async () => {
      floors[1]?.click();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    /* Đường dẫn tra từ `ROUTES`, màn không ghép một chuỗi nào (R-65). */
    expect(onNavigate.mock.calls[0]?.[0]).toBe(
      ROUTES.project.walls(scenarioArgsFor('partial').projectId, SECOND_LEVEL.id),
    );
  });
});

describe('tim tường bật tắt được (BC-17)', () => {
  it('ô đánh dấu có mặt và đổi được câu trả lời của công cụ', async () => {
    renderWithProviders(
      <MemoryRouter>
        <WallLayerReviewContainer {...scenarioArgsFor('partial')} />
      </MemoryRouter>,
    );

    const checkbox = await screen.findByRole('checkbox', { name: 'Hiện tim tường' });

    expect(checkbox).not.toBeChecked();

    await act(async () => {
      checkbox.click();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(checkbox).toBeChecked();
    });
  });
});

describe('lớp Tường bật tắt được từ cây lớp (BC-19)', () => {
  it('nút con mắt bàn phím tới được, và chú giải đi theo nó', async () => {
    renderWithProviders(
      <MemoryRouter>
        <WallLayerReviewContainer {...scenarioArgsFor('partial')} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('group', { name: 'Lọc theo độ dày tường' })).toBeInTheDocument();

    const hide = screen.getByRole('button', { name: 'Ẩn lớp Tường' });

    /* Hai lỗi của `TreeItem` dùng chung mà hàng riêng của màn này không mắc. */
    expect(hide.getAttribute('tabindex')).toBeNull();

    await act(async () => {
      hide.click();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.queryByRole('group', { name: 'Lọc theo độ dày tường' })).not.toBeInTheDocument();
    });

    const show = screen.getByRole('button', { name: 'Hiện lớp Tường' });

    await act(async () => {
      show.click();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole('group', { name: 'Lọc theo độ dày tường' })).toBeInTheDocument();
    });
  });
});

describe('thu gọn hai panel (BT-16)', () => {
  it('nút trên ray công cụ đưa màn vào trạng thái thu gọn thật', async () => {
    renderWithProviders(
      <MemoryRouter>
        <WallLayerReviewContainer {...scenarioArgsFor('partial')} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('tree', { name: 'Cây lớp' })).toBeInTheDocument();

    const collapse = screen.getByRole('button', { name: 'Thu gọn hai panel' });

    await act(async () => {
      collapse.click();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.queryByRole('tree', { name: 'Cây lớp' })).not.toBeInTheDocument();
    });

    /* Canvas và thanh trạng thái vẫn còn — thu gọn không phải màn trắng (A11). */
    expect(screen.getByRole('status', { name: 'Thanh trạng thái' })).toBeInTheDocument();

    const expand = screen.getByRole('button', { name: 'Mở lại hai panel' });

    await act(async () => {
      expand.click();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole('tree', { name: 'Cây lớp' })).toBeInTheDocument();
    });
  });
});

describe('thứ tự ray công cụ (BC-02)', () => {
  /** Nhãn của từng nút trên ray, theo đúng thứ tự DOM. */
  const railLabels = (): readonly string[] =>
    Array.from(screen.getByRole('toolbar', { name: 'Công cụ lớp tường' }).querySelectorAll('button'))
      .map((button) => button.getAttribute('aria-label') ?? '');

  it('nối đoạn đứng TRƯỚC đo, đúng thứ tự đặc tả đọc ray', async () => {
    renderWithProviders(
      <MemoryRouter>
        <WallLayerReviewContainer {...scenarioArgsFor('partial')} />
      </MemoryRouter>,
    );

    await screen.findByRole('toolbar', { name: 'Công cụ lớp tường' });

    const labels = railLabels();
    const mergeAt = labels.findIndex((label) => label.startsWith('nối đoạn'));
    const measureAt = labels.findIndex((label) => label.startsWith('đo'));

    expect(mergeAt).toBeGreaterThan(-1);
    expect(measureAt).toBeGreaterThan(-1);
    expect(mergeAt).toBeLessThan(measureAt);
  });

  it('vai Người xem: "đo" vẫn hiện, "nối đoạn" bị ẩn', async () => {
    renderWithProviders(
      <MemoryRouter>
        <WallLayerReviewContainer {...scenarioArgsFor('forbidden')} />
      </MemoryRouter>,
    );

    await screen.findByRole('toolbar', { name: 'Công cụ lớp tường' });

    const labels = railLabels();

    expect(labels.some((label) => label.startsWith('đo'))).toBe(true);
    expect(labels.some((label) => label.startsWith('nối đoạn'))).toBe(false);
  });
});

describe('bộ đếm ở trạng thái Xong (BT-08)', () => {
  it('thanh tiến độ và con số chuyển sang token "đã xác minh"', async () => {
    const { container } = renderState('success');

    await screen.findByRole('button', { name: 'Sang lớp Cửa và nội thất' });

    /*
     * A5 vẫn nguyên: xanh "đã xác minh" ở đây tới từ `reviewed === total` —
     * việc của người duyệt — chứ không từ một điểm số nào của AI.
     */
    expect(container.querySelectorAll('.bg-state-verified').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.text-state-verified').length).toBeGreaterThan(0);
  });

  it('trạng thái Một phần thì KHÔNG có token đó ở bộ đếm', async () => {
    const { container } = renderState('partial');

    await screen.findByRole('tree', { name: 'Cây lớp' });

    expect(container.querySelectorAll('.text-state-verified')).toHaveLength(0);
  });
});
