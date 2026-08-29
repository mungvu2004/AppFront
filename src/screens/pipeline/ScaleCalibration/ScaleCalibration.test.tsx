/**
 * Lượt kiểm của màn Hiệu chỉnh tỷ lệ.
 *
 * Bốn bộ khẳng định dùng chung (`expectSevenStates`, `expectAccessible`,
 * `expectVietnamese`, `expectNoRawColor`) cộng bốn phép đo của bản nghiệm thu:
 *
 * | mã | đo cái gì | ngưỡng |
 * |---|---|---|
 * | `[NGHIEM-1]` | bảy trạng thái của A11 | 7/7 |
 * | `[NGHIEM-2]` | kịch bản bốn bước: kéo 400 px → nhập 4800 → 12 mm/px → tự lưu → hoàn tác | cả bốn bước |
 * | `[NGHIEM-3]` | 250 mm/px hiện câu "tường dày 3 m" TRƯỚC khi áp, và KHÔNG chặn | cảnh báo có, nút vẫn bấm được |
 * | `[NGHIEM-4]` | phép tính không bị giấu — cả ba vế đứng trên màn | 3/3 |
 *
 * Hai lớp render, cố ý — cùng khuôn `ProcessingScreen.test.tsx`:
 *
 * - **Chỉ props** cho bảy trạng thái và ba bộ soát. {@link ScaleCalibration} là
 *   một hàm của props (mục D), nên bảy trạng thái vẽ được mà không cần mạng.
 *   Dữ liệu đến từ `ScaleCalibration.stories.tsx`, một bộ duy nhất cho cả story
 *   lẫn test: hai bộ song song là hai bộ sẽ lệch nhau (R-70).
 * - **Qua hook thật + view thật + cổng của bộ mẫu** cho hai kịch bản nghiệm thu.
 *   Đó là phần việc riêng của lượt ghép: `useScaleCalibration.test.ts` đã kiểm
 *   nửa "suy nghĩ" mà không cần DOM, còn ở đây điều đang được kiểm là con số ấy
 *   THẬT SỰ đi ra tới màn — `"12 mm/px"` phải đọc được trên DOM, không chỉ đúng
 *   trong một mô hình.
 *
 * ## Vì sao đoạn tham chiếu được kéo qua `actions` chứ không qua chuột
 *
 * `ImageRatioPoint` là tỉ lệ `0..1` của khung ảnh, và view tính nó từ
 * `getBoundingClientRect()`. jsdom trả về một hình chữ nhật rỗng cho mọi phần
 * tử, nên một `pointermove` giả lập ở đây đo được đúng con số không — nó sẽ kiểm
 * jsdom chứ không kiểm màn. Chiều còn lại của cùng kịch bản — gõ chiều dài thật,
 * bấm "Áp dụng tỷ lệ" — đi qua DOM THẬT, vì hai thao tác đó không phụ thuộc vào
 * hình học nào.
 */

