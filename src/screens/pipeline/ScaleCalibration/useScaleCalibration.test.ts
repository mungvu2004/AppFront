/**
 * Nửa "suy nghĩ" của màn Hiệu chỉnh tỷ lệ, kiểm không cần DOM của màn.
 *
 * Hook được lái qua `renderHook`, và tầng dữ liệu là `createMockApiClient()` của
 * `src/api/__mocks__/client.ts` — cùng phép ánh xạ bản sản phẩm dùng, nên test
 * không dựng một ý niệm thứ hai về hình dạng câu trả lời (R-70). Đồ thị trong
 * store là bộ mẫu chuẩn của A14 (`createCleanBuildingScenario`), và các chuỗi
 * kích thước được dựng từ chính 34 `Dimension` của bộ mẫu đó — không có bảng dữ
 * liệu thứ hai bịa tại chỗ.
 *
 * Ba con số duy nhất viết ra ở đây — `400 px`, `4.800 mm`, `250 mm/px` — là
 * chính ví dụ đặc tả nêu, và cũng là ví dụ `domain/units/__tests__/scale.test.ts`
 * đang kiểm. Chúng đi vào `createScale`; không phép chia nào xảy ra trong file
 * này, kể cả để dựng dữ liệu: tỉ lệ `0..1` của một đoạn 400 px trên khung ảnh do
 * chính một `Scale` của M-02 tính ra.
 */

