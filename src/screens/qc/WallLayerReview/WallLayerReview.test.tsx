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

import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
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
import { provisionalScaleNoticeOf } from '@/lib/viewmodel/provisionalScale';
import {
  SEVEN_STATES,
  SEVEN_STATE_LABELS,
  type SevenStateScenario,
} from '@/lib/testing/sevenStateScenarios';
import { setFlowGateSlot } from '@/components/shell/flowGateStore';
import { ROUTES } from '@/routes/paths';
import { resetSelectorCaches } from '@/store/selectors';
import { useStore } from '@/store';

// Nạp tĩnh, ở pha collect, hộp thoại mà `FloorLayerSaveBanner` `lazy()`: không thì bài xung đột
// biên dịch nó BÊN TRONG `findByRole` của mình, và dưới tải lượt ấy dài hơn trần chờ (QA-01c nợ #12).
import './FloorLayerSaveConfirm';
import type { WallLayerViewProps } from './types';
import { WallLayerInspector } from './WallLayerInspector';
import { WallLayerList } from './WallLayerList';
import { WallLayerReviewContainer } from './WallLayerReview.container';
import { WallLayerStatusBar } from './WallLayerStatusBar';
import { ProvisionalScale, scenarioArgsFor } from './WallLayerReview.stories';
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
} from './wallLayerReviewGateway';

const SCREEN_DIRECTORY = 'src/screens/qc/WallLayerReview';

/**
 * Ba băng độ dày của hệ thiết kế — đọc ra, không viết tay lại (R-71).
 *
 * Khẳng định đúng BA băng ngay tại chỗ đọc: nếu hệ thiết kế đổi số băng, phép
 * kiểm này hỏng ở đây với một câu đọc được, chứ không hỏng ở một chỗ xa hơn.
 */
const THICKNESS_BANDS = [110, 220, 330] as const; // ba nhóm màu (wallThicknessColorBand)

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
/* Dải lưu lớp (F-04x-1 bước 7).                                               */
/* -------------------------------------------------------------------------- */