import { readdirSync } from 'node:fs';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockApiClient } from '@/api/__mocks__/client';
import type { ApiClient } from '@/api/client';
import { createSampleBuilding, sampleLevelId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import {
  createScale,
  millimetresPerPixel,
  pixels,
  type MillimetresPerPixel,
  type Pixels,
  type Scale,
} from '@/domain/units/scale';
import { millimetres } from '@/domain/units/types';
import { RETRY_SCHEDULE_MS } from '@/lib/autosave/retrySchedule';
import { REDUCED_MOTION_QUERY } from '@/lib/motion';
import { formatLength } from '@/lib/format/measure';
import { formatNumber } from '@/lib/format/number';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { createCleanBuildingScenario } from '@/lib/testing/fixtures';
import { installFakeClock, type FakeClock } from '@/lib/testing/fakeClock';
import { createTestQueryClient, renderWithProviders } from '@/lib/testing/render';
import {
  SEVEN_STATES,
  SEVEN_STATE_LABELS,
  type SevenStateScenario,
} from '@/lib/testing/sevenStateScenarios';
import { useStore } from '@/store';

import { ScaleCalibration } from './ScaleCalibration';
import { compactScenario, scenarioFor } from './ScaleCalibration.stories';
import {
  clearPersistedScales,
  createScaleCalibrationGateway,
  withScaleCapabilities,
  type ScaleCalibrationGateway,
  type ScaleDrawingSnapshot,
  type ScaleRawDimensionString,
} from './scaleCalibrationGateway';
import { useScaleCalibration } from './useScaleCalibration';
import type { ImageRatioPoint, ScaleCalibrationActions, UseScaleCalibrationResult } from './types';

const SCREEN_DIRECTORY = 'src/screens/pipeline/ScaleCalibration';
const PROJECT_ID = 'project-1';

/** Tầng của bộ mẫu chuẩn A14 — mã có tiền tố `L-`, tức một `LevelId` thật. */
const FLOOR_ID = sampleLevelId(0);

/** Tầng mock đã đo xong, dùng làm ảnh nền của lượt kiểm. */
const MEASURED_MOCK_FLOOR_ID = 'L2';

/** Số nhịp đồng hồ giả một lượt đọc của bộ mẫu cần để về. */
const SETTLE_TURNS = 20;

/** `4.800 mm ÷ 400 px = 12 mm/px` — ví dụ của chính đặc tả. */
const REFERENCE_PIXEL_LENGTH: Pixels = pixels(400);
const REFERENCE_REAL_LENGTH = millimetres(4800);
const REFERENCE_SCALE: Scale = createScale({
  pixelLength: REFERENCE_PIXEL_LENGTH,
  realLength: REFERENCE_REAL_LENGTH,
});

/** Tỷ lệ vô lý đặc tả nêu đích danh: 250 mm/px trên nét tường 12 px là tường 3 m. */
const IMPLAUSIBLE_RATIO: MillimetresPerPixel = millimetresPerPixel(250);
const REFERENCE_WALL_WIDTH: Pixels = pixels(12);

/** Nhãn thật của các ô bấm — hằng chuỗi của `ScaleCalibrationPanel.tsx`. */
const REAL_LENGTH_LABEL = 'Chiều dài thật';
const APPLY_LABEL = 'Áp dụng tỷ lệ';

/** Nhãn thật của khung canvas — hằng chuỗi của `ScaleCalibrationCanvas.tsx`. */
const CANVAS_ARIA_LABEL = 'Bản vẽ đã nắn, kéo để vẽ đường tham chiếu';

/**
 * Cạnh của khung canvas trong lượt kiểm khung nhìn, tính bằng pixel CSS.
 *
 * Một con số bất kỳ nhưng KHÁC KHÔNG: `flyToBounds` bỏ qua lượt bay khi canvas
 * đo được `0 × 0`, nên chính con số không mới là thứ làm phép kiểm mất ý nghĩa.
 * Khung vuông vì `ScaleCalibrationCanvas` dựng nó bằng `aspect-square`.
 */
const CANVAS_FRAME_PX = 800;

/**
 * Mã lỗi máy đọc — A6 cho phép chữ hoa ở đúng chỗ này, và chỉ ở đây.
 *
 * Bỏ qua theo HÌNH DẠNG (CHỮ_HOA_CÓ_GẠCH_DƯỚI trọn chuỗi) chứ không liệt kê
 * từng từ, để `frame`/`not`/`found` không lọt vào từ vựng được duyệt và mở đường
 * cho tiếng Anh thật ở chỗ khác. Cùng khuôn `ProcessingScreen.test.tsx`.
 */
const MACHINE_ERROR_CODE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

/**
 * `Panel` và `pixel` là hai từ mượn đã có mặt trong `vi.json`.
 *
 * `pixel` đứng trong dòng dẫn xuất `"1 pixel = 12 mm · …"` (khoá
 * `scaleCalibration.currentScale.derivedLine`), và `panel` đã được duyệt từ màn
 * Xử lý. Ghi tên ở đây để chúng là quyết định đọc được, không phải hai chữ
 * tiếng Anh lọt lưới.
 *
 * `zoom` là chữ thứ ba, và nó KHÔNG phải chuỗi của màn này: nó là `aria-label`
 * của `src/components/canvas/ZoomCluster.tsx` — một component dùng chung mà
 * canvas tái sử dụng. Sửa nó là sửa `src/components/**`, ngoài phạm vi R-68 của
 * lượt dựng màn, nên chỗ này ghi nhận nó thành văn thay vì im lặng cho qua.
 * Đây là NỢ đã ghi, không phải một chữ được duyệt: nó thuộc về lượt dọn
 * `ZoomCluster`, và danh sách này chỉ được ngắn đi.
 */
const ALLOWED_WORDS = ['panel', 'pixel', 'zoom'];

/* -------------------------------------------------------------------------- */
/* Môi trường.                                                                 */
/* -------------------------------------------------------------------------- */

let clock: FakeClock;

class FakeResizeObserver {
  observe(): void {
    /* kích thước do chính test đặt, không có lượt đổi nào để báo */
  }
  unobserve(): void {
    /* như trên */
  }
  disconnect(): void {
    /* như trên */
  }
}

/**
 * `matchMedia` của jsdom, với đúng một câu trả lời được chọn.
 *
 * `isReducedMotion` chỉ áp cho truy vấn `prefers-reduced-motion`; mọi truy vấn
 * khác vẫn trả `false`, tức khung nhìn rộng — nếu không thì bật giảm chuyển động
 * sẽ vô tình bật luôn cách xếp thu gọn, và phép kiểm sẽ đo hai thứ một lúc.
 */
function setReducedMotion(isReducedMotion: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: isReducedMotion && query === REDUCED_MOTION_QUERY,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  // Mặc định: khung rộng, chuyển động đầy đủ.
  setReducedMotion(false);
  // jsdom không khai `ResizeObserver`. Gắn bản giả bằng `Object.defineProperty`
  // và gỡ nó bằng tay ở `afterEach`, để không lượt kiểm nào thừa hưởng bản giả
  // của lượt trước.
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: FakeResizeObserver,
  });
  clock = installFakeClock();
  clearPersistedScales();
  seedStore();
});