import { createElement, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockApiClient } from '@/api/__mocks__/client';
import type { ApiClient } from '@/api/client';
import { createSampleBuilding, sampleLevelId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import {
  createScale,
  millimetresPerPixel,
  pixels,
  SCALE_THRESHOLDS,
  type MillimetresPerPixel,
  type Pixels,
  type Scale,
} from '@/domain/units/scale';
import { millimetres } from '@/domain/units/types';
import { RETRY_SCHEDULE_MS } from '@/lib/autosave/retrySchedule';
import { formatLength } from '@/lib/format/measure';
import { formatNumber } from '@/lib/format/number';
import { formatCombo, parseCombo } from '@/lib/input/shortcutRegistry';
import { createCleanBuildingScenario } from '@/lib/testing/fixtures';
import { createTestQueryClient } from '@/lib/testing/render';
import { installFakeClock, type FakeClock } from '@/lib/testing/fakeClock';
import { SEVEN_STATES } from '@/lib/testing/sevenStateScenarios';
import { useStore } from '@/store';
import type { ProjectRole } from '@/types/project';

import {
  clearPersistedScales,
  createScaleCalibrationGateway,
  withScaleCapabilities,
  type ScaleCalibrationGateway,
  type ScaleDrawingSnapshot,
  type ScaleRawDimensionString,
} from './scaleCalibrationGateway';
import { useScaleCalibration } from './useScaleCalibration';
import type {
  ImageRatioPoint,
  ScaleCalibrationState,
  UseScaleCalibrationResult,
} from './types';

/* -------------------------------------------------------------------------- */
/* Ví dụ đã có sẵn trong đặc tả và trong test của domain.                       */
/* -------------------------------------------------------------------------- */

const PROJECT_ID = 'project-1';

/** Số nhịp đồng hồ giả một lượt đọc của bộ mẫu cần để về. */
const SETTLE_TURNS = 20;

/** Tầng của bộ mẫu chuẩn. Mã tầng có tiền tố `L-`, tức một `LevelId` thật. */
const FLOOR_ID = sampleLevelId(0);

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

/** Ảnh mẫu để đo trên: tầng của bộ mẫu mock đã đo xong và tìm được khung bản vẽ. */
const MEASURED_MOCK_FLOOR_ID = 'L2';
/** Tầng mock mà máy KHÔNG tìm được khung bản vẽ — nguồn của trạng thái `error`. */
const WARPED_MOCK_FLOOR_ID = 'L1';

/* -------------------------------------------------------------------------- */
/* Môi trường.                                                                 */
/* -------------------------------------------------------------------------- */

let clock: FakeClock;

/* jsdom không có `matchMedia`; `matches: false` là cách xếp rộng, không giảm chuyển động. */
beforeEach(() => {
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

  clock = installFakeClock();
  clearPersistedScales();
  seedStore();
});

afterEach(() => {
  cleanup();
  clock.restore();
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
 * Dấu thập phân tiếng Việt là dấu PHẨY, nên `String(15.6)` là `"15.6"` và
 * `parseLength` đọc dấu chấm đó thành dấu phân nhóm hàng nghìn. `formatNumber`
 * là chiều thuận của chính `parseLength`, nên nó là cách đúng để gõ một số vào
 * ô nhập — kể cả trong test.
 */
function typedNumber(value: number): string {
  return formatNumber(value, { grouping: false });
}

/* -------------------------------------------------------------------------- */
/* Bộ dựng cổng.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Ảnh nền của một tầng, đọc từ chính bộ mẫu của `createMockApiClient()`.
 *
 * Mã tầng bị đổi sang mã của bộ mẫu chuẩn A14 vì store giữ đồ thị của bộ mẫu
 * đó: hai bộ dữ liệu đã có, và test nối chúng lại chứ không dựng bộ thứ ba.
 */
async function readMockDrawing(
  client: ApiClient,
  sourceFloorId: string,
): Promise<ScaleDrawingSnapshot> {
  const result = await client.quality.assess({ floorId: sourceFloorId, projectId: PROJECT_ID });

  if (!result.ok) {
    throw new Error('Không đọc được lượt đo chất lượng của bộ mẫu.');
  }

  const floor = result.data.floors.find((entry) => entry.floorId === sourceFloorId);

  if (floor === undefined || floor.measurement === undefined) {
    throw new Error(`Bộ mẫu không có tầng đã đo nào mang mã ${sourceFloorId}.`);
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

/**
 * 34 chuỗi kích thước, dựng từ 34 `Dimension` của bộ mẫu chuẩn.
 *
 * Chiều dài pixel của mỗi hàng do `REFERENCE_SCALE` quy đổi từ chính giá trị
 * mi-li-mét của bộ mẫu — nên mọi hàng cùng nói một tỷ lệ 12 mm/px, và
 * `inferScale` phải suy ra đúng con số đó. Không phép chia nào ở đây: `Scale`
 * làm việc đó.
 */
function sampleDimensionRows(lowConfidenceCount = 0): readonly ScaleRawDimensionString[] {
  const graph = createSampleBuilding();

  return graph.dimensions.map((dimension, index) => {
    const realLength = millimetres(dimension.valueMm);

    return {
    id: dimension.id,
    realLength,
    pixelLength: REFERENCE_SCALE.millimetresToPixels(realLength),
    confidence:
      index < lowConfidenceCount ? SCALE_THRESHOLDS.minimumConfidence : dimension.confidence,
    boundingBox: {
      min: { x: 0.1, y: index * 0.02 },
      max: { x: 0.3, y: index * 0.02 + 0.01 },
    },
    };
  });
}

interface HarnessOptions {
  readonly sourceFloorId?: string;
  readonly rows?: readonly ScaleRawDimensionString[];
  readonly referenceWallWidthPx?: Pixels;
}

interface Harness {
  readonly gateway: ScaleCalibrationGateway;
  readonly persistCalls: () => readonly MillimetresPerPixel[];
}

/**
 * Cổng của bộ mẫu với đúng những việc đang kiểm được thay.
 *
 * Cùng lý lẽ `makeScriptedClient` của `useProcessingScreen.test.ts`: chỉ thứ
 * đang kiểm mới bị thay, phần còn lại vẫn là cổng thật chạy trên bộ mẫu.
 */
async function makeHarness(options: HarnessOptions = {}): Promise<Harness> {
  const client = createMockApiClient();
  const base = createScaleCalibrationGateway(client, { now: () => clock.epochMs() });
  const drawing = await readMockDrawing(client, options.sourceFloorId ?? MEASURED_MOCK_FLOOR_ID);
  const persisted: MillimetresPerPixel[] = [];

  const gateway = withScaleCapabilities(base, {
    supports: {
      dimensionStrings: options.rows !== undefined,
      referenceWallWidth: options.referenceWallWidthPx !== undefined,
    },
    readFloorDrawing: async () => ({ ok: true, data: drawing }),
    readDimensionStrings: async () =>
      options.rows === undefined
        ? base.readDimensionStrings({ floorId: FLOOR_ID, projectId: PROJECT_ID })
        : { supported: true, value: options.rows },
    readReferenceWallWidth: async () =>
      options.referenceWallWidthPx === undefined
        ? base.readReferenceWallWidth({ floorId: FLOOR_ID, projectId: PROJECT_ID })
        : { supported: true, value: options.referenceWallWidthPx },
    persistScale: async (input) => {
      persisted.push(input.millimetresPerPixel);
      return base.persistScale(input);
    },
  });

  return { gateway, persistCalls: () => persisted };
}

/* -------------------------------------------------------------------------- */
/* Dựng hook.                                                                  */
/* -------------------------------------------------------------------------- */

interface MountOptions {
  readonly roles?: readonly ProjectRole[];
  readonly forceCollapsed?: boolean;
}

interface Mounted {
  readonly result: { current: UseScaleCalibrationResult };
  readonly unmount: () => void;
}

function mountHook(gateway: ScaleCalibrationGateway, options: MountOptions = {}): Mounted {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }): ReactNode =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  const rendered = renderHook(
    () =>
      useScaleCalibration({
        projectId: PROJECT_ID,
        floorId: FLOOR_ID,
        gateway,
        ...(options.roles !== undefined ? { roles: options.roles } : {}),
        ...(options.forceCollapsed !== undefined ? { forceCollapsed: options.forceCollapsed } : {}),
      }),
    { wrapper },
  );

  return { result: rendered.result, unmount: rendered.unmount };
}

/**
 * Chờ lượt đọc đầu tiên về.
 *
 * Đồng hồ ở đây là đồng hồ giả, nên `waitFor` — vốn chờ bằng đồng hồ thật —
 * sẽ đứng im mãi mãi. Cách chờ đúng dưới đồng hồ giả là tự đẩy thời gian.
 */
async function settle(mounted: Mounted): Promise<void> {
  for (let turn = 0; turn < SETTLE_TURNS; turn += 1) {
    if (mounted.result.current.model.state !== 'loading') {
      return;
    }

    await act(async () => {
      await clock.advance(1);
    });
  }

  expect(mounted.result.current.model.state).not.toBe('loading');
}

/** Kéo một đoạn dài đúng `REFERENCE_PIXEL_LENGTH` theo phương ngang. */
async function dragReferenceLine(mounted: Mounted): Promise<void> {
  const drawingWidthPx = pixels(
    (useStore.getState().spatial === null ? 0 : 0) + imageWidthPxOf(mounted),
  );
  const frame = createScale({ pixelLength: drawingWidthPx, realLength: millimetres(1) });
  const start: ImageRatioPoint = { x: 0, y: 0 };
  const end: ImageRatioPoint = {
    x: frame.pixelsToMillimetres(REFERENCE_PIXEL_LENGTH),
    y: 0,
  };

  await act(async () => {
    mounted.result.current.actions.onStartDrag(start);
  });
  await act(async () => {
    mounted.result.current.actions.onMoveDrag(end, { isAxisLocked: false });
  });
  await act(async () => {
    mounted.result.current.actions.onEndDrag(end);
  });
}

/**
 * Bề rộng ảnh, đọc ngược từ chính hook.
 *
 * Toạ độ `1` trên khung ảnh là mép phải, nên toạ độ con trỏ mà thanh trạng thái
 * báo cho điểm đó chính là bề rộng ảnh tính bằng pixel — không phải một con số
 * test tự giữ, mà là con số hook đang dùng.
 */
function imageWidthPxOf(mounted: Mounted): number {
  act(() => {
    mounted.result.current.actions.onMoveCursor({ x: 1, y: 1 });
  });

  return mounted.result.current.model.statusBar.x;
}

/* -------------------------------------------------------------------------- */
/* Kiểm.                                                                       */
/* -------------------------------------------------------------------------- */

describe('useScaleCalibration — tỷ lệ do M-02 tính', () => {
  it('kéo đoạn 400 px rồi nhập 4800 mm cho ra 12 mm/px, và hiện đủ phép tính', async () => {
    const harness = await makeHarness();
    const mounted = mountHook(harness.gateway);
    await settle(mounted);
    await dragReferenceLine(mounted);

    await act(async () => {
      mounted.result.current.actions.onChangeRealLength('4800');
    });

    const { computation } = mounted.result.current.model.panel;

    expect(computation.numeratorLabel).toBe('4.800 mm');
    expect(computation.denominatorLabel).toBe('400 px');
    expect(computation.resultLabel).toBe('12 mm/px');
    expect(computation.isComplete).toBe(true);
    expect(mounted.result.current.model.panel.canApply).toBe(true);
  });

  it('chưa nhập chiều dài thì vế thiếu vẫn có chỗ đứng, và phép tính chưa đủ', async () => {
    const harness = await makeHarness();
    const mounted = mountHook(harness.gateway);
    await settle(mounted);
    await dragReferenceLine(mounted);

    const { computation } = mounted.result.current.model.panel;

    expect(computation.denominatorLabel).toBe('400 px');
    expect(computation.numeratorLabel).toBe('—');
    expect(computation.resultLabel).toBe('—');
    expect(computation.isComplete).toBe(false);
  });

  it('suy ra tỷ lệ của bộ mẫu từ 34 chuỗi kích thước qua inferScale', async () => {
    const harness = await makeHarness({ rows: sampleDimensionRows() });
    const mounted = mountHook(harness.gateway);
    await settle(mounted);

    const inference = mounted.result.current.aiInference;

    expect(inference).not.toBeNull();
    expect(inference?.suggestedMillimetresPerPixel).toBeCloseTo(
      REFERENCE_SCALE.millimetresPerPixel,
      6,
    );
  });
});

describe('useScaleCalibration — áp dụng, tự lưu, hoàn tác', () => {
  it('áp tỷ lệ ghi vào store, tự lưu chạy, và hoàn tác trả về tỷ lệ cũ', async () => {
    const harness = await makeHarness();
    const mounted = mountHook(harness.gateway);
    await settle(mounted);
    await dragReferenceLine(mounted);

    await act(async () => {
      mounted.result.current.actions.onChangeRealLength('4800');
    });

    expect(storedRatio()).toBeUndefined();

    await act(async () => {
      mounted.result.current.actions.onApply();
    });

    expect(storedRatio()).toBeCloseTo(REFERENCE_SCALE.millimetresPerPixel, 6);

    // A7: không có nút lưu. Đủ im lặng thì lượt lưu tự chạy. Khoảng chờ ở đây
    // là nhịp thử lại đầu tiên của `createAutosave` — một hằng có thật, và theo
    // cấu trúc thì dài hơn khoảng giãn 800 ms của A7, nên không con số nào phải
    // viết tay ở đây (R-71).
    await act(async () => {
      await clock.advance(RETRY_SCHEDULE_MS[0]);
    });

    expect(harness.persistCalls()).toHaveLength(1);
    expect(harness.persistCalls()[0]).toBeCloseTo(REFERENCE_SCALE.millimetresPerPixel, 6);
    expect(mounted.result.current.model.statusBar.saveText).not.toBe('');

    // A8: hoàn tác được, và hoàn tác chạy qua zundo vì `spatial` nằm trong
    // `partialize` — đúng đường mà `commit()` nuôi.
    await act(async () => {
      useStore.temporal.getState().undo();
    });

    expect(storedRatio()).toBeUndefined();
  });

  it('trả về `appliedScale` dùng được ngay sau khi áp', async () => {
    const harness = await makeHarness();
    const mounted = mountHook(harness.gateway);
    await settle(mounted);
    await dragReferenceLine(mounted);

    await act(async () => {
      mounted.result.current.actions.onChangeRealLength('4800');
    });
    await act(async () => {
      mounted.result.current.actions.onApply();
    });

    const applied = mounted.result.current.appliedScale;

    expect(applied).not.toBeNull();
    expect(applied?.pixelsToMillimetres(REFERENCE_PIXEL_LENGTH)).toBeCloseTo(
      REFERENCE_REAL_LENGTH,
      6,
    );
  });
});

describe('useScaleCalibration — hai cảnh báo, cả hai KHÔNG chặn', () => {
  it('250 mm/px bật cảnh báo tường ba mét ngay khi gõ, nút áp vẫn bấm được', async () => {
    const harness = await makeHarness({ referenceWallWidthPx: REFERENCE_WALL_WIDTH });
    const mounted = mountHook(harness.gateway);
    await settle(mounted);
    await dragReferenceLine(mounted);

    // Một đoạn 400 px dài 100.000 mm cho ra đúng 250 mm/px.
    await act(async () => {
      mounted.result.current.actions.onChangeRealLength(
        typedNumber(IMPLAUSIBLE_RATIO * REFERENCE_PIXEL_LENGTH),
      );
    });

    const { panel } = mounted.result.current.model;
    const warning = panel.warnings.find((notice) => notice.warning.kind === 'implausible');

    expect(warning).toBeDefined();
    expect(warning?.statusCode).toBe('attention');
    // Nét tường 12 px ở 250 mm/px là một bức tường dày ba mét — đúng câu đặc tả nêu.
    const impliedThickness = millimetres(IMPLAUSIBLE_RATIO * REFERENCE_WALL_WIDTH);

    expect(warning?.warning.kind).toBe('implausible');
    expect(warning?.message).toContain(formatLength(impliedThickness));
    // Cảnh báo nói ra hậu quả, không khoá nút.
    expect(panel.canApply).toBe(true);
    expect(panel.areActionsHidden).toBe(false);
    // Cùng cảnh báo đó đứng cạnh ô nhập, hiện ngay khi gõ chứ không đợi rời ô.
    expect(panel.reference.inlineWarning).not.toBeNull();
  });

  it('lệch quá 15% so với ước tính của AI thì cảnh báo, vẫn không chặn', async () => {
    const harness = await makeHarness({ rows: sampleDimensionRows() });
    const mounted = mountHook(harness.gateway);
    await settle(mounted);
    await dragReferenceLine(mounted);

    const aiRatio = mounted.result.current.aiInference?.suggestedMillimetresPerPixel;

    expect(aiRatio).toBeDefined();

    // Một tỷ lệ lệch gấp đôi ngưỡng 15%, dựng bằng chính ngưỡng đó.
    const drifted = millimetresPerPixel(
      (aiRatio ?? 0) * (1 + SCALE_THRESHOLDS.aiDeviationLimit + SCALE_THRESHOLDS.aiDeviationLimit),
    );

    await act(async () => {
      mounted.result.current.actions.onChangeRealLength(
        typedNumber(drifted * REFERENCE_PIXEL_LENGTH),
      );
    });

    const { panel } = mounted.result.current.model;
    const warning = panel.warnings.find(
      (notice) => notice.warning.kind === 'deviatesFromEstimate',
    );

    expect(warning).toBeDefined();
    expect(warning?.statusCode).toBe('attention');
    expect(panel.canApply).toBe(true);
  });

  it('tỷ lệ hợp lý thì không cảnh báo gì', async () => {
    const harness = await makeHarness({ referenceWallWidthPx: REFERENCE_WALL_WIDTH });
    const mounted = mountHook(harness.gateway);
    await settle(mounted);
    await dragReferenceLine(mounted);

    await act(async () => {
      mounted.result.current.actions.onChangeRealLength(typedNumber(REFERENCE_REAL_LENGTH));
    });

    expect(mounted.result.current.model.panel.warnings).toHaveLength(0);
  });
});

describe('useScaleCalibration — ba dòng kiểm chứng luôn đủ ba', () => {
  it('giữ đúng ba dòng, và dòng chưa đo được nói "—" chứ không biến mất', async () => {
    const harness = await makeHarness({ referenceWallWidthPx: REFERENCE_WALL_WIDTH });
    const mounted = mountHook(harness.gateway);
    await settle(mounted);
    await dragReferenceLine(mounted);

    await act(async () => {
      mounted.result.current.actions.onChangeRealLength('4800');
    });

    const rows = mounted.result.current.model.panel.crossChecks;

    expect(rows.map((row) => row.id)).toEqual([
      'wallThickness',
      'doorWidth',
      'largestRoomArea',
    ]);
    expect(rows[0]?.valueLabel).not.toBe('—');
    expect(rows[1]?.valueLabel).toBe('—');
    expect(rows[2]?.valueLabel).toBe('—');
    // A5: không dòng nào mang màu "đã xác minh".
    expect(rows.every((row) => row.statusCode !== 'verified')).toBe(true);
  });
});

describe('useScaleCalibration — bảy trạng thái', () => {
  it('đạt tới được cả bảy', async () => {
    const reached = new Set<ScaleCalibrationState>();

    // 1. loading — trước khi lượt đọc đầu tiên về.
    const loadingHarness = await makeHarness();
    const loading = mountHook(loadingHarness.gateway);
    reached.add(loading.result.current.model.state);
    await settle(loading);

    // 2. empty — đọc xong, không chuỗi kích thước nào.
    reached.add(loading.result.current.model.state);

    // 3. partial — đã bắt tay vào việc nhưng chưa chốt.
    await dragReferenceLine(loading);
    reached.add(loading.result.current.model.state);

    // 4. success — đã áp.
    await act(async () => {
      loading.result.current.actions.onChangeRealLength('4800');
    });
    await act(async () => {
      loading.result.current.actions.onApply();
    });
    reached.add(loading.result.current.model.state);
    loading.unmount();

    // 5. error — máy không tìm được khung bản vẽ, bản vẽ có thể méo.
    const warpedHarness = await makeHarness({ sourceFloorId: WARPED_MOCK_FLOOR_ID });
    const warped = mountHook(warpedHarness.gateway);
    await settle(warped);
    reached.add(warped.result.current.model.state);
    expect(warped.result.current.model.errorMessage).not.toBeNull();
    expect(warped.result.current.model.errorCode).not.toBeNull();
    warped.unmount();

    // 6. forbidden — người xem không có quyền sửa.
    const forbiddenHarness = await makeHarness();
    const forbidden = mountHook(forbiddenHarness.gateway, { roles: ['viewer'] });
    await settle(forbidden);
    reached.add(forbidden.result.current.model.state);
    expect(forbidden.result.current.model.canvas.isInteractive).toBe(false);
    expect(forbidden.result.current.model.panel.areActionsHidden).toBe(true);
    forbidden.unmount();

    // 7. collapsed — panel thu gọn.
    const collapsedHarness = await makeHarness();
    const collapsed = mountHook(collapsedHarness.gateway, { forceCollapsed: true });
    await settle(collapsed);
    reached.add(collapsed.result.current.model.state);
    collapsed.unmount();

    expect([...reached].sort()).toEqual([...SEVEN_STATES].sort());
  });

  it('trạng thái `partial` cũng đến từ chuỗi kích thước tin cậy thấp', async () => {
    const harness = await makeHarness({ rows: sampleDimensionRows(3) });
    const mounted = mountHook(harness.gateway);
    await settle(mounted);

    const { model } = mounted.result.current;

    expect(model.state).toBe('partial');
    expect(model.panel.dimension.lowConfidenceNotice).not.toBeNull();
    expect(model.panel.dimension.rows.filter((row) => row.isLowConfidence)).toHaveLength(3);
    // A5: hàng do AI đọc không bao giờ mang màu "đã xác minh".
    expect(model.panel.dimension.rows.every((row) => row.statusCode !== 'verified')).toBe(true);
  });
});

describe('useScaleCalibration — bàn phím và phiên kéo', () => {
  it('Esc huỷ đoạn đang kéo, R đo lại', async () => {
    const harness = await makeHarness();
    const mounted = mountHook(harness.gateway);
    await settle(mounted);

    await act(async () => {
      mounted.result.current.actions.onStartDrag({ x: 0, y: 0 });
    });

    expect(mounted.result.current.model.panel.reference.draft).not.toBeNull();

    await act(async () => {
      mounted.result.current.actions.onCancelDrag();
    });

    expect(mounted.result.current.model.panel.reference.draft).toBeNull();

    await dragReferenceLine(mounted);

    expect(mounted.result.current.model.panel.reference.canRemeasure).toBe(true);

    await act(async () => {
      mounted.result.current.actions.onRemeasure();
    });

    expect(mounted.result.current.model.panel.reference.draft).toBeNull();
  });

  it('nhích một đầu đoạn: mũi tên đi một pixel, Shift + mũi tên đi mười', async () => {
    const harness = await makeHarness();
    const mounted = mountHook(harness.gateway);
    await settle(mounted);
    await dragReferenceLine(mounted);

    const before = mounted.result.current.model.panel.reference.draft?.pixelLength ?? 0;

    await act(async () => {
      mounted.result.current.actions.onNudgeEndpoint('end', 'right', 'fine');
    });

    const afterFine = mounted.result.current.model.panel.reference.draft?.pixelLength ?? 0;

    await act(async () => {
      mounted.result.current.actions.onNudgeEndpoint('end', 'right', 'coarse');
    });

    const afterCoarse = mounted.result.current.model.panel.reference.draft?.pixelLength ?? 0;

    expect(afterFine - before).toBeCloseTo(1, 6);
    expect(afterCoarse - afterFine).toBeCloseTo(10, 6);
  });

  it('giữ Shift khoá đoạn theo trục', async () => {
    const harness = await makeHarness();
    const mounted = mountHook(harness.gateway);
    await settle(mounted);

    await act(async () => {
      mounted.result.current.actions.onStartDrag({ x: 0.2, y: 0.2 });
    });
    await act(async () => {
      mounted.result.current.actions.onMoveDrag({ x: 0.5, y: 0.22 }, { isAxisLocked: true });
    });

    const draft = mounted.result.current.model.panel.reference.draft;

    expect(draft?.isAxisLocked).toBe(true);
    expect(draft?.end.y).toBeCloseTo(draft?.start.y ?? 0, 6);
  });

  it('nêu đủ sáu dòng nhắc phím tắt, tổ hợp do `formatCombo` viết', async () => {
    const harness = await makeHarness();
    const mounted = mountHook(harness.gateway);
    await settle(mounted);

    const hints = mounted.result.current.model.panel.shortcutHints;

    expect(hints).toHaveLength(6);
    expect(hints.map((hint) => hint.comboLabel)).toContain(
      formatCombo(parseCombo('Shift+ArrowLeft')),
    );
    expect(hints.every((hint) => hint.description.length > 0)).toBe(true);
  });
});