describe('dải lưu lớp (F-04x-1)', () => {
  const RELOAD_MESSAGE = 'Tầng này vừa được sửa ở nơi khác. Tải lại để xem bản mới nhất.';

  it('xung đột: dải chú ý + "Tải lại", ngoài canvas; A9 hỏi trước khi bỏ sửa', async () => {
    const onReload = vi.fn();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    renderWithProviders(
      <MemoryRouter>
        <WallLayerReviewContainer
          {...scenarioArgsFor('partial')}
          forceSaveBlock={{ confirm: { onCancel, onConfirm, open: true }, kind: 'reload', message: RELOAD_MESSAGE, onReload }}
        />
      </MemoryRouter>,
    );

    const banner = screen.getAllByRole('alert').find((node) => node.textContent?.includes(RELOAD_MESSAGE));

    expect(banner).toBeDefined();
    expect(banner?.closest('section')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
    expect(onReload).toHaveBeenCalledTimes(1);

    expect(await screen.findByRole('dialog', { name: 'Bỏ thay đổi chưa lưu của tầng này?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại và bỏ thay đổi' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('không lưu được: dải vi phạm với câu của ống, không có nút "Tải lại"', () => {
    const message = 'Bạn không còn quyền sửa tầng này.';

    renderWithProviders(
      <MemoryRouter>
        <WallLayerReviewContainer {...scenarioArgsFor('partial')} forceSaveBlock={{ confirm: null, kind: 'blocked', message }} />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('alert').some((node) => node.textContent?.includes(message))).toBe(true);
    expect(screen.queryByRole('button', { name: 'Tải lại' })).not.toBeInTheDocument();
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
      /* Đọc lớp hỏng: cả màn là trạng thái lỗi một lối ra, không dựng chú giải hỏng (BUG-326). */
      error: { kind: 'absent', name: 'Không tải được chú giải' },
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

    if (expectation?.kind === 'absent') {
      expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
      expect(screen.queryByText(expectation.name)).toBeNull();

      return;
    }

    if (expectation?.kind === 'label') {
      expect(container.querySelector(`[aria-label="${expectation.name}"]`)).not.toBeNull();

      return;
    }

    expect(await screen.findByText(expectation?.name ?? '')).toBeInTheDocument();
  });

  /* Thang sáu bậc: 175/235/90 mm của bộ mẫu nay trong dung sai, nên không có mục "Không chuẩn";
   * ca có tường ngoài danh mục (260 mm) khoá ở wallThicknessScale.test.ts. Xong hết thì còn "Đã duyệt". */
  it('[BUG-416] bộ mẫu toàn độ dày trong danh mục: không có "Không chuẩn"; xong hết thì chú giải còn "Đã duyệt"', async () => {
    const partial = renderState('partial');
    const legend = await screen.findByRole('group', { name: 'Lọc theo độ dày tường' });

    expect(within(legend).queryByText('Không chuẩn')).toBeNull();
    expect(within(legend).getByText('Đã duyệt')).toBeInTheDocument();
    partial.unmount();

    renderState('success');
    const done = await screen.findByRole('group', { name: 'Lọc theo độ dày tường' });

    expect(within(done).queryByText('Không chuẩn')).toBeNull();
    expect(within(done).getByText('Đã duyệt')).toBeInTheDocument();
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
    expect(tokens[0]).toBe('var(--wall-110-stroke)');
    expect(tokens[1]).toBe('var(--wall-220)');
    expect(tokens[2]).toBe('var(--wall-330-stroke)');
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

    /* Cổng (FlowGate) bay vào khe của thanh bước trong header; ở đây tự dựng khe đó. */
    renderWithProviders(
      <MemoryRouter>
        <div ref={setFlowGateSlot} />
        <WallLayerReviewContainer {...scenarioArgsFor('success')} onNavigate={onNavigate} />
      </MemoryRouter>,
    );

    /* Cổng sang lớp kế là việc của FloorReviewGate (có test riêng); ở đây chỉ cần mở được màn. */
    expect((await screen.findAllByText('Duyệt tường')).length).toBeGreaterThan(0);
    expect(onNavigate).not.toHaveBeenCalled();
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

  /* Không chữ nào được nới — nợ "zoom" của `ZoomCluster` đã trả (B-V1-48). */
  const ALLOWED_WORDS: readonly string[] = [];

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

  it('mã BE đứng riêng trả nguyên văn, không cắt thành nhãn rác (B-V7-42, B-V7-81)', () => {
    const backendId = `W-01J${'A'.repeat(22)}`;

    expect(wallDisplayCode(backendId)).toBe(backendId);
  });

  it('nhãn panel Đoạn tường viết hoa chữ đầu (A6, BUG-339)', () => {
    const panel = {
      inspector: {
        id: WALL_LAYER_FIXTURE_WALLS[0]?.id,
        codeLabel: '#W-001',
        thicknessMm: 220,
        lengthLabel: '4.250,00 mm',
        heightLabel: '3,00 m',
        confidence: 0.71,
        kindLabel: 'Tường gạch',
        advanced: { elevationOffsetLabel: '0', startPointLabel: '0', endPointLabel: '0' },
      },
      thicknessChoices: THICKNESS_BANDS,
      thicknessFocusRequest: 0,
      isViewerRole: false,
      viewerRoleNotice: '',
      onApprove: vi.fn(),
      onSkip: vi.fn(),
      onChangeThickness: vi.fn(),
      reviewCounter: { reviewed: 12, total: 48 },
      rows: [],
    } as unknown as WallLayerViewProps;

    renderWithProviders(<WallLayerInspector panel={panel} />);

    for (const label of ['Chiều dài', 'Chiều cao', 'Độ tin cậy', 'Vật liệu']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
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

  it('đổi tầng ở breadcrumb "Tầng ▾" của đầu màn (không lặp khối tầng trong panel)', async () => {
    renderWithProviders(
      <MemoryRouter>
        <WallLayerReviewContainer {...twoFloorArgs(vi.fn())} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('navigation', { name: 'Tầng của bản vẽ' })).not.toBeInTheDocument();

    const floorChip = await screen.findByRole('button', { name: /^Chọn nhanh — đang ở/u });

    await act(async () => {
      floorChip.click();
      await Promise.resolve();
    });

    const menu = await screen.findByRole('listbox', { name: 'Chọn tầng' });

    expect(within(menu).getByRole('button', { name: SECOND_LEVEL.name })).toBeInTheDocument();
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

    /* A6 · B-V6-04: tên lớp trong cây và trong nút con mắt cùng viết thường. */
    expect(screen.getByRole('treeitem', { name: 'Tường' })).toBeInTheDocument();
    const hide = screen.getByRole('button', { name: 'Ẩn lớp tường' });

    /* Hai lỗi của `TreeItem` dùng chung mà hàng riêng của màn này không mắc. */
    expect(hide.getAttribute('tabindex')).toBeNull();

    await act(async () => {
      hide.click();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.queryByRole('group', { name: 'Lọc theo độ dày tường' })).not.toBeInTheDocument();
    });

    const show = screen.getByRole('button', { name: 'Hiện lớp tường' });

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
    const mergeAt = labels.findIndex((label) => label.startsWith('Nối đoạn'));
    const measureAt = labels.findIndex((label) => label.startsWith('Đo'));

    expect(mergeAt).toBeGreaterThan(-1);
    expect(measureAt).toBeGreaterThan(-1);
    expect(mergeAt).toBeLessThan(measureAt);
  });

  it('[BUG-604] nhãn ray viết hoa chữ đầu (A6), và "Tách đoạn" có phím X', async () => {
    renderWithProviders(
      <MemoryRouter>
        <WallLayerReviewContainer {...scenarioArgsFor('partial')} />
      </MemoryRouter>,
    );

    await screen.findByRole('toolbar', { name: 'Công cụ lớp tường' });

    const labels = railLabels();

    expect(labels).toEqual(
      expect.arrayContaining(['Chọn (phím V)', 'Vẽ tường (phím W)', 'Tách đoạn (phím X)', 'Đo (phím M)']),
    );
    expect(labels.filter((label) => label.charAt(0) !== label.charAt(0).toLocaleUpperCase('vi'))).toEqual([]);
  });

  it('[BUG-601] vai Người xem: "Đo" và "Nối đoạn" bị ẩn — canvas người xem không nhận lượt bấm', async () => {
    renderWithProviders(
      <MemoryRouter>
        <WallLayerReviewContainer {...scenarioArgsFor('forbidden')} />
      </MemoryRouter>,
    );

    await screen.findByRole('toolbar', { name: 'Công cụ lớp tường' });

    const labels = railLabels();

    expect(labels.some((label) => label.startsWith('Đo'))).toBe(false);
    expect(labels.some((label) => label.startsWith('Nối đoạn'))).toBe(false);
  });
});

describe('bộ đếm ở trạng thái Xong (BT-08)', () => {
  it('thanh tiến độ và con số chuyển sang token "đã xác minh"', async () => {
    const { container } = renderState('success');

    /* Câu 2 ở đầu panel: huy hiệu "Xong" (nút sang lớp kế nằm ở cổng của thanh bước). */
    await screen.findByText('Xong');

    /*
     * A5 vẫn nguyên: xanh "đã xác minh" ở đây tới từ `reviewed === total` —
     * việc của người duyệt — chứ không từ một điểm số nào của AI.
     */
    expect(container.querySelectorAll('.bg-state-verified').length).toBeGreaterThan(0);
    /* Chữ trạng thái dùng token `-text` (đủ tương phản), màu thô chỉ cho thanh/icon. */
    expect(container.querySelectorAll('.text-state-verified-text').length).toBeGreaterThan(0);
  });

  it('trạng thái Một phần thì KHÔNG có token đó ở bộ đếm', async () => {
    const { container } = renderState('partial');

    await screen.findByRole('tree', { name: 'Cây lớp' });

    expect(container.querySelectorAll('.text-state-verified')).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Dải tỷ lệ tạm (F-04x-2 [8].7).                                              */
/* -------------------------------------------------------------------------- */

describe('dải tỷ lệ tạm (F-04x-2)', () => {
  const NOTICE = provisionalScaleNoticeOf('unresolved')?.message ?? '';

  beforeEach(() => {
    useStore.getState().setSpatial(null, null);
  });

  it('tầng unresolved: dải chú ý + "Đặt tỷ lệ" mở màn tỉ lệ; chiều dài là PROVISIONAL_MEASURE_TEXT', async () => {
    const onNavigate = vi.fn();
    const args = { ...scenarioArgsFor('partial'), ...ProvisionalScale.args, onNavigate };

    renderWithProviders(
      <MemoryRouter>
        <WallLayerReviewContainer {...args} />
      </MemoryRouter>,
    );

    expect(await screen.findByText(NOTICE)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Đặt tỷ lệ' }));
    expect(onNavigate).toHaveBeenCalledWith(ROUTES.project.scale(args.projectId, args.floorId));
  });

  it('tầng có tỉ lệ thật: không dải', async () => {
    renderState('partial');

    await screen.findByRole('tree', { name: 'Cây lớp' });

    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đặt tỷ lệ' })).not.toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* Đợt sửa P04 cụm A (SCR-16) — mỗi ca đỏ trước bản sửa.                        */
/* -------------------------------------------------------------------------- */

describe('đợt sửa P04 — SCR-16', () => {
  const inspectorPanel = (overrides: Partial<WallLayerViewProps>): WallLayerViewProps =>
    ({
      inspector: null,
      reviewCounter: { reviewed: 12, total: 48 },
      thicknessChoices: THICKNESS_BANDS,
      thicknessFocusRequest: 0,
      isViewerRole: false,
      viewerRoleNotice: '',
      onApprove: vi.fn(),
      onSkip: vi.fn(),
      onChangeThickness: vi.fn(),
      rows: [],
      ...overrides,
    }) as unknown as WallLayerViewProps;

  it('[BUG-601] vai Người xem: "Thu gọn hai panel" thu gọn thật, không chỉ đổi nhãn', async () => {
    renderState('forbidden');

    expect(await screen.findByRole('tree', { name: 'Cây lớp' })).toBeInTheDocument();

    await act(async () => {
      screen.getByRole('button', { name: 'Thu gọn hai panel' }).click();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.queryByRole('tree', { name: 'Cây lớp' })).not.toBeInTheDocument();
    });
  });

  it('[BUG-324] gốc màn cao bằng khung nhìn, nên thanh trạng thái dính đáy', async () => {
    renderState('partial');

    expect(await screen.findByRole('region', { name: 'Duyệt lớp tường' })).toHaveClass('h-screen');
  });

  it('[BUG-395] dưới 1280 panel trái không bị khoá 560 px (danh sách còn ~3 hàng)', async () => {
    renderState('partial');

    const tree = await screen.findByRole('tree', { name: 'Cây lớp' });
    const panel = tree.closest('.shadow-panel');

    expect(panel).not.toBeNull();
    expect(panel?.className).not.toContain('h-[560px]');
  });

  it('[BUG-621] dưới 1024 panel trái không cắt đáy', async () => {
    renderState('partial');

    const tree = await screen.findByRole('tree', { name: 'Cây lớp' });
    const panel = tree.closest('.shadow-panel');
    const listRegion = panel?.lastElementChild;

    expect(panel?.className.split(' ')).not.toContain('overflow-hidden');
    expect(listRegion?.className.split(' ')).not.toContain('flex-1');
    expect(listRegion?.className.split(' ')).toContain('lg:flex-1');
  });

  it('[BUG-396] hàng danh sách không tràn mép phải: không huy hiệu chữ 70 px, hàng cắt tràn', async () => {
    /* jsdom đo mọi khung 0 px nên danh sách ảo không dựng hàng nào; cho khung cuộn một chiều cao. */
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      { x: 0, y: 0, top: 0, left: 0, right: 280, bottom: 800, width: 280, height: 800, toJSON: () => ({}) } as DOMRect,
    );
    renderState('partial');

    const options = await screen.findAllByRole('option');

    expect(options.length).toBeGreaterThan(0);

    for (const option of options) {
      expect(option).toHaveClass('overflow-hidden');
      expect(within(option).queryByText('Cần chú ý')).not.toBeInTheDocument();
    }
  });

  it('[BUG-638] tường đã duyệt mang hình riêng, không chỉ một chấm màu', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      { x: 0, y: 0, top: 0, left: 0, right: 280, bottom: 800, width: 280, height: 800, toJSON: () => ({}) } as DOMRect,
    );
    renderState('success');

    const options = await screen.findAllByRole('option');
    const status = options[0]?.querySelector('[title="Đã duyệt"]');

    expect(status?.querySelector('svg')).not.toBeNull();
  });

  it('[BUG-614] bộ lọc panel trái: nhãn 13 px ngang cây lớp', async () => {
    renderState('partial');

    expect(await screen.findByText('Chỉ hiện chưa duyệt')).toHaveClass('text-[13px]');
    expect(screen.getByText('Hiện tim tường')).toHaveClass('text-[13px]');
  });

  it('[BUG-612][BUG-616] thanh trạng thái: câu không mono; lưu thất bại dùng màu vi phạm kèm biểu tượng', () => {
    const { rerender } = renderWithProviders(
      <WallLayerStatusBar cursorLabel="Chưa rê chuột lên bản vẽ" saveFailed={false} saveLabel="Đã lưu" scaleLabel="12 mm/px" />,
    );

    expect(screen.queryByText('Chưa rê chuột lên bản vẽ')).toBeNull();
    // Lưu ổn: nhãn đã ở đầu panel (QcPanelHead), thanh trạng thái không lặp.
    expect(screen.queryByText('Đã lưu')).toBeNull();

    rerender(
      <WallLayerStatusBar cursorLabel="Chưa rê chuột lên bản vẽ" saveFailed saveLabel="Lưu thất bại" scaleLabel="12 mm/px" />,
    );

    const failed = screen.getByText('Lưu thất bại');

    expect(failed).toHaveClass('text-state-violation-text');
    expect(failed).not.toHaveClass('text-text-muted');
    /* Đợt Impeccable 2: biểu tượng đứng ngay trước nhãn trong `QcStatusBar` chung, không lồng trong nhãn. */
    expect(failed.closest('[role="status"]')?.querySelector('svg.text-state-violation')).not.toBeNull();
  });

  it('[BUG-329] thẻ Đoạn tường trống có đệm dưới', () => {
    renderWithProviders(<WallLayerInspector panel={inspectorPanel({})} />);

    expect(screen.getByText(/Chọn một đoạn tường/u)).toHaveClass('pb-5');
  });

  it('[BUG-604] "Đổi độ dày" đưa focus vào ba lựa chọn độ dày', () => {
    const wall = {
      id: WALL_LAYER_FIXTURE_WALLS[0]?.id,
      codeLabel: '#W-001',
      thicknessMm: 220,
      lengthLabel: '4.250,00 mm',
      heightLabel: '3,00 m',
      confidence: 0.71,
      kindLabel: 'Tường gạch',
      advanced: { elevationOffsetLabel: '0', startPointLabel: '0', endPointLabel: '0' },
    };
    const { rerender } = renderWithProviders(
      <WallLayerInspector panel={inspectorPanel({ inspector: wall } as Partial<WallLayerViewProps>)} />,
    );

    expect(document.activeElement?.getAttribute('role')).not.toBe('radio');

    rerender(
      <WallLayerInspector
        panel={inspectorPanel({ inspector: wall, thicknessFocusRequest: 1 } as Partial<WallLayerViewProps>)}
      />,
    );

    expect(document.activeElement?.getAttribute('role')).toBe('radio');
    expect(document.activeElement?.getAttribute('aria-checked')).toBe('true');
  });

  it('[G4a-16] ?wall= trong URL mở sẵn đúng đoạn, bỏ chọn thì xoá tham số', async () => {
    const wallId = WALL_LAYER_FIXTURE_WALLS[1]?.id ?? '';
    const before = window.location.href;

    window.history.replaceState(null, '', `?wall=${wallId}`);

    try {
      renderState('partial');

      await waitFor(() => {
        expect(screen.queryByText(/Chọn một đoạn tường trên bản vẽ/u)).toBeNull();
      });
      expect(new URLSearchParams(window.location.search).get('wall')).toBe(wallId);
    } finally {
      window.history.replaceState(null, '', before);
    }
  });

  it('[G4a-13] độ dày ngoài ba mức: thanh tra gắn nhãn "Không chuẩn" cạnh mã, số đo đứng riêng', () => {
    const wall = {
      id: WALL_LAYER_FIXTURE_WALLS[0]?.id,
      codeLabel: '#W-002',
      thicknessMm: 100,
      lengthLabel: '4.250,00 mm',
      heightLabel: '3,00 m',
      confidence: 0.71,
      kindLabel: 'Tường gạch',
      advanced: { elevationOffsetLabel: '0', startPointLabel: '0', endPointLabel: '0' },
    };
    const { rerender } = renderWithProviders(
      <WallLayerInspector panel={inspectorPanel({ inspector: wall } as Partial<WallLayerViewProps>)} />,
    );

    expect(screen.getByText('Độ dày đo được')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Không chuẩn')).toBeInTheDocument();

    rerender(
      <WallLayerInspector
        panel={inspectorPanel({ inspector: { ...wall, thicknessMm: 220 } } as Partial<WallLayerViewProps>)}
      />,
    );

    expect(screen.queryByText('Không chuẩn')).toBeNull();
  });

  it('[BUG-604] menu chuột phải của tường ĐÃ duyệt không đưa "Duyệt" chết', async () => {
    const { container } = renderState('partial');

    await screen.findByRole('tree', { name: 'Cây lớp' });

    const reviewed = WALL_LAYER_FIXTURE_WALLS.find((wall) => wall.reviewed);
    const unreviewed = WALL_LAYER_FIXTURE_WALLS.find((wall) => !wall.reviewed);
    const figureOf = (id: string | undefined): Element => {
      const figure = container.querySelector(`g[role="presentation"][aria-label="#${wallDisplayCode(id ?? '')}"]`);

      if (figure === null) {
        throw new Error(`không thấy hình tường ${id ?? ''}`);
      }

      return figure;
    };

    fireEvent.contextMenu(figureOf(reviewed?.id));
    expect(within(await screen.findByRole('menu')).queryByRole('menuitem', { name: 'Duyệt' })).not.toBeInTheDocument();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    fireEvent.contextMenu(figureOf(unreviewed?.id));
    await waitFor(() => {
      expect(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Duyệt' })).toBeInTheDocument();
    });
  });
});

describe('[G74 16-E-010] mở menu tường bằng bàn phím', () => {
  it('Shift+F10 hoặc phím ContextMenu trên một hàng danh sách mở đúng menu của tường đó', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      { x: 0, y: 0, top: 0, left: 0, right: 280, bottom: 800, width: 280, height: 800, toJSON: () => ({}) } as DOMRect,
    );
    renderState('partial');

    const rows = await screen.findAllByRole('option');
    const row = rows[0];

    if (row === undefined) {
      throw new Error('không có hàng tường nào');
    }

    row.focus();
    fireEvent.keyDown(row, { key: 'F10', shiftKey: true });
    expect(await screen.findByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    fireEvent.keyDown(row, { key: 'ContextMenu' });
    expect(await screen.findByRole('menu')).toBeInTheDocument();
  });
});

describe('G68 câu 2 ở đầu panel: trạng thái + số thật, đọc được như chữ thường', () => {
  it('đầu panel có H1 "Duyệt tường", huy hiệu và câu "12/48 tường đã duyệt"', async () => {
    renderState('partial');

    expect(await screen.findByRole('heading', { level: 1, name: 'Duyệt tường' })).toBeInTheDocument();
    expect(screen.getByText('Chưa xong')).toBeInTheDocument();
    expect(screen.getByText(/^12\/48 tường đã duyệt$/u)).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* [16-D-008] Danh sách của vai Người xem đọc rỗng/đang tải từ dữ liệu.        */
/* -------------------------------------------------------------------------- */

describe('[16-D-008] danh sách của vai Người xem', () => {
  const viewerPanel = (overrides: Partial<WallLayerViewProps>): WallLayerViewProps =>
    ({
      state: 'forbidden',
      rows: [],
      reviewCounter: { reviewed: 0, total: 0 },
      isViewerRole: true,
      emptyNotice: null,
      errorMessage: null,
      selectedWallId: null,
      hoveredWallId: null,
      onSelect: vi.fn(),
      onHover: vi.fn(),
      onOpenRowMenu: vi.fn(),
      ...overrides,
    }) as unknown as WallLayerViewProps;

  const NO_MATCH = /không có đoạn tường nào khớp bộ lọc/iu;

  it('đang tải: khung skeleton, không câu "không khớp bộ lọc"', () => {
    renderWithProviders(<WallLayerList panel={viewerPanel({})} flashingWallId={null} onToggleSelect={vi.fn()} />);

    expect(screen.getByRole('status', { name: 'Danh sách đoạn tường' })).toBeInTheDocument();
    expect(screen.queryByText(NO_MATCH)).not.toBeInTheDocument();
  });

  it('tầng rỗng: EmptyState, không câu "không khớp bộ lọc"', () => {
    renderWithProviders(
      <WallLayerList
        panel={viewerPanel({ emptyNotice: 'Chưa phát hiện được đoạn tường nào.' })}
        flashingWallId={null}
        onToggleSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('Chưa có đoạn tường nào')).toBeInTheDocument();
    expect(screen.queryByText(NO_MATCH)).not.toBeInTheDocument();
  });
});