afterEach(() => {
  cleanup();
  clock.restore();
  Reflect.deleteProperty(globalThis, 'ResizeObserver');
  vi.restoreAllMocks();
});

/** Đồ thị của bộ mẫu chuẩn A14 trong store, và một ngăn xếp hoàn tác sạch. */
function seedStore(): void {
  const scenario = createCleanBuildingScenario();
  useStore.getState().setSpatial(normalizeSpatial(scenario.graph), 'version-1');
  useStore.temporal.getState().clear();
}

/** Tỷ lệ đang lưu trên tầng đang mở, đọc thẳng từ store. */
function storedRatio(): number | undefined {
  const entity = useStore.getState().spatial?.byId[FLOOR_ID];

  return entity !== undefined && 'scaleMillimetresPerPixel' in entity
    ? entity.scaleMillimetresPerPixel
    : undefined;
}

/**
 * Một con số viết ra như người dùng gõ nó.
 *
 * Dấu thập phân tiếng Việt là dấu PHẨY, nên `formatNumber` — chiều thuận của
 * chính `parseLength` — là cách đúng để gõ một số vào ô nhập, kể cả trong test.
 */
function typedNumber(value: number): string {
  return formatNumber(value, { grouping: false });
}

/* -------------------------------------------------------------------------- */
/* Mảng thứ hai của `expectSevenStates`.                                       */
/* -------------------------------------------------------------------------- */

/** Chỉ để thoả kiểu; props thật đến từ `scenarioFor` của story. */
function scenarioIndex(): readonly SevenStateScenario[] {
  return SEVEN_STATES.map((state) => ({
    state,
    label: SEVEN_STATE_LABELS[state],
    rows: [],
    totalCount: scenarioFor(state).model.panel.dimension.rows.length,
    isLoading: state === 'loading',
    isCollapsed: state === 'collapsed',
    canView: state !== 'forbidden',
    error: null,
  }));
}

/* -------------------------------------------------------------------------- */
/* Bộ dựng của hai kịch bản nghiệm thu.                                        */
/* -------------------------------------------------------------------------- */

/**
 * Ảnh nền của một tầng, đọc từ chính bộ mẫu của `createMockApiClient()`.
 *
 * Mã tầng bị đổi sang mã của bộ mẫu chuẩn A14 vì store giữ đồ thị của bộ mẫu
 * đó: hai bộ dữ liệu đã có, và test nối chúng lại chứ không dựng bộ thứ ba.
 */
async function readMockDrawing(client: ApiClient): Promise<ScaleDrawingSnapshot> {
  const result = await client.quality.assess({
    floorId: MEASURED_MOCK_FLOOR_ID,
    projectId: PROJECT_ID,
  });

  if (!result.ok) {
    throw new Error('Không đọc được lượt đo chất lượng của bộ mẫu.');
  }

  const floor = result.data.floors.find((entry) => entry.floorId === MEASURED_MOCK_FLOOR_ID);

  if (floor === undefined || floor.measurement === undefined) {
    throw new Error('Bộ mẫu không có tầng đã đo nào để hiệu chỉnh.');
  }

  return {
    floorId: FLOOR_ID,
    floorName: floor.floorName,
    imageUrl: floor.sourceUrl,
    widthPx: pixels(floor.measurement.widthPx),
    heightPx: pixels(floor.measurement.heightPx),
    isWarped: floor.frame !== undefined && !floor.frame.isFound,
  };
}

interface Harness {
  readonly gateway: ScaleCalibrationGateway;
  readonly persistCalls: () => readonly MillimetresPerPixel[];
}

/**
 * Chuỗi kích thước dựng từ 34 `Dimension` thật của bộ mẫu A14.
 *
 * Chiều dài pixel của mỗi hàng do chính {@link REFERENCE_SCALE} quy đổi từ giá
 * trị mi-li-mét của bộ mẫu, nên không phép chia nào xảy ra ở đây và không có
 * bảng dữ liệu thứ hai bịa tại chỗ (R-70). Hộp bao xếp so le xuống dưới để hai
 * hàng khác nhau bay tới hai chỗ khác nhau — đó là thứ phép kiểm khung nhìn cần.
 */
function sampleDimensionRows(): readonly ScaleRawDimensionString[] {
  const graph = createSampleBuilding();

  return graph.dimensions.map((dimension, index) => {
    const realLength = millimetres(dimension.valueMm);
    const top = index * 0.02;

    return {
      id: dimension.id,
      realLength,
      pixelLength: REFERENCE_SCALE.millimetresToPixels(realLength),
      confidence: dimension.confidence,
      boundingBox: { min: { x: 0.1, y: top }, max: { x: 0.3, y: top + 0.01 } },
    };
  });
}

/**
 * Cổng của bộ mẫu với đúng những việc đang kiểm được thay.
 *
 * Cùng lý lẽ `makeHarness` của `useScaleCalibration.test.ts`: chỉ thứ đang kiểm
 * mới bị thay, phần còn lại vẫn là cổng thật chạy trên bộ mẫu (R-70).
 */
interface HarnessOptions {
  readonly referenceWallWidthPx?: Pixels;
  readonly rows?: readonly ScaleRawDimensionString[];
}

async function makeHarness(options: HarnessOptions = {}): Promise<Harness> {
  const { referenceWallWidthPx, rows } = options;
  const client = createMockApiClient();
  const base = createScaleCalibrationGateway(client, { now: () => clock.epochMs() });
  const drawing = await readMockDrawing(client);
  const persisted: MillimetresPerPixel[] = [];

  const gateway = withScaleCapabilities(base, {
    supports: {
      dimensionStrings: rows !== undefined,
      referenceWallWidth: referenceWallWidthPx !== undefined,
    },
    readFloorDrawing: async () => ({ ok: true, data: drawing }),
    readDimensionStrings: async () =>
      rows === undefined
        ? base.readDimensionStrings({ floorId: FLOOR_ID, projectId: PROJECT_ID })
        : { supported: true, value: rows },
    readReferenceWallWidth: async () =>
      referenceWallWidthPx === undefined
        ? base.readReferenceWallWidth({ floorId: FLOOR_ID, projectId: PROJECT_ID })
        : { supported: true, value: referenceWallWidthPx },
    persistScale: async (input) => {
      persisted.push(input.millimetresPerPixel);
      return base.persistScale(input);
    },
  });

  return { gateway, persistCalls: () => persisted };
}

/**
 * Màn thật: hook thật lái view thật.
 *
 * `actions` được hé ra qua một `useEffect` để kịch bản kéo được đoạn tham chiếu
 * — xem ghi chú "Vì sao đoạn tham chiếu được kéo qua `actions`" ở đầu file. Mọi
 * khẳng định vẫn đọc DOM, không đọc mô hình.
 */
interface MountedScreen {
  readonly actions: () => ScaleCalibrationActions;
  readonly state: () => UseScaleCalibrationResult['model']['state'];
  readonly unmount: () => void;
}

function mountScreen(gateway: ScaleCalibrationGateway): MountedScreen {
  let latest: UseScaleCalibrationResult | null = null;

  function Wired(): ReactNode {
    const screenProps = useScaleCalibration({ projectId: PROJECT_ID, floorId: FLOOR_ID, gateway });

    useEffect(() => {
      latest = screenProps;
    });

    latest = screenProps;

    return <ScaleCalibration actions={screenProps.actions} model={screenProps.model} />;
  }

  const queryClient = createTestQueryClient();
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <Wired />
    </QueryClientProvider>,
  );

  const current = (): UseScaleCalibrationResult => {
    if (latest === null) {
      throw new Error('Màn chưa render lần nào.');
    }

    return latest;
  };

  return {
    actions: () => current().actions,
    state: () => current().model.state,
    unmount: rendered.unmount,
  };
}

/**
 * Chờ lượt đọc đầu tiên về.
 *
 * Đồng hồ ở đây là đồng hồ giả, nên `waitFor` — vốn chờ bằng đồng hồ thật — sẽ
 * đứng im mãi mãi. Cách chờ đúng dưới đồng hồ giả là tự đẩy thời gian.
 */
async function settle(mounted: MountedScreen): Promise<void> {
  for (let turn = 0; turn < SETTLE_TURNS; turn += 1) {
    if (mounted.state() !== 'loading') {
      return;
    }

    await act(async () => {
      await clock.advance(1);
    });
  }

  expect(mounted.state()).not.toBe('loading');
}

/**
 * Bề rộng ảnh, đọc ngược từ chính màn.
 *
 * Toạ độ `1` trên khung ảnh là mép phải, nên toạ độ con trỏ mà thanh trạng thái
 * báo cho điểm đó chính là bề rộng ảnh tính bằng pixel — không phải một con số
 * test tự giữ, mà là con số hook đang dùng. Không phép chia nào ở đây: đoạn dài
 * đúng 400 px được dựng bằng một `Scale` của M-02.
 */
function imageWidthPxOf(mounted: MountedScreen): Pixels {
  act(() => {
    mounted.actions().onMoveCursor({ x: 1, y: 1 });
  });

  const value = screen.getByLabelText(/^Toạ độ X:/u).textContent ?? '';

  return pixels(Number.parseFloat(value.replace(/[^0-9,]/gu, '').replace(',', '.')));
}

/** Kéo một đoạn dài đúng `REFERENCE_PIXEL_LENGTH` theo phương ngang. */
async function dragReferenceLine(mounted: MountedScreen): Promise<void> {
  const frame = createScale({
    pixelLength: imageWidthPxOf(mounted),
    realLength: millimetres(1),
  });
  const start: ImageRatioPoint = { x: 0, y: 0 };
  const end: ImageRatioPoint = { x: frame.pixelsToMillimetres(REFERENCE_PIXEL_LENGTH), y: 0 };

  await act(async () => {
    mounted.actions().onStartDrag(start);
  });
  await act(async () => {
    mounted.actions().onMoveDrag(end, { isAxisLocked: false });
  });
  await act(async () => {
    mounted.actions().onEndDrag(end);
  });
}

/**
 * `transform` của lớp mang khung nhìn, đọc thẳng từ DOM.
 *
 * Đây là chỗ `ViewportState` thật sự hiện ra: canvas viết
 * `translate(x, y) scale(zoom)` lên lớp `inset-0` nằm trong khung. Đọc nó thay
 * vì đọc mô hình là cách duy nhất chứng minh khung nhìn ĐỔI trên màn chứ không
 * chỉ đổi trong một đối tượng.
 */
function viewportTransform(): string {
  const frame = screen.getByRole('group', { name: CANVAS_ARIA_LABEL });
  const layer = frame.firstElementChild;

  return layer instanceof HTMLElement ? layer.style.transform : '';
}

/** Gõ vào ô "Chiều dài thật" — qua DOM thật, đúng đường người dùng đi. */
function typeRealLength(text: string): void {
  const field = screen.getByLabelText(new RegExp(REAL_LENGTH_LABEL, 'u'));

  act(() => {
    fireEvent.change(field, { target: { value: text } });
  });
}

/* -------------------------------------------------------------------------- */
/* [NGHIEM-1] Bảy trạng thái (A11, R-63).                                      */
/* -------------------------------------------------------------------------- */

describe('ScaleCalibration — bảy trạng thái (A11, R-63)', () => {
  it('vẽ đủ bảy trạng thái, không lần nào ném lỗi và không lần nào ra màn trắng', () => {
    let rendered = 0;

    expectSevenStates((scenario) => {
      const { container, unmount } = renderWithProviders(
        <ScaleCalibration {...scenarioFor(scenario.state)} />,
      );
      rendered += 1;
      return { container, unmount };
    }, scenarioIndex());

    expect(rendered).toBe(SEVEN_STATES.length);
    expect(rendered).toBe(7);
  });

  it('trạng thái không có quyền: nút áp dụng biến MẤT, không phải mờ đi', () => {
    renderWithProviders(<ScaleCalibration {...scenarioFor('forbidden')} />);

    expect(screen.queryByRole('button', { name: APPLY_LABEL })).not.toBeInTheDocument();
  });

  it('trạng thái lỗi nói cả câu hậu quả lẫn mã máy đọc, và mở lối về tiền xử lý', () => {
    const scenario = scenarioFor('error');

    renderWithProviders(<ScaleCalibration {...scenario} />);

    // Câu này đứng hai chỗ, và cả hai đều đúng chỗ: tiêu đề khối lỗi của màn, và
    // lời báo bản vẽ có thể méo mà canvas tự dựng đè lên ảnh.
    expect(screen.getAllByText(/Nắn ảnh thất bại nên bản vẽ có thể méo/u).length).toBeGreaterThan(0);
    expect(screen.getByText(new RegExp(scenario.model.errorCode ?? '', 'u'))).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Quay lại bước tiền xử lý' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tải lại ảnh' })).toBeInTheDocument();
  });

  it('thanh trạng thái 32px là `StatusBar` dùng chung, có mặt ở mọi trạng thái', () => {
    for (const state of SEVEN_STATES) {
      const { unmount } = renderWithProviders(<ScaleCalibration {...scenarioFor(state)} />);

      expect(screen.getByRole('status', { name: 'Thanh trạng thái' })).toBeInTheDocument();
      unmount();
    }
  });

  it('khung hẹp vẫn dựng đủ canvas, panel và thanh trạng thái', () => {
    renderWithProviders(<ScaleCalibration {...compactScenario()} />);

    expect(screen.getByLabelText('Tấm trượt hiệu chỉnh tỷ lệ')).toBeInTheDocument();
    expect(screen.getByLabelText('Khung bản vẽ để hiệu chỉnh tỷ lệ')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Thanh trạng thái' })).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* Khả năng tiếp cận, tiếng Việt, màu (R-72).                                   */
/* -------------------------------------------------------------------------- */

describe('ScaleCalibration — khả năng tiếp cận, tiếng Việt, màu (R-72)', () => {
  it('đi qua expectAccessible ở trạng thái đầy đủ nhất', () => {
    const { container } = renderWithProviders(<ScaleCalibration {...scenarioFor('success')} />);

    expectAccessible(container);
  });

  it('đi qua expectAccessible ở trạng thái một phần, nơi có cả cảnh báo lẫn danh sách', () => {
    const { container } = renderWithProviders(<ScaleCalibration {...scenarioFor('partial')} />);

    expectAccessible(container);
  });

  it('mọi chuỗi hiển thị là tiếng Việt có dấu', () => {
    const { container } = renderWithProviders(<ScaleCalibration {...scenarioFor('success')} />);

    expectVietnamese(container, { allowWords: ALLOWED_WORDS, ignore: [MACHINE_ERROR_CODE] });
  });

  it('mọi chuỗi hiển thị của trạng thái lỗi cũng là tiếng Việt có dấu', () => {
    const { container } = renderWithProviders(<ScaleCalibration {...scenarioFor('error')} />);

    expectVietnamese(container, { allowWords: ALLOWED_WORDS, ignore: [MACHINE_ERROR_CODE] });
  });

  it('không mã màu thô trong bất kỳ file nào của thư mục màn (A1)', () => {
    for (const file of readdirSync(SCREEN_DIRECTORY)) {
      expectNoRawColor(`${SCREEN_DIRECTORY}/${file}`);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-4] Phép tính không giấu được.                                       */
/* -------------------------------------------------------------------------- */

describe('ScaleCalibration — phép tính hiện đủ ba vế [NGHIEM-4]', () => {
  it('đặt cả tử số, mẫu số và kết quả xuống màn, không rút gọn thành mỗi kết quả', () => {
    const scenario = scenarioFor('success');
    const { computation } = scenario.model.panel;

    renderWithProviders(<ScaleCalibration {...scenario} />);

    const block = screen.getByLabelText('Phép tính ra tỷ lệ');

    expect(block).toHaveTextContent(computation.numeratorLabel);
    expect(block).toHaveTextContent(computation.denominatorLabel);
    expect(block).toHaveTextContent(computation.resultLabel);
  });

  it('thiếu một vế thì vế thiếu vẫn có chỗ đứng, không biến mất', () => {
    const scenario = scenarioFor('partial');

    renderWithProviders(<ScaleCalibration {...scenario} />);

    const block = screen.getByLabelText('Phép tính ra tỷ lệ');

    expect(scenario.model.panel.computation.isComplete).toBe(false);
    expect(block).toHaveTextContent(scenario.model.panel.computation.denominatorLabel);
    expect(block).toHaveTextContent('—');
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-2] Kịch bản bốn bước, qua hook thật và view thật.                   */
/* -------------------------------------------------------------------------- */

describe('ScaleCalibration — kịch bản bốn bước [NGHIEM-2]', () => {
  it('kéo 400 px → nhập 4800 → màn hiện 12 mm/px → tự lưu → hoàn tác trả về tỷ lệ cũ', async () => {
    const harness = await makeHarness();
    const mounted = mountScreen(harness.gateway);
    await settle(mounted);

    /* Bước 1 — kéo một đoạn dài đúng 400 px. */
    await dragReferenceLine(mounted);

    expect(screen.getByLabelText('Phép tính ra tỷ lệ')).toHaveTextContent(
      `${formatNumber(REFERENCE_PIXEL_LENGTH)} px`,
    );

    /* Bước 2 — nhập 4800 mm, qua DOM thật. */
    typeRealLength(typedNumber(REFERENCE_REAL_LENGTH));

    /* Bước 3 — màn hiện đúng phép tính, cả ba vế. */
    const computationBlock = screen.getByLabelText('Phép tính ra tỷ lệ');

    expect(computationBlock).toHaveTextContent(formatLength(REFERENCE_REAL_LENGTH, { unit: 'mm' }));
    expect(computationBlock).toHaveTextContent(`${formatNumber(REFERENCE_PIXEL_LENGTH)} px`);
    expect(computationBlock).toHaveTextContent(
      `${formatNumber(REFERENCE_SCALE.millimetresPerPixel)} mm/px`,
    );

    /* Bước 4a — áp tỷ lệ qua nút thật, rồi tự lưu (A7: không có nút lưu). */
    expect(storedRatio()).toBeUndefined();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: APPLY_LABEL }));
    });

    expect(storedRatio()).toBeCloseTo(REFERENCE_SCALE.millimetresPerPixel, 6);

    await act(async () => {
      await clock.advance(RETRY_SCHEDULE_MS[0]);
    });

    expect(harness.persistCalls()).toHaveLength(1);
    expect(harness.persistCalls()[0]).toBeCloseTo(REFERENCE_SCALE.millimetresPerPixel, 6);

    /* Bước 4b — hoàn tác trả về tỷ lệ cũ (A8), qua đúng đường zundo. */
    await act(async () => {
      useStore.temporal.getState().undo();
    });

    expect(storedRatio()).toBeUndefined();

    mounted.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-5] Khung nhìn THẬT SỰ bay khi chọn một chuỗi kích thước (R-07).     */
/* -------------------------------------------------------------------------- */

describe('ScaleCalibration — nối kích thước canvas [NGHIEM-5]', () => {
  it('chọn một chuỗi kích thước làm `transform` của lớp khung nhìn ĐỔI GIÁ TRỊ', async () => {
    // Giảm chuyển động BẬT, và đó là điều kiện làm phép kiểm này đo được thứ nó
    // định đo. `flyToBounds` chạy 340 ms qua `requestAnimationFrame`, nên ở nhịp
    // đầu nó đặt lại đúng giá trị xuất phát — đọc `transform` ngay sau lời gọi
    // dưới chuyển động đầy đủ sẽ luôn thấy "chưa đổi", bất kể đường nối kích
    // thước có đúng hay không. Bật giảm chuyển động thì khung nhìn nhảy THẲNG
    // tới đích (mục B), nên giá trị đọc được là ĐÍCH thật mà `flyToBounds` tính
    // ra từ kích thước canvas — đúng con số sẽ sai nếu đường nối bị đứt.
    setReducedMotion(true);

    // `flyToBounds` tính `ViewportState` từ bề rộng và bề cao canvas ĐÃ RENDER.
    // jsdom trả về hình chữ nhật rỗng cho mọi phần tử, nên nếu không đặt kích
    // thước ở đây thì hook coi canvas là `0 × 0` và BỎ QUA lượt bay — phép kiểm
    // sẽ xanh vì sai lý do. Đặt một khung vuông đúng như `aspect-square` dựng ra.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: CANVAS_FRAME_PX,
      height: CANVAS_FRAME_PX,
      left: 0,
      right: CANVAS_FRAME_PX,
      toJSON: () => ({}),
      top: 0,
      width: CANVAS_FRAME_PX,
      x: 0,
      y: 0,
    } as DOMRect);

    const rows = sampleDimensionRows();
    const harness = await makeHarness({ rows });
    const mounted = mountScreen(harness.gateway);
    await settle(mounted);

    const before = viewportTransform();

    // Hàng cuối nằm xa hàng đầu nhất trên khung ảnh, nên nếu khung nhìn có bay
    // thì nó bay một quãng thấy được — không phải một sai khác dưới một pixel.
    const target = rows[rows.length - 1];

    expect(target).toBeDefined();

    await act(async () => {
      mounted.actions().onSelectDimensionRow(target?.id ?? '');
    });

    const after = viewportTransform();

    expect(before).not.toBe('');
    expect(after).not.toBe(before);

    mounted.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* [NGHIEM-3] 250 mm/px cảnh báo, và KHÔNG chặn.                               */
/* -------------------------------------------------------------------------- */

describe('ScaleCalibration — cảnh báo tường ba mét [NGHIEM-3]', () => {
  it('nhập tỷ lệ 250 mm/px thì câu "tường dày 3 m" hiện TRƯỚC khi áp được', async () => {
    const harness = await makeHarness({ referenceWallWidthPx: REFERENCE_WALL_WIDTH });
    const mounted = mountScreen(harness.gateway);
    await settle(mounted);
    await dragReferenceLine(mounted);

    // Một đoạn 400 px dài 100.000 mm cho ra đúng 250 mm/px.
    typeRealLength(typedNumber(IMPLAUSIBLE_RATIO * REFERENCE_PIXEL_LENGTH));

    // Nét tường 12 px ở 250 mm/px là một bức tường dày ba mét — đúng câu đặc tả nêu.
    const impliedThickness = millimetres(IMPLAUSIBLE_RATIO * REFERENCE_WALL_WIDTH);
    const warningRegion = screen.getAllByLabelText('Cảnh báo về tỷ lệ')[0];

    expect(warningRegion).toBeDefined();
    expect(warningRegion).toHaveTextContent(formatLength(impliedThickness));

    // Cảnh báo nói ra hậu quả, không khoá nút: A9 không áp vì thao tác này hoàn
    // tác được, nên không hộp thoại nào được dựng ra và nút vẫn bấm được.
    const applyButton = screen.getByRole('button', { name: APPLY_LABEL });

    expect(applyButton).toBeEnabled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    mounted.unmount();
  });
});
